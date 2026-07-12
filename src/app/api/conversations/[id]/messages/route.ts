/**
 * PropertyPro - Messages API Routes
 * Handle CRUD operations for conversation messages
 */

import { NextRequest, NextResponse } from "next/server";
import { Message, Conversation } from "@/models";
import { Types } from "mongoose";
import { withPermissionAndDB } from "@/lib/api-utils";
import { publish } from "@/lib/realtime/bus";
import { sendPushToUsers } from "@/lib/push/send";

// GET /api/conversations/[id]/messages - Get messages for a conversation
export const GET = withPermissionAndDB("profile_management")(
  async (
    user: any,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id: conversationId } = await params;
      if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
        return NextResponse.json(
          { error: "Invalid conversation ID" },
          { status: 400 }
        );
      }
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "50");
      const skip = (page - 1) * limit;

      // Verify user has access to this conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      const activeParticipant = (conversation as any).getActiveParticipant?.(
        user.id
      );

      if (!activeParticipant) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      // Get messages with pagination
      const messages = await Message.find({ conversationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("senderId", "firstName lastName email avatar")
        .lean();

      // Get total count for pagination
      const total = await Message.countDocuments({ conversationId });

      return NextResponse.json({
        messages: messages.reverse(), // Reverse to show oldest first
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      console.error("Get messages error:", error);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }
  }
);

// POST /api/conversations/[id]/messages - Send a new message
export const POST = withPermissionAndDB("profile_management")(
  async (
    user: any,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id: conversationId } = await params;
      if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
        return NextResponse.json(
          { error: "Invalid conversation ID" },
          { status: 400 }
        );
      }
      const body = await request.json();
      const {
        content,
        messageType = "general",
        priority = "normal",
        attachments = [],
      } = body;

      // Validate input
      if (!content || content.trim().length === 0) {
        return NextResponse.json(
          { error: "Message content is required" },
          { status: 400 }
        );
      }

      // Verify user has access to this conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      if (!Types.ObjectId.isValid(user.id)) {
        return NextResponse.json(
          { error: "Invalid sender ID" },
          { status: 400 }
        );
      }

      const senderObjectId = new Types.ObjectId(user.id);

      const activeParticipant = (conversation as any).getActiveParticipant?.(
        user.id
      );

      if (!activeParticipant) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      // Create new message
      const message = new Message({
        conversationId: new Types.ObjectId(conversationId),
        senderId: senderObjectId,
        content: content.trim(),
        messageType,
        priority,
        attachments,
        status: "sent",
        isSystemMessage: false,
        isEdited: false,
      });

      await message.save();

      const now = new Date();
      const senderFullName =
        [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
        user.email ||
        "Unknown User";

      // Update conversation's last message and timestamp
      await Conversation.findByIdAndUpdate(
        conversationId,
        {
          $set: {
            lastMessage: {
              messageId: message._id,
              content: message.content,
              senderId: senderObjectId,
              senderName: senderFullName,
              createdAt: message.createdAt,
              messageType: message.messageType,
            },
            lastActivity: now,
            updatedAt: now,
            "metadata.lastActivity": now,
          },
          $inc: {
            "metadata.totalMessages": 1,
          },
        },
        { upsert: false }
      );

      // Populate sender information
      await message.populate("senderId", "firstName lastName email avatar");

      const messagePayload = {
        _id: message._id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: message.content,
        messageType: message.messageType,
        priority: message.priority,
        attachments: message.attachments,
        status: message.status,
        isSystemMessage: message.isSystemMessage,
        isEdited: message.isEdited,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      };

      // Publish realtime event to all conversation participants
      const participantIds: string[] = Array.isArray(
        (conversation as any).participants
      )
        ? ((conversation as any).participants as Array<{ userId: any }>)
            .map((p) => String(p?.userId ?? ""))
            .filter(Boolean)
        : [];

      publish({
        type: "message.created",
        conversationId: String(conversationId),
        participantIds,
        message: messagePayload,
      });

      // Fire web push to other participants (fire-and-forget)
      const recipientIds = participantIds.filter((id) => id !== user.id);
      if (recipientIds.length > 0) {
        void sendPushToUsers(recipientIds, {
          title: senderFullName,
          body: message.content.slice(0, 160),
          url: `/dashboard/messages?conversation=${conversationId}`,
          tag: `conversation-${conversationId}`,
        });
      }

      return NextResponse.json({ message: messagePayload }, { status: 201 });
    } catch (error) {
      console.error("Send message error:", error);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      );
    }
  }
);

// PUT /api/conversations/[id]/messages - Update message status (mark as read)
export const PUT = withPermissionAndDB("profile_management")(
  async (
    user: any,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id: conversationId } = await params;
      if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
        return NextResponse.json(
          { error: "Invalid conversation ID" },
          { status: 400 }
        );
      }
      const body = await request.json();
      const { action, messageIds } = body;

      // Verify user has access to this conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      const activeParticipant = (conversation as any).getActiveParticipant?.(
        user.id
      );

      if (!activeParticipant) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      if (action === "mark_as_read" && messageIds && Array.isArray(messageIds)) {
        // Mark messages as read
        if (!Types.ObjectId.isValid(user.id)) {
          return NextResponse.json(
            { error: "Invalid user ID" },
            { status: 400 }
          );
        }

        const validMessageIds = messageIds
          .filter((id: string) => Types.ObjectId.isValid(id))
          .map((id: string) => new Types.ObjectId(id));

        if (validMessageIds.length === 0) {
          return NextResponse.json(
            { error: "No valid message IDs provided" },
            { status: 400 }
          );
        }

        const userObjectId = new Types.ObjectId(user.id);
        const now = new Date();

        // Update messages to mark as read
        await Message.updateMany(
          {
            _id: { $in: validMessageIds },
            conversationId: new Types.ObjectId(conversationId),
            senderId: { $ne: userObjectId }, // Don't mark own messages as read
          },
          {
            $addToSet: {
              readBy: {
                userId: userObjectId,
                readAt: now,
              },
            },
            $set: {
              status: "read",
              readAt: now,
              updatedAt: now,
            },
          }
        );

        // Update the participant's lastReadAt in the conversation
        await Conversation.updateOne(
          {
            _id: new Types.ObjectId(conversationId),
            "participants.userId": userObjectId,
          },
          {
            $set: {
              "participants.$.lastReadAt": now,
            },
          }
        );

        return NextResponse.json({ success: true, action: "marked_as_read" });
      }

      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
      console.error("Update messages error:", error);
      return NextResponse.json(
        { error: "Failed to update messages" },
        { status: 500 }
      );
    }
  }
);

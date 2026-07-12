/**
 * PropertyPro - Individual Message API Routes
 * Handle operations on specific messages (edit, delete, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { Message, Conversation } from "@/models";
import {
  AuthenticatedAccessUser,
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";

// GET /api/conversations/[id]/messages/[messageId] - Get specific message
export const GET = withPermissionAndDB("profile_management")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string; messageId: string }> }
  ) => {
  try {
    const { id: conversationId, messageId } = await params;

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
      return createErrorResponse("Access denied", 403);
    }

    // Get the specific message
    const message = (await Message.findOne({
      _id: messageId,
      conversationId,
    }).populate("senderId", "firstName lastName email avatar")) as any;

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    return createSuccessResponse({ message });
  } catch (error) {
    return handleApiError(error);
  }
  }
);

// PUT /api/conversations/[id]/messages/[messageId] - Edit message
export const PUT = withPermissionAndDB("profile_management")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string; messageId: string }> }
  ) => {
  try {
    const { id: conversationId, messageId } = await params;
    const body = await request.json();
    const { content } = body;

    // Validate input
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

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
      return createErrorResponse("Access denied", 403);
    }

    // Find the message
    const message = (await Message.findOne({
      _id: messageId,
      conversationId,
    })) as any;

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Check if user is the sender
    if (message.senderId.toString() !== user.id) {
      return createErrorResponse("You can only edit your own messages", 403);
    }

    // Check if message is not too old (e.g., 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (message.createdAt < fifteenMinutesAgo) {
      return createErrorResponse("Message is too old to edit", 400);
    }

    // Update the message
    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();

    await message.save();
    await message.populate("senderId", "firstName lastName email avatar");

    return createSuccessResponse({ message });
  } catch (error) {
    return handleApiError(error);
  }
  }
);

// DELETE /api/conversations/[id]/messages/[messageId] - Delete message
export const DELETE = withPermissionAndDB("profile_management")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string; messageId: string }> }
  ) => {
  try {
    const { id: conversationId, messageId } = await params;

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
      return createErrorResponse("Access denied", 403);
    }

    // Find the message
    const message = (await Message.findOne({
      _id: messageId,
      conversationId,
    })) as any;

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Check if user is the sender or has conversation delete permissions
    const isOwner = message.senderId.toString() === user.id;
    const canDeleteMessages = (conversation as any).canParticipantDeleteMessages?.(
      user.id
    );

    if (!isOwner && !canDeleteMessages) {
      return NextResponse.json(
        { error: "You can only delete your own messages" },
        { status: 403 }
      );
    }

    // Soft delete - mark as deleted instead of removing
    message.deletedAt = new Date();
    message.deletedBy = user.id as any;

    await message.save();

    // If this was the last message in conversation, update conversation
    if (conversation.lastMessage?.messageId?.toString() === messageId) {
      // Find the previous message
      const previousMessage = await Message.findOne({
        conversationId,
        deletedAt: null,
        _id: { $ne: messageId },
      }).sort({ createdAt: -1 });

      if (previousMessage) {
        conversation.lastMessage = {
          messageId: previousMessage._id,
          content: previousMessage.content?.substring(0, 200) || "",
          senderId: previousMessage.senderId,
          senderName: previousMessage.senderName || "Unknown User",
          createdAt: previousMessage.createdAt,
          messageType: previousMessage.messageType || "general",
        };
      } else {
        conversation.lastMessage = undefined;
      }
      conversation.updatedAt = new Date();
      await conversation.save();
    }

    return createSuccessResponse(null, "Message deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
  }
);

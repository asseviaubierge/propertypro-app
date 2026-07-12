/**
 * PropertyPro - Messages API Routes
 * CRUD operations for tenant-property manager messaging
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Message, User, Property, Conversation, MessageStatus } from "@/models";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withAccessAndDB,
  parsePaginationParams,
  parseRequestBody,
} from "@/lib/api-utils";

// ============================================================================
// GET /api/messages - Get user's conversations or messages
// ============================================================================

export const GET = withAccessAndDB({})(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
) => {
  try {
    const { searchParams } = new URL(request.url);

    const conversationId = searchParams.get("conversationId");
    const type = searchParams.get("type") ?? "messages"; // "messages" or "search"
    const search = searchParams.get("search");
    const messageType = searchParams.get("messageType");
    const beforeDate = searchParams.get("beforeDate");
    const afterDate = searchParams.get("afterDate");

    if (type === "search" && search) {
      // Search messages
      const { page, limit } = parsePaginationParams(searchParams);

      const messages = await (Message as any).searchMessages(user.id, search, {
        conversationId: conversationId ?? undefined,
        messageType: messageType ?? undefined,
        limit,
      });

      return createSuccessResponse({
        messages,
        searchQuery: search,
        pagination: {
          page,
          limit,
          total: messages.length,
        },
      });
    } else if (conversationId) {
      // Get messages in a specific conversation
      const { page, limit } = parsePaginationParams(searchParams);

      // Validate conversation access
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return createErrorResponse("Conversation not found", 404);
      }

      const isParticipant = conversation.participants.some(
        (p: any) => p.userId.toString() === user.id && p.isActive,
      );
      if (!isParticipant) {
        return createErrorResponse("Access denied to this conversation", 403);
      }

      // Build query options
      const options: any = { page, limit };
      if (beforeDate) options.beforeDate = new Date(beforeDate);
      if (afterDate) options.afterDate = new Date(afterDate);
      if (messageType) options.messageType = messageType;

      const messages = await (Message as any).getConversationMessages(
        conversationId,
        options,
      );

      // Mark messages as delivered for the current user
      await MessageStatus.updateMany(
        {
          conversationId,
          recipientId: user.id,
          status: "sent",
        },
        {
          status: "delivered",
          deliveredAt: new Date(),
        },
      );

      // Update conversation read status
      await (conversation as any).markAsReadForUser(user.id);
      await conversation.save();

      return createSuccessResponse({
        messages,
        conversationId,
        pagination: {
          page,
          limit,
          total: await Message.countDocuments({
            conversationId,
            deletedAt: null,
          }),
        },
      });
    } else {
      return createErrorResponse("conversationId is required", 400);
    }
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// POST /api/messages - Send a new message
// ============================================================================

export const POST = withAccessAndDB({})(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
) => {
  try {
    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error ?? "Invalid request body", 400);
    }

    const {
      conversationId,
      content,
      messageType = "general",
      priority = "normal",
      attachments = [],
      replyToId,
      mentions = [],
    } = body;

    // Validate required fields
    if (!conversationId || !content) {
      return createErrorResponse(
        "Conversation ID and content are required",
        400,
      );
    }

    // Validate conversation exists and user is a participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return createErrorResponse("Conversation not found", 404);
    }

    const isParticipant = conversation.participants.some(
      (p: any) => p.userId.toString() === user.id && p.isActive,
    );
    if (!isParticipant) {
      return createErrorResponse(
        "You are not a participant in this conversation",
        403,
      );
    }

    // Validate reply-to message if provided
    if (replyToId) {
      const originalMessage = await Message.findById(replyToId);
      if (!originalMessage) {
        return createErrorResponse("Original message not found", 404);
      }

      // Ensure reply is in the same conversation
      if (originalMessage.conversationId.toString() !== conversationId) {
        return createErrorResponse(
          "Reply message must be in the same conversation",
          400,
        );
      }
    }

    // Validate mentions
    if (mentions && mentions.length > 0) {
      const mentionedUsers = await User.find({ _id: { $in: mentions } });
      if (mentionedUsers.length !== mentions.length) {
        return createErrorResponse(
          "One or more mentioned users not found",
          400,
        );
      }

      // Ensure mentioned users are participants in the conversation
      const participantIds = conversation.participants
        .filter((p: any) => p.isActive)
        .map((p: any) => p.userId.toString());

      const invalidMentions = mentions.filter(
        (id: string) => !participantIds.includes(id),
      );
      if (invalidMentions.length > 0) {
        return createErrorResponse(
          "Mentioned users must be participants in the conversation",
          400,
        );
      }
    }

    // Create the message
    const message = new Message({
      conversationId,
      senderId: user.id,
      content,
      messageType,
      priority,
      attachments,
      replyToId,
      mentions,
      metadata: {
        ipAddress: request.headers.get("x-forwarded-for") ?? "unknown",
        userAgent: request.headers.get("user-agent") ?? "unknown",
        platform: "web",
      },
    });

    await message.save();

    // Create message status for each participant (except sender)
    const participants = conversation.participants.filter(
      (p: any) => p.isActive && p.userId.toString() !== user.id,
    );

    for (const participant of participants) {
      await MessageStatus.create({
        messageId: message._id,
        conversationId,
        senderId: user.id,
        recipientId: participant.userId,
        status: "sent",
      });
    }

    // Populate the response
    await message.populate([
      { path: "senderId", select: "firstName lastName email avatar" },
      { path: "replyToId", select: "content senderId createdAt" },
      { path: "mentions", select: "firstName lastName email" },
    ]);

    // In a real implementation, you would send real-time notifications here
    // This would be handled by Socket.io in the actual implementation

    return createSuccessResponse(
      {
        message,
        conversation: {
          _id: conversation._id,
          name: conversation.name,
          type: conversation.type,
        },
      },
      "Message sent successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

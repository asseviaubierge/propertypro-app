/**
 * PropertyPro - Individual Conversation API Routes
 * CRUD operations for specific conversations
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Conversation, Message } from "@/models";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
  parseRequestBody,
  isValidObjectId,
} from "@/lib/api-utils";
import { z } from "zod";

// Validation schemas
const updateConversationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  settings: z
    .object({
      allowFileSharing: z.boolean().optional(),
      allowMemberInvites: z.boolean().optional(),
      muteNotifications: z.boolean().optional(),
      autoDeleteMessages: z.boolean().optional(),
      autoDeleteDays: z.number().min(1).max(365).optional(),
      requireApprovalForNewMembers: z.boolean().optional(),
    })
    .optional(),
  isArchived: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  tags: z.array(z.string()).max(10).optional(),
});

// ============================================================================
// GET /api/conversations/[id] - Get specific conversation details
// ============================================================================

export const GET = withPermissionAndDB("profile_management")(
  async (
    user: any,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id: conversationId } = await params;

      if (!isValidObjectId(conversationId)) {
        return createErrorResponse("Invalid conversation ID", 400);
      }

      const conversation = await Conversation.findById(conversationId)
        .populate("participants.userId", "firstName lastName email phone avatar role")
        .populate("propertyId", "name address")
        .populate("createdBy", "firstName lastName email");

      if (!conversation) {
        return createErrorResponse("Conversation not found", 404);
      }

      const activeParticipant = (conversation as any).getActiveParticipant?.(
        user.id
      );
      if (!activeParticipant) {
        return createErrorResponse("Access denied to this conversation", 403);
      }

      // Get unread count for this user
      const unreadCount = await (conversation as any).getUnreadCount?.(user.id) ?? 0;

      // Get recent messages count
      const recentMessagesCount = await Message.countDocuments({
        conversationId: conversation._id,
        deletedAt: null,
      });

      return createSuccessResponse({
        conversation: {
          ...(conversation.toObject ? conversation.toObject() : conversation),
          unreadCount,
          recentMessagesCount,
        },
      });
    } catch (error) {
      return handleApiError(error, "Failed to fetch conversation");
    }
  }
);

// ============================================================================
// PATCH /api/conversations/[id] - Update conversation
// ============================================================================

export const PATCH = withPermissionAndDB("profile_management")(
  async (
    user: any,
    request: NextRequest,
    { params }: { params: { id: string } }
  ) => {
    try {
      const conversationId = params.id;

      if (!isValidObjectId(conversationId)) {
        return createErrorResponse("Invalid conversation ID", 400);
      }

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      // Validate request body
      const validation = updateConversationSchema.safeParse(body);
      if (!validation.success) {
        return createErrorResponse(
          `Validation error: ${validation.error.errors
            .map((e) => e.message)
            .join(", ")}`,
          400
        );
      }

      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        return createErrorResponse("Conversation not found", 404);
      }

      const activeParticipant = (conversation as any).getActiveParticipant?.(
        user.id
      );
      if (!activeParticipant) {
        return createErrorResponse("Access denied to this conversation", 403);
      }

      // Check permissions for certain updates
      const { name, description, settings, isArchived, isPinned, tags } =
        validation.data;

      if (name || description || settings) {
        if (!(conversation as any).canParticipantEditConversation?.(user.id)) {
          return createErrorResponse(
            "Insufficient permissions to edit conversation",
            403
          );
        }
      }

      // Update conversation
      const updates: any = {};

      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (settings !== undefined) {
        updates.settings = { ...conversation.settings, ...settings };
      }
      if (isArchived !== undefined) updates.isArchived = isArchived;
      if (isPinned !== undefined) updates.isPinned = isPinned;
      if (tags !== undefined) updates.tags = tags;

      const updatedConversation = await Conversation.findByIdAndUpdate(
        conversationId,
        updates,
        { new: true, runValidators: true }
      ).populate([
        {
          path: "participants.userId",
          select: "firstName lastName email phone avatar role",
        },
        { path: "propertyId", select: "name address" },
        { path: "createdBy", select: "firstName lastName email" },
      ]);

      return createSuccessResponse(
        { conversation: updatedConversation },
        "Conversation updated successfully"
      );
    } catch (error) {
      return handleApiError(error, "Failed to update conversation");
    }
  }
);

// ============================================================================
// DELETE /api/conversations/[id] - Delete/Leave conversation
// ============================================================================

export const DELETE = withPermissionAndDB("profile_management")(
  async (
    user: any,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id: conversationId } = await params;

      if (!isValidObjectId(conversationId)) {
        return createErrorResponse("Invalid conversation ID", 400);
      }

      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        return createErrorResponse("Conversation not found", 404);
      }

      const activeParticipant = (conversation as any).getActiveParticipant?.(
        user.id
      );
      if (!activeParticipant) {
        return createErrorResponse("Access denied to this conversation", 403);
      }

      const { searchParams } = new URL(request.url);
      const action = searchParams.get("action") || "leave"; // "leave" or "delete"

      if (action === "delete") {
        if (!(conversation as any).canParticipantDeleteConversation?.(user.id)) {
          return createErrorResponse(
            "Insufficient permissions to delete conversation",
            403
          );
        }

        // Soft delete the conversation
        conversation.deletedAt = new Date();
        await conversation.save();

        return createSuccessResponse(null, "Conversation deleted successfully");
      } else {
        // Leave conversation (remove user as participant)
        if (conversation.type === "individual") {
          return createErrorResponse(
            "Cannot leave individual conversations",
            400
          );
        }

        // Remove user from participants
        await (conversation as any).removeParticipant?.(user.id);
        await conversation.save();

        // If no active participants left, soft delete the conversation
        if (((conversation as any).activeParticipantsCount ?? 0) === 0) {
          conversation.deletedAt = new Date();
          await conversation.save();
        }

        return createSuccessResponse(null, "Left conversation successfully");
      }
    } catch (error) {
      return handleApiError(error, "Failed to process conversation deletion");
    }
  }
);

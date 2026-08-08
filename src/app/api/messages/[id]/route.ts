/**
 * PropertyPro - Individual Message API Routes
 * Operations for individual messages
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Message } from "@/models";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withAccessAndDB,
  parseRequestBody,
  isValidObjectId,
} from "@/lib/api-utils";

// ============================================================================
// GET /api/messages/[id] - Get a specific message
// ============================================================================

export const GET = withAccessAndDB({})(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid message ID", 400);
      }

      // Find the message
      const message = (await Message.findById(id)
        .populate("senderId", "firstName lastName email")
        .populate("recipientId", "firstName lastName email")
        .populate("propertyId", "name address")
        .populate("replyToId", "subject content senderId")) as any;

      if (!message) {
        return createErrorResponse("Message not found", 404);
      }

      // Check permissions - user must be sender or recipient
      const canAccess =
        String(message.senderId._id) === user.id ||
        String(message.recipientId._id) === user.id ||
        user.isAdmin;

      if (!canAccess) {
        return createErrorResponse("Access denied", 403);
      }

      // Mark as read if user is the recipient
      if (
        String(message.recipientId._id) === user.id &&
        message.status !== "read"
      ) {
        await (message as any).markAsRead?.();
      }

      return createSuccessResponse({ message });
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PUT /api/messages/[id] - Update message status
// ============================================================================

export const PUT = withAccessAndDB({})(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid message ID", 400);
      }

      const { success, data: body } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse("Invalid request body", 400);
      }

      const { action } = body;

      // Find the message
      const message = (await Message.findById(id)) as any;
      if (!message) {
        return createErrorResponse("Message not found", 404);
      }

      // Check permissions
      const canUpdate =
        message.senderId.toString() === user.id ||
        message.recipientId.toString() === user.id ||
        user.isAdmin;

      if (!canUpdate) {
        return createErrorResponse("Access denied", 403);
      }

      // Handle different actions
      switch (action) {
        case "mark_read":
          if (message.recipientId.toString() === user.id) {
            await (message as any).markAsRead?.();
          } else {
            return createErrorResponse(
              "Only recipient can mark message as read",
              403
            );
          }
          break;

        case "mark_delivered":
          if (message.recipientId.toString() === user.id) {
            await (message as any).markAsDelivered?.();
          } else {
            return createErrorResponse(
              "Only recipient can mark message as delivered",
              403
            );
          }
          break;

        default:
          return createErrorResponse("Invalid action", 400);
      }

      // Populate and return updated message
      await message.populate([
        { path: "senderId", select: "firstName lastName email" },
        { path: "recipientId", select: "firstName lastName email" },
        { path: "propertyId", select: "name address" },
      ]);

      return createSuccessResponse(
        { message },
        `Message ${action.replace("_", " ")} successfully`
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// DELETE /api/messages/[id] - Delete a message (soft delete)
// ============================================================================

export const DELETE = withAccessAndDB({})(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid message ID", 400);
      }

      // Find the message
      const message = (await Message.findById(id)) as any;
      if (!message) {
        return createErrorResponse("Message not found", 404);
      }

      // Check permissions - only sender can delete their own messages
      const canDelete =
        message.senderId.toString() === user.id || user.isAdmin;

      if (!canDelete) {
        return createErrorResponse(
          "Only the sender can delete this message",
          403
        );
      }

      // Soft delete
      message.deletedAt = new Date();
      await message.save();

      return createSuccessResponse(null, "Message deleted successfully");
    } catch (error) {
      return handleApiError(error);
    }
  }
);

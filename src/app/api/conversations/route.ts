/**
 * PropertyPro - Conversations API Routes
 * CRUD operations for conversation management
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Conversation, User, Property } from "@/models";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
  parsePaginationParams,
  parseRequestBody,
  isValidObjectId,
} from "@/lib/api-utils";
import { z } from "zod";

const CONVERSATION_ADMIN_ROLE = "admin" as const;
const CONVERSATION_MEMBER_ROLE = "member" as const;
const ADMIN_PARTICIPANT_PERMISSIONS = {
  canAddMembers: true,
  canRemoveMembers: true,
  canEditConversation: true,
  canDeleteMessages: true,
} as const;
const MEMBER_PARTICIPANT_PERMISSIONS = {
  canAddMembers: false,
  canRemoveMembers: false,
  canEditConversation: false,
  canDeleteMessages: false,
} as const;

// Validation schemas
const createConversationSchema = z.object({
  type: z.enum(["individual", "group", "announcement"]),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  participants: z.array(z.string()).min(1),
  propertyId: z.string().optional(),
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
});

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

const addParticipantSchema = z.object({
  userId: z.string(),
  role: z
    .enum([CONVERSATION_ADMIN_ROLE, CONVERSATION_MEMBER_ROLE])
    .optional(),
  permissions: z
    .object({
      canAddMembers: z.boolean().optional(),
      canRemoveMembers: z.boolean().optional(),
      canEditConversation: z.boolean().optional(),
      canDeleteMessages: z.boolean().optional(),
    })
    .optional(),
});

// ============================================================================
// GET /api/conversations - Get user's conversations
// ============================================================================

export const GET = withPermissionAndDB("profile_management")(async (user, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);

    const { page = 1, limit = 10 } = parsePaginationParams(searchParams);

    const includeArchived = searchParams.get("includeArchived") === "true";
    const propertyId = searchParams.get("propertyId");
    const type = searchParams.get("type");
    const search = searchParams.get("search");

    // Build query options
    const options: any = {
      includeArchived,
      limit,
      skip: (page - 1) * limit,
    };

    if (propertyId && isValidObjectId(propertyId)) {
      options.propertyId = propertyId;
    }

    // Get conversations - using direct query for now
    let conversations;
    try {
      // Simple query to get conversations where user is a participant
      conversations = await Conversation.find({
        "participants.userId": user.id,
        "participants.isActive": true,
        deletedAt: null,
        ...(includeArchived ? {} : { isArchived: false }),
        ...(propertyId && isValidObjectId(propertyId) ? { propertyId } : {}),
      })
        .populate("participants.userId", "firstName lastName email avatar")
        .populate("propertyId", "name address")
        .populate("createdBy", "firstName lastName email")
        .sort({ isPinned: -1, "lastMessage.createdAt": -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
    } catch (error) {
      console.error("Error querying conversations:", error);
      throw error;
    }

    // Apply additional filters
    if (type) {
      conversations = conversations.filter((conv: any) => conv.type === type);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      conversations = conversations.filter((conv: any) => {
        return (
          conv.name?.toLowerCase().includes(searchLower) ||
          conv.description?.toLowerCase().includes(searchLower) ||
          conv.participants.some((p: any) =>
            `${p.userId.firstName} ${p.userId.lastName}`
              .toLowerCase()
              .includes(searchLower)
          )
        );
      });
    }

    // Calculate unread counts for each conversation using direct Message query
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conversation: any) => {
        try {
          // Direct query to count unread messages for this user in this conversation
          const { Message } = require("@/models");
          const unreadCount = await Message.countDocuments({
            conversationId: conversation._id,
            senderId: { $ne: user.id }, // Don't count own messages
            $and: [
              { status: { $ne: "read" } }, // Message not marked as read globally
              {
                readBy: {
                  $not: {
                    $elemMatch: { userId: user.id },
                  },
                },
              }, // User hasn't read this message specifically
            ],
          });

          return {
            ...conversation.toObject(),
            unreadCount,
          };
        } catch (error) {
          console.error(
            "Error calculating unread count for conversation:",
            conversation._id,
            error
          );
          // Fallback to simple logic
          const participant = conversation.participants.find(
            (p: any) => p.userId.toString() === user.id
          );
          let fallbackCount = 0;
          if (
            participant &&
            participant.lastReadAt &&
            conversation.lastMessage
          ) {
            fallbackCount =
              conversation.lastMessage.createdAt > participant.lastReadAt
                ? 1
                : 0;
          } else {
            fallbackCount = conversation.metadata?.totalMessages || 0;
          }

          return {
            ...conversation.toObject(),
            unreadCount: fallbackCount,
          };
        }
      })
    );

    // Get total count for pagination
    const totalCount = await Conversation.countDocuments({
      "participants.userId": user.id,
      "participants.isActive": true,
      deletedAt: null,
      ...(includeArchived ? {} : { isArchived: false }),
      ...(propertyId && isValidObjectId(propertyId) ? { propertyId } : {}),
    });

    const responseData = {
      conversations: conversationsWithUnread,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
      totalUnread: conversationsWithUnread.reduce(
        (sum: number, conv: any) => sum + (conv.unreadCount || 0),
        0
      ),
    };

    return createSuccessResponse(responseData);
  } catch (error) {
    console.error("API Error in GET /api/conversations:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// POST /api/conversations - Create a new conversation
// ============================================================================

export const POST = withPermissionAndDB("profile_management")(async (user, request: NextRequest) => {
  try {
    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error!, 400);
    }

    // Validate request body
    const validation = createConversationSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        `Validation error: ${validation.error.errors
          .map((e) => e.message)
          .join(", ")}`,
        400
      );
    }

    const { type, name, description, participants, propertyId, settings } =
      validation.data;

    // Validate participants exist
    const participantUsers = await User.find({
      _id: { $in: participants },
      isActive: true,
    });

    if (participantUsers.length !== participants.length) {
      return createErrorResponse(
        "One or more participants not found or inactive",
        400
      );
    }

    // Validate property if provided
    if (propertyId) {
      if (!isValidObjectId(propertyId)) {
        return createErrorResponse("Invalid property ID", 400);
      }

      const property = await Property.findById(propertyId);
      if (!property) {
        return createErrorResponse("Property not found", 404);
      }
    }

    let conversation;

    if (type === "individual") {
      if (participants.length !== 1) {
        return createErrorResponse(
          "Individual conversations require exactly one other participant",
          400
        );
      }

      // Check if conversation already exists
      conversation = await Conversation.findOrCreateIndividualConversation(
        user.id,
        participants[0],
        propertyId
      );

      if (!conversation.isNew) {
        // Conversation already exists, return it
        await conversation.populate(
          "participants.userId",
          "firstName lastName email avatar"
        );
        return createSuccessResponse(
          { conversation },
          "Conversation already exists",
          200
        );
      }
    } else {
      // Group or announcement conversation
      if (!name) {
        return createErrorResponse(`${type} conversations require a name`, 400);
      }

      conversation = new Conversation({
        type,
        name,
        description,
        participants: [
          {
            userId: user.id,
            role: CONVERSATION_ADMIN_ROLE,
            joinedAt: new Date(),
            isActive: true,
            permissions: { ...ADMIN_PARTICIPANT_PERMISSIONS },
          },
          ...participants.map((participantId: string) => ({
            userId: participantId,
            role: CONVERSATION_MEMBER_ROLE,
            joinedAt: new Date(),
            isActive: true,
            permissions: { ...MEMBER_PARTICIPANT_PERMISSIONS },
          })),
        ],
        createdBy: user.id,
        propertyId,
        settings: settings || {},
      });

      await conversation.save();
    }

    // Populate conversation for response
    await conversation.populate([
      {
        path: "participants.userId",
        select: "firstName lastName email avatar",
      },
      { path: "propertyId", select: "name address" },
      { path: "createdBy", select: "firstName lastName email" },
    ]);

    return createSuccessResponse(
      { conversation },
      "Conversation created successfully",
      201
    );
  } catch (error) {
    return handleApiError(error, "Failed to create conversation");
  }
});

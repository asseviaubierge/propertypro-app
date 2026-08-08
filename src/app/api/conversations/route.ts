import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { Conversation, Message, User, Lease } from "@/models";
import {
  createErrorResponse,
  createSuccessResponse,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { resolveAccessProfile } from "@/lib/server-permissions";
import { canAccessProperty } from "@/lib/property-scope";
import { validateConversationParticipants } from "@/lib/messaging-access";

const participantSelect = "firstName lastName email phone avatar role isActive";

export const GET = withPermissionAndDB("profile_management")(
  async (user, request: NextRequest, context?: { tenantProfile?: any }) => {
    const access = await resolveAccessProfile(user.role);
    const params = new URL(request.url).searchParams;
    const includeArchived = params.get("includeArchived") === "true";
    const propertyId = params.get("propertyId");
    const type = params.get("type");
    const search = params.get("search")?.trim();

    const query: Record<string, any> = { deletedAt: null };
    if (!access.isAdmin) {
      query.participants = { $elemMatch: { userId: user.id, isActive: true } };
    }
    if (!includeArchived) query.isArchived = false;
    if (type && ["individual", "group", "announcement"].includes(type)) query.type = type;
    if (propertyId) {
      if (!Types.ObjectId.isValid(propertyId)) return createErrorResponse("Identifiant de bien invalide", 400);
      if (!access.isAdmin) {
        const allowed = access.isTenant
          ? Boolean(await Lease.exists({
              tenantId: { $in: [String(user.id), context?.tenantProfile?._id].filter(Boolean) },
              propertyId,
              deletedAt: null,
            }))
          : await canAccessProperty({ ...access, id: String(user.id) }, propertyId);
        if (!allowed) return createErrorResponse("Accès refusé à ce bien", 403);
      }
      query.propertyId = propertyId;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { "lastMessage.content": { $regex: search, $options: "i" } },
      ];
    }

    const conversations = await Conversation.find(query)
      .populate("participants.userId", participantSelect)
      .sort({ isPinned: -1, "metadata.lastActivity": -1, updatedAt: -1 })
      .lean();

    const userObjectId = new Types.ObjectId(String(user.id));
    const result = await Promise.all(
      conversations.map(async (conversation: any) => {
        const unreadCount = await Message.countDocuments({
          conversationId: conversation._id,
          senderId: { $ne: userObjectId },
          deletedAt: null,
          readBy: { $not: { $elemMatch: { userId: userObjectId } } },
        });
        return { ...conversation, unreadCount };
      })
    );

    return createSuccessResponse({
      conversations: result,
      totalUnread: result.reduce((sum, item) => sum + (item.unreadCount || 0), 0),
    });
  }
);

export const POST = withPermissionAndDB("profile_management")(
  async (user, request: NextRequest, context?: { tenantProfile?: any }) => {
    const access = await resolveAccessProfile(user.role);
    const body = await request.json().catch(() => null);
    if (!body || !["individual", "group"].includes(body.type)) {
      return createErrorResponse("Type de conversation invalide", 400);
    }

    const requested = Array.isArray(body.participants) ? body.participants.map(String) : [];
    const participants = [...new Set([String(user.id), ...requested])];
    if (body.type === "individual" && participants.length !== 2) {
      return createErrorResponse("Une conversation individuelle doit avoir exactement deux participants", 400);
    }
    if (body.type === "group" && participants.length < 2) {
      return createErrorResponse("Ajoutez au moins un participant", 400);
    }
    if (!(await validateConversationParticipants({ ...access, id: String(user.id) }, participants))) {
      return createErrorResponse("Un ou plusieurs participants sont hors de votre périmètre", 403);
    }

    if (body.propertyId) {
      if (!Types.ObjectId.isValid(String(body.propertyId))) return createErrorResponse("Identifiant de bien invalide", 400);
      if (!access.isAdmin) {
        const allowed = access.isTenant
          ? Boolean(await Lease.exists({
              tenantId: { $in: [String(user.id), context?.tenantProfile?._id].filter(Boolean) },
              propertyId: body.propertyId,
              deletedAt: null,
            }))
          : await canAccessProperty({ ...access, id: String(user.id) }, body.propertyId);
        if (!allowed) return createErrorResponse("Accès refusé à ce bien", 403);
      }
    }

    const activeUsers = await User.countDocuments({
      _id: { $in: participants }, isActive: true, deletedAt: null,
    });
    if (activeUsers !== participants.length) return createErrorResponse("Participant introuvable ou inactif", 400);

    if (body.type === "individual") {
      const existing = await Conversation.findOne({
        type: "individual",
        deletedAt: null,
        "participants.userId": { $all: participants },
        participants: { $size: 2 },
      }).populate("participants.userId", participantSelect);
      if (existing) return createSuccessResponse({ conversation: existing }, "Conversation existante");
    }

    const conversation = await Conversation.create({
      type: body.type,
      name: body.type === "group" ? String(body.name || "Nouvelle conversation").trim().slice(0, 100) : undefined,
      description: body.description ? String(body.description).trim().slice(0, 500) : undefined,
      propertyId: body.propertyId || undefined,
      createdBy: user.id,
      participants: participants.map((participantId) => ({
        userId: participantId,
        role: participantId === String(user.id) ? "admin" : "member",
        joinedAt: new Date(),
        isActive: true,
        permissions: participantId === String(user.id)
          ? { canAddMembers: true, canRemoveMembers: true, canEditConversation: true, canDeleteMessages: true }
          : { canAddMembers: false, canRemoveMembers: false, canEditConversation: false, canDeleteMessages: false },
      })),
      settings: {
        allowFileSharing: true,
        allowMemberInvites: true,
        muteNotifications: false,
        autoDeleteMessages: false,
        requireApprovalForNewMembers: false,
      },
      metadata: { totalMessages: 0, totalParticipants: participants.length, lastActivity: new Date() },
      isArchived: false,
      isPinned: false,
      tags: [],
    });

    await conversation.populate("participants.userId", participantSelect);
    return createSuccessResponse({ conversation }, "Conversation créée");
  }
);

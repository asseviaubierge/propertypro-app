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

    const requested = Array.isArray(body.participants)
      ? body.participants.map(String).filter(Boolean)
      : [];
    const participants = [...new Set([String(user.id), ...requested])];

    if (body.type === "individual" && participants.length !== 2) {
      return createErrorResponse(
        "Une conversation individuelle doit avoir exactement deux participants",
        400
      );
    }
    if (body.type === "group" && participants.length < 2) {
      return createErrorResponse("Ajoutez au moins un participant", 400);
    }

    if (
      !(await validateConversationParticipants(
        { ...access, id: String(user.id) },
        participants
      ))
    ) {
      return createErrorResponse(
        "Vous ne pouvez communiquer qu’avec les contacts autorisés de votre espace E-IMMO.",
        403
      );
    }

    const participantObjectIds = participants.map(
      (participantId) => new Types.ObjectId(participantId)
    );

    // Sécurité supplémentaire : seuls Super Admin, Gestionnaires et Locataires
    // peuvent participer à la messagerie E-IMMO.
    const activeUsers = await User.find({
      _id: { $in: participantObjectIds },
      role: { $in: ["admin", "super_admin", "manager", "tenant"] },
      isActive: true,
      deletedAt: null,
    })
      .select("_id role")
      .lean();

    if (activeUsers.length !== participants.length) {
      return createErrorResponse(
        "Un participant n’est pas autorisé à utiliser cette conversation.",
        400
      );
    }

    let propertyObjectId: Types.ObjectId | undefined;
    if (body.propertyId) {
      if (!Types.ObjectId.isValid(String(body.propertyId))) {
        return createErrorResponse("Identifiant de bien invalide", 400);
      }
      if (!access.isAdmin) {
        const allowed = access.isTenant
          ? Boolean(
              await Lease.exists({
                tenantId: {
                  $in: [String(user.id), context?.tenantProfile?._id].filter(Boolean),
                },
                propertyId: body.propertyId,
                deletedAt: null,
              })
            )
          : await canAccessProperty(
              { ...access, id: String(user.id) },
              body.propertyId
            );
        if (!allowed) {
          return createErrorResponse("Accès refusé à ce bien", 403);
        }
      }
      propertyObjectId = new Types.ObjectId(String(body.propertyId));
    }

    if (body.type === "individual") {
      // Utilisation de la collection brute pour éviter les conversions récursives
      // Mongoose observées lors de la création sur certaines données historiques.
      const existing = await Conversation.collection.findOne({
        type: "individual",
        deletedAt: null,
        "participants.userId": { $all: participantObjectIds },
        participants: { $size: 2 },
      } as any);

      if (existing) {
        return createSuccessResponse(
          {
            conversation: {
              _id: String(existing._id),
              id: String(existing._id),
              type: existing.type,
              name: existing.name,
            },
          },
          "Conversation existante"
        );
      }
    }

    const now = new Date();
    const creatorId = new Types.ObjectId(String(user.id));
    const document = {
      type: body.type,
      name:
        body.type === "group"
          ? String(body.name || "Nouvelle conversation").trim().slice(0, 100)
          : undefined,
      description: body.description
        ? String(body.description).trim().slice(0, 500)
        : undefined,
      propertyId: propertyObjectId,
      createdBy: creatorId,
      participants: participantObjectIds.map((participantId) => ({
        userId: participantId,
        role:
          participantId.toString() === creatorId.toString() ? "admin" : "member",
        joinedAt: now,
        isActive: true,
        permissions:
          participantId.toString() === creatorId.toString()
            ? {
                canAddMembers: true,
                canRemoveMembers: true,
                canEditConversation: true,
                canDeleteMessages: true,
              }
            : {
                canAddMembers: false,
                canRemoveMembers: false,
                canEditConversation: false,
                canDeleteMessages: false,
              },
      })),
      settings: {
        allowFileSharing: true,
        allowMemberInvites: true,
        muteNotifications: false,
        autoDeleteMessages: false,
        requireApprovalForNewMembers: false,
      },
      metadata: {
        totalMessages: 0,
        totalParticipants: participants.length,
        lastActivity: now,
      },
      isArchived: false,
      isPinned: false,
      tags: [],
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const inserted = await Conversation.collection.insertOne(document as any);
    const conversationId = String(inserted.insertedId);

    // Réponse volontairement minimale et sérialisable. La liste est rechargée
    // juste après par le client avec l'API GET normale.
    return createSuccessResponse(
      {
        conversation: {
          _id: conversationId,
          id: conversationId,
          type: body.type,
          name: document.name,
        },
      },
      "Conversation créée"
    );
  }
);

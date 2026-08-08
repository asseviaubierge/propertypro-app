import { Types } from "mongoose";
import { Conversation, Lease, User } from "@/models";
import { getScopedPropertyIds, type ScopeUser } from "@/lib/property-scope";

function id(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "_id" in value) {
    return id((value as { _id?: unknown })._id);
  }
  return String(value);
}

export async function canAccessConversation(
  user: ScopeUser,
  conversationId: string | Types.ObjectId
): Promise<boolean> {
  if (!user?.id || !Types.ObjectId.isValid(String(conversationId))) return false;
  if (user.isAdmin) return Boolean(await Conversation.exists({ _id: conversationId, deletedAt: null }));
  return Boolean(
    await Conversation.exists({
      _id: conversationId,
      deletedAt: null,
      participants: { $elemMatch: { userId: user.id, isActive: true } },
    })
  );
}

export async function getAllowedMessagingUserIds(user: ScopeUser): Promise<string[] | null> {
  if (!user?.id) return [];
  if (user.isAdmin) return null;

  const allowed = new Set<string>([String(user.id)]);
  const admins = await User.find({ role: "admin", isActive: true, deletedAt: null }).select("_id").lean();
  admins.forEach((entry: any) => allowed.add(id(entry._id)));

  if (user.isTenant) {
    const leases = await Lease.find({ tenantId: user.id, deletedAt: null }).select("propertyId").lean();
    const propertyIds = leases.map((lease: any) => lease.propertyId).filter(Boolean);
    if (propertyIds.length) {
      const { Property } = await import("@/models");
      const properties = await Property.find({ _id: { $in: propertyIds }, deletedAt: null })
        .select("ownerId managerId")
        .lean();
      properties.forEach((property: any) => {
        if (property.ownerId) allowed.add(id(property.ownerId));
        if (property.managerId) allowed.add(id(property.managerId));
      });
    }
    return [...allowed].filter(Boolean);
  }

  const scopedPropertyIds = await getScopedPropertyIds(user);
  if (!scopedPropertyIds?.length) return [...allowed].filter(Boolean);

  const tenantIds = await Lease.distinct("tenantId", {
    propertyId: { $in: scopedPropertyIds },
    deletedAt: null,
  });
  tenantIds.forEach((tenantId: unknown) => allowed.add(id(tenantId)));

  return [...allowed].filter(Boolean);
}

export async function validateConversationParticipants(
  user: ScopeUser,
  participantIds: string[]
): Promise<boolean> {
  const unique = [...new Set(participantIds.map(String).filter(Boolean))];
  if (!unique.length || unique.some((value) => !Types.ObjectId.isValid(value))) return false;
  const allowed = await getAllowedMessagingUserIds(user);
  if (allowed === null) return true;
  const allowedSet = new Set(allowed);
  return unique.every((participantId) => allowedSet.has(participantId));
}

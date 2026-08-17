import { Types } from "mongoose";
import { Conversation, Lease, Property, Tenant, User } from "@/models";
import type { ScopeUser } from "@/lib/property-scope";
import { getScopedTenantIds } from "@/lib/tenant-scope";

const MESSAGING_ROLES = ["admin", "super_admin", "manager", "tenant"] as const;

function stringId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  // Les ObjectId Mongoose exposent eux-mêmes une propriété `_id`. Il faut
  // donc les convertir avant de traiter les documents peuplés, sinon la
  // lecture de certains baux d'un gestionnaire boucle jusqu'à provoquer
  // « Maximum call stack size exceeded ».
  if (
    typeof value === "object" &&
    value &&
    "toHexString" in value &&
    typeof (value as { toHexString?: unknown }).toHexString === "function"
  ) {
    return (value as { toHexString: () => string }).toHexString();
  }
  if (typeof value === "object" && value && "_id" in value) {
    return stringId((value as { _id?: unknown })._id);
  }
  return String(value);
}

function validObjectIds(values: Iterable<unknown>): Types.ObjectId[] {
  return [...values]
    .map(stringId)
    .filter((value) => Types.ObjectId.isValid(value))
    .map((value) => new Types.ObjectId(value));
}

async function addSuperAdmins(target: Set<string>) {
  const admins = await User.find({
    role: { $in: ["admin", "super_admin"] },
    isActive: true,
    deletedAt: null,
  })
    .select("_id")
    .lean();

  admins.forEach((entry: any) => target.add(String(entry._id)));
}

export async function canAccessConversation(
  user: ScopeUser,
  conversationId: string | Types.ObjectId
): Promise<boolean> {
  if (!user?.id || !Types.ObjectId.isValid(String(conversationId))) return false;
  if (user.isAdmin) {
    return Boolean(await Conversation.exists({ _id: conversationId, deletedAt: null }));
  }
  return Boolean(
    await Conversation.exists({
      _id: conversationId,
      deletedAt: null,
      participants: { $elemMatch: { userId: user.id, isActive: true } },
    })
  );
}

/**
 * Messagerie E-IMMO :
 * - Super Admin : Gestionnaires + Locataires (+ autres Super Admin).
 * - Gestionnaire : Super Admin + locataires de son portefeuille.
 * - Locataire : Super Admin + gestionnaire(s) des biens liés à ses baux.
 * Aucun autre type de compte n'est autorisé dans les conversations.
 */
export async function getAllowedMessagingUserIds(user: ScopeUser): Promise<string[]> {
  if (!user?.id || !Types.ObjectId.isValid(String(user.id))) return [];

  const allowed = new Set<string>([String(user.id)]);
  await addSuperAdmins(allowed);

  if (user.isAdmin) {
    const users = await User.find({
      role: { $in: [...MESSAGING_ROLES] },
      isActive: true,
      deletedAt: null,
    })
      .select("_id")
      .lean();
    users.forEach((entry: any) => allowed.add(String(entry._id)));
    return [...allowed];
  }

  if (user.isTenant) {
    const tenantProfile = await Tenant.findOne({
      userId: user.id,
      deletedAt: null,
    })
      .select("_id")
      .lean();

    const tenantIdentifiers = [String(user.id), tenantProfile?._id]
      .filter(Boolean)
      .map(String);

    const leases = await Lease.find({
      tenantId: { $in: tenantIdentifiers },
      deletedAt: null,
    })
      .select("propertyId")
      .lean();

    const propertyIds = leases.map((lease: any) => lease.propertyId).filter(Boolean);
    if (propertyIds.length) {
      const properties = await Property.find({
        _id: { $in: propertyIds },
        deletedAt: null,
      })
        .select("ownerId managerId")
        .lean();

      const managerCandidateIds = new Set<string>();
      properties.forEach((property: any) => {
        if (property.managerId) managerCandidateIds.add(String(property.managerId));
        if (property.ownerId) managerCandidateIds.add(String(property.ownerId));
      });

      const managers = await User.find({
        _id: { $in: validObjectIds(managerCandidateIds) },
        role: "manager",
        isActive: true,
        deletedAt: null,
      })
        .select("_id")
        .lean();
      managers.forEach((entry: any) => allowed.add(String(entry._id)));
    }

    return [...allowed];
  }

  if (user.isManager) {
    // Réutilise le même périmètre que les pages Locataires : comptes créés
    // par ce gestionnaire + locataires liés aux baux de ses propriétés.
    // Cela couvre aussi les locataires historiques dont le bail stocke l'ID
    // du profil Tenant au lieu de l'ID User.
    const scopedTenantIds = await getScopedTenantIds(user);
    const tenantObjectIds = validObjectIds(scopedTenantIds ?? []);
    if (!tenantObjectIds.length) return [...allowed];

    // Certaines données historiques stockent l'ID du profil Tenant dans le bail,
    // d'autres l'ID du User. On prend en charge les deux formats.
    const profiles = await Tenant.find({
      _id: { $in: tenantObjectIds },
      deletedAt: null,
    })
      .select("userId")
      .lean();

    const userCandidates = new Set<string>(tenantObjectIds.map(String));
    profiles.forEach((profile: any) => {
      if (profile.userId) userCandidates.add(String(profile.userId));
    });

    const tenants = await User.find({
      _id: { $in: validObjectIds(userCandidates) },
      role: "tenant",
      isActive: true,
      deletedAt: null,
    })
      .select("_id")
      .lean();
    tenants.forEach((entry: any) => allowed.add(String(entry._id)));

    return [...allowed];
  }

  return [];
}

export async function validateConversationParticipants(
  user: ScopeUser,
  participantIds: string[]
): Promise<boolean> {
  const unique = [...new Set(participantIds.map(String).filter(Boolean))];
  if (!unique.length || unique.some((value) => !Types.ObjectId.isValid(value))) {
    return false;
  }

  const allowed = new Set(await getAllowedMessagingUserIds(user));
  return unique.every((participantId) => allowed.has(participantId));
}

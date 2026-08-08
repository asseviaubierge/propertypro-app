import { Types } from "mongoose";
import { Property } from "@/models";

export interface ScopeUser {
  id: string;
  isAdmin?: boolean;
  isManager?: boolean;
  isTenant?: boolean;
  originalRole?: string;
  normalizedRole?: string;
  role?: string;
}

const OWNER_ROLE_ALIASES = new Set([
  "owner",
  "property owner",
  "property_owner",
  "landlord",
]);

function normalizedOriginalRole(user: ScopeUser): string {
  return String(
    user.originalRole ?? user.normalizedRole ?? user.role ?? ""
  ).trim().toLowerCase();
}

function isOwnerProfile(user: ScopeUser): boolean {
  return OWNER_ROLE_ALIASES.has(normalizedOriginalRole(user));
}

function denyAllQuery(query: Record<string, any> = {}) {
  return { ...query, _id: { $in: [] } };
}

export async function getScopedPropertyIds(
  user: ScopeUser | null | undefined
): Promise<Types.ObjectId[] | null> {
  if (!user?.id) return [];

  // Administrators keep global access.
  if (user.isAdmin) return null;

  const filter: Record<string, any> = { deletedAt: null };

  // A Property Manager account can represent a direct owner or an agency.
  // Historical properties may be linked through either ownerId or managerId.
  if (isOwnerProfile(user) || user.isManager) {
    filter.$or = [{ ownerId: user.id }, { managerId: user.id }];
  } else {
    return [];
  }

  const properties = await Property.find(filter).select("_id").lean();
  return properties.map((property: any) => property._id);
}

export async function applyPropertyScope(
  user: ScopeUser | null | undefined,
  query: Record<string, any> = {}
) {
  if (user?.isAdmin) return query;
  if (!user?.id) return denyAllQuery(query);

  const propertyIds = await getScopedPropertyIds(user);
  return {
    ...query,
    propertyId: { $in: propertyIds ?? [] },
  };
}

export async function applyPropertyDocumentScope(
  user: ScopeUser | null | undefined,
  query: Record<string, any> = {}
) {
  if (user?.isAdmin) return query;
  if (!user?.id) return denyAllQuery(query);

  const propertyIds = await getScopedPropertyIds(user);
  return {
    ...query,
    _id: { $in: propertyIds ?? [] },
  };
}

export function applyOwnerScope(
  user: ScopeUser | null | undefined,
  query: Record<string, any> = {}
) {
  if (user?.isAdmin) return query;
  if (!user?.id) return denyAllQuery(query);

  if (isOwnerProfile(user) || user.isManager) {
    return {
      ...query,
      $or: [{ ownerId: user.id }, { managerId: user.id }],
    };
  }

  return denyAllQuery(query);
}

export function applyTenantScope(
  user: ScopeUser | null | undefined,
  query: Record<string, any> = {}
) {
  if (user?.isAdmin) return query;
  if (!user?.id) return denyAllQuery(query);

  if (user.isTenant) {
    return { ...query, tenantId: user.id };
  }

  // Staff access cannot safely be inferred here because tenant resources are
  // scoped through leases/properties. Callers must apply property scope.
  return denyAllQuery(query);
}

export async function canAccessProperty(
  user: ScopeUser | null | undefined,
  propertyId: string | Types.ObjectId
): Promise<boolean> {
  if (!user?.id || !propertyId) return false;
  if (user.isAdmin) return true;

  const propertyIds = await getScopedPropertyIds(user);
  return propertyIds?.some((id) => id.toString() === propertyId.toString()) ?? false;
}

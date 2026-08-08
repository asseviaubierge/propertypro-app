import { Types } from "mongoose";
import { Lease, User } from "@/models";
import { LeaseStatus, UserRole } from "@/types";
import { getScopedPropertyIds, type ScopeUser } from "./property-scope";

function toObjectId(value: string | Types.ObjectId): Types.ObjectId | null {
  const raw = value instanceof Types.ObjectId ? value.toString() : value;
  return Types.ObjectId.isValid(raw) ? new Types.ObjectId(raw) : null;
}

/**
 * Returns the tenant user IDs visible to the authenticated user.
 *
 * A Property Manager can see:
 * - tenants explicitly attached to them through managerId/createdBy;
 * - tenants attached to leases on properties within their scope.
 *
 * null means unrestricted access (Super Admin).
 */
export async function getScopedTenantIds(
  user: ScopeUser | null | undefined,
  options: { activeOnly?: boolean } = {}
): Promise<Types.ObjectId[] | null> {
  if (!user?.id) return [];
  if (user.isAdmin) return null;

  const currentUserId = toObjectId(user.id);
  if (!currentUserId) return [];

  if (user.isTenant) return [currentUserId];

  const [directTenantIds, propertyIds] = await Promise.all([
    User.distinct("_id", {
      role: UserRole.TENANT,
      deletedAt: null,
      $or: [{ managerId: currentUserId }, { createdBy: currentUserId }],
    }),
    getScopedPropertyIds(user),
  ]);

  let leasedTenantIds: Types.ObjectId[] = [];
  if (propertyIds?.length) {
    const leaseFilter: Record<string, unknown> = {
      propertyId: { $in: propertyIds },
      deletedAt: null,
    };
    if (options.activeOnly) leaseFilter.status = LeaseStatus.ACTIVE;
    leasedTenantIds = await Lease.distinct("tenantId", leaseFilter);
  }

  const uniqueIds = new Map<string, Types.ObjectId>();
  for (const value of [...directTenantIds, ...leasedTenantIds]) {
    const objectId = toObjectId(value);
    if (objectId) uniqueIds.set(objectId.toString(), objectId);
  }

  return [...uniqueIds.values()];
}

export async function canAccessTenant(
  user: ScopeUser | null | undefined,
  tenantId: string | Types.ObjectId
): Promise<boolean> {
  if (!user?.id || !tenantId) return false;
  if (user.isAdmin) return true;

  const targetTenantId = toObjectId(tenantId);
  const currentUserId = toObjectId(user.id);
  if (!targetTenantId || !currentUserId) return false;

  if (user.isTenant) {
    return currentUserId.equals(targetTenantId);
  }

  // Fast path for newly created tenants that do not have a lease yet.
  const directlyManaged = await User.exists({
    _id: targetTenantId,
    role: UserRole.TENANT,
    deletedAt: null,
    $or: [{ managerId: currentUserId }, { createdBy: currentUserId }],
  });
  if (directlyManaged) return true;

  // Fallback for tenants attached through a lease/property relationship.
  const propertyIds = await getScopedPropertyIds(user);
  if (!propertyIds?.length) return false;

  return Boolean(
    await Lease.exists({
      tenantId: targetTenantId,
      propertyId: { $in: propertyIds },
      deletedAt: null,
    })
  );
}

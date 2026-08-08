import { Types } from "mongoose";
import { MaintenanceRequest } from "@/models";
import { applyPropertyScope, canAccessProperty, ScopeUser } from "@/lib/property-scope";

function idOf(value: any): string {
  return String(value?._id ?? value ?? "");
}

export async function maintenanceListScope(user: ScopeUser, query: Record<string, any> = {}) {
  if (user.isAdmin) return query;
  if (user.isTenant) return { ...query, tenantId: user.id };
  return applyPropertyScope(user, query);
}

export async function canAccessMaintenanceRequest(
  user: ScopeUser,
  requestOrId: any,
): Promise<boolean> {
  if (!user?.id) return false;
  if (user.isAdmin) return true;

  const item = typeof requestOrId === "string" || requestOrId instanceof Types.ObjectId
    ? await MaintenanceRequest.findById(requestOrId).select("propertyId tenantId assignedTo deletedAt").lean()
    : requestOrId;

  if (!item || item.deletedAt) return false;
  if (user.isTenant) return idOf(item.tenantId) === user.id;
  return canAccessProperty(user, idOf(item.propertyId));
}

export async function assertMaintenancePropertyAccess(user: ScopeUser, propertyId: any) {
  return canAccessProperty(user, idOf(propertyId));
}

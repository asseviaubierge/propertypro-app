import { Types } from "mongoose";
import { Inspection, Lease, Tenant } from "@/models";
import {
  applyPropertyScope,
  canAccessProperty,
  ScopeUser,
} from "@/lib/property-scope";

function idOf(value: any): string {
  return String(value?._id ?? value ?? "");
}

export async function getTenantRecordIdForUser(userId: string): Promise<string | null> {
  if (!userId) return null;
  const tenant = await Tenant.findOne({ userId, deletedAt: null }).select("_id").lean();
  return tenant?._id?.toString() ?? null;
}

export async function inspectionListScope(
  user: ScopeUser,
  query: Record<string, any> = {},
): Promise<Record<string, any>> {
  if (user.isAdmin) return query;

  if (user.isTenant) {
    const tenantId = await getTenantRecordIdForUser(user.id);
    return { ...query, tenantId: tenantId ?? { $in: [] } };
  }

  return applyPropertyScope(user, query);
}

export async function canAccessInspection(
  user: ScopeUser,
  inspectionOrId: any,
): Promise<boolean> {
  if (!user?.id) return false;
  if (user.isAdmin) return true;

  const inspection =
    typeof inspectionOrId === "string" || inspectionOrId instanceof Types.ObjectId
      ? await Inspection.findById(inspectionOrId)
          .select("propertyId tenantId deletedAt")
          .lean()
      : inspectionOrId;

  if (!inspection || inspection.deletedAt) return false;

  if (user.isTenant) {
    const tenantId = await getTenantRecordIdForUser(user.id);
    return Boolean(tenantId && idOf(inspection.tenantId) === tenantId);
  }

  return canAccessProperty(user, idOf(inspection.propertyId));
}

export async function validateInspectionRelations(
  user: ScopeUser,
  data: {
    propertyId?: any;
    tenantId?: any;
    leaseId?: any;
  },
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const propertyId = idOf(data.propertyId);
  if (!propertyId) {
    return { ok: false, status: 400, message: "Property ID is required" };
  }

  if (!(await canAccessProperty(user, propertyId))) {
    return { ok: false, status: 403, message: "Access denied for this property" };
  }

  if (data.leaseId) {
    const lease = await Lease.findById(data.leaseId)
      .select("propertyId tenantId deletedAt")
      .lean();
    if (!lease || lease.deletedAt) {
      return { ok: false, status: 404, message: "Bail introuvable" };
    }
    if (idOf(lease.propertyId) !== propertyId) {
      return { ok: false, status: 400, message: "Lease does not belong to this property" };
    }
    if (data.tenantId) {
      const tenant = await Tenant.findById(data.tenantId)
        .select("_id userId deletedAt")
        .lean();
      if (!tenant || tenant.deletedAt) {
        return { ok: false, status: 404, message: "Tenant not found" };
      }

      // Depending on the age of the data, Lease.tenantId may reference either
      // the User account or the Tenant record. Accept both representations.
      const leaseTenantId = idOf(lease.tenantId);
      const tenantRecordId = idOf(tenant._id);
      const tenantUserId = idOf((tenant as any).userId);
      if (leaseTenantId !== tenantRecordId && leaseTenantId !== tenantUserId) {
        return { ok: false, status: 400, message: "Le bail et le locataire ne correspondent pas" };
      }
    }
  } else if (data.tenantId) {
    const tenant = await Tenant.findById(data.tenantId).select("_id deletedAt").lean();
    if (!tenant || tenant.deletedAt) {
      return { ok: false, status: 404, message: "Tenant not found" };
    }
  }

  return { ok: true };
}

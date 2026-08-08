import { User } from "@/models";
import { UserRole } from "@/types";
import {
  AccessRequirement,
  AuthenticatedAccessUser,
} from "@/lib/api-utils";
import { hasAnyPermission } from "./role-utils";
import { resolveAccessProfile } from "./server-permissions";
import { canAccessProperty } from "./property-scope";

export const LEASE_VIEW_PERMISSIONS = [
  "lease_view",
  "lease_management",
] as const;

export const LEASE_MANAGE_PERMISSIONS = [
  "lease_create",
  "lease_edit",
  "lease_management",
] as const;

export const LEASE_DOCUMENT_READ_PERMISSIONS = [
  "document_access",
  "document_management",
  "lease_view",
  "lease_management",
] as const;

export const LEASE_DOCUMENT_WRITE_PERMISSIONS = [
  "document_management",
  "lease_edit",
  "lease_management",
] as const;

export const LEASE_READ_ACCESS: AccessRequirement = {
  roles: [UserRole.TENANT],
  permissions: [...LEASE_VIEW_PERMISSIONS],
  match: "any",
};

export const LEASE_MANAGE_ACCESS: AccessRequirement = {
  permissions: [...LEASE_MANAGE_PERMISSIONS],
};

export const LEASE_PATCH_ACCESS: AccessRequirement = {
  roles: [UserRole.TENANT],
  permissions: [...LEASE_MANAGE_PERMISSIONS],
  match: "any",
};

export const LEASE_DOCUMENT_READ_ACCESS: AccessRequirement = {
  roles: [UserRole.TENANT],
  permissions: [...LEASE_DOCUMENT_READ_PERMISSIONS],
  match: "any",
};

export const LEASE_DOCUMENT_UPLOAD_ACCESS: AccessRequirement = {
  roles: [UserRole.TENANT],
  permissions: [...LEASE_DOCUMENT_WRITE_PERMISSIONS],
  match: "any",
};

export function resolveReferenceId(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (record._id) {
      return resolveReferenceId(record._id);
    }

    if (record.id) {
      return resolveReferenceId(record.id);
    }

    if (record.userId) {
      return resolveReferenceId(record.userId);
    }

    if (typeof record.toString === "function") {
      const stringValue = record.toString();
      return stringValue === "[object Object]" ? null : stringValue;
    }
  }

  try {
    return String(value);
  } catch {
    return null;
  }
}

export function isLeaseTenantUser(
  user: AuthenticatedAccessUser,
  leaseLike: { tenantId?: unknown } | null | undefined
): boolean {
  if (!user.isTenant) {
    return false;
  }

  return resolveReferenceId(leaseLike?.tenantId) === user.id;
}

export function canManageLeases(user: AuthenticatedAccessUser): boolean {
  return (
    user.isCompanyStaff &&
    hasAnyPermission(user.permissions, LEASE_MANAGE_PERMISSIONS)
  );
}

export async function canAccessLease(
  user: AuthenticatedAccessUser,
  leaseLike: { propertyId?: unknown; tenantId?: unknown } | null | undefined
): Promise<boolean> {
  if (!leaseLike) return false;
  if (user.isAdmin) return true;
  if (isLeaseTenantUser(user, leaseLike)) return true;
  if (!canManageLeases(user)) return false;

  const propertyId = resolveReferenceId(leaseLike.propertyId);
  return propertyId ? canAccessProperty(user, propertyId) : false;
}

export function canManageLeaseDocuments(
  user: AuthenticatedAccessUser
): boolean {
  return (
    user.isCompanyStaff &&
    hasAnyPermission(user.permissions, LEASE_DOCUMENT_WRITE_PERMISSIONS)
  );
}

export async function isLeaseTenantCandidate(
  userId: string
): Promise<boolean> {
  const tenant = await User.findById(userId).select("role");
  if (!tenant) {
    return false;
  }

  const profile = await resolveAccessProfile(tenant.role);
  return profile.isTenant;
}

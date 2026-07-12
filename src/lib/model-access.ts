import mongoose from "mongoose";
import { UserRole } from "@/types";
import {
  AccessProfile,
  createAccessProfile,
  getSystemRolePermissions,
  hasAnyPermission,
  normalizeRoleName,
  resolveSystemRole,
} from "./permissions-manager";

const STAFF_VALIDATION_PERMISSIONS = [
  "property_management",
  "property_view",
  "tenant_management",
  "lease_management",
  "lease_view",
  "maintenance_management",
  "maintenance_assign",
  "financial_management",
  "payment_processing",
  "document_management",
  "company_settings",
  "user_management",
  "role_management",
  "system_settings",
] as const;

const MAINTENANCE_ASSIGNABLE_PERMISSIONS = [
  "maintenance_management",
  "maintenance_assign",
  "maintenance_view",
  "work_orders",
] as const;

async function resolveValidationPermissions(
  role?: string | null
): Promise<string[]> {
  const normalizedRole = normalizeRoleName(role) ?? UserRole.TENANT;
  const systemRole = resolveSystemRole(normalizedRole);

  if (systemRole) {
    return getSystemRolePermissions(systemRole);
  }

  const RoleModel = mongoose.models.Role;
  if (!RoleModel) {
    return [];
  }

  const customRole = (await RoleModel.findOne({
    name: normalizedRole,
    isActive: true,
    deletedAt: null,
  })
    .select("permissions")
    .lean()) as { permissions?: unknown } | null;

  return Array.isArray(customRole?.permissions)
    ? customRole.permissions.filter(
        (permission: unknown): permission is string =>
          typeof permission === "string"
      )
    : [];
}

export async function resolveAccessProfileForValidation(
  role?: string | null
): Promise<AccessProfile> {
  const permissions = await resolveValidationPermissions(role);
  return createAccessProfile(role, permissions);
}

export async function isTenantAccessRole(
  role?: string | null
): Promise<boolean> {
  const profile = await resolveAccessProfileForValidation(role);
  return profile.isTenant;
}

export async function isCompanyStaffAccessRole(
  role?: string | null
): Promise<boolean> {
  const profile = await resolveAccessProfileForValidation(role);
  return (
    profile.isCompanyStaff ||
    hasAnyPermission(profile.permissions, STAFF_VALIDATION_PERMISSIONS)
  );
}

export async function isMaintenanceAssignableRole(
  role?: string | null
): Promise<boolean> {
  const profile = await resolveAccessProfileForValidation(role);
  return (
    profile.isCompanyStaff &&
    hasAnyPermission(profile.permissions, MAINTENANCE_ASSIGNABLE_PERMISSIONS)
  );
}

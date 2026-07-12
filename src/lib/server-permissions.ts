import "server-only";

import { Role } from "@/models";
import { UserRole } from "@/types";
import {
  AccessProfile,
  createAccessProfile,
  getSystemRolePermissions,
  normalizeRoleName,
  resolveSystemRole,
} from "./permissions-manager";

const ROLE_PERMISSION_CACHE = new Map<
  string,
  { permissions: string[]; timestamp: number }
>();
const ROLE_PERMISSION_CACHE_TTL = 5 * 60 * 1000;

export async function resolveRolePermissions(
  role: string | null | undefined
): Promise<string[]> {
  const normalizedRole = normalizeRoleName(role) ?? UserRole.TENANT;
  const systemRole = resolveSystemRole(normalizedRole);

  if (systemRole) {
    return getSystemRolePermissions(systemRole);
  }

  const cached = ROLE_PERMISSION_CACHE.get(normalizedRole);
  if (cached && Date.now() - cached.timestamp < ROLE_PERMISSION_CACHE_TTL) {
    return cached.permissions;
  }

  const customRole = await Role.findOne({
    name: normalizedRole,
    isActive: true,
    deletedAt: null,
  })
    .select("permissions")
    .lean();

  const permissions = Array.isArray(customRole?.permissions)
    ? customRole.permissions
    : [];

  ROLE_PERMISSION_CACHE.set(normalizedRole, {
    permissions,
    timestamp: Date.now(),
  });

  return permissions;
}

export async function resolveAccessProfile(
  role: string | null | undefined
): Promise<AccessProfile> {
  const permissions = await resolveRolePermissions(role);
  return createAccessProfile(role, permissions);
}

export function clearRolePermissionCache(role?: string): void {
  if (role) {
    const normalizedRole = normalizeRoleName(role);
    if (normalizedRole) {
      ROLE_PERMISSION_CACHE.delete(normalizedRole);
    }
    return;
  }

  ROLE_PERMISSION_CACHE.clear();
}

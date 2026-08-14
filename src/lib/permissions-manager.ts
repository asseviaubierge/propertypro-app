import { UserRole } from "@/types";
import {
  ADMIN_ONLY_PERMISSIONS,
  MANAGER_LEVEL_PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
} from "./permission-catalog";

export { SYSTEM_ROLE_PERMISSIONS } from "./permission-catalog";

export type AccessLevel = "tenant" | "manager" | "admin";

export interface AccessProfile {
  role: string;
  originalRole: string;
  normalizedRole: string;
  systemRole: UserRole | null;
  permissions: string[];
  accessLevel: AccessLevel;
  isSystemRole: boolean;
  isCustomRole: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isTenant: boolean;
  isCompanyStaff: boolean;
}

const BASELINE_AUTHENTICATED_PERMISSIONS = ["profile_management"] as const;

const ROLE_ALIAS_LOOKUP: Record<string, UserRole> = {
  [UserRole.ADMIN]: UserRole.ADMIN,
  administrator: UserRole.ADMIN,
  "property administrator": UserRole.ADMIN,
  property_administrator: UserRole.ADMIN,
  super_admin: UserRole.ADMIN,
  [UserRole.MANAGER]: UserRole.MANAGER,
  "property manager": UserRole.MANAGER,
  property_manager: UserRole.MANAGER,
  owner: UserRole.MANAGER,
  "property owner": UserRole.MANAGER,
  property_owner: UserRole.MANAGER,
  landlord: UserRole.MANAGER,
  "maintenance staff": UserRole.MANAGER,
  maintenance_staff: UserRole.MANAGER,
  "leasing agent": UserRole.MANAGER,
  leasing_agent: UserRole.MANAGER,
  [UserRole.TENANT]: UserRole.TENANT,
  renter: UserRole.TENANT,
  resident: UserRole.TENANT,
};

export function normalizeRoleName(role?: string | null): string | null {
  const value = role?.trim();
  return value ? value.toLowerCase() : null;
}

export function resolveSystemRole(role?: string | null): UserRole | null {
  const normalizedRole = normalizeRoleName(role);
  return normalizedRole ? ROLE_ALIAS_LOOKUP[normalizedRole] ?? null : null;
}

export function getSystemRolePermissions(role: UserRole): string[] {
  return Array.from(SYSTEM_ROLE_PERMISSIONS[role] ?? []);
}

export function getUniquePermissions(permissions: readonly string[]): string[] {
  return [...new Set(permissions.filter(Boolean).map((permission) => permission.trim()))];
}

export function hasPermission(
  permissions: readonly string[],
  permission: string
): boolean {
  return permissions.includes(permission);
}

export function hasAnyPermission(
  permissions: readonly string[],
  requiredPermissions: readonly string[]
): boolean {
  return requiredPermissions.some((permission) => permissions.includes(permission));
}

export function hasAllPermissions(
  permissions: readonly string[],
  requiredPermissions: readonly string[]
): boolean {
  return requiredPermissions.every((permission) => permissions.includes(permission));
}

export function hasRequiredRole(
  userRole: string | null | undefined,
  requiredRoles: readonly string[]
): boolean {
  const normalizedUserRole = normalizeRoleName(userRole);
  const resolvedUserRole = resolveSystemRole(userRole);

  if (!normalizedUserRole) {
    return false;
  }

  return requiredRoles.some((requiredRole) => {
    const normalizedRequiredRole = normalizeRoleName(requiredRole);
    if (!normalizedRequiredRole) {
      return false;
    }

    if (normalizedUserRole === normalizedRequiredRole) {
      return true;
    }

    const resolvedRequiredRole = resolveSystemRole(requiredRole);
    return Boolean(
      resolvedUserRole &&
        resolvedRequiredRole &&
        resolvedUserRole === resolvedRequiredRole
    );
  });
}

export function matchesRequiredRoles(
  profile: AccessProfile,
  requiredRoles: readonly string[]
): boolean {
  if (requiredRoles.length === 0) {
    return true;
  }

  if (hasRequiredRole(profile.originalRole, requiredRoles)) {
    return true;
  }

  const resolvedRequiredRoles = requiredRoles
    .map((requiredRole) => resolveSystemRole(requiredRole))
    .filter((role): role is UserRole => Boolean(role));

  if (resolvedRequiredRoles.length === 0) {
    return false;
  }

  return resolvedRequiredRoles.some((requiredRole) => {
    switch (requiredRole) {
      case UserRole.ADMIN:
        return profile.isAdmin;
      case UserRole.MANAGER:
        return profile.isManager || profile.isAdmin;
      case UserRole.TENANT:
        return profile.isTenant;
      default:
        return false;
    }
  });
}

export function getAccessLevel(
  role: string | null | undefined,
  permissions: readonly string[]
): AccessLevel {
  const systemRole = resolveSystemRole(role);

  if (systemRole === UserRole.ADMIN) {
    return "admin";
  }

  if (systemRole === UserRole.MANAGER) {
    return "manager";
  }

  if (systemRole === UserRole.TENANT) {
    return "tenant";
  }

  if (hasAnyPermission(permissions, ADMIN_ONLY_PERMISSIONS)) {
    return "admin";
  }

  if (hasAnyPermission(permissions, MANAGER_LEVEL_PERMISSIONS)) {
    return "manager";
  }

  return "tenant";
}

export function createAccessProfile(
  role: string | null | undefined,
  resolvedPermissions: readonly string[] = []
): AccessProfile {
  const normalizedRole = normalizeRoleName(role) ?? UserRole.TENANT;
  const systemRole = resolveSystemRole(normalizedRole);
  const originalRole = normalizedRole;
  // System roles intentionally stay static. If we ever decide to allow DB
  // extensions for built-in roles, this is the place to merge them in.
  const rolePermissions = systemRole
    ? getSystemRolePermissions(systemRole)
    : Array.from(resolvedPermissions);
  const permissions = getUniquePermissions([
    ...BASELINE_AUTHENTICATED_PERMISSIONS,
    ...rolePermissions,
  ]);
  const accessLevel = getAccessLevel(normalizedRole, permissions);

  return {
    role: systemRole ?? normalizedRole,
    originalRole,
    normalizedRole,
    systemRole,
    permissions,
    accessLevel,
    isSystemRole: normalizedRole === systemRole,
    isCustomRole: !systemRole,
    isAdmin: accessLevel === "admin",
    isManager: accessLevel === "manager",
    isTenant: accessLevel === "tenant",
    isCompanyStaff: accessLevel === "admin" || accessLevel === "manager",
  };
}

export function getAccessLevelRank(accessLevel: AccessLevel): number {
  switch (accessLevel) {
    case "admin":
      return 3;
    case "manager":
      return 2;
    default:
      return 1;
  }
}

export function canViewUsers(profile: AccessProfile): boolean {
  return hasAnyPermission(profile.permissions, ["user_view", "user_management"]);
}

export function canManageUsers(profile: AccessProfile): boolean {
  return hasPermission(profile.permissions, "user_management");
}

export function canManageRoles(profile: AccessProfile): boolean {
  return hasPermission(profile.permissions, "role_management");
}

export function canAccessRoleConfiguration(profile: AccessProfile): boolean {
  return canManageRoles(profile);
}

export function canViewTargetUser(
  actor: AccessProfile,
  target: AccessProfile,
  options: { isSelf?: boolean } = {}
): boolean {
  const { isSelf = false } = options;

  if (isSelf) {
    return true;
  }

  if (actor.isAdmin) {
    return true;
  }

  return (
    getAccessLevelRank(actor.accessLevel) >=
    getAccessLevelRank(target.accessLevel)
  );
}

export function canManageTargetUser(
  actor: AccessProfile,
  target: AccessProfile,
  options: { isSelf?: boolean } = {}
): boolean {
  const { isSelf = false } = options;

  if (isSelf) {
    return true;
  }

  if (actor.isAdmin) {
    return true;
  }

  return getAccessLevelRank(actor.accessLevel) > getAccessLevelRank(target.accessLevel);
}

export function canManageTargetRole(
  actor: AccessProfile,
  targetRoleProfile: AccessProfile
): boolean {
  if (!canManageRoles(actor)) {
    return false;
  }

  if (actor.isAdmin) {
    return true;
  }

  return (
    getAccessLevelRank(actor.accessLevel) >
    getAccessLevelRank(targetRoleProfile.accessLevel)
  );
}

export function isAdminRole(role?: string | null): boolean {
  return resolveSystemRole(role) === UserRole.ADMIN;
}

export function isManagerRole(role?: string | null): boolean {
  return resolveSystemRole(role) === UserRole.MANAGER;
}

export function isTenantRole(role?: string | null): boolean {
  return resolveSystemRole(role) === UserRole.TENANT;
}

export function canBeAssignedMaintenance(role?: string | null): boolean {
  const systemRole = resolveSystemRole(role);
  return systemRole === UserRole.ADMIN || systemRole === UserRole.MANAGER;
}

export function formatRoleLabel(role?: string | null): string {
  const normalizedRole = normalizeRoleName(role);
  if (!normalizedRole) {
    return "Inconnu";
  }

  return normalizedRole.replace(/_/g, " ").replace(/\b\w/g, (char) =>
    char.toUpperCase()
  );
}

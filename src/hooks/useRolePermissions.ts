/**
 * PropertyPro - Role Permissions Hook
 * Enhanced permission management supporting both system and custom roles
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { UserRole, IRoleConfig } from "@/types";
import {
  SYSTEM_ROLE_PERMISSIONS,
  formatRoleLabel,
  normalizeRoleName,
  resolveSystemRole,
} from "@/lib/role-utils";

// ============================================================================
// TYPES
// ============================================================================

interface RolePermissionsData {
  permissions: string[];
  roleInfo: IRoleConfig | null;
  isLoading: boolean;
  error: string | null;
}

interface UseRolePermissionsReturn extends RolePermissionsData {
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  refreshPermissions: () => Promise<void>;
  isSystemRole: boolean;
  isCustomRole: boolean;
}

// ============================================================================
// PERMISSION CACHE
// ============================================================================

const permissionCache = new Map<
  string,
  { permissions: string[]; timestamp: number; roleInfo: IRoleConfig | null }
>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useRolePermissions(
  targetRole?: string
): UseRolePermissionsReturn {
  const { data: session } = useSession();
  const userRole = targetRole || session?.user?.role;
  const resolvedSystemRole = resolveSystemRole(userRole);

  const [permissionsData, setPermissionsData] = useState<RolePermissionsData>({
    permissions: [],
    roleInfo: null,
    isLoading: true,
    error: null,
  });

  // Check if role is a system role
  const isSystemRole = Boolean(resolvedSystemRole);
  const isCustomRole = userRole ? !resolvedSystemRole : false;

  // Fetch permissions for custom roles
  const fetchCustomRolePermissions = useCallback(
    async (
      roleName: string
    ): Promise<{ permissions: string[]; roleInfo: IRoleConfig | null }> => {
      try {
        const normalizedRoleName = normalizeRoleName(roleName) ?? roleName;

        // Check cache first
        const cached = permissionCache.get(normalizedRoleName);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          return { permissions: cached.permissions, roleInfo: cached.roleInfo };
        }

        const response = await fetch(
          `/api/roles?search=${encodeURIComponent(normalizedRoleName)}&limit=1`
        );
        if (!response.ok) {
          throw new Error(
            `Failed to fetch role permissions: ${response.statusText}`
          );
        }

        const data = await response.json();
        const roles = data?.data?.roles ?? data?.roles ?? [];
        const role = roles.find(
          (r: IRoleConfig) =>
            normalizeRoleName(r.name) === normalizedRoleName
        );

        if (!role) {
          throw new Error(`Role '${normalizedRoleName}' not found`);
        }

        const result = { permissions: role.permissions, roleInfo: role };

        // Cache the result
        permissionCache.set(normalizedRoleName, {
          permissions: role.permissions,
          roleInfo: role,
          timestamp: Date.now(),
        });

        return result;
      } catch (error) {
        console.error("Error fetching custom role permissions:", error);
        throw error;
      }
    },
    []
  );

  // Load permissions
  const loadPermissions = useCallback(async () => {
    if (!userRole) {
      setPermissionsData({
        permissions: [],
        roleInfo: null,
        isLoading: false,
        error: "No role specified",
      });
      return;
    }

    setPermissionsData((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      if (resolvedSystemRole) {
        // Handle system roles
        const permissions = SYSTEM_ROLE_PERMISSIONS[resolvedSystemRole] || [];
        const normalizedUserRole = normalizeRoleName(userRole);
        const roleLabel = formatRoleLabel(userRole);
        const roleInfo: IRoleConfig = {
          name: userRole,
          label: roleLabel,
          description:
            normalizedUserRole === resolvedSystemRole
              ? `System role: ${resolvedSystemRole}`
              : `${roleLabel} uses ${resolvedSystemRole} access rules`,
          permissions,
          isSystem: normalizedUserRole === resolvedSystemRole,
          isActive: true,
          color:
            resolvedSystemRole === UserRole.ADMIN
              ? "destructive"
              : resolvedSystemRole === UserRole.MANAGER
              ? "default"
              : "outline",
          userCount: 0,
          canEdit: false,
          canDelete: false,
        };

        setPermissionsData({
          permissions,
          roleInfo,
          isLoading: false,
          error: null,
        });
      } else {
        // Handle custom roles
        const { permissions, roleInfo } = await fetchCustomRolePermissions(
          normalizeRoleName(userRole) ?? userRole
        );
        setPermissionsData({
          permissions,
          roleInfo,
          isLoading: false,
          error: null,
        });
      }
    } catch (error) {
      setPermissionsData({
        permissions: [],
        roleInfo: null,
        isLoading: false,
        error:
          error instanceof Error ? error.message : "Failed to load permissions",
      });
    }
  }, [userRole, resolvedSystemRole, fetchCustomRolePermissions]);

  // Refresh permissions (clears cache)
  const refreshPermissions = useCallback(async () => {
    if (userRole && !isSystemRole) {
      permissionCache.delete(normalizeRoleName(userRole) ?? userRole);
    }
    await loadPermissions();
  }, [userRole, isSystemRole, loadPermissions]);

  // Permission checking functions
  const hasPermission = useCallback(
    (permission: string): boolean => {
      return permissionsData.permissions.includes(permission);
    },
    [permissionsData.permissions]
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]): boolean => {
      return permissions.some((permission) =>
        permissionsData.permissions.includes(permission)
      );
    },
    [permissionsData.permissions]
  );

  const hasAllPermissions = useCallback(
    (permissions: string[]): boolean => {
      return permissions.every((permission) =>
        permissionsData.permissions.includes(permission)
      );
    },
    [permissionsData.permissions]
  );

  // Load permissions on mount and when role changes
  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  return {
    ...permissionsData,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions,
    isSystemRole,
    isCustomRole,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get permissions for a role (cached version)
 */
export async function getRolePermissions(roleName: string): Promise<string[]> {
  // Check if it's a system role
  const resolvedSystemRole = resolveSystemRole(roleName);
  if (resolvedSystemRole) {
    return SYSTEM_ROLE_PERMISSIONS[resolvedSystemRole] || [];
  }

  // Check cache for custom roles
  const normalizedRoleName = normalizeRoleName(roleName) ?? roleName;
  const cached = permissionCache.get(normalizedRoleName);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.permissions;
  }

  // Fetch from API for custom roles
  try {
    const response = await fetch(
      `/api/roles?search=${encodeURIComponent(normalizedRoleName)}&limit=1`
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch role permissions: ${response.statusText}`
      );
    }

    const data = await response.json();
    const roles = data?.data?.roles ?? data?.roles ?? [];
    const role = roles.find(
      (r: IRoleConfig) => normalizeRoleName(r.name) === normalizedRoleName
    );

    if (!role) {
      return [];
    }

    // Cache the result
    permissionCache.set(normalizedRoleName, {
      permissions: role.permissions,
      roleInfo: role,
      timestamp: Date.now(),
    });

    return role.permissions;
  } catch (error) {
    console.error("Error fetching role permissions:", error);
    return [];
  }
}

/**
 * Clear permission cache for a specific role or all roles
 */
export function clearPermissionCache(roleName?: string): void {
  if (roleName) {
    permissionCache.delete(normalizeRoleName(roleName) ?? roleName);
  } else {
    permissionCache.clear();
  }
}

// ============================================================================
// AVAILABLE ROLES HOOK (UNION: SYSTEM + CUSTOM)
// ============================================================================

export function useAvailableRoles() {
  const [roles, setRoles] = useState<IRoleConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRoles = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch("/api/roles?includeSystem=true");
        if (!res.ok) {
          throw new Error(`Failed to load roles: ${res.statusText}`);
        }
        const data = await res.json();
        const rolesRaw: IRoleConfig[] = data?.data?.roles ?? data?.roles ?? [];
        // Sort: system roles first, then custom alphabetically
        const sorted = rolesRaw
          .filter((r) => r?.isActive)
          .sort((a, b) => {
            if (a.isSystem && !b.isSystem) return -1;
            if (!a.isSystem && b.isSystem) return 1;
            return a.label.localeCompare(b.label);
          });
        setRoles(sorted);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load roles");
        setRoles([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadRoles();
  }, []);

  return { roles, isLoading, error };
}

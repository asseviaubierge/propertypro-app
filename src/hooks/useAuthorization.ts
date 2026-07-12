"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  canAccessRoleConfiguration,
  canManageRoles,
  canManageUsers,
  canViewUsers,
  createAccessProfile,
} from "@/lib/permissions-manager";
import { useRolePermissions } from "./useRolePermissions";

export function useAuthorization() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const {
    permissions,
    isLoading: permissionsLoading,
    error,
    refreshPermissions,
  } = useRolePermissions();

  const accessProfile = useMemo(
    () => createAccessProfile(role, permissions),
    [role, permissions]
  );

  return {
    accessProfile,
    permissions,
    isLoading: status === "loading" || permissionsLoading,
    error,
    refreshPermissions,
    canViewUsers: canViewUsers(accessProfile),
    canManageUsers: canManageUsers(accessProfile),
    canManageRoles: canManageRoles(accessProfile),
    canAccessRoleConfiguration: canAccessRoleConfiguration(accessProfile),
    accessLevel: accessProfile.accessLevel,
    isAdmin: accessProfile.isAdmin,
    isManager: accessProfile.isManager,
    isTenant: accessProfile.isTenant,
    isCompanyStaff: accessProfile.isCompanyStaff,
  };
}

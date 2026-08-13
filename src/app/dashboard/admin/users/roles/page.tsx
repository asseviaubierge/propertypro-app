"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useState, useEffect, useMemo } from "react";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CustomModal,
  CustomModalHeader,
  CustomModalTitle,
  CustomModalDescription,
  CustomModalBody,
  CustomModalFooter,
} from "@/components/ui/custom-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DeleteConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  ArrowLeft,
  Shield,
  Users,
  Plus,
  Trash2,
  Settings,
  UserCheck,
  Search,
  RefreshCw,
  Eye,
  Lock,
  Unlock,
} from "lucide-react";
import { UserRole, IUser, IRoleConfig } from "@/types";
import { normalizeRoleName, resolveSystemRole } from "@/lib/role-utils";
import { clearPermissionCache } from "@/hooks/useRolePermissions";
import { useAuthorization } from "@/hooks/useAuthorization";

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface RoleConfig {
  role: string;
  name: string;
  label: string;
  description: string;
  permissions: string[];
  userCount: number;
  color: string;
  isSystem: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface UserWithRole {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string | null;
  role: string;
  originalRole: string;
  normalizedOriginalRole: string;
  isActive: boolean;
  lastLogin?: string;
}

// Available permissions in the system - moved inside component to use translations

const normalizeRoleToSystem = (role?: string | null): string => {
  return resolveSystemRole(role) ?? normalizeRoleName(role) ?? UserRole.TENANT;
};

const isLegacyOrSystemRole = (role?: string | null) => {
  return Boolean(resolveSystemRole(role));
};

// Default system role configurations - moved inside component to use translations

export default function RoleManagementPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLocalizationContext();
  const { canManageRoles } = useAuthorization();

  // Available permissions with translations
  const AVAILABLE_PERMISSIONS: Permission[] = useMemo(
    () => [
      // User Management
      {
        id: "user_management",
        name: t("admin.roles.permissions.user_management.name"),
        description: t("admin.roles.permissions.user_management.description"),
        category: t("admin.roles.permissions.user_management.category"),
      },
      {
        id: "user_view",
        name: t("admin.roles.permissions.user_view.name"),
        description: t("admin.roles.permissions.user_view.description"),
        category: t("admin.roles.permissions.user_view.category"),
      },
      {
        id: "role_management",
        name: t("admin.roles.permissions.role_management.name"),
        description: t("admin.roles.permissions.role_management.description"),
        category: t("admin.roles.permissions.role_management.category"),
      },
      // Property Management
      {
        id: "property_management",
        name: t("admin.roles.permissions.property_management.name"),
        description: t(
          "admin.roles.permissions.property_management.description",
        ),
        category: t("admin.roles.permissions.property_management.category"),
      },
      {
        id: "property_view",
        name: t("admin.roles.permissions.property_view.name"),
        description: t("admin.roles.permissions.property_view.description"),
        category: t("admin.roles.permissions.property_view.category"),
      },
      {
        id: "property_create",
        name: t("admin.roles.permissions.property_create.name"),
        description: t("admin.roles.permissions.property_create.description"),
        category: t("admin.roles.permissions.property_create.category"),
      },
      {
        id: "property_edit",
        name: t("admin.roles.permissions.property_edit.name"),
        description: t("admin.roles.permissions.property_edit.description"),
        category: t("admin.roles.permissions.property_edit.category"),
      },
      {
        id: "property_delete",
        name: t("admin.roles.permissions.property_delete.name"),
        description: t("admin.roles.permissions.property_delete.description"),
        category: t("admin.roles.permissions.property_delete.category"),
      },
      // Tenant Management
      {
        id: "tenant_management",
        name: t("admin.roles.permissions.tenant_management.name"),
        description: t("admin.roles.permissions.tenant_management.description"),
        category: t("admin.roles.permissions.tenant_management.category"),
      },
      {
        id: "tenant_view",
        name: t("admin.roles.permissions.tenant_view.name"),
        description: t("admin.roles.permissions.tenant_view.description"),
        category: t("admin.roles.permissions.tenant_view.category"),
      },
      {
        id: "tenant_create",
        name: t("admin.roles.permissions.tenant_create.name"),
        description: t("admin.roles.permissions.tenant_create.description"),
        category: t("admin.roles.permissions.tenant_create.category"),
      },
      {
        id: "tenant_edit",
        name: t("admin.roles.permissions.tenant_edit.name"),
        description: t("admin.roles.permissions.tenant_edit.description"),
        category: t("admin.roles.permissions.tenant_edit.category"),
      },
      // Lease Management
      {
        id: "lease_management",
        name: t("admin.roles.permissions.lease_management.name"),
        description: t("admin.roles.permissions.lease_management.description"),
        category: t("admin.roles.permissions.lease_management.category"),
      },
      {
        id: "lease_view",
        name: t("admin.roles.permissions.lease_view.name"),
        description: t("admin.roles.permissions.lease_view.description"),
        category: t("admin.roles.permissions.lease_view.category"),
      },
      {
        id: "lease_create",
        name: t("admin.roles.permissions.lease_create.name"),
        description: t("admin.roles.permissions.lease_create.description"),
        category: t("admin.roles.permissions.lease_create.category"),
      },
      {
        id: "lease_edit",
        name: t("admin.roles.permissions.lease_edit.name"),
        description: t("admin.roles.permissions.lease_edit.description"),
        category: t("admin.roles.permissions.lease_edit.category"),
      },
      // Maintenance Management
      {
        id: "maintenance_management",
        name: t("admin.roles.permissions.maintenance_management.name"),
        description: t(
          "admin.roles.permissions.maintenance_management.description",
        ),
        category: t("admin.roles.permissions.maintenance_management.category"),
      },
      {
        id: "maintenance_assign",
        name: t("admin.roles.permissions.maintenance_assign.name"),
        description: t(
          "admin.roles.permissions.maintenance_assign.description",
        ),
        category: t("admin.roles.permissions.maintenance_assign.category"),
      },
      {
        id: "maintenance_view",
        name: t("admin.roles.permissions.maintenance_view.name"),
        description: t("admin.roles.permissions.maintenance_view.description"),
        category: t("admin.roles.permissions.maintenance_view.category"),
      },
      {
        id: "maintenance_create",
        name: t("admin.roles.permissions.maintenance_create.name"),
        description: t(
          "admin.roles.permissions.maintenance_create.description",
        ),
        category: t("admin.roles.permissions.maintenance_create.category"),
      },
      {
        id: "maintenance_requests",
        name: t("admin.roles.permissions.maintenance_requests.name"),
        description: t(
          "admin.roles.permissions.maintenance_requests.description",
        ),
        category: t("admin.roles.permissions.maintenance_requests.category"),
      },
      {
        id: "work_orders",
        name: t("admin.roles.permissions.work_orders.name"),
        description: t("admin.roles.permissions.work_orders.description"),
        category: t("admin.roles.permissions.work_orders.category"),
      },
      {
        id: "maintenance_history",
        name: t("admin.roles.permissions.maintenance_history.name"),
        description: t(
          "admin.roles.permissions.maintenance_history.description",
        ),
        category: t("admin.roles.permissions.maintenance_history.category"),
      },
      // Financial Management
      {
        id: "financial_management",
        name: t("admin.roles.permissions.financial_management.name"),
        description: t(
          "admin.roles.permissions.financial_management.description",
        ),
        category: t("admin.roles.permissions.financial_management.category"),
      },
      {
        id: "financial_reports",
        name: t("admin.roles.permissions.financial_reports.name"),
        description: t("admin.roles.permissions.financial_reports.description"),
        category: t("admin.roles.permissions.financial_reports.category"),
      },
      {
        id: "payment_processing",
        name: t("admin.roles.permissions.payment_processing.name"),
        description: t(
          "admin.roles.permissions.payment_processing.description",
        ),
        category: t("admin.roles.permissions.payment_processing.category"),
      },
      {
        id: "payment_portal",
        name: t("admin.roles.permissions.payment_portal.name"),
        description: t("admin.roles.permissions.payment_portal.description"),
        category: t("admin.roles.permissions.payment_portal.category"),
      },
      {
        id: "payment_history",
        name: t("admin.roles.permissions.payment_history.name"),
        description: t("admin.roles.permissions.payment_history.description"),
        category: t("admin.roles.permissions.payment_history.category"),
      },
      // System Administration
      {
        id: "system_settings",
        name: t("admin.roles.permissions.system_settings.name"),
        description: t("admin.roles.permissions.system_settings.description"),
        category: t("admin.roles.permissions.system_settings.category"),
      },
      {
        id: "audit_logs",
        name: t("admin.roles.permissions.audit_logs.name"),
        description: t("admin.roles.permissions.audit_logs.description"),
        category: t("admin.roles.permissions.audit_logs.category"),
      },
      {
        id: "backup_restore",
        name: t("admin.roles.permissions.backup_restore.name"),
        description: t("admin.roles.permissions.backup_restore.description"),
        category: t("admin.roles.permissions.backup_restore.category"),
      },
      {
        id: "bulk_operations",
        name: t("admin.roles.permissions.bulk_operations.name"),
        description: t("admin.roles.permissions.bulk_operations.description"),
        category: t("admin.roles.permissions.bulk_operations.category"),
      },
      {
        id: "company_settings",
        name: t("admin.roles.permissions.company_settings.name"),
        description: t("admin.roles.permissions.company_settings.description"),
        category: t("admin.roles.permissions.company_settings.category"),
      },
      {
        id: "data_export",
        name: t("admin.roles.permissions.data_export.name"),
        description: t("admin.roles.permissions.data_export.description"),
        category: t("admin.roles.permissions.data_export.category"),
      },
      // Reports and Analytics
      {
        id: "reports_all",
        name: t("admin.roles.permissions.reports_all.name"),
        description: t("admin.roles.permissions.reports_all.description"),
        category: t("admin.roles.permissions.reports_all.category"),
      },
      {
        id: "reports_property",
        name: t("admin.roles.permissions.reports_property.name"),
        description: t("admin.roles.permissions.reports_property.description"),
        category: t("admin.roles.permissions.reports_property.category"),
      },
      {
        id: "reports_own",
        name: t("admin.roles.permissions.reports_own.name"),
        description: t("admin.roles.permissions.reports_own.description"),
        category: t("admin.roles.permissions.reports_own.category"),
      },
      {
        id: "advanced_analytics",
        name: t("admin.roles.permissions.advanced_analytics.name"),
        description: t(
          "admin.roles.permissions.advanced_analytics.description",
        ),
        category: t("admin.roles.permissions.advanced_analytics.category"),
      },
      // Applications and Screening
      {
        id: "application_processing",
        name: t("admin.roles.permissions.application_processing.name"),
        description: t(
          "admin.roles.permissions.application_processing.description",
        ),
        category: t("admin.roles.permissions.application_processing.category"),
      },
      {
        id: "screening_management",
        name: t("admin.roles.permissions.screening_management.name"),
        description: t(
          "admin.roles.permissions.screening_management.description",
        ),
        category: t("admin.roles.permissions.screening_management.category"),
      },
      // Document Management
      {
        id: "document_access",
        name: t("admin.roles.permissions.document_access.name"),
        description: t("admin.roles.permissions.document_access.description"),
        category: t("admin.roles.permissions.document_access.category"),
      },
      {
        id: "document_management",
        name: t("admin.roles.permissions.document_management.name"),
        description: t(
          "admin.roles.permissions.document_management.description",
        ),
        category: t("admin.roles.permissions.document_management.category"),
      },
      // Profile Management
      {
        id: "profile_management",
        name: t("admin.roles.permissions.profile_management.name"),
        description: t(
          "admin.roles.permissions.profile_management.description",
        ),
        category: t("admin.roles.permissions.profile_management.category"),
      },
    ],
    [t],
  );

  const defaultRoleConfigs: RoleConfig[] = useMemo(
    () => [
      {
        role: UserRole.ADMIN,
        name: UserRole.ADMIN,
        label: t("admin.roles.defaultRoles.admin.label"),
        description: t("admin.roles.defaultRoles.admin.description"),
        permissions: [
          "user_management",
          "role_management",
          "property_management",
          "tenant_management",
          "lease_management",
          "maintenance_management",
          "financial_management",
          "system_settings",
          "audit_logs",
          "backup_restore",
          "reports_all",
          "bulk_operations",
          "company_settings",
          "data_export",
          "advanced_analytics",
        ],
        userCount: 0,
        color: "destructive",
        isSystem: true,
        canEdit: false,
        canDelete: false,
      },
      {
        role: UserRole.MANAGER,
        name: UserRole.MANAGER,
        label: t("admin.roles.defaultRoles.manager.label"),
        description: t("admin.roles.defaultRoles.manager.description"),
        permissions: [
          "property_management",
          "tenant_management",
          "lease_management",
          "maintenance_management",
          "financial_management",
          "reports_all",
          "bulk_operations",
          "property_create",
          "tenant_create",
          "lease_create",
          "maintenance_assign",
          "payment_processing",
          "document_management",
        ],
        userCount: 0,
        color: "default",
        isSystem: true,
        canEdit: false,
        canDelete: false,
      },
      {
        role: UserRole.TENANT,
        name: UserRole.TENANT,
        label: t("admin.roles.defaultRoles.tenant.label"),
        description: t("admin.roles.defaultRoles.tenant.description"),
        permissions: [
          "profile_management",
          "maintenance_requests",
          "payment_portal",
          "document_access",
          "lease_view",
          "payment_history",
          "maintenance_history",
        ],
        userCount: 0,
        color: "outline",
        isSystem: true,
        canEdit: false,
        canDelete: false,
      },
    ],
    [t],
  );

  const [roleConfigs, setRoleConfigs] =
    useState<RoleConfig[]>(defaultRoleConfigs);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");

  // Role creation/editing state
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleConfig | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Check if all permissions are selected
  const allPermissionsSelected =
    selectedPermissions.length === AVAILABLE_PERMISSIONS.length;

  // User assignment state
  const [showUserAssignDialog, setShowUserAssignDialog] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [targetRole, setTargetRole] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  // Check permissions
  // Delete role function
  const handleDeleteRole = async (roleConfig: RoleConfig) => {
    try {
      setDeleteLoading(roleConfig.name);

      if (roleConfig.isSystem) {
        toast.error("System roles cannot be deleted");
        return;
      }

      if (roleConfig.userCount > 0 || !roleConfig.canDelete) {
        toast.error(
          `Cannot delete role with ${roleConfig.userCount} assigned users. Please reassign users first.`,
        );
        return;
      }

      const response = await fetch(
        `/api/roles/${encodeURIComponent(roleConfig.name)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.message || "Failed to delete role");
      }

      clearPermissionCache();
      toast.success("Role deleted successfully");

      // Refresh data
      await fetchRolesAndUsers();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete role",
      );
    } finally {
      setDeleteLoading(null);
    }
  };

  // Fetch roles and users
  const fetchRolesAndUsers = async () => {
    try {
      setIsLoading(true);

      // Fetch both roles and users in parallel
      const [rolesResponse, usersResponse] = await Promise.all([
        fetch("/api/roles?includeSystem=true"),
        fetch("/api/users?limit=1000"),
      ]);

      if (!rolesResponse.ok) {
        throw new Error("Failed to fetch roles");
      }

      if (!usersResponse.ok) {
        throw new Error("Failed to fetch users");
      }

      const rolesData = await rolesResponse.json();
      const usersData = await usersResponse.json();

      const rolePayload =
        rolesData?.data?.roles ?? rolesData?.roles ?? rolesData ?? [];

      const usersPayloadRaw = usersData?.data ?? usersData;
      const usersPayload = Array.isArray(usersPayloadRaw?.users)
        ? usersPayloadRaw.users
        : Array.isArray(usersPayloadRaw)
          ? usersPayloadRaw
          : [];

      const normalizedUsers: UserWithRole[] = (usersPayload as IUser[])
        .map((user) => {
          const originalRoleRaw =
            typeof user.role === "string" ? user.role : "";
          const normalizedOriginalRole = originalRoleRaw
            ? originalRoleRaw.toLowerCase()
            : "";
          const canonicalRole = normalizeRoleToSystem(originalRoleRaw);

          return {
            _id:
              typeof user._id === "string"
                ? user._id
                : ((user._id as any)?.toString?.() ?? ""),
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? "",
            email: user.email ?? "",
            avatar: (user as any)?.avatar ?? null,
            role: canonicalRole,
            originalRole: originalRoleRaw || canonicalRole,
            normalizedOriginalRole: normalizedOriginalRole || canonicalRole,
            isActive: Boolean(user.isActive),
            lastLogin: user.lastLogin
              ? new Date(user.lastLogin).toISOString()
              : undefined,
          };
        })
        .filter((user) => Boolean(user._id));

      setUsers(normalizedUsers);

      const systemRoleCounts = normalizedUsers.reduce<Record<UserRole, number>>(
        (acc, user) => {
          const systemRole = resolveSystemRole(user.originalRole);
          if (systemRole) {
            acc[systemRole] = (acc[systemRole] ?? 0) + 1;
          }
          return acc;
        },
        {} as Record<UserRole, number>,
      );

      const customRoleCounts = normalizedUsers.reduce<Record<string, number>>(
        (acc, user) => {
          if (!isLegacyOrSystemRole(user.originalRole)) {
            const key = user.normalizedOriginalRole;
            if (key) {
              acc[key] = (acc[key] ?? 0) + 1;
            }
          }
          return acc;
        },
        {},
      );

      const baseRoleMap = new Map<string, RoleConfig>(
        defaultRoleConfigs.map((role) => [
          role.role,
          {
            ...role,
            userCount: systemRoleCounts[role.role as UserRole] ?? 0,
          },
        ]),
      );

      const customRoles: RoleConfig[] = [];

      if (Array.isArray(rolePayload)) {
        rolePayload.forEach((role: IRoleConfig) => {
          const originalName = role.name || "";
          const normalizedRawName = normalizeRoleName(originalName) ?? "";
          const canonicalRole = normalizeRoleToSystem(originalName);
          const resolvedSystemRole = resolveSystemRole(originalName);
          const isSystemRole =
            Boolean(role.isSystem) && Boolean(resolvedSystemRole);

          const existing = resolvedSystemRole
            ? baseRoleMap.get(resolvedSystemRole)
            : undefined;

          const baseConfig: RoleConfig = {
            role: isSystemRole ? canonicalRole : originalName,
            name: originalName || canonicalRole,
            label: role.label,
            description: role.description,
            permissions: role.permissions ?? [],
            userCount: 0,
            color: role.color || existing?.color || "outline",
            isSystem: Boolean(role.isSystem),
            canEdit: Boolean(role.canEdit),
            canDelete: Boolean(role.canDelete),
          };

          if (isSystemRole && resolvedSystemRole) {
            baseRoleMap.set(resolvedSystemRole, {
              ...(existing ?? baseConfig),
              ...baseConfig,
              role: resolvedSystemRole,
              userCount:
                systemRoleCounts[resolvedSystemRole] ??
                role.userCount ??
                existing?.userCount ??
                0,
              color: baseConfig.color,
            });
          } else {
            const count =
              customRoleCounts[normalizedRawName] ?? role.userCount ?? 0;
            customRoles.push({
              ...baseConfig,
              role: originalName || normalizedRawName,
              userCount: count,
            });
          }
        });
      }

      const sortedCustomRoles = customRoles.sort((a, b) =>
        a.label.localeCompare(b.label),
      );

      setRoleConfigs([...baseRoleMap.values(), ...sortedCustomRoles]);
    } catch (error) {
      toast.error(t("admin.roles.toast.loadFailed"));
      // Fallback to default system roles if API fails
      setRoleConfigs(defaultRoleConfigs);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!showUserAssignDialog) {
      setTargetRole(null);
    }
  }, [showUserAssignDialog]);

  // Toggle all permissions
  const handleToggleAllPermissions = () => {
    if (allPermissionsSelected) {
      // Deselect all
      setSelectedPermissions([]);
    } else {
      // Select all
      setSelectedPermissions(AVAILABLE_PERMISSIONS.map((p) => p.id));
    }
  };

  // Handle role creation/editing
  const handleSaveRole = async () => {
    try {
      if (!newRoleName.trim()) {
        toast.error(t("admin.roles.toast.roleNameRequired"));
        return;
      }

      if (selectedPermissions.length === 0) {
        toast.error(t("admin.roles.toast.permissionRequired"));
        return;
      }

      const roleName = newRoleName.toLowerCase().replace(/\s+/g, "_");
      const roleData = {
        name: roleName,
        label: newRoleName,
        description: newRoleDescription,
        permissions: selectedPermissions,
        color: "outline" as const,
        isActive: true,
      };

      if (editingRole && !editingRole.isSystem) {
        // Update existing custom role
        const response = await fetch(`/api/roles/${editingRole.name}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: newRoleName,
            description: newRoleDescription,
            permissions: selectedPermissions,
            color: "outline",
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error?.message || "Failed to update role");
        }

        clearPermissionCache();
        toast.success(t("admin.roles.toast.roleUpdated"));
      } else {
        // Create new role
        const response = await fetch("/api/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(roleData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error?.message || "Failed to create role");
        }

        clearPermissionCache();
        toast.success(t("admin.roles.toast.roleCreated"));
      }

      // Reset form and refresh data
      setShowRoleDialog(false);
      setEditingRole(null);
      setNewRoleName("");
      setNewRoleDescription("");
      setSelectedPermissions([]);

      // Refresh roles and users
      await fetchRolesAndUsers();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("admin.roles.toast.roleSaveFailed"),
      );
    }
  };

  // Handle user role assignment
  const handleAssignRole = async () => {
    try {
      if (!targetRole || selectedUsers.length === 0) {
        toast.error(t("admin.roles.toast.selectUsersAndRole"));
        return;
      }

      // Call the role assignment API
      const response = await fetch("/api/users/assign-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: selectedUsers,
          targetRole,
          reason: "Bulk role assignment from admin panel",
          notifyUsers: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.message || "Failed to assign roles");
      }

      const result = await response.json();

      toast.success(
        t("admin.roles.toast.rolesAssigned", {
          values: { count: result.modifiedCount, role: targetRole },
        }),
      );

      setShowUserAssignDialog(false);
      setSelectedUsers([]);
      setTargetRole(null);

      // Refresh data
      await fetchRolesAndUsers();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("admin.roles.toast.assignFailed"),
      );
    }
  };

  useEffect(() => {
    if (canManageRoles) {
      fetchRolesAndUsers();
    }
  }, [canManageRoles]);

  // Filter users based on search and role
  const filteredUsers = (users || []).filter((user) => {
    const matchesSearch =
      searchTerm === "" ||
      `${user.firstName} ${user.lastName}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const normalizedSelectedRole =
      selectedRole === "all" ? "all" : selectedRole.toLowerCase();
    const matchesRole =
      normalizedSelectedRole === "all" ||
      (isLegacyOrSystemRole(normalizedSelectedRole) &&
        user.role === normalizeRoleToSystem(normalizedSelectedRole)) ||
      user.normalizedOriginalRole === normalizedSelectedRole;

    return matchesSearch && matchesRole;
  });

  // Group permissions by category
  const permissionsByCategory = AVAILABLE_PERMISSIONS.reduce(
    (acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      acc[permission.category].push(permission);
      return acc;
    },
    {} as Record<string, Permission[]>,
  );

  if (!canManageRoles) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">
            {t("admin.roles.accessDenied.title")}
          </h3>
          <p className="text-muted-foreground">
            {t("admin.roles.accessDenied.description")}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.back()}
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("admin.roles.accessDenied.goBack")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-xl leading-tight font-bold tracking-tight break-normal sm:text-3xl">
            {t("admin.roles.title")}
          </h1>
          <p className="text-muted-foreground">{t("admin.roles.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRolesAndUsers}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            {t("admin.roles.refresh")}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingRole(null);
              setNewRoleName("");
              setNewRoleDescription("");
              setSelectedPermissions([]);
              setShowRoleDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("admin.roles.createRole")}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">
            {t("admin.roles.tabs.overview")}
          </TabsTrigger>
          <TabsTrigger value="roles">{t("admin.roles.tabs.roles")}</TabsTrigger>
          <TabsTrigger value="users">{t("admin.roles.tabs.users")}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roleConfigs.map((config) => (
              <Card key={config.name} className="relative">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {config.label}
                  </CardTitle>
                  <Badge variant={config.color as any} className="text-xs">
                    {config.userCount} {t("admin.roles.overview.users")}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{config.userCount}</div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {config.description}
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs font-medium">
                      {t("admin.roles.overview.keyPermissions")}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {config.permissions.slice(0, 3).map((permission) => (
                        <Badge
                          key={permission}
                          variant="outline"
                          className="text-xs"
                        >
                          {permission.replace("_", " ")}
                        </Badge>
                      ))}
                      {config.permissions.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{config.permissions.length - 3}{" "}
                          {t("admin.roles.overview.more")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Roles Management Tab */}
        <TabsContent value="roles" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t("admin.roles.manage.title")}
              </CardTitle>
              <CardDescription>
                {t("admin.roles.manage.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {roleConfigs.map((config) => (
                  <div
                    key={config.name}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {config.isSystem ? (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Unlock className="h-4 w-4 text-green-600" />
                        )}
                        <div>
                          <h3 className="font-medium">{config.label}</h3>
                          <p className="text-sm text-muted-foreground">
                            {config.description}
                          </p>
                        </div>
                      </div>
                      <Badge variant={config.color as any}>
                        {config.userCount} {t("admin.roles.overview.users")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingRole(config);
                          setNewRoleName(config.label);
                          setNewRoleDescription(config.description);
                          setSelectedPermissions(config.permissions);
                          setShowRoleDialog(true);
                        }}
                        disabled={!config.canEdit}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        {config.canEdit
                          ? t("admin.roles.manage.edit")
                          : t("admin.roles.manage.view")}
                      </Button>
                      {!config.isSystem && (
                        <DeleteConfirmationDialog
                          itemName={config.label}
                          itemType="role"
                          onConfirm={() => handleDeleteRole(config)}
                          loading={deleteLoading === config.name}
                          disabled={
                            !config.canDelete || deleteLoading === config.name
                          }
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              !config.canDelete || deleteLoading === config.name
                            }
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                            title={
                              config.canDelete
                                ? "Delete custom role"
                                : `Cannot delete role with ${config.userCount} assigned users`
                            }
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </DeleteConfirmationDialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Assignment Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                {t("admin.roles.userAssignment.title")}
              </CardTitle>
              <CardDescription>
                {t("admin.roles.userAssignment.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={t(
                        "admin.roles.userAssignment.searchPlaceholder",
                      )}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select
                  value={selectedRole}
                  onValueChange={(value) => setSelectedRole(value)}
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue
                      placeholder={t("admin.roles.userAssignment.filterByRole")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("admin.roles.userAssignment.allRoles")}
                    </SelectItem>
                    {roleConfigs.map((config) => {
                      const normalizedValue = (
                        config.name || config.role
                      ).toLowerCase();
                      return (
                        <SelectItem
                          key={`${config.name}-${normalizedValue}`}
                          value={normalizedValue}
                        >
                          {config.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => setShowUserAssignDialog(true)}
                  disabled={selectedUsers.length === 0}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  {t("admin.roles.userAssignment.assignRoles")}
                </Button>
              </div>

              {/* Users Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={
                            selectedUsers.length === filteredUsers.length &&
                            filteredUsers.length > 0
                          }
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedUsers(filteredUsers.map((u) => u._id));
                            } else {
                              setSelectedUsers([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>
                        {t("admin.roles.userAssignment.table.user")}
                      </TableHead>
                      <TableHead>
                        {t("admin.roles.userAssignment.table.email")}
                      </TableHead>
                      <TableHead>
                        {t("admin.roles.userAssignment.table.currentRole")}
                      </TableHead>
                      <TableHead>
                        {t("admin.roles.userAssignment.table.status")}
                      </TableHead>
                      <TableHead>
                        {t("admin.roles.userAssignment.table.lastLogin")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("admin.roles.userAssignment.table.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
                              <div className="space-y-1">
                                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                          </TableCell>
                          <TableCell>
                            <div className="h-6 w-24 bg-muted rounded animate-pulse" />
                          </TableCell>
                          <TableCell>
                            <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                          </TableCell>
                          <TableCell>
                            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                          </TableCell>
                          <TableCell>
                            <div className="h-8 w-8 bg-muted rounded animate-pulse ml-auto" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="flex flex-col items-center gap-2">
                            <Users className="h-8 w-8 text-muted-foreground" />
                            <p className="text-muted-foreground">
                              {searchTerm || selectedRole !== "all"
                                ? t(
                                    "admin.roles.userAssignment.noUsersMatching",
                                  )
                                : t("admin.roles.userAssignment.noUsers")}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user._id.toString()}>
                          <TableCell>
                            <Checkbox
                              checked={selectedUsers.includes(user._id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedUsers((prev) => [
                                    ...prev,
                                    user._id,
                                  ]);
                                } else {
                                  setSelectedUsers((prev) =>
                                    prev.filter((id) => id !== user._id),
                                  );
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage
                                  src={user.avatar ?? undefined}
                                  alt={`${user.firstName} ${user.lastName}`}
                                />
                                <AvatarFallback className="text-xs">
                                  {user.firstName?.[0]}
                                  {user.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {user.firstName} {user.lastName}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            {(() => {
                              const matchedRole =
                                roleConfigs.find(
                                  (config) =>
                                    config.role === user.role ||
                                    config.name.toLowerCase() ===
                                      user.normalizedOriginalRole,
                                ) ?? null;
                              const rawLabel = matchedRole
                                ? matchedRole.label
                                : (user.originalRole ?? user.role);
                              const displayLabel = rawLabel.replace(/_/g, " ");

                              return (
                                <Badge
                                  variant={
                                    (matchedRole?.color as any) || "outline"
                                  }
                                  className="capitalize"
                                >
                                  {displayLabel}
                                </Badge>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={user.isActive ? "default" : "secondary"}
                            >
                              {user.isActive
                                ? t("admin.roles.userAssignment.active")
                                : t("admin.roles.userAssignment.inactive")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.lastLogin
                              ? new Date(user.lastLogin).toLocaleDateString()
                              : t("admin.roles.userAssignment.never")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/dashboard/admin/users/${user._id}`,
                                )
                              }
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Role Creation/Edit Dialog */}
      <CustomModal
        open={showRoleDialog}
        onOpenChange={setShowRoleDialog}
        size="3/4"
      >
        <CustomModalHeader onClose={() => setShowRoleDialog(false)}>
          <CustomModalTitle>
            {editingRole
              ? t("admin.roles.dialog.editTitle")
              : t("admin.roles.dialog.createTitle")}
          </CustomModalTitle>
          <CustomModalDescription>
            {editingRole
              ? t("admin.roles.dialog.editDescription")
              : t("admin.roles.dialog.createDescription")}
          </CustomModalDescription>
        </CustomModalHeader>

        <CustomModalBody>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roleName">
                  {t("admin.roles.dialog.roleName")}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="roleName"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder={t("admin.roles.dialog.roleNamePlaceholder")}
                  disabled={editingRole?.isSystem}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roleDescription">
                  {t("admin.roles.dialog.description")}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="roleDescription"
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  placeholder={t("admin.roles.dialog.descriptionPlaceholder")}
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="font-bold">
                  {t("admin.roles.dialog.permissions")}
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleToggleAllPermissions}
                  disabled={editingRole?.isSystem && !editingRole?.canEdit}
                >
                  {allPermissionsSelected
                    ? t("admin.roles.dialog.deselectAll")
                    : t("admin.roles.dialog.selectAll")}
                </Button>
              </div>
              <div className="space-y-4">
                {Object.entries(permissionsByCategory).map(
                  ([category, permissions]) => (
                    <div key={category} className="space-y-2">
                      <h4 className="font-bold text-sm">{category}</h4>
                      <div className="grid grid-cols-6 gap-2">
                        {permissions.map((permission) => (
                          <div
                            key={permission.id}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={permission.id}
                              checked={selectedPermissions.includes(
                                permission.id,
                              )}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedPermissions((prev) => [
                                    ...prev,
                                    permission.id,
                                  ]);
                                } else {
                                  setSelectedPermissions((prev) =>
                                    prev.filter((p) => p !== permission.id),
                                  );
                                }
                              }}
                              disabled={
                                editingRole?.isSystem && !editingRole?.canEdit
                              }
                            />
                            <Label htmlFor={permission.id} className="text-sm">
                              {permission.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </CustomModalBody>

        <CustomModalFooter>
          <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
            {t("admin.roles.dialog.cancel")}
          </Button>
          <Button
            onClick={handleSaveRole}
            disabled={!newRoleName.trim() || !newRoleDescription.trim()}
          >
            {editingRole
              ? t("admin.roles.dialog.updateButton")
              : t("admin.roles.dialog.createButton")}
          </Button>
        </CustomModalFooter>
      </CustomModal>

      {/* User Role Assignment Dialog */}
      <Dialog
        open={showUserAssignDialog}
        onOpenChange={setShowUserAssignDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.roles.assignDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("admin.roles.assignDialog.description", {
                values: { count: selectedUsers.length },
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("admin.roles.assignDialog.selectRole")}</Label>
              <Select
                value={targetRole ?? ""}
                onValueChange={(value) => setTargetRole(value)}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("admin.roles.assignDialog.chooseRole")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {roleConfigs.map((config) => (
                    <SelectItem key={config.name} value={config.name}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUserAssignDialog(false)}
            >
              {t("admin.roles.assignDialog.cancel")}
            </Button>
            <Button onClick={handleAssignRole} disabled={!targetRole}>
              {t("admin.roles.assignDialog.assign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

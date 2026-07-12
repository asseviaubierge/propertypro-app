/**
 * PropertyPro - Conversation Contacts API
 * Returns active users available to add to conversations
 */

import { NextRequest } from "next/server";
import {
  withPermissionAndDB,
  createErrorResponse,
  createSuccessResponse,
} from "@/lib/api-utils";
import { UserRole } from "@/types";
import { User } from "@/models";

const DEFAULT_VISIBLE_ROLES: Partial<Record<UserRole, UserRole[]>> = {
  [UserRole.TENANT]: [
    UserRole.ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.MANAGER,
    UserRole.MANAGER,
    UserRole.MANAGER,
    UserRole.MANAGER,
  ],
  [UserRole.MANAGER]: [
    UserRole.ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.MANAGER,
    UserRole.MANAGER,
    UserRole.TENANT,
    UserRole.MANAGER,
    UserRole.MANAGER,
  ],
  [UserRole.MANAGER]: [
    UserRole.ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.MANAGER,
    UserRole.MANAGER,
    UserRole.MANAGER,
    UserRole.TENANT,
  ],
  [UserRole.MANAGER]: [
    UserRole.ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.MANAGER,
    UserRole.MANAGER,
    UserRole.MANAGER,
    UserRole.MANAGER,
    UserRole.TENANT,
  ],
  [UserRole.ADMIN]: [
    UserRole.ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.MANAGER,
    UserRole.MANAGER,
    UserRole.MANAGER,
    UserRole.MANAGER,
    UserRole.TENANT,
  ],
};

const ALLOWED_ROLES = [
  UserRole.ADMIN,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.MANAGER,
  UserRole.MANAGER,
  UserRole.MANAGER,
  UserRole.MANAGER,
  UserRole.TENANT,
];

export const GET = withPermissionAndDB("profile_management")(
  async (user, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const search = searchParams.get("search")?.trim() ?? "";
      const limit = Math.min(
        Number.parseInt(searchParams.get("limit") ?? "50", 10) || 50,
        200
      );

      const rolesParam = searchParams.get("roles");
      const excludeRolesParam = searchParams.get("excludeRoles");

      const roleFilterValues = rolesParam
        ? rolesParam
            .split(",")
            .map((role) => role.trim())
            .filter(Boolean)
        : DEFAULT_VISIBLE_ROLES[user.role as UserRole] ?? undefined;

      const excludeRoleValues = excludeRolesParam
        ? excludeRolesParam
            .split(",")
            .map((role) => role.trim())
            .filter(Boolean)
        : undefined;

      const filter: Record<string, unknown> = {
        _id: { $ne: user.id },
        isActive: true,
        deletedAt: null,
      };

      if (roleFilterValues && roleFilterValues.length > 0) {
        filter.role = { $in: roleFilterValues };
      }

      if (excludeRoleValues && excludeRoleValues.length > 0) {
        filter.role = {
          ...(filter.role as Record<string, unknown> | undefined),
          $nin: excludeRoleValues,
        };
      }

      if (search) {
        filter.$or = [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      const users = await User.find(filter)
        .select("firstName lastName email role avatar isActive")
        .sort({ firstName: 1, lastName: 1 })
        .limit(limit)
        .lean();

      const formatted = users.map((u) => ({
        id: u._id.toString(),
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        avatar: u.avatar ?? null,
        isActive: u.isActive,
      }));

      return createSuccessResponse({
        users: formatted,
        total: formatted.length,
      });
    } catch (error) {
      console.error("Failed to fetch conversation contacts:", error);
      return createErrorResponse("Failed to fetch contacts", 500);
    }
  }
);

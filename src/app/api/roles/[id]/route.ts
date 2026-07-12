/**
 * PropertyPro - Individual Role Management API Routes
 * CRUD operations for specific roles
 */

import { NextRequest } from "next/server";
import { Role, User } from "@/models";
import { IRoleConfig } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  parseRequestBody,
  withPermissionAndDB,
  isValidObjectId,
} from "@/lib/api-utils";
import {
  canManageTargetRole,
  createAccessProfile,
} from "@/lib/permissions-manager";
import { clearRolePermissionCache } from "@/lib/server-permissions";
import { SYSTEM_PERMISSIONS } from "@/lib/permission-catalog";
import { z } from "zod";
import mongoose from "mongoose";

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const updateRoleSchema = z.object({
  label: z
    .string()
    .min(1, "Role label is required")
    .max(100, "Role label cannot exceed 100 characters")
    .optional(),
  description: z
    .string()
    .min(1, "Role description is required")
    .max(500, "Role description cannot exceed 500 characters")
    .optional(),
  permissions: z
    .array(z.enum(SYSTEM_PERMISSIONS))
    .min(1, "At least one permission is required")
    .optional(),
  color: z.enum(["default", "destructive", "outline", "secondary"]).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// GET /api/roles/[id] - Get specific role
// ============================================================================

export const GET = withPermissionAndDB("role_management")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      // Find the role by ID (ObjectId) or by name (string)
      let role;
      if (isValidObjectId(id)) {
        role = await Role.findById(id)
          .populate("createdBy", "firstName lastName email")
          .populate("updatedBy", "firstName lastName email")
          .lean();
      } else {
        // Try to find by name
        role = await Role.findOne({ name: id })
          .populate("createdBy", "firstName lastName email")
          .populate("updatedBy", "firstName lastName email")
          .lean();
      }

      if (!role) {
        return createErrorResponse("Role not found", 404);
      }

      // Get user count for this role
      const userCount = await User.countDocuments({
        role: role.name,
        isActive: true,
      });

      // Transform role to include computed fields
      const roleResponse: IRoleConfig = {
        _id: role._id.toString(),
        name: role.name,
        label: role.label,
        description: role.description,
        permissions: role.permissions,
        isSystem: role.isSystem,
        isActive: role.isActive,
        color: role.color as IRoleConfig["color"],
        userCount,
        canEdit: !role.isSystem,
        canDelete: !role.isSystem && userCount === 0,
        createdBy: role.createdBy?._id?.toString(),
        updatedBy: role.updatedBy?._id?.toString(),
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      };

      return createSuccessResponse({ role: roleResponse });
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PUT /api/roles/[id] - Update specific role
// ============================================================================

export const PUT = withPermissionAndDB("role_management")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      // Validate request body
      const validation = updateRoleSchema.safeParse(body);
      if (!validation.success) {
        return createErrorResponse(
          `Validation failed: ${validation.error.errors
            .map((e) => e.message)
            .join(", ")}`,
          400
        );
      }

      const updateData = validation.data;

      // Find the role by ID (ObjectId) or by name (string)
      let role;
      if (isValidObjectId(id)) {
        role = await Role.findById(id);
      } else {
        // Try to find by name
        role = await Role.findOne({ name: id });
      }

      if (!role) {
        return createErrorResponse("Role not found", 404);
      }

      // Check if role can be edited
      if (role.isSystem) {
        return createErrorResponse("System roles cannot be modified", 403);
      }

      const targetRoleProfile = createAccessProfile(
        role.name,
        updateData.permissions ?? role.permissions
      );
      if (!canManageTargetRole(user, targetRoleProfile)) {
        return createErrorResponse(
          "You do not have permission to update this role",
          403
        );
      }

      // Update role
      const updatedRole = await Role.findByIdAndUpdate(
        role._id,
        {
          ...updateData,
          updatedBy: new mongoose.Types.ObjectId(user.id),
        },
        { new: true, runValidators: true }
      )
        .populate("createdBy", "firstName lastName email")
        .populate("updatedBy", "firstName lastName email");

      if (!updatedRole) {
        return createErrorResponse("Failed to update role", 500);
      }

      clearRolePermissionCache(updatedRole.name);

      // Get user count for this role
      const userCount = await User.countDocuments({
        role: updatedRole.name,
        isActive: true,
      });

      // Transform response
      const roleResponse: IRoleConfig = {
        _id: updatedRole._id.toString(),
        name: updatedRole.name,
        label: updatedRole.label,
        description: updatedRole.description,
        permissions: updatedRole.permissions,
        isSystem: updatedRole.isSystem,
        isActive: updatedRole.isActive,
        color: updatedRole.color as IRoleConfig["color"],
        userCount,
        canEdit: true,
        canDelete: userCount === 0,
        createdBy: updatedRole.createdBy?._id?.toString(),
        updatedBy: user.id,
        createdAt: updatedRole.createdAt,
        updatedAt: updatedRole.updatedAt,
      };

      return createSuccessResponse(
        { role: roleResponse },
        "Role updated successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// DELETE /api/roles/[id] - Delete specific role
// ============================================================================

export const DELETE = withPermissionAndDB("role_management")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      // Find the role by ID (ObjectId) or by name (string)
      let role;
      if (isValidObjectId(id)) {
        role = await Role.findById(id);
      } else {
        // Try to find by name
        role = await Role.findOne({ name: id });
      }

      if (!role) {
        return createErrorResponse("Role not found", 404);
      }

      // Check if role can be deleted
      if (role.isSystem) {
        return createErrorResponse("System roles cannot be deleted", 403);
      }

      const targetRoleProfile = createAccessProfile(role.name, role.permissions);
      if (!canManageTargetRole(user, targetRoleProfile)) {
        return createErrorResponse(
          "You do not have permission to delete this role",
          403
        );
      }

      // Check if role has assigned users
      const userCount = await User.countDocuments({
        role: role.name,
        isActive: true,
      });

      if (userCount > 0) {
        return createErrorResponse(
          `Cannot delete role with ${userCount} assigned users. Please reassign users first.`,
          409
        );
      }

      // Soft delete the role
      await Role.findByIdAndUpdate(role._id, {
        $set: {
          deletedAt: new Date(),
          updatedBy: new mongoose.Types.ObjectId(user.id),
          isActive: false,
        },
      });

      clearRolePermissionCache(role.name);

      return createSuccessResponse(
        { deletedRoleId: role._id.toString() },
        "Role deleted successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PATCH /api/roles/[id]/toggle - Toggle role active status
// ============================================================================

export const PATCH = withPermissionAndDB("role_management")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      // Find the role by ID (ObjectId) or by name (string)
      let role;
      if (isValidObjectId(id)) {
        role = await Role.findById(id);
      } else {
        // Try to find by name
        role = await Role.findOne({ name: id });
      }

      if (!role) {
        return createErrorResponse("Role not found", 404);
      }

      // Check if role can be modified
      if (role.isSystem) {
        return createErrorResponse("System roles cannot be modified", 403);
      }

      const targetRoleProfile = createAccessProfile(role.name, role.permissions);
      if (!canManageTargetRole(user, targetRoleProfile)) {
        return createErrorResponse(
          "You do not have permission to modify this role",
          403
        );
      }

      // Toggle active status
      const updatedRole = await Role.findByIdAndUpdate(
        role._id,
        {
          isActive: !role.isActive,
          updatedBy: new mongoose.Types.ObjectId(user.id),
        },
        { new: true }
      );

      if (!updatedRole) {
        return createErrorResponse("Failed to update role", 500);
      }

      clearRolePermissionCache(updatedRole.name);

      return createSuccessResponse(
        {
          roleId: updatedRole._id.toString(),
          isActive: updatedRole.isActive,
        },
        `Role ${
          updatedRole.isActive ? "activated" : "deactivated"
        } successfully`
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

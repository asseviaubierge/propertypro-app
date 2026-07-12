/**
 * PropertyPro - Individual User API Routes
 * Handle operations for specific users
 */

import { NextRequest } from "next/server";
import {
  Lease,
  User,
  Property,
  MaintenanceRequest,
  WorkOrder,
  Ticket,
} from "@/models";
import {
  LeaseStatus,
  UserRole,
  MaintenanceStatus,
  WorkOrderStatus,
  TicketStatus,
} from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  isValidObjectId,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { auditService } from "@/lib/audit-service";
import { AuditCategory, AuditAction, AuditSeverity } from "@/models/AuditLog";
import {
  canManageRoles,
  canManageTargetRole,
  canManageTargetUser,
  canViewTargetUser,
} from "@/lib/permissions-manager";
import { resolveAccessProfile } from "@/lib/server-permissions";

// ============================================================================
// GET /api/users/[id] - Get a specific user
// ============================================================================

export const GET = withPermissionAndDB(["user_view", "user_management"])(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid user ID", 400);
      }

      const targetUser = await User.findById(id).select("-password -__v").lean();

      if (!targetUser) {
        return createErrorResponse("User not found", 404);
      }

      const targetAccess = await resolveAccessProfile(targetUser.role);
      if (
        !canViewTargetUser(user, targetAccess, {
          isSelf: targetUser._id.toString() === user.id,
        })
      ) {
        return createErrorResponse("Access denied", 403);
      }

      return createSuccessResponse(targetUser);
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PUT /api/users/[id] - Update a specific user
// ============================================================================

export const PUT = withPermissionAndDB("user_management")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid user ID", 400);
      }

      const body = await request.json();

      const targetUser = await User.findById(id);
      if (!targetUser) {
        return createErrorResponse("User not found", 404);
      }

      const targetAccess = await resolveAccessProfile(targetUser.role);
      if (
        !canManageTargetUser(user, targetAccess, {
          isSelf: targetUser._id.toString() === user.id,
        })
      ) {
        return createErrorResponse("Access denied", 403);
      }

      if (body.role && body.role !== targetUser.role) {
        const targetRoleAccess = await resolveAccessProfile(body.role);
        if (!canManageRoles(user) || !canManageTargetRole(user, targetRoleAccess)) {
          return createErrorResponse("You cannot change user roles", 403);
        }
      }

      delete body.password;
      delete body._id;
      delete body.__v;
      delete body.createdAt;
      delete body.updatedAt;

    const oldData = {
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      email: targetUser.email,
      role: targetUser.role,
      phone: targetUser.phone,
      avatar: targetUser.avatar,
      isActive: targetUser.isActive,
    };

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    ).select("-password -__v");

    if (!updatedUser) {
      return createErrorResponse("User not found", 404);
    }

    const newData = {
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      role: updatedUser.role,
      phone: updatedUser.phone,
      avatar: updatedUser.avatar,
      isActive: updatedUser.isActive,
    };

      const context = auditService.extractContextFromRequest(request, user);

    await auditService.logEvent(
      {
        category: AuditCategory.USER_MANAGEMENT,
        action: AuditAction.UPDATE,
        severity: AuditSeverity.LOW,
        description: `Updated user: ${updatedUser.firstName} ${updatedUser.lastName}`,
        resourceType: "user",
        resourceId: id,
        resourceName: `${updatedUser.firstName} ${updatedUser.lastName}`,
        oldValues: oldData,
        newValues: newData,
        tags: ["user", "update"],
      },
      context
    );

    if (body.role && body.role !== targetUser.role) {
      await auditService.logEvent(
        {
          category: AuditCategory.USER_MANAGEMENT,
          action: AuditAction.ROLE_ASSIGNED,
          severity: AuditSeverity.MEDIUM,
          description: `Changed role for ${updatedUser.firstName} ${updatedUser.lastName}`,
          resourceType: "user",
          resourceId: id,
          resourceName: `${updatedUser.firstName} ${updatedUser.lastName}`,
          details: { oldRole: targetUser.role, newRole: body.role },
          tags: ["user", "role"],
        },
        context
      );
    }

      return createSuccessResponse(updatedUser, "User updated successfully");
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// DELETE /api/users/[id] - Deactivate a specific user
// ============================================================================

export const DELETE = withPermissionAndDB("user_management")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      // When `permanent=true`, the user is soft-deleted (removed from listings)
      // rather than just deactivated. References are preserved for data integrity.
      const permanent =
        request.nextUrl.searchParams.get("permanent") === "true";
      const verb = permanent ? "delete" : "deactivate";

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid user ID", 400);
      }

      if (id === user.id) {
        return createErrorResponse(`You cannot ${verb} yourself`, 400);
      }

      const targetUser = await User.findById(id).select("_id role firstName lastName");
      if (!targetUser) {
        return createErrorResponse("User not found", 404);
      }

      const targetAccess = await resolveAccessProfile(targetUser.role);
      if (!canManageTargetUser(user, targetAccess)) {
        return createErrorResponse("Insufficient permissions", 403);
      }

      if (targetUser.role === UserRole.TENANT) {
        const activeLease = await Lease.exists({
          tenantId: id,
          status: LeaseStatus.ACTIVE,
          deletedAt: null,
        });

        if (activeLease) {
          return createErrorResponse(
            `Cannot ${verb} tenant with an active lease. Please terminate the lease first.`,
            409
          );
        }
      }

      // Permanent deletion: block while the user is still assigned to anything.
      // The admin must unassign these first to keep records consistent.
      if (permanent) {
        const activeMaintenanceStatuses = [
          MaintenanceStatus.SUBMITTED,
          MaintenanceStatus.ASSIGNED,
          MaintenanceStatus.IN_PROGRESS,
        ];
        const activeWorkOrderStatuses = [
          WorkOrderStatus.PENDING,
          WorkOrderStatus.ASSIGNED,
          WorkOrderStatus.IN_PROGRESS,
        ];
        const openTicketStatuses = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS];

        const [
          ownedProperties,
          managedProperties,
          maintenanceCount,
          workOrderCount,
          ticketCount,
        ] = await Promise.all([
          Property.countDocuments({ ownerId: id, deletedAt: null }),
          Property.countDocuments({ managerId: id, deletedAt: null }),
          MaintenanceRequest.countDocuments({
            assignedTo: id,
            status: { $in: activeMaintenanceStatuses },
          }),
          WorkOrder.countDocuments({
            assignedTo: id,
            status: { $in: activeWorkOrderStatuses },
            deletedAt: null,
          }),
          Ticket.countDocuments({
            assignedTo: id,
            status: { $in: openTicketStatuses },
          }),
        ]);

        const plural = (n: number, singular: string) =>
          `${n} ${singular}${n === 1 ? "" : "s"}`;

        const blockers: string[] = [];
        const propertyCount = ownedProperties + managedProperties;
        if (propertyCount > 0)
          blockers.push(
            `${propertyCount} ${propertyCount === 1 ? "property" : "properties"}`
          );
        if (maintenanceCount > 0)
          blockers.push(plural(maintenanceCount, "active maintenance request"));
        if (workOrderCount > 0)
          blockers.push(plural(workOrderCount, "open work order"));
        if (ticketCount > 0) blockers.push(plural(ticketCount, "open ticket"));

        if (blockers.length > 0) {
          return createErrorResponse(
            `This user is still assigned to ${blockers.join(
              ", "
            )}. Please unassign them first, then try to delete.`,
            409
          );
        }
      }

      const context = auditService.extractContextFromRequest(request, user);

      const updatedUser = await User.findByIdAndUpdate(
        id,
        permanent
          ? { $set: { isActive: false, deletedAt: new Date() } }
          : { $set: { isActive: false } },
        { new: true }
      ).select("-password -__v");

      if (!updatedUser) {
        return createErrorResponse("User not found", 404);
      }

      await auditService.logEvent(
        {
          category: AuditCategory.USER_MANAGEMENT,
          action: AuditAction.DELETE,
          severity: AuditSeverity.HIGH,
          description: `${permanent ? "Deleted" : "Deactivated"} user: ${updatedUser.firstName} ${updatedUser.lastName}`,
          resourceType: "user",
          resourceId: id,
          resourceName: `${updatedUser.firstName} ${updatedUser.lastName}`,
          oldValues: { isActive: true, deletedAt: null },
          newValues: permanent
            ? { isActive: false, deletedAt: updatedUser.deletedAt }
            : { isActive: false },
          tags: ["user", verb],
        },
        context
      );

      return createSuccessResponse(
        updatedUser,
        permanent ? "User deleted successfully" : "User deactivated successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

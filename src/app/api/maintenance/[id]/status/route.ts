/**
 * PropertyPro - Maintenance Request Status Update API
 * Handle status changes for maintenance requests with role-based permissions
 */

import { NextRequest } from "next/server";
import { MaintenanceRequest, User } from "@/models";
import { UserRole, MaintenanceStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  parseRequestBody,
  isValidObjectId,
  withAccessAndDB,
} from "@/lib/api-utils";
import { hasAnyPermission } from "@/lib/role-utils";
import { resolveAccessProfile } from "@/lib/server-permissions";

const MAINTENANCE_STATUS_READ_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: [
    "maintenance_view",
    "maintenance_management",
    "maintenance_assign",
    "work_orders",
  ],
  match: "any" as const,
};

const MAINTENANCE_STATUS_WRITE_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: ["maintenance_management", "maintenance_assign", "work_orders"],
  match: "any" as const,
};

const MAINTENANCE_HANDLER_PERMISSIONS = [
  "maintenance_management",
  "maintenance_assign",
  "work_orders",
];

function canHandleMaintenance(profile: { isCompanyStaff: boolean; permissions: string[] }) {
  return (
    profile.isCompanyStaff &&
    hasAnyPermission(profile.permissions, MAINTENANCE_HANDLER_PERMISSIONS)
  );
}

// ============================================================================
// PATCH /api/maintenance/[id]/status - Update maintenance request status
// ============================================================================

export const PATCH = withAccessAndDB(MAINTENANCE_STATUS_WRITE_ACCESS)(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid maintenance request ID", 400);
      }

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      const { action, assignedTo, actualCost, notes } = body;

      if (!action) {
        return createErrorResponse("Action is required", 400);
      }

      const maintenanceRequest = await MaintenanceRequest.findById(id)
        .populate("assignedTo", "firstName lastName email")
        .populate("tenantId", "firstName lastName email phone avatar")
        .populate("propertyId", "name address");

      if (!maintenanceRequest) {
        return createErrorResponse("Maintenance request not found", 404);
      }

      const canManage =
        user.isCompanyStaff &&
        hasAnyPermission(user.permissions, [
          "maintenance_management",
          "maintenance_assign",
        ]);
      const canWork = canHandleMaintenance(user);
      const isAssignedToUser =
        (maintenanceRequest.assignedTo as any)?._id?.toString() === user.id;
      const isRequestOwner =
        user.isTenant &&
        (maintenanceRequest.tenantId as any)?._id?.toString() === user.id;

      const oldStatus = maintenanceRequest.status;

      switch (action) {
        case "assign":
        case "reassign":
          if (!canManage) {
            return createErrorResponse(
              "Only authorized staff can assign maintenance requests",
              403
            );
          }
          if (!assignedTo) {
            return createErrorResponse("Assigned user ID is required", 400);
          }
          if (!isValidObjectId(assignedTo)) {
            return createErrorResponse("Invalid assigned user ID", 400);
          }

          const assignedUser = await User.findById(assignedTo);
          if (!assignedUser || !assignedUser.isActive) {
            return createErrorResponse("Assigned user not found", 404);
          }

          const assignedUserAccess = await resolveAccessProfile(assignedUser.role);
          if (!canHandleMaintenance(assignedUserAccess)) {
            return createErrorResponse(
              "Can only assign to active maintenance staff",
              400
            );
          }

          maintenanceRequest.assignedTo = assignedTo;
          maintenanceRequest.status = MaintenanceStatus.ASSIGNED;
          break;

        case "start":
          if (!canWork || (!isAssignedToUser && !canManage)) {
            return createErrorResponse(
              "You can only start work on requests assigned to you",
              403
            );
          }
          if (maintenanceRequest.status !== MaintenanceStatus.ASSIGNED) {
            return createErrorResponse(
              "Can only start work on assigned requests",
              400
            );
          }
          maintenanceRequest.status = MaintenanceStatus.IN_PROGRESS;
          break;

        case "complete":
          if (!canWork || (!isAssignedToUser && !canManage)) {
            return createErrorResponse(
              "You can only complete requests assigned to you",
              403
            );
          }
          if (maintenanceRequest.status !== MaintenanceStatus.IN_PROGRESS) {
            return createErrorResponse(
              "Can only complete requests that are in progress",
              400
            );
          }
          maintenanceRequest.status = MaintenanceStatus.COMPLETED;
          maintenanceRequest.completedDate = new Date();

          if (actualCost !== undefined) {
            const cost = parseFloat(actualCost);
            if (isNaN(cost) || cost < 0) {
              return createErrorResponse("Invalid actual cost", 400);
            }
            maintenanceRequest.actualCost = cost;
          }

          if (notes) {
            const timestamp = new Date().toISOString();
            const userName = `${user.firstName || "User"} ${
              user.lastName || ""
            }`.trim();
            const completionNote = `[${timestamp}] ${userName} (Completion): ${notes}`;

            maintenanceRequest.notes = maintenanceRequest.notes
              ? `${maintenanceRequest.notes}\n${completionNote}`
              : completionNote;
          }
          break;

        case "cancel":
          if (!canManage && !isRequestOwner) {
            return createErrorResponse(
              "Only authorized staff or request owners can cancel requests",
              403
            );
          }
          if (maintenanceRequest.status === MaintenanceStatus.COMPLETED) {
            return createErrorResponse("Cannot cancel completed requests", 400);
          }
          maintenanceRequest.status = MaintenanceStatus.CANCELLED;
          break;

        default:
          return createErrorResponse("Invalid action specified", 400);
      }

      await maintenanceRequest.save();

      let syncWarning: string | null = null;
      if (maintenanceRequest.propertyId && maintenanceRequest.unitId) {
        try {
          const { propertyStatusSynchronizer } = await import(
            "@/lib/services/property-status-sync.service"
          );

          await propertyStatusSynchronizer.syncAfterMaintenanceStatusChange(
            (maintenanceRequest.propertyId as any)._id.toString(),
            maintenanceRequest._id.toString(),
            maintenanceRequest.unitId.toString(),
            oldStatus,
            maintenanceRequest.status,
            {
              triggeredBy: `maintenance-api:${user.id}`,
              logChanges: true,
            }
          );
        } catch (syncError) {
          syncWarning =
            syncError instanceof Error
              ? syncError.message
              : "Property status synchronization failed";
        }
      }

      const updatedRequest = await MaintenanceRequest.findById(id)
        .populate("propertyId", "name address type")
        .populate("tenantId", "firstName lastName email phone avatar")
        .populate("assignedTo", "firstName lastName email role");

      return createSuccessResponse(
        {
          data: updatedRequest,
          warning: syncWarning || undefined,
        },
        `Maintenance request ${action} completed successfully`
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// GET /api/maintenance/[id]/status - Get status history (future enhancement)
// ============================================================================

export const GET = withAccessAndDB(MAINTENANCE_STATUS_READ_ACCESS)(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid maintenance request ID", 400);
      }

      const maintenanceRequest = await MaintenanceRequest.findById(id)
        .populate("assignedTo", "firstName lastName email")
        .populate("tenantId", "firstName lastName email phone avatar")
        .populate("propertyId", "name address");

      if (!maintenanceRequest) {
        return createErrorResponse("Maintenance request not found", 404);
      }

      const isRequestOwner =
        user.isTenant &&
        (maintenanceRequest.tenantId as any)?._id?.toString() === user.id;
      if (user.isTenant && !isRequestOwner) {
        return createErrorResponse(
          "You can only view your own maintenance requests",
          403
        );
      }

      const statusHistory = [
        {
          status: MaintenanceStatus.SUBMITTED,
          timestamp: maintenanceRequest.createdAt,
          user: "System",
          action: "Request submitted",
        },
      ];

      if (maintenanceRequest.assignedTo) {
        statusHistory.push({
          status: MaintenanceStatus.ASSIGNED,
          timestamp: maintenanceRequest.updatedAt,
          user:
            `${(maintenanceRequest.assignedTo as any)?.firstName || ""} ${
              (maintenanceRequest.assignedTo as any)?.lastName || ""
            }`.trim() || "Unknown",
          action: "Request assigned",
        });
      }

      if (maintenanceRequest.status === MaintenanceStatus.IN_PROGRESS) {
        statusHistory.push({
          status: MaintenanceStatus.IN_PROGRESS,
          timestamp: maintenanceRequest.updatedAt,
          user:
            `${(maintenanceRequest.assignedTo as any)?.firstName || ""} ${
              (maintenanceRequest.assignedTo as any)?.lastName || ""
            }`.trim() || "Unknown",
          action: "Work started",
        });
      }

      if (
        maintenanceRequest.status === MaintenanceStatus.COMPLETED &&
        maintenanceRequest.completedDate
      ) {
        statusHistory.push({
          status: MaintenanceStatus.COMPLETED,
          timestamp: maintenanceRequest.completedDate,
          user:
            `${(maintenanceRequest.assignedTo as any)?.firstName || ""} ${
              (maintenanceRequest.assignedTo as any)?.lastName || ""
            }`.trim() || "Unknown",
          action: "Work completed",
        });
      }

      if (maintenanceRequest.status === MaintenanceStatus.CANCELLED) {
        statusHistory.push({
          status: MaintenanceStatus.CANCELLED,
          timestamp: maintenanceRequest.updatedAt,
          user: "System",
          action: "Request cancelled",
        });
      }

      return createSuccessResponse({
        request: maintenanceRequest,
        statusHistory,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
);

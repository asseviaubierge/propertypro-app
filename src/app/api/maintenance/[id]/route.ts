/**
 * PropertyPro - Individual Maintenance Request API Routes
 * CRUD operations for individual maintenance requests
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
  withPermissionAndDB,
} from "@/lib/api-utils";
import { maintenanceRequestSchema, validateSchema } from "@/lib/validations";
import { resolveAccessProfile } from "@/lib/server-permissions";

const MAINTENANCE_READ_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: [
    "maintenance_view",
    "maintenance_management",
    "maintenance_assign",
    "work_orders",
  ],
  match: "any" as const,
};

const MAINTENANCE_WRITE_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: [
    "maintenance_create",
    "maintenance_management",
    "maintenance_assign",
    "work_orders",
  ],
  match: "any" as const,
};

// ============================================================================
// GET /api/maintenance/[id] - Get a specific maintenance request
// ============================================================================

export const GET = withAccessAndDB(MAINTENANCE_READ_ACCESS)(
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
        .populate(
          "propertyId",
          "name address type ownerId managerId isMultiUnit units"
        )
        .populate("tenantId", "firstName lastName email phone avatar")
        .populate("assignedTo", "firstName lastName email phone avatar");

      if (!maintenanceRequest) {
        return createErrorResponse("Maintenance request not found", 404);
      }

      if (
        user.isTenant &&
        !maintenanceRequest.tenantId._id.equals(user.id)
      ) {
        return createErrorResponse(
          "You can only view your own maintenance requests",
          403
        );
      }

      const requestObj = (maintenanceRequest.toObject
        ? maintenanceRequest.toObject()
        : maintenanceRequest) as any;

      let unit = null;
      if (requestObj.unitId && requestObj.propertyId?.units) {
        unit = requestObj.propertyId.units.find(
          (embeddedUnit: any) =>
            embeddedUnit._id.toString() === requestObj.unitId.toString()
        );
      }

      return createSuccessResponse(
        {
          ...requestObj,
          property: requestObj.propertyId,
          unit,
          tenant: requestObj.tenantId
            ? {
                user: requestObj.tenantId,
              }
            : null,
        },
        "Maintenance request retrieved successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PUT /api/maintenance/[id] - Update a maintenance request
// ============================================================================

export const PUT = withAccessAndDB(MAINTENANCE_WRITE_ACCESS)(
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

      const maintenanceRequest = await MaintenanceRequest.findById(id);
      if (!maintenanceRequest) {
        return createErrorResponse("Maintenance request not found", 404);
      }

      if (user.isTenant) {
        if (!maintenanceRequest.tenantId.equals(user.id)) {
          return createErrorResponse(
            "You can only update your own maintenance requests",
            403
          );
        }

        if (maintenanceRequest.status === MaintenanceStatus.COMPLETED) {
          return createErrorResponse(
            "Cannot update completed maintenance request",
            400
          );
        }
      } else if (user.isManager && !user.isAdmin) {
        if (
          maintenanceRequest.assignedTo &&
          !maintenanceRequest.assignedTo.equals(user.id)
        ) {
          return createErrorResponse(
            "You can only update requests assigned to you",
            403
          );
        }
      }

      const updateSchema = maintenanceRequestSchema.partial();
      const validation = validateSchema(updateSchema, body);
      if (!validation.success) {
        return createErrorResponse(validation.errors.join(", "), 400);
      }

      const updateData = validation.data;

      if (user.isTenant) {
        const restrictedFields = [
          "assignedTo",
          "status",
          "estimatedCost",
          "actualCost",
          "scheduledDate",
          "completedDate",
        ] as const;

        restrictedFields.forEach((field) => {
          delete (updateData as Record<string, unknown>)[field];
        });
      }

      if (user.isManager && !user.isAdmin) {
        delete updateData.propertyId;
        delete updateData.tenantId;
        delete updateData.priority;
      }

      Object.assign(maintenanceRequest, updateData);
      await maintenanceRequest.save();

      await maintenanceRequest.populate([
        { path: "propertyId", select: "name address type" },
        { path: "tenantId", select: "firstName lastName email phone" },
        { path: "assignedTo", select: "firstName lastName email phone" },
      ]);

      const requestObj = maintenanceRequest.toObject
        ? maintenanceRequest.toObject()
        : maintenanceRequest;

      return createSuccessResponse(
        {
          ...requestObj,
          property: requestObj.propertyId,
          tenant: {
            user: requestObj.tenantId || {},
          },
        },
        "Maintenance request updated successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// DELETE /api/maintenance/[id] - Delete a maintenance request (soft delete)
// ============================================================================

export const DELETE = withPermissionAndDB([
  "maintenance_management",
  "maintenance_assign",
  "work_orders",
])(
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

      const maintenanceRequest = await MaintenanceRequest.findById(id);
      if (!maintenanceRequest) {
        return createErrorResponse("Maintenance request not found", 404);
      }

      if (maintenanceRequest.status === MaintenanceStatus.COMPLETED) {
        return createErrorResponse(
          "Cannot delete completed maintenance request.",
          409
        );
      }

      maintenanceRequest.deletedAt = new Date();
      await maintenanceRequest.save();

      return createSuccessResponse(
        { id: maintenanceRequest._id },
        "Maintenance request deleted successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PATCH /api/maintenance/[id] - Partial update (status change, assignment, etc.)
// ============================================================================

export const PATCH = withAccessAndDB(MAINTENANCE_WRITE_ACCESS)(
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

      const maintenanceRequest = await MaintenanceRequest.findById(id);
      if (!maintenanceRequest) {
        return createErrorResponse("Maintenance request not found", 404);
      }

      if (user.isTenant && !maintenanceRequest.tenantId.equals(user.id)) {
        return createErrorResponse(
          "You can only modify your own maintenance requests",
          403
        );
      }

      const { action, ...data } = body;

      switch (action) {
        case "assign": {
          if (user.isTenant) {
            return createErrorResponse(
              "Tenants cannot assign maintenance requests",
              403
            );
          }
          if (!data.assignedTo) {
            return createErrorResponse("Assigned user ID is required", 400);
          }

          const assignedUser = await User.findById(data.assignedTo);
          if (!assignedUser) {
            return createErrorResponse("Assigned user not found", 404);
          }

          const assigneeAccess = await resolveAccessProfile(assignedUser.role);
          if (!assigneeAccess.isCompanyStaff) {
            return createErrorResponse(
              "User cannot be assigned maintenance requests",
              400
            );
          }

          maintenanceRequest.assignedTo = data.assignedTo;
          maintenanceRequest.status = MaintenanceStatus.ASSIGNED;
          break;
        }

        case "startWork":
          if (user.isTenant) {
            return createErrorResponse(
              "Tenants cannot start work on maintenance requests",
              403
            );
          }
          maintenanceRequest.status = MaintenanceStatus.IN_PROGRESS;
          break;

        case "complete":
          if (user.isTenant) {
            return createErrorResponse(
              "Tenants cannot complete maintenance requests",
              403
            );
          }
          maintenanceRequest.status = MaintenanceStatus.COMPLETED;
          maintenanceRequest.completedDate = new Date();
          if (data.actualCost) {
            maintenanceRequest.actualCost = data.actualCost;
          }
          break;

        case "addNote": {
          if (!data.note) {
            return createErrorResponse("Note content is required", 400);
          }

          const currentNotes = maintenanceRequest.notes || "";
          const timestamp = new Date().toISOString();
          const userName = `${user.firstName || "User"} ${
            user.lastName || ""
          }`.trim();
          const newNote = `[${timestamp}] ${userName}: ${data.note}`;

          maintenanceRequest.notes = currentNotes
            ? `${currentNotes}\n${newNote}`
            : newNote;
          break;
        }

        default:
          return createErrorResponse("Invalid action specified", 400);
      }

      await maintenanceRequest.save();

      return createSuccessResponse(
        maintenanceRequest,
        `Maintenance request ${action} completed successfully`
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

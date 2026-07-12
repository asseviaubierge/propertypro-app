/**
 * PropertyPro - Maintenance Requests API Routes
 * CRUD operations for maintenance request management
 */

import { NextRequest } from "next/server";
import { MaintenanceRequest, Property, User } from "@/models";
import { UserRole, MaintenancePriority, MaintenanceStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  parsePaginationParams,
  paginateQuery,
  parseRequestBody,
  withAccessAndDB,
  withPermissionAndDB,
} from "@/lib/api-utils";
import {
  maintenanceRequestSchema,
  paginationSchema,
  validateSchema,
} from "@/lib/validations";
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
// GET /api/maintenance - Get all maintenance requests with pagination and filtering
// ============================================================================

export const GET = withAccessAndDB(MAINTENANCE_READ_ACCESS)(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const paginationParams = parsePaginationParams(searchParams);

      const filterParams = {
        ...paginationParams,
        status: searchParams.get("status") || undefined,
        priority: searchParams.get("priority") || undefined,
        category: searchParams.get("category") || undefined,
        propertyId: searchParams.get("propertyId") || undefined,
        unitId: searchParams.get("unitId") || undefined,
        tenantId: searchParams.get("tenantId") || undefined,
        assignedTo: searchParams.get("assignedTo") || undefined,
        emergency: searchParams.get("emergency") === "true",
        overdue: searchParams.get("overdue") === "true",
      };

      const validation = validateSchema(paginationSchema, paginationParams);
      if (!validation.success) {
        return createErrorResponse(validation.errors.join(", "), 400);
      }

      const filters = filterParams;
      const query: Record<string, unknown> = {};

      if (user.isTenant) {
        query.tenantId = user.id;
      }

      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.priority) {
        query.priority = filters.priority;
      }
      if (filters.category) {
        query.category = filters.category;
      }
      if (filters.propertyId) {
        query.propertyId = filters.propertyId;
      }
      if (filters.unitId) {
        query.unitId = filters.unitId;
      }
      if (filters.tenantId && !user.isTenant) {
        query.tenantId = filters.tenantId;
      }
      if (filters.assignedTo) {
        query.assignedTo = filters.assignedTo;
      }

      if (filters.emergency) {
        query.priority = MaintenancePriority.EMERGENCY;
      }

      if (filters.overdue) {
        const now = new Date();
        const emergencyDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
        const highDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const mediumDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const lowDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        query.status = {
          $nin: [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
        };
        query.$or = [
          {
            priority: MaintenancePriority.EMERGENCY,
            createdAt: { $lt: emergencyDate },
          },
          { priority: MaintenancePriority.HIGH, createdAt: { $lt: highDate } },
          {
            priority: MaintenancePriority.MEDIUM,
            createdAt: { $lt: mediumDate },
          },
          { priority: MaintenancePriority.LOW, createdAt: { $lt: lowDate } },
        ];
      }

      const result = await paginateQuery(
        MaintenanceRequest,
        query,
        paginationParams
      );

      const populatedData = await MaintenanceRequest.populate(result.data, [
        {
          path: "propertyId",
          select: "name address type isMultiUnit units",
          options: { lean: true },
        },
        {
          path: "tenantId",
          select: "firstName lastName email phone tenantStatus",
          options: { lean: true },
        },
        {
          path: "assignedTo",
          select: "firstName lastName email phone",
          options: { lean: true },
        },
      ]);

      const transformedData = (populatedData as unknown as any[]).map(
        (requestItem: any) => {
          const requestObj = requestItem.toObject
          ? requestItem.toObject()
          : requestItem;

          let unit = null;
          if (requestObj.unitId && requestObj.propertyId?.units) {
            unit = requestObj.propertyId.units.find(
              (embeddedUnit: any) =>
                embeddedUnit._id.toString() === requestObj.unitId.toString()
            );
          }

          return {
            ...requestObj,
            property: requestObj.propertyId,
            unit,
            tenant: requestObj.tenantId
              ? {
                  user: requestObj.tenantId || {},
                }
              : null,
          };
        }
      );

      return createSuccessResponse(
        transformedData,
        "Maintenance requests retrieved successfully",
        result.pagination
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// POST /api/maintenance - Create a new maintenance request
// ============================================================================

export const POST = withAccessAndDB(MAINTENANCE_WRITE_ACCESS)(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      const validation = validateSchema(maintenanceRequestSchema, body);
      if (!validation.success) {
        return createErrorResponse(validation.errors.join(", "), 400);
      }

      const maintenanceData = validation.data;
      const property = await Property.findById(maintenanceData.propertyId);
      if (!property) {
        return createErrorResponse("Property not found", 404);
      }

      if (maintenanceData.unitId) {
        const unitExists = property.units.some(
          (unit: any) => unit._id.toString() === maintenanceData.unitId
        );
        if (!unitExists) {
          return createErrorResponse(
            "Unit not found in the specified property",
            404
          );
        }
      }

      const tenant = await User.findOne({
        _id: maintenanceData.tenantId,
        role: UserRole.TENANT,
      });
      if (!tenant) {
        return createErrorResponse("Tenant not found", 404);
      }

      if (user.isTenant && user.id !== maintenanceData.tenantId) {
        return createErrorResponse(
          "You can only create maintenance requests for yourself",
          403
        );
      }

      if (maintenanceData.assignedTo) {
        const assignedUser = await User.findById(maintenanceData.assignedTo);
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
      }

      const maintenanceRequest = new MaintenanceRequest({
        ...maintenanceData,
        status: MaintenanceStatus.SUBMITTED,
      });
      await maintenanceRequest.save();

      await maintenanceRequest.populate([
        {
          path: "propertyId",
          select: "name address type",
          options: { lean: true },
        },
        {
          path: "tenantId",
          select: "firstName lastName email phone tenantStatus",
          options: { lean: true },
        },
        {
          path: "assignedTo",
          select: "firstName lastName email phone",
          options: { lean: true },
        },
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
        "Maintenance request created successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PUT /api/maintenance - Bulk update maintenance requests
// ============================================================================

export const PUT = withPermissionAndDB(
  ["maintenance_management", "bulk_operations"],
  { requireAllPermissions: true }
)(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      if (!user.isAdmin) {
        return createErrorResponse("Forbidden", 403);
      }

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      const { requestIds, updates } = body;

      if (!Array.isArray(requestIds) || requestIds.length === 0) {
        return createErrorResponse("Request IDs array is required", 400);
      }

      if (!updates || typeof updates !== "object") {
        return createErrorResponse("Updates object is required", 400);
      }

      const allowedUpdates = { ...updates };
      delete allowedUpdates._id;
      delete allowedUpdates.propertyId;
      delete allowedUpdates.tenantId;
      delete allowedUpdates.createdAt;
      delete allowedUpdates.updatedAt;

      const result = await MaintenanceRequest.updateMany(
        { _id: { $in: requestIds } },
        { $set: allowedUpdates }
      );

      return createSuccessResponse(
        {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
        },
        `${result.modifiedCount} maintenance requests updated successfully`
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// DELETE /api/maintenance - Bulk delete maintenance requests
// ============================================================================

export const DELETE = withPermissionAndDB(
  ["maintenance_management", "bulk_operations"],
  { requireAllPermissions: true }
)(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      if (!user.isAdmin) {
        return createErrorResponse("Forbidden", 403);
      }

      const { searchParams } = new URL(request.url);
      const requestIds = searchParams.get("ids")?.split(",") || [];

      if (requestIds.length === 0) {
        return createErrorResponse("Request IDs are required", 400);
      }

      const completedRequests = await MaintenanceRequest.find({
        _id: { $in: requestIds },
        status: MaintenanceStatus.COMPLETED,
      });

      if (completedRequests.length > 0) {
        return createErrorResponse(
          "Cannot delete completed maintenance requests.",
          409
        );
      }

      const result = await MaintenanceRequest.updateMany(
        { _id: { $in: requestIds } },
        { $set: { deletedAt: new Date() } }
      );

      return createSuccessResponse(
        {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
        },
        `${result.modifiedCount} maintenance requests deleted successfully`
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

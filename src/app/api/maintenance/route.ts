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
import { maintenanceListScope, assertMaintenancePropertyAccess } from "@/lib/maintenance-access";
import { ensureDefaultMaintenanceStaff } from "@/lib/default-maintenance-staff";

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
      let query: Record<string, unknown> = await maintenanceListScope(user, { deletedAt: null });

      if (filters.propertyId) {
        if (!user.isTenant && !(await assertMaintenancePropertyAccess(user, filters.propertyId))) {
          return createErrorResponse("Forbidden property", 403);
        }
        query.propertyId = filters.propertyId;
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

      // Resolve references manually. This avoids strict populate failures caused
      // by legacy maintenance documents and embedded property units.
      const rawRows = (result.data as any[]).map((row: any) =>
        typeof row?.toObject === "function" ? row.toObject() : row
      );
      const propertyIds = [...new Set(rawRows.map((row) => String(row.propertyId?._id ?? row.propertyId ?? "")).filter(Boolean))];
      const tenantIds = [...new Set(rawRows.map((row) => String(row.tenantId?._id ?? row.tenantId ?? "")).filter(Boolean))];
      const staffIds = [...new Set(rawRows.map((row) => String(row.assignedTo?._id ?? row.assignedTo ?? "")).filter(Boolean))];

      const [properties, tenants, staffRows] = await Promise.all([
        propertyIds.length
          ? Property.find({ _id: { $in: propertyIds } })
              .select("name address type isMultiUnit units")
              .lean()
          : [],
        tenantIds.length
          ? User.find({ _id: { $in: tenantIds } })
              .select("firstName lastName email phone tenantStatus")
              .lean()
          : [],
        staffIds.length
          ? User.find({ _id: { $in: staffIds } })
              .select("firstName lastName email phone")
              .lean()
          : [],
      ]);

      const propertyMap = new Map((properties as any[]).map((item) => [String(item._id), item]));
      const tenantMap = new Map((tenants as any[]).map((item) => [String(item._id), item]));
      const staffMap = new Map((staffRows as any[]).map((item) => [String(item._id), item]));

      const transformedData = rawRows.map((requestObj: any) => {
        const property = propertyMap.get(String(requestObj.propertyId?._id ?? requestObj.propertyId ?? "")) || null;
        const tenant = tenantMap.get(String(requestObj.tenantId?._id ?? requestObj.tenantId ?? "")) || null;
        const assignedTo = staffMap.get(String(requestObj.assignedTo?._id ?? requestObj.assignedTo ?? "")) || null;
        const unit = requestObj.unitId && property?.units
          ? property.units.find((embeddedUnit: any) =>
              String(embeddedUnit?._id) === String(requestObj.unitId?._id ?? requestObj.unitId)
            ) || null
          : null;

        return {
          ...requestObj,
          propertyId: property || requestObj.propertyId,
          property,
          unit,
          tenantId: tenant || requestObj.tenantId,
          tenant: tenant ? { user: tenant } : null,
          assignedTo,
        };
      });

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

      if (!user.isTenant && !(await assertMaintenancePropertyAccess(user, maintenanceData.propertyId))) {
        return createErrorResponse("Forbidden property", 403);
      }

      if (maintenanceData.unitId) {
        const unitExists = (property.units || []).some(
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

      // Every new request first enters the central E-IMMO maintenance queue.
      // A Super Admin can reassign it to a real technician afterwards.
      const defaultStaff = await ensureDefaultMaintenanceStaff();

      const maintenanceRequest = new MaintenanceRequest({
        ...maintenanceData,
        assignedTo: defaultStaff._id,
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

/**
 * PropertyPro - Inspections API Routes
 * CRUD operations for property inspection management
 */

import { NextRequest } from "next/server";
import { Inspection, Property } from "@/models";
import { UserRole } from "@/types";
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
  inspectionSchema,
  paginationSchema,
  validateSchema,
} from "@/lib/validations";

const INSPECTION_READ_PERMISSIONS = [
  "property_view",
  "property_management",
  "maintenance_view",
  "maintenance_management",
] as const;

const INSPECTION_WRITE_PERMISSIONS = [
  "property_management",
  "maintenance_management",
] as const;

// ============================================================================
// GET /api/inspections - Get all inspections with pagination and filtering
// ============================================================================

export const GET = withPermissionAndDB([...INSPECTION_READ_PERMISSIONS])(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const paginationParams = parsePaginationParams(searchParams);

    const validation = validateSchema(paginationSchema, paginationParams);
    if (!validation.success) {
      return createErrorResponse(validation.errors.join(", "), 400);
    }

    // Build query with filters
    const query: Record<string, unknown> = {};

    const status = searchParams.get("status");
    if (status) query.status = status;

    const type = searchParams.get("type");
    if (type) query.type = type;

    const propertyId = searchParams.get("propertyId");
    if (propertyId) query.propertyId = propertyId;

    const inspectorId = searchParams.get("inspectorId");
    if (inspectorId) query.inspectorId = inspectorId;

    const tenantId = searchParams.get("tenantId");
    if (tenantId) query.tenantId = tenantId;

    const overallCondition = searchParams.get("overallCondition");
    if (overallCondition) query.overallCondition = overallCondition;

    // Date range filter
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    if (fromDate || toDate) {
      query.scheduledDate = {};
      if (fromDate)
        (query.scheduledDate as Record<string, unknown>).$gte = new Date(
          fromDate
        );
      if (toDate)
        (query.scheduledDate as Record<string, unknown>).$lte = new Date(
          toDate
        );
    }

    const result = await paginateQuery(Inspection, query, paginationParams);

    // Populate references
    const populatedData = await Inspection.populate(result.data as any[], [
      {
        path: "propertyId",
        select: "name address type isMultiUnit units",
        options: { lean: true },
      },
      {
        path: "tenantId",
        select: "firstName lastName email phone",
        options: { lean: true },
      },
      {
        path: "inspectorId",
        select: "firstName lastName email phone avatar",
        options: { lean: true },
      },
      {
        path: "leaseId",
        select: "startDate endDate status",
        options: { lean: true },
      },
    ]);

    // Transform data
    const transformedData = (populatedData as unknown as any[]).map(
      (inspection: any) => ({
        ...inspection,
        property: inspection.propertyId,
        tenant: inspection.tenantId
          ? { user: inspection.tenantId }
          : null,
        inspector: inspection.inspectorId,
        lease: inspection.leaseId || null,
      })
    );

    return createSuccessResponse(
      transformedData,
      "Inspections retrieved successfully",
      result.pagination
    );
  } catch (error) {
    return handleApiError(error);
  }
  }
);

// ============================================================================
// POST /api/inspections - Create a new inspection
// ============================================================================

export const POST = withPermissionAndDB([...INSPECTION_WRITE_PERMISSIONS])(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error!, 400);
    }

    const validation = validateSchema(inspectionSchema as any, body);
    if (!validation.success) {
      return createErrorResponse(validation.errors.join(", "), 400);
    }

    const inspectionData = validation.data as any;

    // Verify property exists
    const property = await Property.findById(inspectionData.propertyId);
    if (!property) {
      return createErrorResponse("Property not found", 404);
    }

    // Create inspection
    const inspection = new Inspection(inspectionData);
    await inspection.save();

    // Populate references
    await inspection.populate([
      { path: "propertyId", select: "name address type" },
      { path: "tenantId", select: "firstName lastName email phone" },
      { path: "inspectorId", select: "firstName lastName email phone avatar" },
      { path: "leaseId", select: "startDate endDate status" },
    ]);

    const inspectionObj = inspection.toObject
      ? inspection.toObject()
      : inspection;
    const transformedInspection = {
      ...inspectionObj,
      property: inspectionObj.propertyId,
      tenant: inspectionObj.tenantId
        ? { user: inspectionObj.tenantId }
        : null,
      inspector: inspectionObj.inspectorId,
      lease: inspectionObj.leaseId || null,
    };

    return createSuccessResponse(
      transformedInspection,
      "Inspection created successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
  }
);

// ============================================================================
// DELETE /api/inspections - Bulk delete inspections (admin only)
// ============================================================================

export const DELETE = withAccessAndDB({
  permissions: ["bulk_operations", "property_management"],
  requireAllPermissions: true,
})(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    if (!user.isAdmin) {
      return createErrorResponse("Forbidden", 403);
    }

    const { searchParams } = new URL(request.url);
    const inspectionIds = searchParams.get("ids")?.split(",") || [];

    if (inspectionIds.length === 0) {
      return createErrorResponse("Inspection IDs are required", 400);
    }

    // Prevent deleting completed inspections
    const completedInspections = await Inspection.find({
      _id: { $in: inspectionIds },
      status: "completed",
    });

    if (completedInspections.length > 0) {
      return createErrorResponse(
        "Cannot delete completed inspections.",
        409
      );
    }

    // Soft delete
    const result = await Inspection.updateMany(
      { _id: { $in: inspectionIds } },
      { $set: { deletedAt: new Date() } }
    );

    return createSuccessResponse(
      {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
      `${result.modifiedCount} inspections deleted successfully`
    );
  } catch (error) {
    return handleApiError(error);
  }
  }
);

/**
 * PropertyPro - Individual Inspection API Routes
 * CRUD operations for individual inspection management
 */

import { NextRequest } from "next/server";
import { Inspection } from "@/models";
import { UserRole } from "@/types";
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
import { inspectionUpdateSchema, validateSchema } from "@/lib/validations";

const INSPECTION_READ_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: [
    "property_view",
    "property_management",
    "maintenance_view",
    "maintenance_management",
  ],
  match: "any" as const,
};

const INSPECTION_WRITE_PERMISSIONS = [
  "property_management",
  "maintenance_management",
] as const;

const resolveInspectionTenantId = (inspection: any): string | null => {
  const tenantId = inspection?.tenantId;

  if (!tenantId) {
    return null;
  }

  if (typeof tenantId === "string") {
    return tenantId;
  }

  if (tenantId._id) {
    return tenantId._id.toString();
  }

  return tenantId.toString?.() ?? null;
};

// ============================================================================
// GET /api/inspections/[id] - Get a specific inspection
// ============================================================================

export const GET = withAccessAndDB(INSPECTION_READ_ACCESS)(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return createErrorResponse("Invalid inspection ID", 400);
    }

    const inspection = await Inspection.findById(id)
      .populate("propertyId", "name address type isMultiUnit units")
      .populate("tenantId", "firstName lastName email phone avatar")
      .populate("inspectorId", "firstName lastName email phone avatar")
      .populate("leaseId", "startDate endDate status terms.rentAmount");

    if (!inspection) {
      return createErrorResponse("Inspection not found", 404);
    }

    // Tenants can only view inspections related to them
    if (user.isTenant && resolveInspectionTenantId(inspection) !== user.id) {
      return createErrorResponse(
        "You can only view inspections related to you",
        403,
      );
    }

    const inspectionObj = inspection.toObject
      ? inspection.toObject()
      : inspection;

    const transformedInspection = {
      ...inspectionObj,
      property: inspectionObj.propertyId,
      tenant: inspectionObj.tenantId ? { user: inspectionObj.tenantId } : null,
      inspector: inspectionObj.inspectorId,
      lease: inspectionObj.leaseId || null,
    };

    return createSuccessResponse(
      transformedInspection,
      "Inspection retrieved successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// PUT /api/inspections/[id] - Update an inspection
// ============================================================================

export const PUT = withPermissionAndDB([...INSPECTION_WRITE_PERMISSIONS])(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    try {
      const { id } = await params;
      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid inspection ID", 400);
      }

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      const inspection = await Inspection.findById(id);
      if (!inspection) {
        return createErrorResponse("Inspection not found", 404);
      }

      // Cannot edit completed inspections
      if (inspection.status === "completed") {
        return createErrorResponse("Cannot edit a completed inspection", 400);
      }

      const validation = validateSchema(inspectionUpdateSchema as any, body);
      if (!validation.success) {
        return createErrorResponse(validation.errors.join(", "), 400);
      }

      const updateData = validation.data as any;

      // Prevent changing certain fields after inspection has started
      if (inspection.status === "in_progress") {
        delete updateData.propertyId;
        delete updateData.type;
        delete updateData.scheduledDate;
      }

      Object.assign(inspection, updateData);
      await inspection.save();

      await inspection.populate([
        { path: "propertyId", select: "name address type" },
        { path: "tenantId", select: "firstName lastName email phone" },
        {
          path: "inspectorId",
          select: "firstName lastName email phone avatar",
        },
        {
          path: "leaseId",
          select: "startDate endDate status terms.rentAmount",
        },
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
        "Inspection updated successfully",
      );
    } catch (error) {
      return handleApiError(error);
    }
  },
);

// ============================================================================
// DELETE /api/inspections/[id] - Delete an inspection (soft delete)
// ============================================================================

export const DELETE = withPermissionAndDB([...INSPECTION_WRITE_PERMISSIONS])(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    try {
      const { id } = await params;
      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid inspection ID", 400);
      }

      const inspection = await Inspection.findById(id);
      if (!inspection) {
        return createErrorResponse("Inspection not found", 404);
      }

      if (inspection.status === "completed") {
        return createErrorResponse(
          "Cannot delete a completed inspection.",
          409,
        );
      }

      inspection.deletedAt = new Date();
      await inspection.save();

      return createSuccessResponse(
        { id: inspection._id },
        "Inspection deleted successfully",
      );
    } catch (error) {
      return handleApiError(error);
    }
  },
);

// ============================================================================
// PATCH /api/inspections/[id] - Status transitions and actions
// ============================================================================

export const PATCH = withAccessAndDB(INSPECTION_READ_ACCESS)(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    if (!isValidObjectId(id)) {
      return createErrorResponse("Invalid inspection ID", 400);
    }

    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error!, 400);
    }

    const inspection = await Inspection.findById(id);
    if (!inspection) {
      return createErrorResponse("Inspection not found", 404);
    }

    if (user.isTenant && resolveInspectionTenantId(inspection) !== user.id) {
      return createErrorResponse(
        "You can only modify inspections related to you",
        403,
      );
    }

    const { action, ...data } = body;

    switch (action) {
      case "start":
        if (user.isTenant) {
          return createErrorResponse("Tenants cannot start inspections", 403);
        }
        if (inspection.status !== "scheduled") {
          return createErrorResponse(
            "Can only start a scheduled inspection",
            400,
          );
        }
        inspection.status = "in_progress";
        break;

      case "complete":
        if (user.isTenant) {
          return createErrorResponse(
            "Tenants cannot complete inspections",
            403,
          );
        }
        if (inspection.status !== "in_progress") {
          return createErrorResponse(
            "Can only complete an in-progress inspection",
            400,
          );
        }
        if (!data.overallCondition) {
          return createErrorResponse(
            "Overall condition is required to complete an inspection",
            400,
          );
        }
        inspection.status = "completed";
        inspection.completedDate = new Date();
        inspection.overallCondition = data.overallCondition;
        if (data.notes) inspection.notes = data.notes;
        break;

      case "cancel":
        if (user.isTenant) {
          return createErrorResponse("Tenants cannot cancel inspections", 403);
        }
        if (inspection.status === "completed") {
          return createErrorResponse(
            "Cannot cancel a completed inspection",
            400,
          );
        }
        inspection.status = "cancelled";
        if (data.reason) inspection.notes = data.reason;
        break;

      case "addItem":
        if (user.isTenant) {
          return createErrorResponse(
            "Tenants cannot add inspection items",
            403,
          );
        }
        if (!data.room || !data.item || !data.condition) {
          return createErrorResponse(
            "Room, item, and condition are required",
            400,
          );
        }
        inspection.items.push({
          room: data.room,
          item: data.item,
          condition: data.condition,
          notes: data.notes || "",
          photos: data.photos || [],
          requiresAttention: ["poor", "damaged"].includes(data.condition),
        });
        break;

      case "updateItem":
        if (user.isTenant) {
          return createErrorResponse(
            "Tenants cannot update inspection items",
            403,
          );
        }
        if (data.itemIndex === undefined || data.itemIndex < 0) {
          return createErrorResponse("Valid item index is required", 400);
        }
        if (data.itemIndex >= inspection.items.length) {
          return createErrorResponse("Item index out of range", 400);
        }
        if (data.condition)
          inspection.items[data.itemIndex].condition = data.condition;
        if (data.notes !== undefined)
          inspection.items[data.itemIndex].notes = data.notes;
        if (data.photos) inspection.items[data.itemIndex].photos = data.photos;
        inspection.items[data.itemIndex].requiresAttention = [
          "poor",
          "damaged",
        ].includes(
          data.condition || inspection.items[data.itemIndex].condition,
        );
        break;

      case "addTenantSignature":
        if (!data.signature) {
          return createErrorResponse("Signature data is required", 400);
        }
        inspection.tenantSignature = {
          signedAt: new Date(),
          signature: data.signature,
          ipAddress: data.ipAddress || "",
        };
        break;

      case "addInspectorSignature":
        if (user.isTenant) {
          return createErrorResponse(
            "Tenants cannot add inspector signatures",
            403,
          );
        }
        if (!data.signature) {
          return createErrorResponse("Signature data is required", 400);
        }
        inspection.inspectorSignature = {
          signedAt: new Date(),
          signature: data.signature,
        };
        break;

      default:
        return createErrorResponse("Invalid action specified", 400);
    }

    await inspection.save();

    await inspection.populate([
      { path: "propertyId", select: "name address type" },
      { path: "tenantId", select: "firstName lastName email phone" },
      { path: "inspectorId", select: "firstName lastName email phone avatar" },
    ]);

    return createSuccessResponse(
      inspection,
      `Inspection ${action} completed successfully`,
    );
  } catch (error) {
    return handleApiError(error);
  }
});

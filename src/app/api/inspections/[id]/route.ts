/**
 * PropertyPro - Individual Inspection API Routes
 */

import { NextRequest } from "next/server";
import { Inspection } from "@/models";
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
import { UserRole } from "@/types";
import {
  canAccessInspection,
  validateInspectionRelations,
} from "@/lib/inspection-access";

const READ_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: [
    "property_view",
    "property_management",
    "maintenance_view",
    "maintenance_management",
  ],
  match: "any" as const,
};
const WRITE_PERMISSIONS = ["property_management", "maintenance_management"] as const;

function transformInspection(inspection: any) {
  const object = inspection?.toObject ? inspection.toObject() : inspection;
  const tenantRecord = object.tenantId || null;
  const tenantUser = tenantRecord?.userId || tenantRecord?.user || tenantRecord;

  return {
    ...object,
    property: object.propertyId,
    tenant: tenantRecord
      ? {
          ...tenantRecord,
          user: tenantUser,
        }
      : null,
    inspector: object.inspectorId,
    lease: object.leaseId || null,
  };
}

async function populateInspection(inspection: any) {
  await inspection.populate([
    { path: "propertyId", select: "name address type isMultiUnit units" },
    { path: "tenantId", populate: { path: "userId", select: "firstName lastName email phone avatar" } },
    { path: "inspectorId", select: "firstName lastName email phone avatar" },
    { path: "leaseId", select: "startDate endDate status terms.rentAmount" },
  ]);
  return inspection;
}

export const GET = withAccessAndDB(READ_ACCESS)(async (
  user: AuthenticatedAccessUser,
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return createErrorResponse("Invalid inspection ID", 400);

    const inspection = await Inspection.findById(id);
    if (!inspection) return createErrorResponse("Inspection not found", 404);
    if (!(await canAccessInspection(user, inspection))) {
      return createErrorResponse("Access denied", 403);
    }

    await populateInspection(inspection);
    return createSuccessResponse(transformInspection(inspection), "Inspection retrieved successfully");
  } catch (error) {
    return handleApiError(error);
  }
});

export const PUT = withPermissionAndDB([...WRITE_PERMISSIONS])(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    try {
      const { id } = await params;
      if (!isValidObjectId(id)) return createErrorResponse("Invalid inspection ID", 400);

      const inspection = await Inspection.findById(id);
      if (!inspection) return createErrorResponse("Inspection not found", 404);
      if (!(await canAccessInspection(user, inspection))) {
        return createErrorResponse("Access denied", 403);
      }
      if (inspection.status === "completed") {
        return createErrorResponse("Cannot edit a completed inspection", 409);
      }

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) return createErrorResponse(error!, 400);
      const validation = validateSchema(inspectionUpdateSchema as any, body);
      if (!validation.success) {
        return createErrorResponse(validation.errors.join(", "), 400);
      }

      const updateData = validation.data as any;
      if (inspection.status === "in_progress") {
        delete updateData.propertyId;
        delete updateData.type;
        delete updateData.scheduledDate;
        delete updateData.tenantId;
        delete updateData.leaseId;
      }

      const target = {
        propertyId: updateData.propertyId ?? inspection.propertyId,
        tenantId: updateData.tenantId ?? inspection.tenantId,
        leaseId: updateData.leaseId ?? inspection.leaseId,
      };
      const relationCheck = await validateInspectionRelations(user, target);
      if (!relationCheck.ok) {
        return createErrorResponse(relationCheck.message, relationCheck.status);
      }

      Object.assign(inspection, updateData);
      await inspection.save();
      await populateInspection(inspection);
      return createSuccessResponse(transformInspection(inspection), "Inspection updated successfully");
    } catch (error) {
      return handleApiError(error);
    }
  },
);

export const DELETE = withPermissionAndDB([...WRITE_PERMISSIONS])(
  async (
    user: AuthenticatedAccessUser,
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    try {
      const { id } = await params;
      if (!isValidObjectId(id)) return createErrorResponse("Invalid inspection ID", 400);

      const inspection = await Inspection.findById(id);
      if (!inspection) return createErrorResponse("Inspection not found", 404);
      if (!(await canAccessInspection(user, inspection))) {
        return createErrorResponse("Access denied", 403);
      }
      if (inspection.status === "completed") {
        return createErrorResponse("Cannot delete a completed inspection", 409);
      }

      inspection.deletedAt = new Date();
      await inspection.save();
      return createSuccessResponse({ id: inspection._id }, "Inspection deleted successfully");
    } catch (error) {
      return handleApiError(error);
    }
  },
);

export const PATCH = withAccessAndDB(READ_ACCESS)(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return createErrorResponse("Invalid inspection ID", 400);

    const inspection = await Inspection.findById(id);
    if (!inspection) return createErrorResponse("Inspection not found", 404);
    if (!(await canAccessInspection(user, inspection))) {
      return createErrorResponse("Access denied", 403);
    }

    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) return createErrorResponse(error!, 400);
    const { action, ...data } = body as any;

    // A tenant may only sign their own inspection.
    if (user.isTenant && action !== "addTenantSignature") {
      return createErrorResponse("Tenants may only add their signature", 403);
    }

    switch (action) {
      case "start":
        if (inspection.status !== "scheduled") {
          return createErrorResponse("Can only start a scheduled inspection", 409);
        }
        inspection.status = "in_progress";
        break;
      case "complete":
        if (inspection.status !== "in_progress") {
          return createErrorResponse("Can only complete an in-progress inspection", 409);
        }
        if (!data.overallCondition) {
          return createErrorResponse("Overall condition is required", 400);
        }
        inspection.status = "completed";
        inspection.completedDate = new Date();
        inspection.overallCondition = data.overallCondition;
        if (data.notes !== undefined) inspection.notes = data.notes;
        break;
      case "cancel":
        if (inspection.status === "completed") {
          return createErrorResponse("Cannot cancel a completed inspection", 409);
        }
        inspection.status = "cancelled";
        if (data.reason !== undefined) inspection.notes = data.reason;
        break;
      case "addItem":
        if (!data.room || !data.item || !data.condition) {
          return createErrorResponse("Room, item and condition are required", 400);
        }
        inspection.items.push({
          room: data.room,
          item: data.item,
          condition: data.condition,
          notes: data.notes || "",
          photos: Array.isArray(data.photos) ? data.photos : [],
          requiresAttention: ["poor", "damaged"].includes(data.condition),
        });
        break;
      case "updateItem": {
        const index = Number(data.itemIndex);
        if (!Number.isInteger(index) || index < 0 || index >= inspection.items.length) {
          return createErrorResponse("Valid item index is required", 400);
        }
        if (data.condition) inspection.items[index].condition = data.condition;
        if (data.notes !== undefined) inspection.items[index].notes = data.notes;
        if (Array.isArray(data.photos)) inspection.items[index].photos = data.photos;
        inspection.items[index].requiresAttention = ["poor", "damaged"].includes(
          data.condition || inspection.items[index].condition,
        );
        break;
      }
      case "addTenantSignature":
        if (!data.signature) return createErrorResponse("Signature data is required", 400);
        inspection.tenantSignature = {
          signedAt: new Date(),
          signature: data.signature,
          ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
        } as any;
        break;
      case "addInspectorSignature":
        if (!data.signature) return createErrorResponse("Signature data is required", 400);
        inspection.inspectorSignature = { signedAt: new Date(), signature: data.signature } as any;
        break;
      default:
        return createErrorResponse("Invalid action specified", 400);
    }

    await inspection.save();
    await populateInspection(inspection);
    return createSuccessResponse(transformInspection(inspection), `Inspection ${action} completed successfully`);
  } catch (error) {
    return handleApiError(error);
  }
});

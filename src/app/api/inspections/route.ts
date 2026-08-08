/**
 * PropertyPro - Inspections API Routes
 * Scoped CRUD operations for property inspections.
 */

import { NextRequest } from "next/server";
import { Inspection, Lease, Tenant } from "@/models";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  parsePaginationParams,
  paginateQuery,
  parseRequestBody,
  isValidObjectId,
  withAccessAndDB,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { inspectionSchema, paginationSchema, validateSchema } from "@/lib/validations";
import { UserRole } from "@/types";
import {
  inspectionListScope,
  validateInspectionRelations,
} from "@/lib/inspection-access";
import { canAccessProperty } from "@/lib/property-scope";
import { ensureDefaultMaintenanceStaff } from "@/lib/default-maintenance-staff";

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

function validDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function transformInspection(inspection: any) {
  const object = inspection?.toObject ? inspection.toObject() : inspection;
  return {
    ...object,
    property: object.propertyId,
    tenant: object.tenantId ? { user: object.tenantId } : null,
    inspector: object.inspectorId,
    lease: object.leaseId || null,
  };
}

export const GET = withAccessAndDB(READ_ACCESS)(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
) => {
  try {
    const { searchParams } = new URL(request.url);
    const paginationParams = parsePaginationParams(searchParams);
    const validation = validateSchema(paginationSchema, paginationParams);
    if (!validation.success) {
      return createErrorResponse(validation.errors.join(", "), 400);
    }

    let query: Record<string, any> = {};

    for (const key of ["status", "type", "overallCondition"] as const) {
      const value = searchParams.get(key);
      if (value) query[key] = value;
    }

    const fromRaw = searchParams.get("fromDate");
    const toRaw = searchParams.get("toDate");
    const fromDate = validDate(fromRaw);
    const toDate = validDate(toRaw);
    if ((fromRaw && !fromDate) || (toRaw && !toDate)) {
      return createErrorResponse("Invalid date range", 400);
    }
    if (fromDate || toDate) {
      query.scheduledDate = {};
      if (fromDate) query.scheduledDate.$gte = fromDate;
      if (toDate) query.scheduledDate.$lte = toDate;
    }

    query = await inspectionListScope(user, query);

    // Tenant-supplied identifiers must never widen their own scope.
    if (!user.isTenant) {
      const propertyId = searchParams.get("propertyId");
      if (propertyId) {
        if (!isValidObjectId(propertyId)) {
          return createErrorResponse("Invalid property ID", 400);
        }
        if (!(await canAccessProperty(user, propertyId))) {
          return createErrorResponse("Access denied for this property", 403);
        }
        query.propertyId = propertyId;
      }

      for (const key of ["inspectorId", "tenantId"] as const) {
        const value = searchParams.get(key);
        if (value) {
          if (!isValidObjectId(value)) {
            return createErrorResponse(`Invalid ${key}`, 400);
          }
          query[key] = value;
        }
      }
    }

    const result = await paginateQuery(Inspection, query, paginationParams);
    const populated = await Inspection.populate(result.data as any[], [
      { path: "propertyId", select: "name address type isMultiUnit units", options: { lean: true } },
      { path: "tenantId", populate: { path: "userId", select: "firstName lastName email phone avatar" }, options: { lean: true } },
      { path: "inspectorId", select: "firstName lastName email phone avatar", options: { lean: true } },
      { path: "leaseId", select: "startDate endDate status terms.rentAmount", options: { lean: true } },
    ]);

    return createSuccessResponse(
      (populated as any[]).map(transformInspection),
      "Inspections retrieved successfully",
      result.pagination,
    );
  } catch (error) {
    return handleApiError(error);
  }
});

export const POST = withPermissionAndDB([...WRITE_PERMISSIONS])(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) return createErrorResponse(error!, 400);

      const normalizedBody: any = { ...(body as any) };

      // A JSON date always arrives as text. Convert it before Zod validation.
      if (typeof normalizedBody.scheduledDate === "string") {
        const parsedDate = new Date(normalizedBody.scheduledDate);
        if (Number.isNaN(parsedDate.getTime())) {
          return createErrorResponse("Date planifiée invalide", 400);
        }
        normalizedBody.scheduledDate = parsedDate;
      }

      // Every inspection is initially received by the E-IMMO staff account.
      const eImmoStaff = await ensureDefaultMaintenanceStaff();
      normalizedBody.inspectorId = eImmoStaff._id.toString();

      if (normalizedBody.leaseId) {
        const lease = await Lease.findOne({
          _id: normalizedBody.leaseId,
          deletedAt: null,
          status: "active",
        }).select("propertyId tenantId unitId status").lean();

        if (!lease) {
          return createErrorResponse("Le bail actif sélectionné est introuvable", 404);
        }
        if (String(lease.propertyId) !== String(normalizedBody.propertyId)) {
          return createErrorResponse("Le bail sélectionné n’appartient pas à cette propriété", 400);
        }

        const tenantRecord = await Tenant.findOne({
          userId: lease.tenantId,
          deletedAt: null,
        }).select("_id").lean();

        if (!tenantRecord) {
          return createErrorResponse("Le dossier locataire lié à ce bail est introuvable", 404);
        }

        // The tenant is always derived from the lease; never trust a free-form tenantId.
        normalizedBody.tenantId = tenantRecord._id.toString();
      } else {
        // An inspection without a lease is an off-rental inspection.
        delete normalizedBody.tenantId;
      }

      const validation = validateSchema(inspectionSchema as any, normalizedBody);
      if (!validation.success) {
        return createErrorResponse(validation.errors.join(", "), 400);
      }

      const data = validation.data as any;
      const relationCheck = await validateInspectionRelations(user, data);
      if (!relationCheck.ok) {
        return createErrorResponse(relationCheck.message, relationCheck.status);
      }

      const inspection = await Inspection.create(data);
      await inspection.populate([
        { path: "propertyId", select: "name address type" },
        { path: "tenantId", populate: { path: "userId", select: "firstName lastName email phone avatar" } },
        { path: "inspectorId", select: "firstName lastName email phone avatar" },
        { path: "leaseId", select: "startDate endDate status terms.rentAmount" },
      ]);

      return createSuccessResponse(transformInspection(inspection), "Inspection created successfully");
    } catch (error) {
      return handleApiError(error);
    }
  },
);

export const DELETE = withAccessAndDB({
  permissions: ["bulk_operations", "property_management"],
  requireAllPermissions: true,
})(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const ids = (new URL(request.url).searchParams.get("ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (!ids.length || ids.some((id) => !isValidObjectId(id))) {
      return createErrorResponse("Valid inspection IDs are required", 400);
    }

    const scopedQuery = await inspectionListScope(user, { _id: { $in: ids } });
    const inaccessibleCount = ids.length - (await Inspection.countDocuments(scopedQuery));
    if (inaccessibleCount > 0) {
      return createErrorResponse("One or more inspections are outside your scope", 403);
    }

    const completed = await Inspection.exists({ ...scopedQuery, status: "completed" });
    if (completed) {
      return createErrorResponse("Cannot delete completed inspections", 409);
    }

    const result = await Inspection.updateMany(scopedQuery, { $set: { deletedAt: new Date() } });
    return createSuccessResponse(
      { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount },
      `${result.modifiedCount} inspections deleted successfully`,
    );
  } catch (error) {
    return handleApiError(error);
  }
});

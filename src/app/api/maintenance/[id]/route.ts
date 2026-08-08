import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { MaintenanceRequest, Property, User } from "@/models";
import { MaintenanceStatus, UserRole } from "@/types";
import {
  AuthenticatedAccessUser,
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  isValidObjectId,
  parseRequestBody,
  withAccessAndDB,
} from "@/lib/api-utils";
import {
  canAccessMaintenanceRequest,
  assertMaintenancePropertyAccess,
} from "@/lib/maintenance-access";

const ACCESS = {
  roles: [UserRole.TENANT],
  permissions: [
    "maintenance_view",
    "maintenance_management",
    "maintenance_assign",
    "work_orders",
  ],
  match: "any" as const,
};

const WRITE = {
  roles: [UserRole.TENANT],
  permissions: [
    "maintenance_management",
    "maintenance_assign",
    "work_orders",
  ],
  match: "any" as const,
};

function asId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asId(record._id ?? record.id);
  }
  return null;
}

async function loadRaw(id: string) {
  return MaintenanceRequest.findOne({ _id: id, deletedAt: null });
}

async function buildMaintenanceDetail(item: any) {
  const raw = typeof item?.toObject === "function" ? item.toObject() : item;

  const propertyId = asId(raw?.propertyId);
  const tenantId = asId(raw?.tenantId);
  const assignedToId = asId(raw?.assignedTo);
  const unitId = asId(raw?.unitId);

  const [property, tenantUser, assignedTo] = await Promise.all([
    propertyId && mongoose.isValidObjectId(propertyId)
      ? Property.findById(propertyId)
          .select("name address type isMultiUnit units ownerId managerId")
          .lean()
      : null,
    tenantId && mongoose.isValidObjectId(tenantId)
      ? User.findById(tenantId)
          .select("firstName lastName email phone avatar tenantStatus")
          .lean()
      : null,
    assignedToId && mongoose.isValidObjectId(assignedToId)
      ? User.findById(assignedToId)
          .select("firstName lastName email phone avatar")
          .lean()
      : null,
  ]);

  const unit =
    unitId && Array.isArray((property as any)?.units)
      ? (property as any).units.find(
          (candidate: any) => asId(candidate?._id) === unitId
        ) ?? null
      : null;

  return {
    ...raw,
    propertyId: property ?? raw.propertyId,
    property: property ?? null,
    unitId: unit ?? raw.unitId,
    unit,
    tenantId: tenantUser ?? raw.tenantId,
    tenant: tenantUser ? { user: tenantUser } : null,
    assignedTo: assignedTo ?? raw.assignedTo ?? null,
  };
}

export const GET = withAccessAndDB(ACCESS)(
  async (
    user: AuthenticatedAccessUser,
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid maintenance request ID", 400);
      }

      const item = await loadRaw(id);
      if (!item) {
        return createErrorResponse("Maintenance request not found", 404);
      }
      if (!(await canAccessMaintenanceRequest(user, item))) {
        return createErrorResponse("Forbidden", 403);
      }

      return createSuccessResponse(
        await buildMaintenanceDetail(item),
        "Maintenance request retrieved successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

export const PATCH = withAccessAndDB(WRITE)(
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

      const item = await loadRaw(id);
      if (!item) {
        return createErrorResponse("Maintenance request not found", 404);
      }
      if (!(await canAccessMaintenanceRequest(user, item))) {
        return createErrorResponse("Forbidden", 403);
      }

      const parsed = await parseRequestBody(request);
      if (!parsed.success) {
        return createErrorResponse(parsed.error!, 400);
      }
      const body: any = parsed.data;

      if (user.isTenant) {
        if (String(item.tenantId) !== user.id) {
          return createErrorResponse("Forbidden", 403);
        }
        if (![MaintenanceStatus.SUBMITTED].includes(item.status as MaintenanceStatus)) {
          return createErrorResponse(
            "This request can no longer be edited by the tenant",
            409
          );
        }
      }

      const forbidden = [
        "_id",
        "tenantId",
        "createdAt",
        "updatedAt",
        "deletedAt",
      ];
      forbidden.forEach((key) => delete body[key]);

      if (user.isTenant) {
        [
          "status",
          "assignedTo",
          "estimatedCost",
          "actualCost",
          "completedDate",
        ].forEach((key) => delete body[key]);
      }

      if (
        body.propertyId &&
        !(await assertMaintenancePropertyAccess(user, body.propertyId))
      ) {
        return createErrorResponse("Forbidden property", 403);
      }

      if (body.propertyId) {
        const property = await Property.findById(body.propertyId)
          .select("units")
          .lean();
        if (!property) {
          return createErrorResponse("Property not found", 404);
        }
        if (
          body.unitId &&
          !(property.units || []).some(
            (unit: any) => String(unit._id) === String(body.unitId)
          )
        ) {
          return createErrorResponse(
            "Unit not found in the specified property",
            404
          );
        }
      }

      if (body.assignedTo) {
        const assignee = await User.findById(body.assignedTo)
          .select("isActive")
          .lean();
        if (!assignee || !(assignee as any).isActive) {
          return createErrorResponse("Assigned user not found", 404);
        }
      }

      Object.assign(item, body);
      await item.save();

      return createSuccessResponse(
        await buildMaintenanceDetail(item),
        "Maintenance request updated successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

export const DELETE = withAccessAndDB(WRITE)(
  async (
    user: AuthenticatedAccessUser,
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid maintenance request ID", 400);
      }

      const item = await loadRaw(id);
      if (!item) {
        return createErrorResponse("Maintenance request not found", 404);
      }
      if (!(await canAccessMaintenanceRequest(user, item))) {
        return createErrorResponse("Forbidden", 403);
      }
      if (item.status === MaintenanceStatus.COMPLETED) {
        return createErrorResponse(
          "Completed requests cannot be deleted",
          409
        );
      }
      if (user.isTenant && String(item.tenantId) !== user.id) {
        return createErrorResponse("Forbidden", 403);
      }

      item.deletedAt = new Date();
      await item.save();
      return createSuccessResponse(
        { id },
        "Maintenance request deleted successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

/**
 * PropertyPro - Tenant Maintenance API
 * API endpoints for tenant maintenance request management
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { MaintenanceRequest, Lease, Property } from "@/models";
import { UserRole, MaintenanceStatus } from "@/types";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
  parsePaginationParams,
  parseRequestBody,
} from "@/lib/api-utils";
import { maintenanceRequestSchema, validateSchema } from "@/lib/validations";
import { ensureDefaultMaintenanceStaff } from "@/lib/default-maintenance-staff";

// ============================================================================
// GET /api/tenant/maintenance - Get tenant's maintenance requests
// ============================================================================

export const GET = withPermissionAndDB("maintenance_requests")(
  async (user, request: NextRequest, context?: { tenantProfile?: any }) => {
    try {
      const { searchParams } = new URL(request.url);

      // Parse pagination parameters
      const { page, limit } = parsePaginationParams(searchParams);

      // Get filters
      const status = searchParams.get("status");
      const priority = searchParams.get("priority");
      const category = searchParams.get("category");

      const tenant = context?.tenantProfile;
      if (!tenant) {
        return createErrorResponse("Tenant profile unavailable", 500);
      }

      // Require at least one active lease for this tenant
      const hasActiveLease = await Lease.exists({
        $or: [{ tenantId: user.id }, { tenantId: tenant._id }],
        status: "active",
      });
      if (!hasActiveLease) {
        return createErrorResponse(
          "You must have an active lease to submit a maintenance request",
          403
        );
      }

      // Build query - try both User ID and Tenant ID approaches
      let query: any = {
        $or: [{ tenantId: user.id }, { tenantId: tenant._id }],
      };

      if (status && status !== "all") {
        query.status = status;
      }

      if (priority && priority !== "all") {
        query.priority = priority;
      }

      if (category && category !== "all") {
        query.category = category;
      }

      // Get maintenance requests with pagination
      const maintenanceRequests = await MaintenanceRequest.find(query)
        .populate("propertyId", "name address")
        .populate("assignedTo", "firstName lastName")
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit);

      const totalRequests = await MaintenanceRequest.countDocuments(query);
      const totalPages = Math.ceil(totalRequests / limit);

      return createSuccessResponse({
        maintenanceRequests,
        pagination: {
          page,
          limit,
          total: totalRequests,
          pages: totalPages,
        },
      });
    } catch (error) {
      return handleApiError(error, "Failed to fetch maintenance requests");
    }
  }
);

// ============================================================================
// POST /api/tenant/maintenance - Create a new maintenance request
// ============================================================================

export const POST = withPermissionAndDB("maintenance_requests")(
  async (user, request: NextRequest, context?: { tenantProfile?: any }) => {
    try {
      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      const tenant = context?.tenantProfile;
      if (!tenant) {
        return createErrorResponse("Tenant profile unavailable", 500);
      }

      // If leaseId is provided, validate it and get property info
      const normalizeId = (value: unknown): string | undefined => {
        if (!value) return undefined;
        if (typeof value === "string") {
          // Return undefined for empty strings
          const trimmed = value.trim();
          return trimmed === "" ? undefined : trimmed;
        }
        if (typeof value === "object") {
          const maybeObj = value as { _id?: unknown; toString?: () => string };
          if (typeof maybeObj._id === "string") {
            return maybeObj._id;
          }
          if (
            maybeObj._id &&
            typeof (maybeObj._id as { toString?: () => string }).toString ===
              "function"
          ) {
            return (maybeObj._id as { toString: () => string }).toString();
          }
          if (typeof maybeObj.toString === "function") {
            return maybeObj.toString();
          }
        }
        return undefined;
      };

      let propertyId = normalizeId(body.propertyId);
      let unitId = normalizeId(body.unitId);
      const contactPhone =
        typeof body.contactPhone === "string" && body.contactPhone.trim() !== ""
          ? body.contactPhone.trim()
          : undefined;

      if (body.leaseId) {
        const lease = await Lease.findOne({
          _id: body.leaseId,
          $or: [{ tenantId: user.id }, { tenantId: tenant._id }],
        }).populate("propertyId");

        if (!lease) {
          return createErrorResponse("Lease not found or access denied", 404);
        }

        propertyId = normalizeId(lease.propertyId?._id) || propertyId;
        unitId = unitId || normalizeId(lease.unitId);
      }

      if (!propertyId) {
        return createErrorResponse("Property ID is required", 400);
      }

      // Validate unitId if provided
      if (unitId) {
        const property = await Property.findById(propertyId);
        if (!property) {
          return createErrorResponse("Property not found", 404);
        }

        // Check if the unitId exists in the property's units array
        const unitExists = property.units?.some(
          (unit: any) => unit._id.toString() === unitId.toString()
        );

        if (!unitExists) {
          return createErrorResponse(
            "Invalid unit ID. The unit does not exist in the specified property.",
            400
          );
        }
      }

      // Prepare maintenance request data
      const maintenanceData: any = {
        title: body.title,
        description: body.description,
        category: body.category || "Other",
        priority: body.priority || "medium",
        propertyId,
        tenantId: user.id, // Always use User ID for consistency
        status: MaintenanceStatus.SUBMITTED,
        images: body.images || [],
      };

      // Only include unitId if it's defined and not empty
      if (unitId) {
        maintenanceData.unitId = unitId;
      }

      // Only include contactPhone if it's defined and not empty
      if (contactPhone) {
        maintenanceData.contactPhone = contactPhone;
      }

      // Validate the maintenance request data
      const validation = validateSchema(
        maintenanceRequestSchema,
        maintenanceData
      );
      if (!validation.success) {
        return createErrorResponse(validation.errors.join(", "), 400);
      }

      // Every request first enters the central E-IMMO maintenance queue.
      const defaultStaff = await ensureDefaultMaintenanceStaff();
      maintenanceData.assignedTo = defaultStaff._id;

      // Create the maintenance request
      const maintenanceRequest = new MaintenanceRequest(maintenanceData);
      await maintenanceRequest.save();

      // Populate the response data
      await maintenanceRequest.populate([
        {
          path: "propertyId",
          select: "name address type",
        },
        {
          path: "assignedTo",
          select: "firstName lastName email",
        },
      ]);

      return createSuccessResponse(
        maintenanceRequest,
        "Maintenance request created successfully",
        undefined,
        201
      );
    } catch (error) {
      return handleApiError(error, "Failed to create maintenance request");
    }
  }
);

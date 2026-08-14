/**
 * PropertyPro - Lease Termination API Route
 * Handle lease termination process with proper notice and documentation
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Lease, Property, MaintenanceRequest } from "@/models";
import { LeaseStatus, MaintenanceStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withAccessAndDB,
  parseRequestBody,
  isValidObjectId,
} from "@/lib/api-utils";
import {
  LEASE_PATCH_ACCESS,
  canManageLeases,
  canAccessLease,
  isLeaseTenantUser,
} from "@/lib/lease-access";

// ============================================================================
// POST /api/leases/[id]/terminate - Terminate a lease
// ============================================================================

export const POST = withAccessAndDB(LEASE_PATCH_ACCESS)(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid lease ID", 400);
      }

      const { success, data: body } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse("Invalid request body", 400);
      }

      const { terminationDate, reason, notice, moveOutInspection } = body;

      // Find the lease
      const lease = (await Lease.findById(id)
        .populate("tenantId")
        .populate("propertyId", "name address")) as any;

      if (!lease) {
        return createErrorResponse("Bail introuvable", 404);
      }

      // Check permissions
      const canTerminate = await canAccessLease(user, lease);

      if (!canTerminate) {
        return createErrorResponse("Access denied", 403);
      }

      // Check if lease can be terminated
      if (lease.status !== LeaseStatus.ACTIVE) {
        return createErrorResponse("Only active leases can be terminated", 400);
      }

      // Validate termination date
      const termDate = new Date(terminationDate);
      const today = new Date();

      if (termDate < today) {
        return createErrorResponse(
          "Termination date cannot be in the past",
          400
        );
      }

      // Check notice period (typically 30 days)
      const noticeRequired = 30; // days
      const noticePeriod = Math.ceil(
        (termDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (noticePeriod < noticeRequired && user.isTenant) {
        return createErrorResponse(
          `Minimum ${noticeRequired} days notice required`,
          400
        );
      }

      // Validate required fields
      if (!reason) {
        return createErrorResponse("Termination reason is required", 400);
      }

      // Terminate the lease
      await lease.terminate(user.id, termDate, reason, notice);

      // Update unit status to available
      if (lease.unitId) {
        await Property.updateOne(
          { _id: lease.propertyId._id, "units._id": lease.unitId },
          {
            $set: {
              "units.$.status": "available",
              "units.$.currentTenantId": null,
              "units.$.currentLeaseId": null,
            },
          }
        );
      } else {
        // Fallback for old leases without unitId - update property status
        await Property.findByIdAndUpdate(lease.propertyId._id, {
          status: "available",
        });
      }

      // Close any open maintenance requests for this property
      await MaintenanceRequest.updateMany(
        {
          propertyId: lease.propertyId._id,
          tenantId: lease.tenantId._id,
          status: {
            $in: [
              MaintenanceStatus.SUBMITTED,
              MaintenanceStatus.ASSIGNED,
              MaintenanceStatus.IN_PROGRESS,
            ],
          },
        },
        {
          status: MaintenanceStatus.CANCELLED,
          notes: "Lease terminated - maintenance request cancelled",
        }
      );

      // Schedule move-out inspection if requested
      if (moveOutInspection?.schedule) {
        // In a real implementation, this would create an inspection record
        // For now, we'll add it to the lease notes
        lease.notes =
          (lease.notes || "") +
          `\nMove-out inspection scheduled for ${moveOutInspection.date}`;
        await lease.save();
      }

      // Populate the response
      await lease.populate([
        {
          path: "tenantId",
          select: "firstName lastName email",
        },
        { path: "propertyId", select: "name address type" },
      ]);

      return createSuccessResponse(
        {
          lease,
          terminationDetails: {
            terminatedBy: user.id,
            terminationDate: termDate,
            reason,
            notice,
            propertyStatusUpdated: true,
            maintenanceRequestsClosed: true,
          },
        },
        "Lease terminated successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// GET /api/leases/[id]/terminate - Get lease termination information
// ============================================================================

export const GET = withAccessAndDB(LEASE_PATCH_ACCESS)(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid lease ID", 400);
      }

      // Find the lease
      const lease = (await Lease.findById(id)
        .populate("tenantId")
        .populate("propertyId", "name address")) as any;

      if (!lease) {
        return createErrorResponse("Bail introuvable", 404);
      }

      // Check permissions
      const canView = await canAccessLease(user, lease);

      if (!canView) {
        return createErrorResponse("Access denied", 403);
      }

      // Calculate termination information
      const today = new Date();
      const leaseEndDate = new Date(lease.endDate);
      const daysUntilExpiration = Math.ceil(
        (leaseEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      const terminationInfo = {
        leaseId: lease._id,
        status: lease.status,
        canTerminate: lease.status === LeaseStatus.ACTIVE,
        isExpired: daysUntilExpiration <= 0,
        daysUntilExpiration,
        requirements: {
          noticeRequired: 30, // days
          reasonRequired: true,
          moveOutInspection: true,
        },
        tenant: {
          name: `${lease.tenantId.firstName} ${lease.tenantId.lastName}`,
          email: lease.tenantId.email,
        },
        property: {
          name: lease.propertyId.name,
          address: lease.propertyId.address,
        },
        terms: {
          startDate: lease.startDate,
          endDate: lease.endDate,
          monthlyRent: lease.terms.rentAmount,
          securityDeposit: lease.terms.securityDeposit,
        },
        terminationReasons: [
          "End of lease term",
          "Early termination by tenant",
          "Lease violation",
          "Property sale",
          "Renovation required",
          "Autre",
        ],
      };

      return createSuccessResponse({ terminationInfo });
    } catch (error) {
      return handleApiError(error);
    }
  }
);

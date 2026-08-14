/**
 * PropertyPro - Lease Signing API Route
 * Handle lease signing process with e-signature support
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Lease, Property } from "@/models";
import { LeaseStatus } from "@/types";
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
  isLeaseTenantUser,
} from "@/lib/lease-access";

// ============================================================================
// POST /api/leases/[id]/sign - Sign a lease
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
      const signatureData = success ? body : {};

      // Find the lease
      const lease = (await Lease.findById(id)
        .populate("tenantId")
        .populate("propertyId", "name address")) as any;

      if (!lease) {
        return createErrorResponse("Bail introuvable", 404);
      }

      // Check permissions
      const canSign = canManageLeases(user) || isLeaseTenantUser(user, lease);

      if (!canSign) {
        return createErrorResponse("Access denied", 403);
      }

      // Check if lease can be signed
      if (
        lease.status !== LeaseStatus.DRAFT &&
        lease.status !== LeaseStatus.PENDING_SIGNATURE
      ) {
        return createErrorResponse(
          "Lease cannot be signed in its current status",
          400
        );
      }

      // Validate signature data
      if (!signatureData.signature) {
        return createErrorResponse("Digital signature is required", 400);
      }

      if (!signatureData.ipAddress) {
        return createErrorResponse(
          "IP address is required for audit trail",
          400
        );
      }

      // Sign the lease
      await lease.sign(
        user.id,
        signatureData.signature,
        signatureData.ipAddress
      );

      // Update property status to occupied
      await Property.findByIdAndUpdate(lease.propertyId._id, {
        status: "occupied",
      });

      // Populate the response
      await lease.populate([
        {
          path: "tenantId",
          populate: { path: "userId", select: "firstName lastName email" },
        },
        { path: "propertyId", select: "name address type" },
      ]);

      return createSuccessResponse({ lease }, "Lease signed successfully");
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// GET /api/leases/[id]/sign - Get lease signing status and requirements
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
      const canView = canManageLeases(user) || isLeaseTenantUser(user, lease);

      if (!canView) {
        return createErrorResponse("Access denied", 403);
      }

      // Prepare signing information
      const signingInfo = {
        leaseId: lease._id,
        status: lease.status,
        canSign: [LeaseStatus.DRAFT, LeaseStatus.PENDING_SIGNATURE].includes(
          lease.status
        ),
        isSigned: !!lease.signedDate,
        signedDate: lease.signedDate,
        signedBy: lease.signedBy,
        requirements: {
          digitalSignature: true,
          ipAddressTracking: true,
          tenantConsent: true,
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
      };

      return createSuccessResponse({ signingInfo });
    } catch (error) {
      return handleApiError(error);
    }
  }
);

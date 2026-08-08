/**
 * PropertyPro - Lease Renewal API Route
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Lease } from "@/models";
import { LeaseStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
  parseRequestBody,
  isValidObjectId,
} from "@/lib/api-utils";
import { canAccessLease } from "@/lib/lease-access";

export const POST = withPermissionAndDB(["lease_create", "lease_management"])(
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

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) return createErrorResponse(error || "Invalid request body", 400);

      const currentLease = await Lease.findById(id);
      if (!currentLease || currentLease.deletedAt) {
        return createErrorResponse("Lease not found", 404);
      }
      if (!(await canAccessLease(user, currentLease))) {
        return createErrorResponse("Access denied", 403);
      }

      const newStartDate = new Date(body.newStartDate);
      const newEndDate = new Date(body.newEndDate);
      if (Number.isNaN(newStartDate.getTime()) || Number.isNaN(newEndDate.getTime())) {
        return createErrorResponse("Valid renewal dates are required", 400);
      }
      if (newEndDate <= newStartDate) {
        return createErrorResponse("End date must be after start date", 400);
      }
      if (newStartDate < new Date(currentLease.endDate)) {
        return createErrorResponse("Renewal cannot start before the current lease ends", 409);
      }
      if (currentLease.renewedLeaseId) {
        return createErrorResponse("This lease has already been renewed", 409);
      }

      const overlap = await Lease.findOne({
        _id: { $ne: currentLease._id },
        propertyId: currentLease.propertyId,
        unitId: currentLease.unitId,
        deletedAt: null,
        status: { $in: [LeaseStatus.ACTIVE, LeaseStatus.PENDING, LeaseStatus.DRAFT] },
        startDate: { $lte: newEndDate },
        endDate: { $gte: newStartDate },
      });
      if (overlap) {
        return createErrorResponse("Renewal dates overlap another lease for this unit", 409);
      }

      const renewedLease = await Lease.create({
        propertyId: currentLease.propertyId,
        unitId: currentLease.unitId,
        tenantId: currentLease.tenantId,
        startDate: newStartDate,
        endDate: newEndDate,
        status: LeaseStatus.DRAFT,
        terms: { ...currentLease.terms.toObject?.(), ...body.newTerms },
        documents: [],
        renewalOptions: currentLease.renewalOptions,
        parentLeaseId: currentLease._id,
        notes: body.notes || `Renewal of lease ${currentLease._id}`,
      });

      currentLease.renewedLeaseId = renewedLease._id;
      await currentLease.save({ validateModifiedOnly: true });

      await renewedLease.populate([
        { path: "propertyId", select: "name address type units" },
        { path: "tenantId", select: "firstName lastName email phone" },
      ]);

      return createSuccessResponse(renewedLease, "Bail renouvelé avec succès");
    } catch (error) {
      return handleApiError(error);
    }
  }
);

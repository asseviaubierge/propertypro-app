/**
 * PropertyPro - Tenant Status Management API
 * Dedicated endpoints for tenant status workflow management
 */

import { NextRequest } from "next/server";
import { User } from "@/models";
import { UserRole } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withAccessAndDB,
  withPermissionAndDB,
  parseRequestBody,
  isValidObjectId,
} from "@/lib/api-utils";
import { resolveAccessProfile } from "@/lib/server-permissions";

async function findTenantStatusUser(id: string) {
  const tenant = await User.findById(id)
    .populate("statusHistory.changedBy", "firstName lastName")
    .populate("currentLeaseId", "propertyId startDate endDate status");

  if (!tenant) {
    return null;
  }

  const tenantAccess = await resolveAccessProfile(tenant.role);
  if (!tenantAccess.isTenant) {
    return null;
  }

  return tenant;
}

// ============================================================================
// GET /api/tenants/[id]/status - Get tenant status history and current status
// ============================================================================

export const GET = withAccessAndDB({
  roles: [UserRole.TENANT],
  permissions: ["tenant_view"],
  match: "any",
})(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid tenant ID", 400);
      }

      // Find the tenant user
      const tenant = await findTenantStatusUser(id);

      if (!tenant) {
        return createErrorResponse("Tenant not found", 404);
      }

      // Role-based authorization
      if (user.isTenant && tenant._id.toString() !== user.id) {
        return createErrorResponse(
          "You can only view your own status information",
          403
        );
      }

      const statusInfo = {
        currentStatus: tenant.tenantStatus,
        displayStatus: tenant.displayStatus,
        statusColor: tenant.statusColor,
        lastStatusUpdate: tenant.lastStatusUpdate,
        backgroundCheckStatus: tenant.backgroundCheckStatus,
        backgroundCheckCompletedAt: tenant.backgroundCheckCompletedAt,
        applicationDate: tenant.applicationDate,
        moveInDate: tenant.moveInDate,
        moveOutDate: tenant.moveOutDate,
        currentLease: tenant.currentLeaseId,
        statusHistory: tenant.statusHistory || [],
        availableTransitions: getAvailableTransitions(tenant.tenantStatus),
      };

      return createSuccessResponse(
        statusInfo,
        "Tenant status retrieved successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// POST /api/tenants/[id]/status - Change tenant status with validation
// ============================================================================

export const POST = withPermissionAndDB("tenant_edit")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid tenant ID", 400);
      }

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      const { newStatus, reason, notes, moveDate } = body;

      if (!newStatus) {
        return createErrorResponse("New status is required", 400);
      }

      // Provide default reason if not provided
      const statusReason = reason?.trim() || "Status updated by admin";

      // Validate move date for specific statuses
      if ((newStatus === "active" || newStatus === "moved_out") && !moveDate) {
        return createErrorResponse(
          `${
            newStatus === "active" ? "Move-in" : "Move-out"
          } date is required for ${newStatus} status`,
          400
        );
      }

      // Find the tenant user
      const tenant = await findTenantStatusUser(id);
      if (!tenant) {
        return createErrorResponse("Tenant not found", 404);
      }

      // Validate the status transition
      const availableTransitions = getAvailableTransitions(tenant.tenantStatus);
      if (!availableTransitions.includes(newStatus)) {
        return createErrorResponse(
          `Invalid status transition from ${
            tenant.tenantStatus
          } to ${newStatus}. Available transitions: ${availableTransitions.join(
            ", "
          )}`,
          400
        );
      }

      // Change the status using the model method
      await tenant.changeStatus(
        newStatus,
        user.id,
        statusReason,
        notes,
        moveDate ? new Date(moveDate) : undefined
      );

      // Get updated tenant with populated fields
      const updatedTenant = await User.findById(tenant._id)
        .populate("statusHistory.changedBy", "firstName lastName")
        .populate("currentLeaseId", "propertyId startDate endDate status");

      const statusInfo = {
        currentStatus: updatedTenant.tenantStatus,
        displayStatus: updatedTenant.displayStatus,
        statusColor: updatedTenant.statusColor,
        lastStatusUpdate: updatedTenant.lastStatusUpdate,
        backgroundCheckStatus: updatedTenant.backgroundCheckStatus,
        backgroundCheckCompletedAt: updatedTenant.backgroundCheckCompletedAt,
        statusHistory: updatedTenant.statusHistory || [],
        availableTransitions: getAvailableTransitions(
          updatedTenant.tenantStatus
        ),
      };

      return createSuccessResponse(
        statusInfo,
        `Tenant status changed to ${newStatus} successfully`
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// Helper Functions
// ============================================================================

function getAvailableTransitions(currentStatus: string): string[] {
  const validTransitions = {
    application_submitted: ["under_review", "approved", "terminated"],
    under_review: ["approved", "terminated"],
    approved: ["active", "terminated"],
    active: ["inactive", "moved_out", "terminated"],
    inactive: ["active", "moved_out", "terminated"],
    moved_out: ["terminated"],
    terminated: [], // Terminal state
  };

  return validTransitions[currentStatus] || [];
}

/**
 * PropertyPro - Bulk Status Update Maintenance Requests API
 * API endpoint for bulk status updates of maintenance requests
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { MaintenanceRequest } from "@/models";
import { MaintenanceStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  withPermissionAndDB,
  isValidObjectId,
} from "@/lib/api-utils";
import { z } from "zod";
import { maintenanceListScope } from "@/lib/maintenance-access";

// Validation schema for bulk status update request
const bulkStatusSchema = z.object({
  requestIds: z.array(z.string()).min(1, "At least one request ID is required"),
  status: z.nativeEnum(MaintenanceStatus),
  notes: z.string().optional(),
});

// ============================================================================
// POST /api/maintenance/bulk-status - Bulk update maintenance request status
// ============================================================================

export const POST = withPermissionAndDB([
  "maintenance_management",
  "maintenance_assign",
  "work_orders",
])(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const body = await request.json();
      const validatedData = bulkStatusSchema.parse(body);
      const { requestIds, status, notes } = validatedData;

      // Validate all request IDs
      const invalidIds = requestIds.filter((id) => !isValidObjectId(id));
      if (invalidIds.length > 0) {
        return createErrorResponse(
          `Invalid request IDs: ${invalidIds.join(", ")}`,
          400
        );
      }

      // Find all requests to be updated
      const baseQuery: any = await maintenanceListScope(user, {
        _id: { $in: requestIds },
        deletedAt: null,
      });

      // Role-based access control
      // Single company architecture - Managers can update all maintenance requests

      const requests = await MaintenanceRequest.find(baseQuery);

      if (requests.length === 0) {
        return createErrorResponse(
          "No valid requests found or insufficient permissions",
          404
        );
      }

      if (requests.length !== requestIds.length) {
        return createErrorResponse("Some requests are outside your scope or do not exist", 403);
      }

      // Prepare update data
      const updateData: any = {
        status,
        updatedAt: new Date(),
        updatedBy: user.id,
      };

      // Add completion timestamp if marking as completed
      if (status === MaintenanceStatus.COMPLETED) {
        updateData.completedAt = new Date();
      }

      // Add notes if provided
      if (notes) {
        updateData.$push = {
          notes: {
            content: notes,
            createdBy: user.id,
            createdAt: new Date(),
          },
        };
      }

      // Update all requests
      const result = await MaintenanceRequest.updateMany(
        { _id: { $in: requests.map((r) => r._id) } },
        updateData
      );

      // Trigger property status synchronization for affected properties
      const affectedProperties = new Set<string>();
      for (const request of requests) {
        if (request.propertyId && request.unitId) {
          affectedProperties.add(String(request.propertyId));
        }
      }

      let syncWarning: string | null = null;
      if (affectedProperties.size > 0) {
        try {
          const { propertyStatusSynchronizer } = await import(
            "@/lib/services/property-status-sync.service"
          );

          await propertyStatusSynchronizer.syncMultipleProperties(
            Array.from(affectedProperties),
            {
              triggeredBy: `bulk-maintenance-update:${user.id}`,
              logChanges: true,
            }
          );
        } catch (syncError) {
          syncWarning =
            syncError instanceof Error
              ? syncError.message
              : "Property synchronization skipped";
        }
      }

      return createSuccessResponse(
        {
          message: `Successfully updated ${result.modifiedCount} requests to ${status}`,
          updatedCount: result.modifiedCount,
          newStatus: status,
          warning: syncWarning || undefined,
        },
        "Bulk maintenance status update completed"
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(
          `Validation error: ${error.issues.map((e) => e.message).join(", ")}`,
          400
        );
      }

      return createErrorResponse(
        error instanceof Error
          ? error.message
          : "Failed to update request status",
        500
      );
    }
  }
);

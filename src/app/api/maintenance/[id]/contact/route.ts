/**
 * PropertyPro - Maintenance Request Contact Logging API
 * API endpoint for logging contact attempts with tenants
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { MaintenanceRequest } from "@/models";
import {
  createSuccessResponse,
  createErrorResponse,
  withPermissionAndDB,
  isValidObjectId,
} from "@/lib/api-utils";
import { z } from "zod";
import { canAccessMaintenanceRequest } from "@/lib/maintenance-access";

// Validation schema for contact logging
const contactLogSchema = z.object({
  method: z.enum(["phone", "email", "sms", "in_person"]),
  contactedAt: z.string().datetime(),
  notes: z.string().optional(),
  successful: z.boolean().default(true),
});

// ============================================================================
// POST /api/maintenance/[id]/contact - Log contact attempt
// ============================================================================

export const POST = withPermissionAndDB("maintenance_management")(
  async (
    user,
    request: NextRequest,
    { params }: { params: { id: string } }
  ) => {
    try {
      const { id } = params;

      // Validate request ID
      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid request ID", 400);
      }

      const body = await request.json();
      const validatedData = contactLogSchema.parse(body);
      const { method, contactedAt, notes, successful } = validatedData;

      // Find the maintenance request
      let baseQuery: any = {
        _id: id,
        deletedAt: null,
      };

      // Role-based access control
      // Single company architecture - Managers can log contact for all maintenance requests

      const maintenanceRequest = await MaintenanceRequest.findOne(baseQuery);

      if (!maintenanceRequest) {
        return createErrorResponse(
          "Maintenance request not found or insufficient permissions",
          404
        );
      }

      if (!(await canAccessMaintenanceRequest(user, maintenanceRequest))) {
        return createErrorResponse("Forbidden", 403);
      }

      // Create contact log entry
      const contactLog = {
        method,
        contactedAt: new Date(contactedAt),
        contactedBy: user.id,
        notes,
        successful,
        createdAt: new Date(),
      };

      // Update the maintenance request with contact log
      const updateData: any = {
        $push: {
          contactLogs: contactLog,
        },
        lastContactedAt: new Date(contactedAt),
        updatedAt: new Date(),
        updatedBy: user.id,
      };

      await MaintenanceRequest.findByIdAndUpdate(id, updateData);

      return createSuccessResponse({
        message: "Contact attempt logged successfully",
        contactLog: {
          method,
          contactedAt,
          contactedBy: `${user.firstName} ${user.lastName}`,
          successful,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(
          `Validation error: ${error.errors.map((e) => e.message).join(", ")}`,
          400
        );
      }

      return createErrorResponse(
        error instanceof Error
          ? error.message
          : "Failed to log contact attempt",
        500
      );
    }
  }
);

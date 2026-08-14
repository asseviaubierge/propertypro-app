/**
 * PropertyPro - Emergency Escalation API Route
 * Handle escalation of emergency maintenance requests
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { MaintenanceRequest, User } from "@/models";
import { MaintenanceStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
  parseRequestBody,
} from "@/lib/api-utils";
import { hasAnyPermission } from "@/lib/role-utils";
import { resolveAccessProfile } from "@/lib/server-permissions";
import { z } from "zod";
import { canAccessMaintenanceRequest, maintenanceListScope } from "@/lib/maintenance-access";

// ============================================================================
// POST /api/maintenance/emergency/escalate - Escalate emergency request
// ============================================================================

const escalationSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
  escalationReason: z.string().optional(),
  escalateTo: z.string().optional(), // Specific user to escalate to
  urgencyLevel: z.enum(["high", "critical"]).default("high"),
  notes: z.string().optional(),
});

const EMERGENCY_STAFF_PERMISSIONS = [
  "maintenance_management",
  "maintenance_assign",
  "work_orders",
];

function canReceiveEmergencyAssignment(profile: {
  isCompanyStaff: boolean;
  permissions: string[];
}) {
  return (
    profile.isCompanyStaff &&
    hasAnyPermission(profile.permissions, EMERGENCY_STAFF_PERMISSIONS)
  );
}

export const POST = withPermissionAndDB("maintenance_management")(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error!, 400);
    }

    // Validate request body
    const validation = escalationSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        validation.error.issues.map((e) => e.message).join(", "),
        400
      );
    }

    const { requestId, escalationReason, escalateTo, urgencyLevel, notes } =
      validation.data;

    // Find the emergency request
    const emergencyRequest = await MaintenanceRequest.findById(requestId);
    if (!emergencyRequest) {
      return createErrorResponse("Emergency request not found", 404);
    }

    if (!(await canAccessMaintenanceRequest(user, emergencyRequest))) {
      return createErrorResponse("Forbidden", 403);
    }

    // Verify it's an emergency request
    if (emergencyRequest.priority !== "emergency") {
      return createErrorResponse("Request is not an emergency", 400);
    }

    let escalationTarget;
    if (escalateTo) {
      escalationTarget = await User.findById(escalateTo);
      if (!escalationTarget || !(escalationTarget as any).isActive) {
        return createErrorResponse("Escalation target user not found", 404);
      }

      const targetAccessProfile = await resolveAccessProfile((escalationTarget as any).role);
      if (!canReceiveEmergencyAssignment(targetAccessProfile)) {
        return createErrorResponse(
          "Escalation target must be active maintenance staff",
          400
        );
      }
    } else {
      const staffCandidates = await User.find({ isActive: true })
        .select("_id role firstName lastName email createdAt")
        .sort({ createdAt: 1 });

      for (const candidate of staffCandidates) {
        const candidateAccessProfile = await resolveAccessProfile((candidate as any).role);
        if (!canReceiveEmergencyAssignment(candidateAccessProfile)) {
          continue;
        }

        if (!candidateAccessProfile.isAdmin) {
          escalationTarget = candidate;
          break;
        }

        escalationTarget ??= candidate;
      }
    }

    if (!escalationTarget) {
      return createErrorResponse("No available escalation target found", 404);
    }

    // Check current escalation level and increment
    const currentEscalationLevel = (emergencyRequest as any).escalationLevel || 0;
    const newEscalationLevel = Math.min(currentEscalationLevel + 1, 3); // Max level 3

    // Prepare escalation log entry
    const escalationLogEntry = {
      escalatedBy: user.id,
      escalatedTo: escalationTarget._id,
      reason: escalationReason || `Escalated to level ${newEscalationLevel}`,
      urgencyLevel,
      notes,
      timestamp: new Date(),
      level: newEscalationLevel,
    };

    // Update the request with escalation info
    const updateData: any = {
      assignedTo: escalationTarget._id,
      status: MaintenanceStatus.ASSIGNED,
      escalationLevel: newEscalationLevel,
      updatedAt: new Date(),
      updatedBy: user.id,
      $push: {
        escalationLogs: escalationLogEntry,
      },
    };

    // Add notes if provided
    if (notes || escalationReason) {
      const escalationNote = `ESCALATED to Level ${newEscalationLevel}${
        escalationReason ? `: ${escalationReason}` : ""
      }${notes ? `\nNotes: ${notes}` : ""}`;
      updateData.$push.notes = {
        content: escalationNote,
        createdBy: user.id,
        createdAt: new Date(),
      };
    }

    await MaintenanceRequest.findByIdAndUpdate(requestId, updateData);

    // Create escalation log entry (this could be a separate collection in a real app)
    const escalationLog = {
      requestId: emergencyRequest._id,
      escalatedBy: user.id,
      escalatedTo: escalationTarget._id,
      reason: escalationReason,
      urgencyLevel,
      notes,
      timestamp: new Date(),
    };

    // Populate the updated request for response
    const populatedRequest = await MaintenanceRequest.findById(
      emergencyRequest._id
    )
      .populate("propertyId", "name address")
      .populate({
        path: "tenantId",
        populate: {
          path: "userId",
          select: "firstName lastName email phone",
        },
      })
      .populate("assignedTo", "firstName lastName email");

    // TODO: Send escalation notifications
    // - Email to escalation target
    // - SMS if critical
    // - Push notification
    // - Update dashboard alerts

    return createSuccessResponse(
      {
        request: populatedRequest,
        escalation: escalationLog,
      },
      "Emergency request escalated successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// GET /api/maintenance/emergency/escalate - Get escalation history
// ============================================================================

export const GET = withPermissionAndDB("maintenance_management")(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("requestId");
    const limit = parseInt(searchParams.get("limit") || "12");

    let query: any = {};
    if (requestId) {
      query.requestId = requestId;
    }

    // In a real application, this would query an escalation log collection
    // For now, we'll return escalation info from maintenance request notes
    const scopedEscalationQuery = await maintenanceListScope(user, {
      priority: "emergency",
      notes: { $regex: "ESCALATED:", $options: "i" },
      deletedAt: null,
      ...query,
    });
    const escalatedRequests = await MaintenanceRequest.find(scopedEscalationQuery)
      .populate("propertyId", "name address")
      .populate({
        path: "tenantId",
        populate: {
          path: "userId",
          select: "firstName lastName email",
        },
      })
      .populate("assignedTo", "firstName lastName email")
      .sort({ updatedAt: -1 })
      .limit(limit);

    // Extract escalation info from notes (simplified approach)
    const escalations = escalatedRequests.map((request) => {
      const escalationMatch = request.notes?.match(/ESCALATED: (.+?)(?:\n|$)/);
      return {
        requestId: request._id,
        request: {
          title: request.title,
          status: request.status,
          createdAt: request.createdAt,
          property: request.propertyId,
          tenant: request.tenantId,
          assignedTo: request.assignedTo,
        },
        escalationReason: escalationMatch ? escalationMatch[1] : "Inconnu",
        timestamp: request.updatedAt,
      };
    });

    return createSuccessResponse(
      escalations,
      "Escalation history retrieved successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
});

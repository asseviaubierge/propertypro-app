/**
 * PropertyPro - Application Approve API Route
 * Approve an application
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Application } from "@/models";
import { UserRole, ApplicationStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
  parseRequestBody,
  isValidObjectId,
} from "@/lib/api-utils";

// ============================================================================
// POST /api/applications/[id]/approve - Approve an application
// ============================================================================

export const POST = withPermissionAndDB([
  "application_processing",
  "screening_management",
])(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid application ID", 400);
      }

      const { success, data: body } = await parseRequestBody(request);
      const notes = success ? body?.notes : undefined;

      // Find the application
      const application = await Application.findById(id)
        .populate("propertyId", "name address")
        .populate("applicantId", "firstName lastName email");

      if (!application) {
        return createErrorResponse("Application not found", 404);
      }

      // Check if application can be approved
      const validStatuses = [
        ApplicationStatus.SUBMITTED,
        ApplicationStatus.UNDER_REVIEW,
      ];

      if (!validStatuses.includes(application.status)) {
        return createErrorResponse(
          "Application cannot be approved in its current status",
          400
        );
      }

      // Approve the application
      await (application as any).approve(user.id, notes);

      return createSuccessResponse(
        { application },
        "Application approved successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

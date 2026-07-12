/**
 * PropertyPro - Individual Application API Routes
 * CRUD operations for individual applications
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
  withAccessAndDB,
  parseRequestBody,
  isValidObjectId,
} from "@/lib/api-utils";
import { applicationUpdateSchema, validateSchema } from "@/lib/validations";

const APPLICATION_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: ["application_processing", "screening_management"],
  match: "any" as const,
};

// ============================================================================
// GET /api/applications/[id] - Get a specific application
// ============================================================================

export const GET = withAccessAndDB(APPLICATION_ACCESS)(
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

      const application = await Application.findById(id)
        .populate("propertyId", "name address type rentAmount securityDeposit")
        .populate("applicantId", "firstName lastName email phone")
        .populate("reviewedBy", "firstName lastName email");

      if (!application) {
        return createErrorResponse("Application not found", 404);
      }

      const canAccess =
        user.isCompanyStaff || application.applicantId._id.toString() === user.id;

      if (!canAccess) {
        return createErrorResponse("Access denied", 403);
      }

      return createSuccessResponse({ application });
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PUT /api/applications/[id] - Update an application
// ============================================================================

export const PUT = withAccessAndDB(APPLICATION_ACCESS)(
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

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      const application = await Application.findById(id);
      if (!application) {
        return createErrorResponse("Application not found", 404);
      }

      const canEdit =
        user.isCompanyStaff ||
        (application.applicantId.toString() === user.id &&
          [ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED].includes(
            application.status
          ));

      if (!canEdit) {
        return createErrorResponse("Cannot edit this application", 403);
      }

      const validation = validateSchema(applicationUpdateSchema, body);
      if (!validation.success) {
        return createErrorResponse(validation.errors.join(", "), 400);
      }

      const updateData = validation.data;

      if (user.isTenant) {
        const allowedFields = [
          "personalInfo",
          "employmentInfo",
          "emergencyContacts",
          "previousAddresses",
          "documents",
          "additionalInfo",
        ] as const;

        const restrictedUpdate: Partial<typeof updateData> = {};
        for (const field of allowedFields) {
          if (updateData[field] !== undefined) {
            (restrictedUpdate as Record<string, unknown>)[field] =
              updateData[field];
          }
        }

        Object.assign(application, restrictedUpdate);
      } else {
        Object.assign(application, updateData);
      }

      await application.save();

      await application.populate([
        { path: "propertyId", select: "name address type rentAmount" },
        { path: "applicantId", select: "firstName lastName email" },
        { path: "reviewedBy", select: "firstName lastName" },
      ]);

      return createSuccessResponse(
        { application },
        "Application updated successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// DELETE /api/applications/[id] - Delete an application (soft delete)
// ============================================================================

export const DELETE = withAccessAndDB(APPLICATION_ACCESS)(
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

      const application = await Application.findById(id);
      if (!application) {
        return createErrorResponse("Application not found", 404);
      }

      const canDelete =
        user.isCompanyStaff ||
        (application.applicantId.toString() === user.id &&
          [ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED].includes(
            application.status
          ));

      if (!canDelete) {
        return createErrorResponse("Cannot delete this application", 403);
      }

      application.deletedAt = new Date();
      await application.save();

      return createSuccessResponse(null, "Application deleted successfully");
    } catch (error) {
      return handleApiError(error);
    }
  }
);

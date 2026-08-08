/**
 * PropertyPro - Applications API Routes
 * CRUD operations for tenant applications
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Application, Property, User } from "@/models";
import { UserRole, ApplicationStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  parsePaginationParams,
  paginateQuery,
  parseRequestBody,
  withAccessAndDB,
} from "@/lib/api-utils";
import {
  applicationSchema,
  validateSchema,
} from "@/lib/validations";

const APPLICATION_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: ["application_processing", "screening_management"],
  match: "any" as const,
};

// ============================================================================
// GET /api/applications - Get all applications with pagination and filtering
// ============================================================================

export const GET = withAccessAndDB(APPLICATION_ACCESS)(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const paginationParams = parsePaginationParams(searchParams);

      const query: Record<string, unknown> = {};

      if (user.isTenant) {
        query.applicantId = user.id;
      }

      const status = searchParams.get("status");
      if (
        status &&
        Object.values(ApplicationStatus).includes(status as ApplicationStatus)
      ) {
        query.status = status;
      }

      const propertyId = searchParams.get("propertyId");
      if (propertyId) {
        query.propertyId = propertyId;
      }

      const applicantId = searchParams.get("applicantId");
      if (applicantId && !user.isTenant) {
        query.applicantId = applicantId;
      }

      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      if (startDate || endDate) {
        query.submittedAt = {};
        if (startDate) {
          (query.submittedAt as Record<string, Date>).$gte = new Date(startDate);
        }
        if (endDate) {
          (query.submittedAt as Record<string, Date>).$lte = new Date(endDate);
        }
      }

      const search = searchParams.get("search");
      if (search) {
        query.$or = [
          { "personalInfo.firstName": { $regex: search, $options: "i" } },
          { "personalInfo.lastName": { $regex: search, $options: "i" } },
          { "personalInfo.email": { $regex: search, $options: "i" } },
        ];
      }

      const result = await paginateQuery(Application, query, paginationParams);

      const populatedData = await Application.populate(result.data, [
        { path: "propertyId", select: "name address type rentAmount" },
        { path: "applicantId", select: "firstName lastName email" },
        { path: "reviewedBy", select: "firstName lastName" },
      ]);

      return createSuccessResponse(
        populatedData,
        "Applications retrieved successfully",
        result.pagination
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// POST /api/applications - Create a new application
// ============================================================================

export const POST = withAccessAndDB(APPLICATION_ACCESS)(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      const validation = validateSchema(applicationSchema, body);
      if (!validation.success) {
        return createErrorResponse(validation.issues.map((i:any)=>i.message).join(", "), 400);
      }

      const applicationData = validation.data;
      if (user.isTenant) {
        applicationData.applicantId = user.id;
      }

      const property = await Property.findById(applicationData.propertyId);
      if (!property) {
        return createErrorResponse("Property not found", 404);
      }

      if (property.status !== "available") {
        return createErrorResponse(
          "Property is not available for applications",
          400
        );
      }

      const existingApplication = await Application.findOne({
        propertyId: applicationData.propertyId,
        applicantId: applicationData.applicantId,
        status: {
          $in: [
            ApplicationStatus.DRAFT,
            ApplicationStatus.SUBMITTED,
            ApplicationStatus.UNDER_REVIEW,
          ],
        },
      });

      if (existingApplication) {
        return createErrorResponse(
          "You already have an active application for this property",
          400
        );
      }

      const applicant = await User.findById(applicationData.applicantId);
      if (!applicant) {
        return createErrorResponse("Applicant not found", 404);
      }

      const application = new Application(applicationData);
      await application.save();

      await application.populate([
        { path: "propertyId", select: "name address type rentAmount" },
        { path: "applicantId", select: "firstName lastName email" },
      ]);

      return createSuccessResponse(
        { application },
        "Application created successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

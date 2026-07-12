/**
 * PropertyPro - User Feedback API
 * API endpoint for collecting and managing user feedback
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { userFeedbackService } from "@/lib/services/user-feedback.service";
import { UserRole } from "@/types";
import {
  createSuccessResponse as createApiSuccessResponse,
  createErrorResponse as createApiErrorResponse,
} from "@/lib/api-utils";
import { resolveAccessProfile } from "@/lib/server-permissions";

// Helper functions
function createSuccessResponse(
  data: any,
  message: string,
  status: number = 200
) {
  return createApiSuccessResponse(data, message);
}

function createErrorResponse(message: string, status: number = 400) {
  return createApiErrorResponse(message, status, message);
}

export async function GET(request: NextRequest) {
  try {
    // Get session
    const session = await auth();
    if (!session?.user) {
      return createErrorResponse("Authentication required", 401);
    }

    const accessProfile = await resolveAccessProfile(session.user.role);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "list";
    const category = searchParams.get("category");
    const priority = searchParams.get("priority");
    const status = searchParams.get("status");
    const feature = searchParams.get("feature");
    const period =
      (searchParams.get("period") as "week" | "month" | "quarter") || "month";

    if (action === "list") {
      // Get feedback with filters
      const filters: any = {};

      if (category) filters.category = category;
      if (priority) filters.priority = priority;
      if (status) filters.status = status;
      if (feature) filters.feature = feature;

      // Tenants can only see their own feedback
      if (accessProfile.isTenant) {
        filters.userId = session.user.id;
      }

      const feedback = userFeedbackService.getFeedback(filters);

      return createSuccessResponse(
        {
          feedback,
          total: feedback.length,
          filters: filters,
        },
        "Feedback retrieved successfully"
      );
    }

    if (action === "summary") {
      // Only admins and property managers can see summary
      if (!accessProfile.isCompanyStaff) {
        return createErrorResponse("Insufficient permissions", 403);
      }

      const summary = userFeedbackService.generateFeedbackSummary(period);

      return createSuccessResponse(
        summary,
        "Feedback summary generated successfully"
      );
    }

    if (action === "analytics") {
      // Only admins and property managers can see analytics
      if (!accessProfile.isCompanyStaff) {
        return createErrorResponse("Insufficient permissions", 403);
      }

      const analytics = userFeedbackService.generateFeedbackAnalytics();

      return createSuccessResponse(
        analytics,
        "Feedback analytics generated successfully"
      );
    }

    if (action === "statistics") {
      // Only admins and property managers can see statistics
      if (!accessProfile.isCompanyStaff) {
        return createErrorResponse("Insufficient permissions", 403);
      }

      const statistics = userFeedbackService.getFeedbackStatistics();

      return createSuccessResponse(
        statistics,
        "Feedback statistics retrieved successfully"
      );
    }

    return createErrorResponse("Invalid action specified", 400);
  } catch (error) {
    console.error("Error in feedback GET API:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get session
    const session = await auth();
    if (!session?.user) {
      return createErrorResponse("Authentication required", 401);
    }

    const accessProfile = await resolveAccessProfile(session.user.role);

    // Parse request body
    const body = await request.json();
    const { action, feedbackData, feedbackId, status, adminResponse } = body;

    if (action === "submit") {
      // Submit new feedback
      if (!feedbackData) {
        return createErrorResponse("Feedback data is required", 400);
      }

      // Validate required fields
      const { category, rating, title, description } = feedbackData;
      if (!category || !rating || !title || !description) {
        return createErrorResponse("Missing required feedback fields", 400);
      }

      if (rating < 1 || rating > 5) {
        return createErrorResponse("Rating must be between 1 and 5", 400);
      }

      // Map user role
      let mappedUserRole: UserRole.MANAGER | UserRole.TENANT | UserRole.ADMIN;
      mappedUserRole = accessProfile.isAdmin
        ? UserRole.ADMIN
        : accessProfile.isManager
        ? UserRole.MANAGER
        : UserRole.TENANT;

      const feedback = await userFeedbackService.submitFeedback({
        userId: session.user.id,
        userRole: mappedUserRole,
        category: feedbackData.category,
        rating: feedbackData.rating,
        title: feedbackData.title,
        description: feedbackData.description,
        feature: feedbackData.feature,
        priority: feedbackData.priority || "medium",
        tags: feedbackData.tags || [],
        attachments: feedbackData.attachments,
      });

      return createSuccessResponse(feedback, "Feedback submitted successfully");
    }

    if (action === "update-status") {
      // Only admins and property managers can update status
      if (!accessProfile.isCompanyStaff) {
        return createErrorResponse("Insufficient permissions", 403);
      }

      if (!feedbackId || !status) {
        return createErrorResponse("Feedback ID and status are required", 400);
      }

      const validStatuses = [
        "new",
        "reviewing",
        "in_progress",
        "resolved",
        "closed",
      ];
      if (!validStatuses.includes(status)) {
        return createErrorResponse("Invalid status specified", 400);
      }

      const updatedFeedback = await userFeedbackService.updateFeedbackStatus(
        feedbackId,
        status,
        adminResponse
      );

      if (!updatedFeedback) {
        return createErrorResponse("Feedback not found", 404);
      }

      return createSuccessResponse(
        updatedFeedback,
        "Feedback status updated successfully"
      );
    }

    if (action === "bulk-update") {
      // Only admins can perform bulk updates
      if (!accessProfile.isAdmin) {
        return createErrorResponse("Insufficient permissions", 403);
      }

      const { feedbackIds, newStatus, response } = body;

      if (!feedbackIds || !Array.isArray(feedbackIds) || !newStatus) {
        return createErrorResponse("Feedback IDs and status are required", 400);
      }

      const results = [];
      for (const id of feedbackIds) {
        const updated = await userFeedbackService.updateFeedbackStatus(
          id,
          newStatus,
          response
        );
        if (updated) {
          results.push(updated);
        }
      }

      return createSuccessResponse(
        {
          updated: results.length,
          feedback: results,
        },
        `${results.length} feedback items updated successfully`
      );
    }

    return createErrorResponse("Invalid action specified", 400);
  } catch (error) {
    console.error("Error in feedback POST API:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500
    );
  }
}

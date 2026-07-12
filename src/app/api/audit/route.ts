/**
 * PropertyPro - Audit Logs API
 * API endpoints for accessing and managing audit logs
 */

import { NextRequest, NextResponse } from "next/server";
import { AuthenticatedAccessUser, withPermissionAndDB } from "@/lib/api-utils";
import { UserRole } from "@/types";
import {
  createErrorResponse,
  createSuccessResponse,
  parseRequestBody,
} from "@/lib/api-utils";
import AuditLog, {
  AuditCategory,
  AuditAction,
  AuditSeverity,
} from "@/models/AuditLog";
import { auditService } from "@/lib/audit-service";

// GET /api/audit - Get audit logs with filtering and pagination
export const GET = withPermissionAndDB("audit_logs")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);

      // Pagination
      const page = parseInt(searchParams.get("page") || "1");
      const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
      const skip = (page - 1) * limit;

      // Filters
      const category = searchParams.get("category") as AuditCategory;
      const action = searchParams.get("action") as AuditAction;
      const severity = searchParams.get("severity") as AuditSeverity;
      const userId = searchParams.get("userId");
      const resourceType = searchParams.get("resourceType");
      const resourceId = searchParams.get("resourceId");
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      const search = searchParams.get("search");
      const tags = searchParams.get("tags")?.split(",");

      // Build query
      const query: any = {};

      if (category) query.category = category;
      if (action) query.action = action;
      if (severity) query.severity = severity;
      if (userId) query.userId = userId;
      if (resourceType) query.resourceType = resourceType;
      if (resourceId) query.resourceId = resourceId;

      // Date range filter
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      // Tags filter
      if (tags && tags.length > 0) {
        query.tags = { $in: tags };
      }

      // Text search
      if (search) {
        query.$text = { $search: search };
      }

      // Role-based filtering
      if (user.isManager && !user.isAdmin) {
        // Property managers can only see logs related to their properties
        // This would require additional logic to determine which properties they manage
        // For now, we'll allow access to all logs for property managers
      }

      // Execute query
      const [logs, total] = await Promise.all([
        AuditLog.find(query)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .populate("userId", "firstName lastName email")
          .populate("impersonatedBy", "firstName lastName email")
          .lean(),
        AuditLog.countDocuments(query),
      ]);

      return createSuccessResponse({
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        filters: {
          category,
          action,
          severity,
          userId,
          resourceType,
          resourceId,
          startDate,
          endDate,
          search,
          tags,
        },
      });
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
      return createErrorResponse("Failed to fetch audit logs", 500);
    }
  }
);

// POST /api/audit - Create audit log entry (for system events)
export const POST = withPermissionAndDB("audit_logs")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      const {
        category,
        action,
        severity = AuditSeverity.LOW,
        description,
        resourceType,
        resourceId,
        resourceName,
        details,
        tags,
      } = body;

      // Validate required fields
      if (!category || !action || !description) {
        return createErrorResponse(
          "Missing required fields: category, action, description",
          400
        );
      }

      // Extract context from request
      const context = auditService.extractContextFromRequest(request, user);

      // Log the event
      const auditLog = await auditService.logEvent(
        {
          category,
          action,
          severity,
          description,
          resourceType,
          resourceId,
          resourceName,
          details,
          tags,
        },
        context
      );

      return createSuccessResponse(
        {
          auditLog,
          message: "Audit log entry created successfully",
        },
        "Audit log entry created successfully"
      );
    } catch (error) {
      console.error("Failed to create audit log:", error);
      return createErrorResponse("Failed to create audit log", 500);
    }
  }
);

// GET /api/audit/stats - Get audit statistics
export const stats = withPermissionAndDB("audit_logs")(async (user, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : new Date();

    const dateFilter = {
      timestamp: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // Get statistics
    const [
      totalLogs,
      categoryStats,
      actionStats,
      severityStats,
      dailyStats,
      topUsers,
      securityEvents,
    ] = await Promise.all([
      // Total logs count
      AuditLog.countDocuments(dateFilter),

      // Category breakdown
      AuditLog.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Action breakdown
      AuditLog.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Severity breakdown
      AuditLog.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$severity", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Daily activity
      AuditLog.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Top active users
      AuditLog.aggregate([
        { $match: { ...dateFilter, userId: { $exists: true } } },
        { $group: { _id: "$userId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            count: 1,
            name: { $concat: ["$user.firstName", " ", "$user.lastName"] },
            email: "$user.email",
          },
        },
      ]),

      // Security events count
      AuditLog.countDocuments({
        ...dateFilter,
        category: AuditCategory.SECURITY,
      }),
    ]);

    return createSuccessResponse({
      summary: {
        totalLogs,
        securityEvents,
        dateRange: { startDate, endDate },
      },
      breakdown: {
        categories: categoryStats,
        actions: actionStats,
        severity: severityStats,
      },
      trends: {
        daily: dailyStats,
      },
      topUsers,
    });
  } catch (error) {
    console.error("Failed to fetch audit statistics:", error);
    return createErrorResponse("Failed to fetch audit statistics", 500);
  }
});

// GET /api/audit/user/{userId} - Get audit logs for specific user
export const userLogs = withPermissionAndDB("audit_logs")(
  async (
    user,
    request: NextRequest,
    { params }: { params: { userId: string } }
  ) => {
    try {
      const { searchParams } = new URL(request.url);
      const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
      const offset = parseInt(searchParams.get("offset") || "0");

      const logs = await auditService.getActivityForUser(
        params.userId,
        limit,
        offset
      );

      return createSuccessResponse({
        logs,
        userId: params.userId,
        pagination: {
          limit,
          offset,
          hasMore: logs.length === limit,
        },
      });
    } catch (error) {
      console.error("Failed to fetch user audit logs:", error);
      return createErrorResponse("Failed to fetch user audit logs", 500);
    }
  }
);

// GET /api/audit/resource/{resourceType}/{resourceId} - Get audit logs for specific resource
export const resourceLogs = withPermissionAndDB("audit_logs")(
  async (
    user,
    request: NextRequest,
    { params }: { params: { resourceType: string; resourceId: string } }
  ) => {
    try {
      const { searchParams } = new URL(request.url);
      const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

      const logs = await auditService.getActivityForResource(
        params.resourceType,
        params.resourceId,
        limit
      );

      return createSuccessResponse({
        logs,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
      });
    } catch (error) {
      console.error("Failed to fetch resource audit logs:", error);
      return createErrorResponse("Failed to fetch resource audit logs", 500);
    }
  }
);

// GET /api/audit/security - Get security events
export const securityEvents = withPermissionAndDB("audit_logs")(
  async (user, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const startDate = searchParams.get("startDate")
        ? new Date(searchParams.get("startDate")!)
        : undefined;
      const endDate = searchParams.get("endDate")
        ? new Date(searchParams.get("endDate")!)
        : undefined;
      const severity = searchParams.get("severity") as AuditSeverity;

      const events = await auditService.getSecurityEvents(
        startDate,
        endDate,
        severity
      );

      return createSuccessResponse({
        events,
        filters: { startDate, endDate, severity },
      });
    } catch (error) {
      console.error("Failed to fetch security events:", error);
      return createErrorResponse("Failed to fetch security events", 500);
    }
  }
);

// DELETE /api/audit/cleanup - Cleanup expired audit logs
export const cleanup = withPermissionAndDB("audit_logs")(
  async (user, request: NextRequest) => {
    try {
      const deletedCount = await auditService.cleanupExpiredLogs();

      return createSuccessResponse({
        deletedCount,
        message: `Cleaned up ${deletedCount} expired audit logs`,
      });
    } catch (error) {
      console.error("Failed to cleanup audit logs:", error);
      return createErrorResponse("Failed to cleanup audit logs", 500);
    }
  }
);

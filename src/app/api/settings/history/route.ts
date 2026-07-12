/**
 * PropertyPro - Settings History API Route
 * Track and retrieve settings change history and audit logs
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withAccessAndDB,
  withPermissionAndDB,
} from "@/lib/api-utils";
import mongoose from "mongoose";

// Settings History Schema
const settingsHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  category: { type: String, required: true }, // 'profile', 'notifications', 'security', etc.
  action: { type: String, required: true }, // 'create', 'update', 'delete'
  field: { type: String, required: true }, // specific field that was changed
  oldValue: { type: mongoose.Schema.Types.Mixed }, // previous value
  newValue: { type: mongoose.Schema.Types.Mixed }, // new value
  metadata: {
    userAgent: String,
    ipAddress: String,
    sessionId: String,
    source: { type: String, default: "web" }, // 'web', 'mobile', 'api'
  },
  createdAt: { type: Date, default: Date.now },
});

settingsHistorySchema.index({ userId: 1, createdAt: -1 });
settingsHistorySchema.index({ category: 1, createdAt: -1 });

const SettingsHistory =
  (mongoose.models?.SettingsHistory as mongoose.Model<any>) ||
  mongoose.model("SettingsHistory", settingsHistorySchema);

function canViewAllSettingsHistory(user: AuthenticatedAccessUser): boolean {
  return (
    user.permissions.includes("system_settings") ||
    user.permissions.includes("audit_logs")
  );
}

// ============================================================================
// GET /api/settings/history - Get settings change history
// ============================================================================
export const GET = withAccessAndDB({})(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "20");
      const category = searchParams.get("category");
      const action = searchParams.get("action");
      const field = searchParams.get("field");
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");

      const query: any = {};

      if (!canViewAllSettingsHistory(user)) {
        query.userId = user.id;
      } else {
        const targetUserId = searchParams.get("userId");
        if (targetUserId) {
          query.userId = targetUserId;
        }
      }

      if (category) query.category = category;
      if (action) query.action = action;
      if (field) query.field = field;

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;

      const settingsHistoryModel = SettingsHistory as any;

      const [history, total] = await Promise.all([
        settingsHistoryModel.find(query)
          .populate("userId", "firstName lastName email")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        settingsHistoryModel.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);

      return createSuccessResponse({
        history,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        message: "Settings history retrieved successfully",
      });
    } catch (error) {
      console.error("Settings history error:", error);
      return handleApiError(error);
    }
  }
);

// ============================================================================
// POST /api/settings/history - Log a settings change
// ============================================================================
export const POST = withAccessAndDB({})(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const body = await request.json();
      const { category, action, field, oldValue, newValue, metadata = {} } = body;

      if (!category || !action || !field) {
        return createErrorResponse(
          "Category, action, and field are required",
          400
        );
      }

      const userAgent = request.headers.get("user-agent") || "";
      const forwarded = request.headers.get("x-forwarded-for");
      const ipAddress = forwarded
        ? forwarded.split(",")[0]
        : request.headers.get("x-real-ip") || "unknown";

      const historyEntry = await (SettingsHistory as any).create({
        userId: user.id,
        category,
        action,
        field,
        oldValue,
        newValue,
        metadata: {
          ...metadata,
          userAgent,
          ipAddress,
          sessionId: user.id,
          source: metadata.source || "web",
        },
      });

      return createSuccessResponse({
        historyEntry,
        message: "Settings change logged successfully",
      });
    } catch (error) {
      console.error("Settings history logging error:", error);
      return handleApiError(error);
    }
  }
);

// ============================================================================
// DELETE /api/settings/history - Clear settings history (admin only)
// ============================================================================
export const DELETE = withPermissionAndDB(["system_settings", "audit_logs"])(
  async (_user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const userId = searchParams.get("userId");
      const category = searchParams.get("category");
      const olderThan = searchParams.get("olderThan");

      const query: any = {};

      if (userId) query.userId = userId;
      if (category) query.category = category;
      if (olderThan) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThan));
        query.createdAt = { $lt: cutoffDate };
      }

      const result = await (SettingsHistory as any).deleteMany(query);

      return createSuccessResponse({
        deletedCount: result.deletedCount,
        message: `Deleted ${result.deletedCount} history entries`,
      });
    } catch (error) {
      console.error("Settings history deletion error:", error);
      return handleApiError(error);
    }
  }
);

// Helper function to log settings changes (can be used by other API routes)
export async function logSettingsChange(
  userId: string,
  category: string,
  action: string,
  field: string,
  oldValue: any,
  newValue: any,
  metadata: any = {}
) {
  try {
    await (SettingsHistory as any).create({
      userId,
      category,
      action,
      field,
      oldValue,
      newValue,
      metadata: {
        source: "api",
        ...metadata,
      },
    });
  } catch (error) {
    console.error("Failed to log settings change:", error);
    // Don't throw error to avoid breaking the main operation
  }
}

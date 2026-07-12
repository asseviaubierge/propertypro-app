/**
 * PropertyPro - Individual Notification API Routes
 * GET, PATCH, DELETE operations for individual notification management
 */

import { NextRequest } from "next/server";
import { Types } from "mongoose";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  isValidObjectId,
  withPermissionAndDB,
} from "@/lib/api-utils";
import Notification from "@/models/Notification";
import {
  buildNotificationVisibilityFilter,
  mergeNotificationFilters,
} from "@/lib/notification-visibility";

export const dynamic = "force-dynamic";

// GET /api/notifications/[id] - Get notification details
export const GET = withPermissionAndDB("profile_management")(async (
  user: AuthenticatedAccessUser,
  _request: NextRequest,
  {
    params,
    tenantProfile,
  }: { params: Promise<{ id: string }>; tenantProfile?: any },
) => {
  try {
    const { id } = await params;

    if (!isValidObjectId(id)) {
      return createErrorResponse("Invalid notification ID", 400);
    }

    const scopeFilter = await buildNotificationVisibilityFilter(
      user,
      tenantProfile,
    );
    const notification = await Notification.findOne(
      mergeNotificationFilters(scopeFilter, { _id: new Types.ObjectId(id) }),
    ).lean();

    if (!notification) {
      return createErrorResponse("Notification not found", 404);
    }

    const doc = notification as any;

    return createSuccessResponse({
      id: doc._id?.toString() ?? "",
      title: doc.title,
      message: doc.message,
      type: doc.type,
      priority: doc.priority,
      read: doc.read,
      readAt: doc.readAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      actionUrl: doc.actionUrl ?? null,
      metadata: doc.metadata ?? {},
    });
  } catch (error) {
    console.error("Failed to fetch notification:", error);
    return createErrorResponse("Failed to fetch notification", 500);
  }
});

// DELETE /api/notifications/[id] - Delete a single notification
export const DELETE = withPermissionAndDB("profile_management")(async (
  user: AuthenticatedAccessUser,
  _request: NextRequest,
  {
    params,
    tenantProfile,
  }: { params: Promise<{ id: string }>; tenantProfile?: any },
) => {
  try {
    const { id } = await params;

    if (!isValidObjectId(id)) {
      return createErrorResponse("Invalid notification ID", 400);
    }

    const scopeFilter = await buildNotificationVisibilityFilter(
      user,
      tenantProfile,
    );
    const result = await Notification.findOneAndDelete(
      mergeNotificationFilters(scopeFilter, { _id: new Types.ObjectId(id) }),
    );

    if (!result) {
      return createErrorResponse("Notification not found", 404);
    }

    return createSuccessResponse({
      message: "Notification deleted",
      id,
    });
  } catch (error) {
    console.error("Failed to delete notification:", error);
    return createErrorResponse("Failed to delete notification", 500);
  }
});

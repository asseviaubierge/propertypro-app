/**
 * PropertyPro - Tenant Notifications API
 * Handles fetching and managing payment notifications for tenants
 */

import { NextRequest } from "next/server";
import { Types } from "mongoose";
import PaymentNotification from "@/models/PaymentNotification";
import {
  AuthenticatedAccessUser,
  createSuccessResponse as createApiSuccessResponse,
  createErrorResponse as createApiErrorResponse,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { canCreatePaymentNotification } from "@/lib/notification-access";

export const dynamic = "force-dynamic";

function getTenantNotificationIds(
  user: AuthenticatedAccessUser,
  tenantProfile?: any
): Types.ObjectId[] {
  return [user.id, tenantProfile?._id, tenantProfile?.userId]
    .filter((id): id is string => Boolean(id) && Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));
}

// ============================================================================
// GET - Fetch tenant's payment notifications
// ============================================================================

export const GET = withPermissionAndDB("payment_portal")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    context?: { tenantProfile?: any }
  ) => {
    try {
      const { searchParams } = new URL(request.url);
      const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1);
      const limit = Math.min(
        Math.max(parseInt(searchParams.get("limit") || "12", 10) || 12, 1),
        100,
      );
      const type = searchParams.get("type");
      const status = searchParams.get("status");

      const tenantIds = getTenantNotificationIds(user, context?.tenantProfile);
      const query: any = { tenantId: { $in: tenantIds } };

      if (type) {
        query.type = type;
      }

      if (status) {
        query.status = status;
      }

      const skip = (page - 1) * limit;

      const notifications = await PaymentNotification.find(query)
        .populate("paymentId", "amount type dueDate")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await PaymentNotification.countDocuments(query);
      const totalPages = Math.ceil(total / limit);

      return createApiSuccessResponse<{
        notifications: typeof notifications;
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>(
        {
          notifications,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        },
        "Notifications fetched successfully"
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch notifications";

      return createApiErrorResponse(errorMessage, 500, errorMessage);
    }
  }
);

// ============================================================================
// POST - Create a new notification (typically used by system)
// ============================================================================

export const POST = withPermissionAndDB([
  "payment_processing",
  "financial_management",
])(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const body = await request.json();
      const {
        tenantId,
        paymentId,
        type,
        scheduledDate,
        emailAddress,
        subject,
        message,
      } = body;

      if (
        !tenantId ||
        !paymentId ||
        !type ||
        !emailAddress ||
        !subject ||
        !message
      ) {
        return createApiErrorResponse(
          "Missing required fields",
          400,
          "Missing required fields"
        );
      }

      if (!["reminder", "overdue", "confirmation", "receipt"].includes(type)) {
        return createApiErrorResponse(
          "Type de notification invalide",
          400,
          "Type de notification invalide"
        );
      }

      if (!(await canCreatePaymentNotification(user, paymentId, tenantId))) {
        return createApiErrorResponse(
          "Paiement ou locataire hors de votre périmètre",
          403,
          "Paiement ou locataire hors de votre périmètre"
        );
      }

      const parsedScheduledDate = scheduledDate
        ? new Date(scheduledDate)
        : new Date();
      if (Number.isNaN(parsedScheduledDate.getTime())) {
        return createApiErrorResponse(
          "Date de programmation invalide",
          400,
          "Date de programmation invalide"
        );
      }

      const notification = new PaymentNotification({
        tenantId,
        paymentId,
        type,
        status: "pending",
        scheduledDate: parsedScheduledDate,
        emailAddress,
        subject,
        message,
      });

      await notification.save();

      return createApiSuccessResponse<typeof notification>(
        notification,
        "Notification created successfully"
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create notification";

      return createApiErrorResponse(errorMessage, 500, errorMessage);
    }
  }
);

// ============================================================================
// PUT - Mark notifications as read (bulk operation)
// ============================================================================

export const PUT = withPermissionAndDB("payment_portal")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    context?: { tenantProfile?: any }
  ) => {
    try {
      const body = await request.json();
      const { notificationIds, markAsRead = true } = body;

      if (!notificationIds || !Array.isArray(notificationIds)) {
        return createApiErrorResponse(
          "Invalid notification IDs",
          400,
          "Invalid notification IDs"
        );
      }

      const tenantIds = getTenantNotificationIds(user, context?.tenantProfile);
      const result = await PaymentNotification.updateMany(
        {
          _id: { $in: notificationIds },
          tenantId: { $in: tenantIds },
        },
        {
          $set: {
            isRead: markAsRead,
            readAt: markAsRead ? new Date() : null,
          },
        }
      );

      return createApiSuccessResponse<{ modifiedCount: number }>(
        {
          modifiedCount: result.modifiedCount,
        },
        `${result.modifiedCount} notifications updated successfully`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update notifications";

      return createApiErrorResponse(errorMessage, 500, errorMessage);
    }
  }
);

// ============================================================================
// DELETE - Delete notifications (bulk operation)
// ============================================================================

export const DELETE = withPermissionAndDB("payment_portal")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    context?: { tenantProfile?: any }
  ) => {
    try {
      const { searchParams } = new URL(request.url);
      const notificationIds = searchParams.get("ids")?.split(",");
      const deleteAll = searchParams.get("all") === "true";

      let result;
      const tenantIds = getTenantNotificationIds(user, context?.tenantProfile);

      if (deleteAll) {
        result = await PaymentNotification.deleteMany({
          tenantId: { $in: tenantIds },
        });
      } else if (notificationIds?.length > 0) {
        result = await PaymentNotification.deleteMany({
          _id: { $in: notificationIds },
          tenantId: { $in: tenantIds },
        });
      } else {
        return createApiErrorResponse(
          "No notifications specified for deletion",
          400,
          "No notifications specified for deletion"
        );
      }

      return createApiSuccessResponse<{ deletedCount: number }>(
        {
          deletedCount: result.deletedCount,
        },
        `${result.deletedCount} notifications deleted successfully`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete notifications";

      return createApiErrorResponse(errorMessage, 500, errorMessage);
    }
  }
);

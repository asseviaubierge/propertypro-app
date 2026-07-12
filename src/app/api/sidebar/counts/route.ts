/**
 * PropertyPro - Sidebar Counts API
 * Provides real-time counts for sidebar navigation badges
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import {
  Announcement,
  Conversation,
  Lease,
  MaintenanceRequest,
  Message,
  Notification,
  Payment,
  Ticket,
  User,
} from "@/models";
import {
  UserRole,
  LeaseStatus,
  MaintenancePriority,
  MaintenanceStatus,
  PaymentStatus,
  TicketStatus,
} from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";
import {
  buildNotificationVisibilityFilter,
  mergeNotificationFilters,
} from "@/lib/notification-visibility";
import {
  buildAnnouncementVisibilityFilter,
  buildTenantTicketFilter,
} from "@/lib/inbox-visibility";
import { Types } from "mongoose";

// ============================================================================
// GET /api/sidebar/counts - Get sidebar navigation counts
// ============================================================================

export const GET = withPermissionAndDB("profile_management")(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
  context?: { tenantProfile?: any }
) => {
  try {
    const canViewOperationalCounts = user.isCompanyStaff;

    // Initialize counts object
    const counts = {
      applications: 0,
      expiringLeases: 0,
      emergencyMaintenance: 0,
      overduePayments: 0,
      inbox: 0,
      messages: 0,
      notifications: 0,
      announcements: 0,
      tickets: 0,
    };

    // Role-based count fetching - Single company architecture
    if (canViewOperationalCounts) {
      // Applications count - users with pending application status
      const applicationsCount = await User.countDocuments({
        role: UserRole.TENANT,
        tenantStatus: { $in: ["application_submitted", "under_review"] },
        isActive: true,
        deletedAt: null,
      });
      counts.applications = applicationsCount;
    }

    if (canViewOperationalCounts) {
      // Expiring leases count - leases expiring in next 30 days
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      let leaseQuery: any = {
        status: LeaseStatus.ACTIVE,
        endDate: {
          $gte: new Date(),
          $lte: thirtyDaysFromNow,
        },
        deletedAt: null,
      };

      // Single company - no role-based filtering needed for leases

      const expiringLeasesCount = await Lease.countDocuments(leaseQuery);
      counts.expiringLeases = expiringLeasesCount;
    }

    if (canViewOperationalCounts) {
      // Emergency maintenance count - emergency priority requests that are not completed/cancelled
      let maintenanceQuery: any = {
        priority: MaintenancePriority.EMERGENCY,
        status: {
          $nin: [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
        },
        deletedAt: null,
      };

      // Single company - all maintenance requests visible to admin/manager

      const emergencyMaintenanceCount = await MaintenanceRequest.countDocuments(
        maintenanceQuery
      );
      counts.emergencyMaintenance = emergencyMaintenanceCount;
    }

    if (canViewOperationalCounts) {
      // Overdue payments count
      let paymentQuery: any = {
        status: PaymentStatus.OVERDUE,
        deletedAt: null,
      };

      // Single company - no role-based filtering needed for payments

      const overduePaymentsCount = await Payment.countDocuments(paymentQuery);
      counts.overduePayments = overduePaymentsCount;
    }

    if (Types.ObjectId.isValid(user.id)) {
      const userObjectId = new Types.ObjectId(user.id);

      const conversationIds = await Conversation.distinct("_id", {
        participants: {
          $elemMatch: {
            userId: userObjectId,
            isActive: true,
          },
        },
        isArchived: false,
        deletedAt: null,
      });

      if (conversationIds.length > 0) {
        counts.messages = await Message.countDocuments({
          conversationId: { $in: conversationIds },
          senderId: { $ne: userObjectId },
          deletedAt: null,
          $and: [
            { status: { $ne: "read" } },
            {
              readBy: {
                $not: {
                  $elemMatch: { userId: userObjectId },
                },
              },
            },
          ],
        });
      }

      const notificationScopeFilter = await buildNotificationVisibilityFilter(
        user,
        context?.tenantProfile
      );

      counts.notifications = await Notification.countDocuments(
        mergeNotificationFilters(notificationScopeFilter, { read: false })
      );

      counts.announcements = await Announcement.countDocuments(
        await buildAnnouncementVisibilityFilter(user, context?.tenantProfile)
      );

      const ticketQuery: any = {
        status: {
          $in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS],
        },
        deletedAt: null,
      };

      if (user.isTenant) {
        Object.assign(
          ticketQuery,
          buildTenantTicketFilter(user, context?.tenantProfile)
        );
      }

      counts.tickets = await Ticket.countDocuments(ticketQuery);
      counts.inbox =
        counts.messages +
        counts.notifications +
        counts.announcements +
        counts.tickets;
    }

    return createSuccessResponse(
      counts,
      "Sidebar counts retrieved successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
});

/**
 * PropertyPro - Tenant Statistics API
 * Comprehensive tenant analytics and status reporting
 */

import { NextRequest } from "next/server";
import { User } from "@/models";
import { UserRole } from "@/types";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";

// ============================================================================
// GET /api/tenants/statistics - Get comprehensive tenant statistics
// ============================================================================

export const GET = withPermissionAndDB("tenant_view")(async (
  user,
  request: NextRequest
) => {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe") || "all"; // all, month, quarter, year
    const includeHistory = searchParams.get("includeHistory") === "true";

    // Build date filter based on timeframe
    let dateFilter = {};
    if (timeframe !== "all") {
      const now = new Date();
      let startDate = new Date();

      switch (timeframe) {
        case "month":
          startDate.setMonth(now.getMonth() - 1);
          break;
        case "quarter":
          startDate.setMonth(now.getMonth() - 3);
          break;
        case "year":
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      dateFilter = { createdAt: { $gte: startDate } };
    }

    // Get status counts
    const statusCounts = await User.aggregate([
      {
        $match: {
          role: UserRole.TENANT,
          isActive: true,
          deletedAt: null,
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: "$tenantStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get background check status counts
    const backgroundCheckCounts = await User.aggregate([
      {
        $match: {
          role: UserRole.TENANT,
          isActive: true,
          deletedAt: null,
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: "$backgroundCheckStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get move-in/move-out statistics
    const moveStats = await User.aggregate([
      {
        $match: {
          role: UserRole.TENANT,
          isActive: true,
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: null,
          totalTenants: { $sum: 1 },
          activeTenants: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$moveInDate", null] },
                    { $eq: ["$moveOutDate", null] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          movedOutTenants: {
            $sum: {
              $cond: [{ $ne: ["$moveOutDate", null] }, 1, 0],
            },
          },
          pendingMoveIn: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$tenantStatus", "approved"] },
                    { $eq: ["$moveInDate", null] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Get application trends (last 12 months)
    const applicationTrends = await User.aggregate([
      {
        $match: {
          role: UserRole.TENANT,
          isActive: true,
          deletedAt: null,
          applicationDate: {
            $gte: new Date(
              new Date().setFullYear(new Date().getFullYear() - 1)
            ),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$applicationDate" },
            month: { $month: "$applicationDate" },
          },
          applications: { $sum: 1 },
          approved: {
            $sum: {
              $cond: [{ $eq: ["$tenantStatus", "approved"] }, 1, 0],
            },
          },
          rejected: {
            $sum: {
              $cond: [{ $eq: ["$tenantStatus", "terminated"] }, 1, 0],
            },
          },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    // Format status counts
    const formattedStatusCounts = {};
    statusCounts.forEach((item) => {
      formattedStatusCounts[item._id || "unknown"] = item.count;
    });

    // Format background check counts
    const formattedBackgroundCounts = {};
    backgroundCheckCounts.forEach((item) => {
      formattedBackgroundCounts[item._id || "unknown"] = item.count;
    });

    // Get recent status changes if history is requested
    let recentStatusChanges = [];
    if (includeHistory) {
      recentStatusChanges = await User.find(
        {
          role: UserRole.TENANT,
          isActive: true,
          deletedAt: null,
          "statusHistory.0": { $exists: true },
        },
        {
          firstName: 1,
          lastName: 1,
          tenantStatus: 1,
          statusHistory: { $slice: -5 }, // Last 5 status changes
        }
      )
        .populate("statusHistory.changedBy", "firstName lastName")
        .sort({ lastStatusUpdate: -1 })
        .limit(20);
    }

    const statistics = {
      overview: {
        totalTenants: moveStats[0]?.totalTenants || 0,
        activeTenants: moveStats[0]?.activeTenants || 0,
        movedOutTenants: moveStats[0]?.movedOutTenants || 0,
        pendingMoveIn: moveStats[0]?.pendingMoveIn || 0,
      },
      statusBreakdown: formattedStatusCounts,
      backgroundCheckBreakdown: formattedBackgroundCounts,
      applicationTrends,
      recentStatusChanges: includeHistory ? recentStatusChanges : undefined,
      generatedAt: new Date(),
      timeframe,
    };

    return createSuccessResponse(
      statistics,
      "Tenant statistics retrieved successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
});

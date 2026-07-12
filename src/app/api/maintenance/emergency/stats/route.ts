/**
 * PropertyPro - Emergency Statistics API Route
 * Provide detailed statistics and analytics for emergency maintenance requests
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { MaintenanceRequest } from "@/models";
import { MaintenancePriority, MaintenanceStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";

// ============================================================================
// GET /api/maintenance/emergency/stats - Get emergency statistics
// ============================================================================

export const GET = withPermissionAndDB("maintenance_management")(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe") || "30"; // days
    const propertyId = searchParams.get("propertyId");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeframe));

    // Build base query
    let baseQuery: any = {
      priority: MaintenancePriority.EMERGENCY,
      deletedAt: null,
      createdAt: { $gte: startDate },
    };

    if (propertyId) {
      baseQuery.propertyId = propertyId;
    }

    // Manager-equivalent roles are limited to their assigned and unassigned emergencies.
    if (user.isManager && !user.isAdmin) {
      baseQuery.$or = [
        { assignedTo: user.id },
        { assignedTo: { $exists: false } },
      ];
    }

    // Get comprehensive emergency statistics
    const stats = await MaintenanceRequest.aggregate([
      { $match: baseQuery },
      {
        $addFields: {
          hoursSinceCreation: {
            $divide: [
              { $subtract: [new Date(), "$createdAt"] },
              1000 * 60 * 60,
            ],
          },
          responseTime: {
            $cond: [
              { $eq: ["$status", MaintenanceStatus.COMPLETED] },
              {
                $divide: [
                  { $subtract: ["$completedDate", "$createdAt"] },
                  1000 * 60 * 60,
                ],
              },
              null,
            ],
          },
          isOverdue: {
            $and: [
              {
                $not: {
                  $in: [
                    "$status",
                    [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
                  ],
                },
              },
              {
                $gt: [
                  {
                    $divide: [
                      { $subtract: [new Date(), "$createdAt"] },
                      1000 * 60 * 60,
                    ],
                  },
                  2,
                ],
              },
            ],
          },
          urgencyLevel: {
            $cond: {
              if: {
                $in: [
                  "$status",
                  [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
                ],
              },
              then: "completed",
              else: {
                $cond: {
                  if: {
                    $gt: [
                      {
                        $divide: [
                          { $subtract: [new Date(), "$createdAt"] },
                          1000 * 60 * 60,
                        ],
                      },
                      4,
                    ],
                  },
                  then: "critical",
                  else: {
                    $cond: {
                      if: {
                        $gt: [
                          {
                            $divide: [
                              { $subtract: [new Date(), "$createdAt"] },
                              1000 * 60 * 60,
                            ],
                          },
                          2,
                        ],
                      },
                      then: "overdue",
                      else: "normal",
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          // Basic counts
          totalEmergencies: { $sum: 1 },
          activeEmergencies: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    [
                      MaintenanceStatus.SUBMITTED,
                      MaintenanceStatus.ASSIGNED,
                      MaintenanceStatus.IN_PROGRESS,
                    ],
                  ],
                },
                1,
                0,
              ],
            },
          },
          completedEmergencies: {
            $sum: {
              $cond: [{ $eq: ["$status", MaintenanceStatus.COMPLETED] }, 1, 0],
            },
          },
          overdueEmergencies: { $sum: { $cond: ["$isOverdue", 1, 0] } },
          unassignedEmergencies: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $not: { $ifNull: ["$assignedTo", false] } },
                    {
                      $in: [
                        "$status",
                        [
                          MaintenanceStatus.SUBMITTED,
                          MaintenanceStatus.ASSIGNED,
                          MaintenanceStatus.IN_PROGRESS,
                        ],
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          // Response time metrics
          avgResponseTime: { $avg: "$responseTime" },
          minResponseTime: { $min: "$responseTime" },
          maxResponseTime: { $max: "$responseTime" },
          // Urgency breakdown
          criticalCount: {
            $sum: { $cond: [{ $eq: ["$urgencyLevel", "critical"] }, 1, 0] },
          },
          overdueCount: {
            $sum: { $cond: [{ $eq: ["$urgencyLevel", "overdue"] }, 1, 0] },
          },
          normalCount: {
            $sum: { $cond: [{ $eq: ["$urgencyLevel", "normal"] }, 1, 0] },
          },
          // Cost metrics
          totalEstimatedCost: { $sum: "$estimatedCost" },
          totalActualCost: { $sum: "$actualCost" },
          avgEstimatedCost: { $avg: "$estimatedCost" },
          avgActualCost: { $avg: "$actualCost" },
        },
      },
    ]);

    // Get category breakdown
    const categoryStats = await MaintenanceRequest.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          avgResponseTime: {
            $avg: {
              $cond: [
                { $eq: ["$status", MaintenanceStatus.COMPLETED] },
                {
                  $divide: [
                    { $subtract: ["$completedDate", "$createdAt"] },
                    1000 * 60 * 60,
                  ],
                },
                null,
              ],
            },
          },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get daily trend data
    const trendData = await MaintenanceRequest.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          count: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", MaintenanceStatus.COMPLETED] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get response time distribution
    const responseTimeDistribution = await MaintenanceRequest.aggregate([
      {
        $match: {
          ...baseQuery,
          status: MaintenanceStatus.COMPLETED,
          completedDate: { $exists: true },
        },
      },
      {
        $addFields: {
          responseTimeHours: {
            $divide: [
              { $subtract: ["$completedDate", "$createdAt"] },
              1000 * 60 * 60,
            ],
          },
        },
      },
      {
        $bucket: {
          groupBy: "$responseTimeHours",
          boundaries: [0, 2, 4, 8, 24, 48, Infinity],
          default: "other",
          output: {
            count: { $sum: 1 },
            avgCost: { $avg: "$actualCost" },
          },
        },
      },
    ]);

    const statistics = stats[0] || {
      totalEmergencies: 0,
      activeEmergencies: 0,
      completedEmergencies: 0,
      overdueEmergencies: 0,
      unassignedEmergencies: 0,
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      criticalCount: 0,
      overdueCount: 0,
      normalCount: 0,
      totalEstimatedCost: 0,
      totalActualCost: 0,
      avgEstimatedCost: 0,
      avgActualCost: 0,
    };

    // Calculate performance metrics
    const completionRate =
      statistics.totalEmergencies > 0
        ? (statistics.completedEmergencies / statistics.totalEmergencies) * 100
        : 0;

    const onTimeRate =
      statistics.completedEmergencies > 0
        ? ((statistics.completedEmergencies - statistics.overdueEmergencies) /
            statistics.completedEmergencies) *
          100
        : 0;

    return createSuccessResponse(
      {
        overview: {
          ...statistics,
          completionRate: Math.round(completionRate * 100) / 100,
          onTimeRate: Math.round(onTimeRate * 100) / 100,
        },
        categoryBreakdown: categoryStats,
        trendData,
        responseTimeDistribution,
        timeframe: parseInt(timeframe),
      },
      "Emergency statistics retrieved successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
});

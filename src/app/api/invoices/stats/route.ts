/**
 * PropertyPro - Invoice Statistics API
 * Comprehensive invoice analytics and status reporting
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Invoice, Property } from "@/models";
import { InvoiceStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";

// ============================================================================
// GET /api/invoices/stats - Get comprehensive invoice statistics
// ============================================================================

export const GET = withPermissionAndDB("financial_reports")(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe") || "all"; // all, month, quarter, year
    const propertyId = searchParams.get("propertyId");
    const tenantId = searchParams.get("tenantId");
    const leaseId = searchParams.get("leaseId");

    // Build base query
    let baseQuery: any = {};

    // Apply role-based filtering
    // Single company architecture - Managers can view invoice stats for all properties
    if (user.isTenant) {
      baseQuery.tenantId = user.id;

      if (tenantId && tenantId !== user.id) {
        return createErrorResponse(
          "You can only view your own invoice statistics",
          403
        );
      }
    }

    // Apply additional filters
    if (propertyId) {
      baseQuery.propertyId = propertyId;
    }
    if (tenantId) {
      // Non-tenant roles may inspect other tenants; tenants already validated above
      baseQuery.tenantId = tenantId;
    }
    if (leaseId) {
      baseQuery.leaseId = leaseId;
    }

    // Apply timeframe filter
    if (timeframe !== "all") {
      const now = new Date();
      let startDate: Date;

      switch (timeframe) {
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case "quarter":
          const quarterStart = Math.floor(now.getMonth() / 3) * 3;
          startDate = new Date(now.getFullYear(), quarterStart, 1);
          break;
        case "year":
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(0); // Beginning of time
      }

      baseQuery.createdAt = { $gte: startDate };
    }

    // Get status counts
    const statusCounts = await Invoice.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
          paidAmount: { $sum: "$amountPaid" },
          balanceRemaining: { $sum: "$balanceRemaining" },
        },
      },
    ]);

    // Get total statistics
    const totalStats = await Invoice.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
          paidAmount: { $sum: "$amountPaid" },
          overdueAmount: {
            $sum: {
              $cond: [
                { $eq: ["$status", InvoiceStatus.OVERDUE] },
                "$balanceRemaining",
                0,
              ],
            },
          },
        },
      },
    ]);

    // Initialize stats object
    const stats = {
      total: 0,
      scheduled: 0,
      issued: 0,
      paid: 0,
      partial: 0,
      overdue: 0,
      cancelled: 0,
      totalAmount: 0,
      paidAmount: 0,
      overdueAmount: 0,
    };

    // Populate status counts
    statusCounts.forEach((status) => {
      const statusKey = status._id as keyof typeof stats;
      if (statusKey in stats && typeof stats[statusKey] === "number") {
        (stats as any)[statusKey] = status.count;
      }
    });

    // Set total statistics
    if (totalStats.length > 0) {
      stats.total = totalStats[0].total;
      stats.totalAmount = totalStats[0].totalAmount;
      stats.paidAmount = totalStats[0].paidAmount;
      stats.overdueAmount = totalStats[0].overdueAmount;
    }

    return createSuccessResponse(
      stats,
      "Invoice statistics retrieved successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
});

/**
 * PropertyPro - Revenues API Route
 * GET /api/accounting/revenues - Get revenue data
 */

import { NextRequest } from "next/server";
import {
  withPermissionAndDB,
  createSuccessResponse as createApiSuccessResponse,
  createErrorResponse as createApiErrorResponse,
} from "@/lib/api-utils";
import { revenueService } from "@/lib/services/revenue.service";

function createSuccessResponse(
  data: any,
  message: string,
  pagination?: any
) {
  return createApiSuccessResponse(data, message, pagination);
}

function createErrorResponse(message: string, status: number = 400) {
  return createApiErrorResponse(message, status, message);
}

export const GET = withPermissionAndDB("financial_reports")(
  async (_user: any, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const propertyId = searchParams.get("propertyId") || undefined;
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      const parsedMonths = parseInt(searchParams.get("months") || "12");
      const months = Number.isNaN(parsedMonths) ? 12 : parsedMonths;

      const [summary, byCategory, byProperty, monthlyTrends] =
        await Promise.all([
          revenueService.getRevenueSummary(propertyId),
          revenueService.getRevenueByCategory(
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined,
            propertyId
          ),
          revenueService.getRevenueByProperty(
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined
          ),
          revenueService.getMonthlyRevenue(months, propertyId),
        ]);

      return createSuccessResponse(
        {
          summary,
          byCategory,
          byProperty,
          monthlyTrends,
        },
        "Revenue data retrieved successfully"
      );
    } catch (error) {
      console.error("[Revenues API] Error:", error);
      return createErrorResponse("Failed to fetch revenue data", 500);
    }
  }
);

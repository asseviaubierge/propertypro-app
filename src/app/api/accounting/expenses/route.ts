/**
 * PropertyPro - Expenses API Routes
 * GET /api/accounting/expenses - List expenses
 * POST /api/accounting/expenses - Create expense
 */

import { NextRequest } from "next/server";
import {
  withPermissionAndDB,
  createSuccessResponse as createApiSuccessResponse,
  createErrorResponse as createApiErrorResponse,
} from "@/lib/api-utils";
import { expenseService } from "@/lib/services/expense.service";

function createSuccessResponse(
  data: any,
  message: string,
  pagination?: any,
  status: number = 200
) {
  return createApiSuccessResponse(data, message, pagination);
}

function createErrorResponse(message: string, status: number = 400) {
  return createApiErrorResponse(message, status, message);
}

export const GET = withPermissionAndDB("financial_management")(
  async (_user: any, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get("page") || "1");
      const limit = Math.min(parseInt(searchParams.get("limit") || "12"), 100);
      const search = (searchParams.get("search") || "").trim();
      const category = searchParams.get("category");
      const status = searchParams.get("status");
      const propertyId = searchParams.get("propertyId");
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      const sortBy = searchParams.get("sortBy") || "date";
      const sortOrder =
        (searchParams.get("sortOrder") as "asc" | "desc") || "desc";

      // Get summary in parallel
      const includeSummary = searchParams.get("includeSummary") === "true";

      const result = await expenseService.listExpenses({
        page,
        limit,
        search: search || undefined,
        category: category || undefined,
        status: status || undefined,
        propertyId: propertyId || undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        sortBy,
        sortOrder,
      });

      let summary = undefined;
      if (includeSummary) {
        summary = await expenseService.getExpenseSummary(
          propertyId || undefined
        );
      }

      return createSuccessResponse(
        {
          expenses: result.expenses,
          summary,
        },
        "Expenses retrieved successfully",
        result.pagination
      );
    } catch (error) {
      console.error("[Expenses API] Error:", error);
      return createErrorResponse("Failed to fetch expenses", 500);
    }
  }
);

export const POST = withPermissionAndDB("financial_management")(
  async (user: any, request: NextRequest) => {
    try {
      const body = await request.json();

      if (!body?.category || !body?.description || !body?.amount || !body?.date) {
        return createErrorResponse(
          "Category, description, amount, and date are required"
        );
      }

      if ((body?.amount ?? 0) <= 0) {
        return createErrorResponse("Amount must be greater than 0");
      }

      const expense = await expenseService.createExpense({
        ...body,
        createdBy: user?.id,
      });

      return createSuccessResponse(expense, "Expense created successfully");
    } catch (error) {
      console.error("[Expenses API] Create error:", error);
      return createErrorResponse("Failed to create expense", 500);
    }
  }
);

/**
 * PropertyPro - Single Expense API Routes
 * GET/PUT/DELETE /api/accounting/expenses/[id]
 */

import { NextRequest } from "next/server";
import { UserRole } from "@/types";
import {
  withPermissionAndDB,
  createSuccessResponse,
  createErrorResponse,
  isValidObjectId,
} from "@/lib/api-utils";
import { expenseService } from "@/lib/services/expense.service";

export const GET = withPermissionAndDB("financial_management")(
  async (
    user: any,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid expense ID", 400);
      }

      const expense = await expenseService.getExpense(id);
      if (!expense) {
        return createErrorResponse("Expense not found", 404);
      }

      return createSuccessResponse(expense, "Expense retrieved successfully");
    } catch (error) {
      console.error("[Expense API] GET error:", error);
      return createErrorResponse("Failed to fetch expense", 500);
    }
  }
);

export const PUT = withPermissionAndDB("financial_management")(
  async (
    user: any,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid expense ID", 400);
      }

      const body = await request.json();
      const expense = await expenseService.updateExpense(id, body);

      if (!expense) {
        return createErrorResponse("Expense not found", 404);
      }

      return createSuccessResponse(expense, "Expense updated successfully");
    } catch (error) {
      console.error("[Expense API] PUT error:", error);
      return createErrorResponse("Failed to update expense", 500);
    }
  }
);

export const DELETE = withPermissionAndDB("financial_management")(
  async (
    user: any,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid expense ID", 400);
      }

      await expenseService.deleteExpense(id);

      return createSuccessResponse(null, "Expense deleted successfully");
    } catch (error) {
      console.error("[Expense API] DELETE error:", error);
      return createErrorResponse("Failed to delete expense", 500);
    }
  }
);

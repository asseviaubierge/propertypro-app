/**
 * PropertyPro - Unified Transactions API
 * GET /api/accounting/transactions
 *
 * Administrators can see all transactions. Owners and managers are restricted
 * to their scoped properties. Tenants can only see their own transactions.
 */

import { NextRequest } from "next/server";
import { Types } from "mongoose";
import {
  createSuccessResponse,
  createErrorResponse,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { transactionService } from "@/lib/services/transaction.service";
import { resolveAccessProfile } from "@/lib/server-permissions";
import { canAccessProperty, getScopedPropertyIds } from "@/lib/property-scope";
import { TransactionType } from "@/types";

const ALLOWED_SORT_FIELDS = new Set(["date", "amount"]);
const ALLOWED_SORT_ORDERS = new Set(["asc", "desc"]);

function parsePositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDate(value: string | null, endOfDay = false): Date | undefined {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

export const GET = withPermissionAndDB("financial_reports")(
  async (user, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const page = parsePositiveInteger(searchParams.get("page"), 1);
      const limit = Math.min(
        parsePositiveInteger(searchParams.get("limit"), 12),
        100
      );
      const search = (searchParams.get("search") || "").trim();
      const requestedType = searchParams.get("type");
      const category = (searchParams.get("category") || "").trim();
      const propertyId = (searchParams.get("propertyId") || "").trim();
      const startDateValue = searchParams.get("startDate");
      const endDateValue = searchParams.get("endDate");
      const requestedSortBy = searchParams.get("sortBy") || "date";
      const requestedSortOrder = searchParams.get("sortOrder") || "desc";

      if (propertyId && !Types.ObjectId.isValid(propertyId)) {
        return createErrorResponse("Invalid property identifier", 400);
      }

      const validTypes = new Set(Object.values(TransactionType));
      if (requestedType && !validTypes.has(requestedType as TransactionType)) {
        return createErrorResponse("Invalid transaction type", 400);
      }

      const startDate = parseDate(startDateValue);
      const endDate = parseDate(endDateValue, true);
      if (startDateValue && !startDate) {
        return createErrorResponse("Invalid start date", 400);
      }
      if (endDateValue && !endDate) {
        return createErrorResponse("Invalid end date", 400);
      }
      if (startDate && endDate && startDate > endDate) {
        return createErrorResponse(
          "The start date must be before the end date",
          400
        );
      }

      const accessProfile = await resolveAccessProfile(user.role);
      const scopedUser = { ...accessProfile, id: String(user.id) };

      const params = {
        page,
        limit,
        search: search || undefined,
        type: (requestedType as TransactionType | null) || undefined,
        category: category || undefined,
        propertyId: propertyId || undefined,
        propertyIds: undefined as string[] | undefined,
        tenantId: undefined as string | undefined,
        startDate,
        endDate,
        sortBy: ALLOWED_SORT_FIELDS.has(requestedSortBy)
          ? requestedSortBy
          : "date",
        sortOrder: (ALLOWED_SORT_ORDERS.has(requestedSortOrder)
          ? requestedSortOrder
          : "desc") as "asc" | "desc",
        bankOnly: true,
      };

      if (accessProfile.isTenant) {
        // A tenant can never select another tenant. An optional property filter
        // only narrows their own payment history.
        params.tenantId = String(user.id);
      } else if (!accessProfile.isAdmin) {
        if (propertyId) {
          const allowed = await canAccessProperty(scopedUser, propertyId);
          if (!allowed) {
            return createErrorResponse(
              "You do not have access to this property's transactions",
              403
            );
          }
        } else {
          const scopedPropertyIds = await getScopedPropertyIds(scopedUser);
          params.propertyIds = (scopedPropertyIds ?? []).map((id) =>
            id.toString()
          );
        }
      }

      const result = await transactionService.getUnifiedTransactions(params);

      return createSuccessResponse(
        {
          transactions: result.transactions,
          summary: result.summary,
        },
        "Transactions retrieved successfully",
        result.pagination
      );
    } catch (error) {
      console.error("[Transactions API] Error:", error);
      return createErrorResponse("Failed to fetch transactions", 500);
    }
  }
);

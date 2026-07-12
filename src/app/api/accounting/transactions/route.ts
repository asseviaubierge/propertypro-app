/**
 * PropertyPro - Bank Transactions API Route
 * GET /api/accounting/transactions - List settled bank-level transactions
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { TransactionType } from "@/types";
import {
  createSuccessResponse as createApiSuccessResponse,
  createErrorResponse as createApiErrorResponse,
} from "@/lib/api-utils";
import { transactionService } from "@/lib/services/transaction.service";
import { resolveAccessProfile } from "@/lib/server-permissions";

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

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const session = await auth();
    if (!session?.user) {
      return createErrorResponse("Authentication required", 401);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "12"), 100);
    const search = (searchParams.get("search") || "").trim();
    const type = searchParams.get("type") as TransactionType | null;
    const category = searchParams.get("category");
    const propertyId = searchParams.get("propertyId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const sortBy = searchParams.get("sortBy") || "date";
    const sortOrder =
      (searchParams.get("sortOrder") as "asc" | "desc") || "desc";

    const accessProfile = await resolveAccessProfile(session.user?.role);

    // Build params
    const params = {
      page,
      limit,
      search: search || undefined,
      type: type || undefined,
      category: category || undefined,
      propertyId: propertyId || undefined,
      tenantId: undefined as string | undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      sortBy,
      sortOrder,
      bankOnly: true,
    };

    // Tenant can only see their own transactions
    if (accessProfile?.isTenant) {
      params.tenantId = session.user?.id;
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

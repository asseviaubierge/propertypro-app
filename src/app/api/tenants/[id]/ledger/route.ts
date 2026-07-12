/**
 * PropertyPro - Tenant Ledger API
 * API endpoints for tenant ledger and financial history
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { tenantLedgerService } from "@/lib/services/tenant-ledger.service";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from "@/lib/api-utils";
import { Types } from "mongoose";

// ============================================================================
// GET /api/tenants/[id]/ledger - Get tenant ledger
// ============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const { id: tenantId } = params;
    const { searchParams } = new URL(request.url);

    if (!Types.ObjectId.isValid(tenantId)) {
      return createErrorResponse("Invalid tenant ID", 400);
    }

    // Parse query parameters
    const leaseId = searchParams.get("leaseId");
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : undefined;
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const includeZeroBalance =
      searchParams.get("includeZeroBalance") === "true";
    const format = searchParams.get("format"); // csv, json

    // Validate lease ID if provided
    if (leaseId && !Types.ObjectId.isValid(leaseId)) {
      return createErrorResponse("Invalid lease ID", 400);
    }

    // Handle CSV export
    if (format === "csv") {
      const csvContent = await tenantLedgerService.exportLedgerToCSV(tenantId, {
        leaseId: leaseId || undefined,
        startDate,
        endDate,
      });

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="tenant_ledger_${tenantId}.csv"`,
        },
      });
    }

    // Generate ledger report
    const ledgerReport = await tenantLedgerService.generateTenantLedger(
      tenantId,
      {
        leaseId: leaseId || undefined,
        startDate,
        endDate,
        page,
        limit,
        includeZeroBalanceEntries: includeZeroBalance,
      }
    );

    return createSuccessResponse(
      ledgerReport,
      "Tenant ledger retrieved successfully"
    );
  } catch (error) {
    return handleApiError(error, "Failed to retrieve tenant ledger");
  }
}

// ============================================================================
// POST /api/tenants/[id]/ledger - Generate custom ledger report
// ============================================================================
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const { id: tenantId } = params;
    const body = await request.json();

    if (!Types.ObjectId.isValid(tenantId)) {
      return createErrorResponse("Invalid tenant ID", 400);
    }

    const {
      leaseId,
      startDate,
      endDate,
      includeCategories = [],
      excludeCategories = [],
      minAmount,
      maxAmount,
      exportFormat = "json",
    } = body;

    // Validate lease ID if provided
    if (leaseId && !Types.ObjectId.isValid(leaseId)) {
      return createErrorResponse("Invalid lease ID", 400);
    }

    // Generate custom ledger report
    const ledgerReport = await tenantLedgerService.generateTenantLedger(
      tenantId,
      {
        leaseId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: 1000, // Higher limit for custom reports
      }
    );

    // Apply custom filters
    let filteredEntries = ledgerReport.entries;

    if (includeCategories.length > 0) {
      filteredEntries = filteredEntries.filter((entry) =>
        includeCategories.includes(entry.category)
      );
    }

    if (excludeCategories.length > 0) {
      filteredEntries = filteredEntries.filter(
        (entry) => !excludeCategories.includes(entry.category)
      );
    }

    if (minAmount !== undefined) {
      filteredEntries = filteredEntries.filter(
        (entry) =>
          entry.debitAmount >= minAmount || entry.creditAmount >= minAmount
      );
    }

    if (maxAmount !== undefined) {
      filteredEntries = filteredEntries.filter(
        (entry) =>
          entry.debitAmount <= maxAmount || entry.creditAmount <= maxAmount
      );
    }

    // Handle CSV export
    if (exportFormat === "csv") {
      const headers = [
        "Date",
        "Type",
        "Category",
        "Description",
        "Reference",
        "Debit Amount",
        "Credit Amount",
        "Running Balance",
        "Status",
      ];

      const rows = filteredEntries.map((entry) => [
        entry.date.toLocaleDateString(),
        entry.type,
        entry.category,
        entry.description,
        entry.reference,
        entry.debitAmount.toFixed(2),
        entry.creditAmount.toFixed(2),
        entry.runningBalance.toFixed(2),
        entry.status,
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="custom_ledger_${tenantId}.csv"`,
        },
      });
    }

    // Return filtered JSON report
    const customReport = {
      ...ledgerReport,
      entries: filteredEntries,
      filters: {
        includeCategories,
        excludeCategories,
        minAmount,
        maxAmount,
      },
    };

    return createSuccessResponse(
      customReport,
      "Custom ledger report generated successfully"
    );
  } catch (error) {
    return handleApiError(error, "Failed to generate custom ledger report");
  }
}

// ============================================================================
// Helper endpoint for current balance
// ============================================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const { id: tenantId } = params;
    const { searchParams } = new URL(request.url);
    const leaseId = searchParams.get("leaseId");

    if (!Types.ObjectId.isValid(tenantId)) {
      return createErrorResponse("Invalid tenant ID", 400);
    }

    // Get current balance information
    const balanceInfo = await tenantLedgerService.getCurrentBalance(
      tenantId,
      leaseId || undefined
    );

    return createSuccessResponse(
      balanceInfo,
      "Current balance retrieved successfully"
    );
  } catch (error) {
    return handleApiError(error, "Failed to retrieve current balance");
  }
}

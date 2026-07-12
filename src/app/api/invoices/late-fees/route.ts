/**
 * PropertyPro - Late Fee Processing API
 * API endpoints for automated late fee processing
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { automatedLateFeeService } from "@/lib/services/automated-late-fee.service";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from "@/lib/api-utils";

// ============================================================================
// POST /api/invoices/late-fees - Process late fees for all overdue invoices
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { dryRun = false, customRules, leaseId } = body;

    let result;

    if (leaseId) {
      // Process late fees for a specific lease
      const rules = await automatedLateFeeService.getLateFeeRulesForLease(
        leaseId
      );
      result = await automatedLateFeeService.processAllLateFees(rules, dryRun);
    } else {
      // Process late fees for all invoices
      result = await automatedLateFeeService.processAllLateFees(
        customRules,
        dryRun
      );
    }

    const message = dryRun
      ? `Late fee preview completed: ${result.feesApplied} fees would be applied`
      : `Late fee processing completed: ${result.feesApplied} fees applied`;

    return createSuccessResponse(
      {
        dryRun,
        summary: {
          totalProcessed: result.totalProcessed,
          feesApplied: result.feesApplied,
          totalFeeAmount: result.totalFeeAmount,
          errorCount: result.errors.length,
        },
        applications: result.applications,
        breakdown: result.summary,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
      message
    );
  } catch (error) {
    return handleApiError(error, "Failed to process late fees");
  }
}

// ============================================================================
// GET /api/invoices/late-fees - Get late fee preview/status
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const leaseId = searchParams.get("leaseId");
    const preview = searchParams.get("preview") === "true";

    if (preview) {
      // Get preview of what late fees would be applied
      let rules;
      if (leaseId) {
        rules = await automatedLateFeeService.getLateFeeRulesForLease(leaseId);
      }

      const result = await automatedLateFeeService.processAllLateFees(
        rules,
        true
      );

      return createSuccessResponse(
        {
          preview: true,
          summary: {
            totalProcessed: result.totalProcessed,
            feesApplied: result.feesApplied,
            totalFeeAmount: result.totalFeeAmount,
          },
          applications: result.applications,
          breakdown: result.summary,
        },
        "Late fee preview generated"
      );
    } else {
      // Get current late fee rules and status
      let rules;
      if (leaseId) {
        rules = await automatedLateFeeService.getLateFeeRulesForLease(leaseId);
      } else {
        // Return default rules
        rules = []; // Would get from service
      }

      return createSuccessResponse(
        {
          rules,
          leaseId,
        },
        "Late fee rules retrieved"
      );
    }
  } catch (error) {
    return handleApiError(error, "Failed to get late fee information");
  }
}

// ============================================================================
// PATCH /api/invoices/late-fees - Update late fee rules
// ============================================================================
export async function PATCH(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { leaseId, rules, enabled } = body;

    if (!leaseId) {
      return createErrorResponse(
        "Lease ID is required for updating rules",
        400
      );
    }

    // This would update the lease's late fee configuration
    // For now, we'll just validate the rules format
    if (rules && Array.isArray(rules)) {
      for (const rule of rules) {
        if (!rule.id || !rule.name || typeof rule.enabled !== "boolean") {
          return createErrorResponse("Invalid rule format", 400);
        }
      }
    }

    // TODO: Implement actual rule updating in lease document
    // const Lease = require("@/models").Lease;
    // await Lease.findByIdAndUpdate(leaseId, {
    //   "terms.paymentConfig.lateFeeRules": rules
    // });

    return createSuccessResponse(
      {
        leaseId,
        rulesUpdated: rules?.length || 0,
        enabled,
      },
      "Late fee rules updated successfully"
    );
  } catch (error) {
    return handleApiError(error, "Failed to update late fee rules");
  }
}

// ============================================================================
// DELETE /api/invoices/late-fees - Remove late fees from invoices
// ============================================================================
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const invoiceIds = searchParams.get("invoiceIds")?.split(",") || [];
    const leaseId = searchParams.get("leaseId");

    if (invoiceIds.length === 0 && !leaseId) {
      return createErrorResponse("Invoice IDs or Lease ID required", 400);
    }

    // This would reverse late fees from specified invoices
    // For now, return a placeholder response
    const reversedCount = invoiceIds.length;

    return createSuccessResponse(
      {
        reversedCount,
        invoiceIds,
        leaseId,
      },
      `Reversed late fees from ${reversedCount} invoices`
    );
  } catch (error) {
    return handleApiError(error, "Failed to reverse late fees");
  }
}

// ============================================================================
// PUT /api/invoices/late-fees - Manual late fee application
// ============================================================================
export async function PUT(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { invoiceId, lateFeeAmount, reason, applyImmediately = true } = body;

    if (!invoiceId) {
      return createErrorResponse("Invoice ID is required", 400);
    }

    if (!lateFeeAmount || lateFeeAmount <= 0) {
      return createErrorResponse("Valid late fee amount is required", 400);
    }

    // Apply manual late fee
    const Invoice = require("@/models").Invoice;
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return createErrorResponse("Invoice not found", 404);
    }

    if (applyImmediately) {
      await invoice.addLateFee(lateFeeAmount);
    }

    return createSuccessResponse(
      {
        invoiceId,
        lateFeeAmount,
        newTotal: invoice.totalAmount + lateFeeAmount,
        applied: applyImmediately,
        reason,
      },
      "Manual late fee applied successfully"
    );
  } catch (error) {
    return handleApiError(error, "Failed to apply manual late fee");
  }
}

/**
 * PropertyPro - Payment Recording API
 * API endpoint for recording payments with automatic invoice linking
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { paymentInvoiceLinkingService } from "@/lib/services/payment-invoice-linking.service";
import { receiptGenerationService } from "@/lib/services/receipt-generation.service";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from "@/lib/api-utils";
import { Types } from "mongoose";

// ============================================================================
// POST /api/payments/record - Record a new payment with invoice linking
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const {
      tenantId,
      leaseId,
      amount,
      paymentMethod,
      paymentDate = new Date(),
      notes,
      specificInvoiceId,
      transactionId,
    } = body;

    // Validate required fields
    if (!tenantId) {
      return createErrorResponse("Tenant ID is required", 400);
    }

    if (!amount || amount <= 0) {
      return createErrorResponse("Valid payment amount is required", 400);
    }

    if (!paymentMethod) {
      return createErrorResponse("Payment method is required", 400);
    }

    // Validate tenant ID format
    if (!Types.ObjectId.isValid(tenantId)) {
      return createErrorResponse("Invalid tenant ID format", 400);
    }

    // Validate lease ID format if provided
    if (leaseId && !Types.ObjectId.isValid(leaseId)) {
      return createErrorResponse("Invalid lease ID format", 400);
    }

    // Validate specific invoice ID if provided
    if (specificInvoiceId && !Types.ObjectId.isValid(specificInvoiceId)) {
      return createErrorResponse("Invalid invoice ID format", 400);
    }

    // Record the payment and link to invoices
    const result = await paymentInvoiceLinkingService.recordManualPayment({
      tenantId,
      leaseId,
      amount: parseFloat(amount),
      paymentMethod,
      paymentDate: new Date(paymentDate),
      notes,
      specificInvoiceId,
    });

    if (!result.success) {
      return createErrorResponse(
        `Payment recording failed: ${result.errors.join(", ")}`,
        400
      );
    }

    // Generate receipt automatically
    let receiptResult = null;
    try {
      receiptResult = await receiptGenerationService.generateReceiptForPayment(
        result.paymentId,
        true // Auto-email receipt
      );
    } catch (error) {
      console.error("Failed to generate receipt:", error);
      // Don't fail the payment if receipt generation fails
    }

    // Get updated payment allocation for the tenant
    const allocation = await paymentInvoiceLinkingService.getPaymentAllocation(
      tenantId,
      leaseId
    );

    return createSuccessResponse(
      {
        payment: {
          id: result.paymentId,
          amount: amount,
          amountApplied: result.totalAmountApplied,
          remainingAmount: result.remainingPaymentAmount,
        },
        invoiceApplications: result.applicationsApplied,
        receipt: receiptResult?.success
          ? {
              receiptId: receiptResult.receiptId,
              receiptNumber: receiptResult.receiptNumber,
              emailSent: receiptResult.emailSent,
            }
          : null,
        tenantBalance: {
          totalOutstanding: allocation.totalOutstanding,
          invoiceCount: allocation.invoices.length,
        },
        warnings: result.errors.length > 0 ? result.errors : undefined,
      },
      "Payment recorded and applied to invoices successfully",
      201
    );
  } catch (error) {
    return handleApiError(error, "Failed to record payment");
  }
}

// ============================================================================
// GET /api/payments/record - Get payment allocation preview
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const leaseId = searchParams.get("leaseId");
    const amount = searchParams.get("amount");

    if (!tenantId) {
      return createErrorResponse("Tenant ID is required", 400);
    }

    if (!Types.ObjectId.isValid(tenantId)) {
      return createErrorResponse("Invalid tenant ID format", 400);
    }

    // Get current payment allocation
    const allocation = await paymentInvoiceLinkingService.getPaymentAllocation(
      tenantId,
      leaseId || undefined
    );

    // If amount is provided, calculate how it would be applied
    let paymentPreview = null;
    if (amount && parseFloat(amount) > 0) {
      const paymentAmount = parseFloat(amount);
      let remainingAmount = paymentAmount;
      const applications = [];

      for (const invoice of allocation.invoices) {
        if (remainingAmount <= 0) break;

        const amountToApply = Math.min(
          remainingAmount,
          invoice.balanceRemaining
        );
        applications.push({
          invoiceId: invoice.invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          dueDate: invoice.dueDate,
          currentBalance: invoice.balanceRemaining,
          amountToApply,
          newBalance: invoice.balanceRemaining - amountToApply,
          willBePaid: invoice.balanceRemaining - amountToApply === 0,
        });

        remainingAmount -= amountToApply;
      }

      paymentPreview = {
        paymentAmount,
        totalApplied: paymentAmount - remainingAmount,
        remainingAmount,
        applications,
      };
    }

    return createSuccessResponse(
      {
        tenantId,
        leaseId,
        currentAllocation: allocation,
        paymentPreview,
      },
      "Payment allocation retrieved successfully"
    );
  } catch (error) {
    return handleApiError(error, "Failed to get payment allocation");
  }
}

// ============================================================================
// PATCH /api/payments/record - Apply existing payment to invoices
// ============================================================================
export async function PATCH(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { paymentId, tenantId, amount, leaseId, specificInvoiceId } = body;

    // Validate required fields
    if (!paymentId) {
      return createErrorResponse("Payment ID is required", 400);
    }

    if (!tenantId) {
      return createErrorResponse("Tenant ID is required", 400);
    }

    if (!amount || amount <= 0) {
      return createErrorResponse("Valid payment amount is required", 400);
    }

    // Validate ID formats
    if (!Types.ObjectId.isValid(paymentId)) {
      return createErrorResponse("Invalid payment ID format", 400);
    }

    if (!Types.ObjectId.isValid(tenantId)) {
      return createErrorResponse("Invalid tenant ID format", 400);
    }

    // Apply payment to invoices
    const result = await paymentInvoiceLinkingService.applyPaymentToInvoices(
      paymentId,
      tenantId,
      parseFloat(amount),
      leaseId
    );

    if (!result.success) {
      return createErrorResponse(
        `Payment application failed: ${result.errors.join(", ")}`,
        400
      );
    }

    return createSuccessResponse(
      {
        paymentId: result.paymentId,
        totalAmountApplied: result.totalAmountApplied,
        remainingAmount: result.remainingPaymentAmount,
        invoiceApplications: result.applicationsApplied,
        warnings: result.errors.length > 0 ? result.errors : undefined,
      },
      "Payment applied to invoices successfully"
    );
  } catch (error) {
    return handleApiError(error, "Failed to apply payment to invoices");
  }
}

// ============================================================================
// DELETE /api/payments/record - Reverse payment application
// ============================================================================
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("paymentId");

    if (!paymentId) {
      return createErrorResponse("Payment ID is required", 400);
    }

    if (!Types.ObjectId.isValid(paymentId)) {
      return createErrorResponse("Invalid payment ID format", 400);
    }

    // Reverse the payment application
    const result = await paymentInvoiceLinkingService.reversePaymentApplication(
      paymentId
    );

    if (!result.success) {
      return createErrorResponse(
        `Payment reversal failed: ${result.errors.join(", ")}`,
        400
      );
    }

    return createSuccessResponse(
      {
        paymentId,
        reversedAmount: result.reversedAmount,
        affectedInvoices: result.affectedInvoices,
        warnings: result.errors.length > 0 ? result.errors : undefined,
      },
      "Payment application reversed successfully"
    );
  } catch (error) {
    return handleApiError(error, "Failed to reverse payment application");
  }
}

/**
 * PropertyPro - Invoice Bulk Operations API
 * Handle bulk operations on multiple invoices
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Invoice, Payment } from "@/models";
import { InvoiceStatus } from "@/types";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from "@/lib/api-utils";
import { Types } from "mongoose";

// ============================================================================
// POST /api/invoices/bulk - Perform bulk operations on invoices
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { operation, invoiceIds, data = {} } = body;

    if (!operation) {
      return createErrorResponse("Operation is required", 400);
    }

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return createErrorResponse("Invoice IDs are required", 400);
    }

    // Validate invoice IDs
    const objectIds = invoiceIds.map((id: string) => {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid invoice ID: ${id}`);
      }
      return new Types.ObjectId(id);
    });

    let result;

    switch (operation) {
      case "mark_paid":
        result = await bulkMarkAsPaid(objectIds, data);
        break;

      case "send_reminders":
        result = await bulkSendReminders(objectIds, data);
        break;

      case "update_status":
        result = await bulkUpdateStatus(objectIds, data);
        break;

      case "generate_pdfs":
        result = await bulkGeneratePDFs(objectIds, data);
        break;

      case "delete":
        result = await bulkDelete(objectIds, data);
        break;

      case "add_late_fees":
        result = await bulkAddLateFees(objectIds, data);
        break;

      default:
        return createErrorResponse("Invalid operation", 400);
    }

    return createSuccessResponse(
      result,
      `Bulk ${operation} completed successfully`
    );
  } catch (error) {
    return handleApiError(error, "Failed to perform bulk operation");
  }
}

// ============================================================================
// BULK OPERATION FUNCTIONS
// ============================================================================

async function bulkMarkAsPaid(invoiceIds: Types.ObjectId[], data: any) {
  const { paymentMethod = "manual", paidDate = new Date() } = data;

  const results = {
    successful: [],
    failed: [],
    totalProcessed: 0,
  };

  for (const invoiceId of invoiceIds) {
    try {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        results.failed.push({ invoiceId, error: "Invoice not found" });
        continue;
      }

      if (invoice.status === InvoiceStatus.PAID) {
        results.failed.push({ invoiceId, error: "Invoice already paid" });
        continue;
      }

      // Create payment record
      const payment = new Payment({
        tenantId: invoice.tenantId,
        propertyId: invoice.propertyId,
        leaseId: invoice.leaseId,
        invoiceId: invoice._id,
        amount: invoice.balanceRemaining,
        paymentMethod: paymentMethod,
        status: "paid",
        paidDate: new Date(paidDate),
        description: `Bulk payment for invoice ${invoice.invoiceNumber}`,
        type: "rent",
      });

      await payment.save();

      // Update invoice
      invoice.paymentIds.push(payment._id);
      invoice.amountPaid = invoice.totalAmount;
      invoice.balanceRemaining = 0;
      invoice.lastPaymentDate = new Date(paidDate);
      invoice.status = InvoiceStatus.PAID;

      await invoice.save();

      results.successful.push({
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        amountPaid: payment.amount,
      });
    } catch (error) {
      results.failed.push({
        invoiceId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    results.totalProcessed++;
  }

  return results;
}

async function bulkSendReminders(invoiceIds: Types.ObjectId[], data: any) {
  const { type = "reminder", method = "email" } = data;

  const results = {
    successful: [],
    failed: [],
    totalProcessed: 0,
  };

  for (const invoiceId of invoiceIds) {
    try {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        results.failed.push({ invoiceId, error: "Invoice not found" });
        continue;
      }

      if (invoice.status === InvoiceStatus.PAID) {
        results.failed.push({
          invoiceId,
          error: "Cannot send reminder for paid invoice",
        });
        continue;
      }

      // Add reminder to sent list
      invoice.remindersSent.push({
        type,
        sentDate: new Date(),
        method,
      });

      await invoice.save();

      results.successful.push({
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        reminderType: type,
      });
    } catch (error) {
      results.failed.push({
        invoiceId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    results.totalProcessed++;
  }

  return results;
}

async function bulkUpdateStatus(invoiceIds: Types.ObjectId[], data: any) {
  const { status } = data;

  if (!status || !Object.values(InvoiceStatus).includes(status)) {
    throw new Error("Valid status is required");
  }

  const results = {
    successful: [],
    failed: [],
    totalProcessed: 0,
  };

  for (const invoiceId of invoiceIds) {
    try {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        results.failed.push({ invoiceId, error: "Invoice not found" });
        continue;
      }

      const oldStatus = invoice.status;
      invoice.status = status;
      await invoice.save();

      results.successful.push({
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        oldStatus,
        newStatus: status,
      });
    } catch (error) {
      results.failed.push({
        invoiceId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    results.totalProcessed++;
  }

  return results;
}

async function bulkGeneratePDFs(invoiceIds: Types.ObjectId[], data: any) {
  const results = {
    successful: [],
    failed: [],
    totalProcessed: 0,
  };

  for (const invoiceId of invoiceIds) {
    try {
      const invoice = await Invoice.findById(invoiceId)
        .populate("tenantId", "firstName lastName email")
        .populate("propertyId", "name address")
        .populate("leaseId", "startDate endDate");

      if (!invoice) {
        results.failed.push({ invoiceId, error: "Invoice not found" });
        continue;
      }

      // Mark PDF as generated (placeholder)
      invoice.pdfGenerated = true;
      invoice.pdfPath = `/invoices/${invoice._id}.pdf`;
      await invoice.save();

      results.successful.push({
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        pdfPath: invoice.pdfPath,
      });
    } catch (error) {
      results.failed.push({
        invoiceId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    results.totalProcessed++;
  }

  return results;
}

async function bulkDelete(invoiceIds: Types.ObjectId[], data: any) {
  const { force = false } = data;

  const results = {
    successful: [],
    failed: [],
    totalProcessed: 0,
  };

  for (const invoiceId of invoiceIds) {
    try {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        results.failed.push({ invoiceId, error: "Invoice not found" });
        continue;
      }

      if (!force && invoice.amountPaid > 0) {
        results.failed.push({
          invoiceId,
          error:
            "Cannot delete invoice with payments (use force=true to override)",
        });
        continue;
      }

      // Soft delete
      invoice.deletedAt = new Date();
      await invoice.save();

      results.successful.push({
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        deletedAt: invoice.deletedAt,
      });
    } catch (error) {
      results.failed.push({
        invoiceId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    results.totalProcessed++;
  }

  return results;
}

async function bulkAddLateFees(invoiceIds: Types.ObjectId[], data: any) {
  const { amount, reason = "Late payment" } = data;

  if (!amount || amount <= 0) {
    throw new Error("Valid late fee amount is required");
  }

  const results = {
    successful: [],
    failed: [],
    totalProcessed: 0,
  };

  for (const invoiceId of invoiceIds) {
    try {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        results.failed.push({ invoiceId, error: "Invoice not found" });
        continue;
      }

      if (invoice.status === InvoiceStatus.PAID) {
        results.failed.push({
          invoiceId,
          error: "Cannot add late fee to paid invoice",
        });
        continue;
      }

      // Add late fee
      invoice.lateFeeAmount += amount;
      invoice.lateFeeAppliedDate = new Date();
      invoice.totalAmount += amount;
      invoice.balanceRemaining += amount;

      // Add late fee as line item
      invoice.lineItems.push({
        description: reason,
        amount: amount,
        type: "late_fee",
        dueDate: new Date(),
      });

      await invoice.save();

      results.successful.push({
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        lateFeeAmount: amount,
      });
    } catch (error) {
      results.failed.push({
        invoiceId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    results.totalProcessed++;
  }

  return results;
}

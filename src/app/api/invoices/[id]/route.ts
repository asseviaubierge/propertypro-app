/**
 * PropertyPro - Individual Invoice API Routes
 * RESTful API endpoints for individual invoice management
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Invoice, Payment } from "@/models";
import {
  InvoiceStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentType,
} from "@/types";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from "@/lib/api-utils";
import { computeEffectiveInvoiceStatus } from "@/lib/invoice/invoice-shared";
import { Types } from "mongoose";

// ============================================================================
// GET /api/invoices/[id] - Get single invoice
// ============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();

    const { id } = await params;

    if (!Types.ObjectId.isValid(id)) {
      return createErrorResponse("Invalid invoice ID", 400);
    }

    const invoice = await Invoice.findById(id)
      .populate("tenantId", "firstName lastName email phone")
      .populate("propertyId", "name address")
      .populate("leaseId", "startDate endDate terms")
      .populate({
        path: "paymentIds",
        select: "amount paidDate paymentMethod status dueDate type",
      });

    if (!invoice) {
      return createErrorResponse("Invoice not found", 404);
    }

    // Surface an accurate, time-sensitive status without mutating the DB on read.
    // A daily cron persists transitions; this keeps reads correct between runs.
    const payload = invoice.toObject() as unknown as Record<string, unknown>;
    payload.status = computeEffectiveInvoiceStatus(invoice);

    return createSuccessResponse(payload, "Invoice retrieved successfully");
  } catch (error) {
    return handleApiError(error, "Failed to retrieve invoice");
  }
}

// ============================================================================
// PUT /api/invoices/[id] - Update invoice
// ============================================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();

    const { id } = await params;
    const body = await request.json();

    if (!Types.ObjectId.isValid(id)) {
      return createErrorResponse("Invalid invoice ID", 400);
    }

    // Find existing invoice
    const existingInvoice = await Invoice.findById(id);
    if (!existingInvoice) {
      return createErrorResponse("Invoice not found", 404);
    }

    // Prevent updates to paid invoices
    if (existingInvoice.status === InvoiceStatus.PAID) {
      return createErrorResponse("Cannot update paid invoices", 400);
    }

    // Extract updatable fields
    const {
      invoiceNumber,
      dueDate,
      issueDate,
      lineItems,
      notes,
      status,
      taxAmount,
    } = body;

    const updates: any = {};

    // Update invoice number (if provided and different)
    if (invoiceNumber && invoiceNumber !== existingInvoice.invoiceNumber) {
      updates.invoiceNumber = invoiceNumber;
    }

    // Update issue date
    if (issueDate) {
      updates.issueDate = new Date(issueDate);
    }

    // Update due date
    if (dueDate) {
      updates.dueDate = new Date(dueDate);
      // Update grace period end if due date changes
      updates.gracePeriodEnd = new Date(
        new Date(dueDate).getTime() + 5 * 24 * 60 * 60 * 1000, // 5 days grace period
      );
    }

    // Update tax amount
    if (taxAmount !== undefined) {
      updates.taxAmount = Math.max(0, Number(taxAmount));
    }

    // Update line items and recalculate totals
    if (lineItems && Array.isArray(lineItems)) {
      // Process line items to ensure proper calculation
      const processedLineItems = lineItems.map((item: any) => ({
        description: item.description,
        amount: Number(item.unitPrice || 0) * Number(item.quantity || 1),
        type: item.type,
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
      }));

      updates.lineItems = processedLineItems;

      // Recalculate totals
      const subtotal = processedLineItems.reduce(
        (sum: number, item: any) => sum + item.amount,
        0,
      );
      const finalTaxAmount =
        updates.taxAmount !== undefined
          ? updates.taxAmount
          : existingInvoice.taxAmount || 0;

      updates.subtotal = subtotal;
      updates.totalAmount = subtotal + finalTaxAmount;
      updates.balanceRemaining =
        subtotal + finalTaxAmount - existingInvoice.amountPaid;
    }

    // Update notes
    if (notes !== undefined) {
      updates.notes = notes;
    }

    // Update status
    if (status && Object.values(InvoiceStatus).includes(status)) {
      updates.status = status;
    }

    // Add audit trail
    updates.updatedAt = new Date();

    // Update the invoice
    const updatedInvoice = await Invoice.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true },
    )
      .populate("tenantId", "firstName lastName email")
      .populate("propertyId", "name address")
      .populate("leaseId", "startDate endDate");

    return createSuccessResponse(
      updatedInvoice,
      "Invoice updated successfully",
    );
  } catch (error) {
    return handleApiError(error, "Failed to update invoice");
  }
}

// ============================================================================
// DELETE /api/invoices/[id] - Soft delete invoice
// ============================================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();

    const { id } = await params;

    if (!Types.ObjectId.isValid(id)) {
      return createErrorResponse("Invalid invoice ID", 400);
    }

    // Find the invoice
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return createErrorResponse("Invoice not found", 404);
    }

    // Check if invoice has payments
    if (invoice.amountPaid > 0) {
      return createErrorResponse(
        "Cannot delete invoice that has received payments",
        400,
      );
    }

    // Soft delete the invoice
    await Invoice.findByIdAndUpdate(id, {
      $set: {
        deletedAt: new Date(),
        status: InvoiceStatus.CANCELLED,
      },
    });

    return createSuccessResponse({ id }, "Invoice deleted successfully");
  } catch (error) {
    return handleApiError(error, "Failed to delete invoice");
  }
}

// ============================================================================
// PATCH /api/invoices/[id] - Partial update invoice
// ============================================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();

    const { id } = await params;
    const body = await request.json();

    if (!Types.ObjectId.isValid(id)) {
      return createErrorResponse("Invalid invoice ID", 400);
    }

    // Find existing invoice
    const existingInvoice = await Invoice.findById(id);
    if (!existingInvoice) {
      return createErrorResponse("Invoice not found", 404);
    }

    // Handle specific operations
    const { operation, ...data } = body;

    let result;

    switch (operation) {
      case "add_payment":
        result = await handleAddPayment(existingInvoice, data);
        break;

      case "add_late_fee":
        result = await handleAddLateFee(existingInvoice, data);
        break;

      case "send_reminder":
        result = await handleSendReminder(existingInvoice, data);
        break;

      case "mark_sent":
        result = await handleMarkSent(existingInvoice, data);
        break;

      default:
        return createErrorResponse("Invalid operation", 400);
    }

    return createSuccessResponse(result, "Invoice updated successfully");
  } catch (error) {
    return handleApiError(error, "Failed to update invoice");
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function handleAddPayment(invoice: any, data: any) {
  const {
    paymentId,
    amount,
    paymentMethod = "manual",
    paidDate = new Date(),
  } = data;

  if (!amount || amount <= 0) {
    throw new Error("Valid payment amount is required");
  }

  let payment;

  if (paymentId) {
    // Use existing payment
    payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new Error("Payment not found");
    }
  } else {
    // Create new payment record for manual payment
    const normalizeMethod = (method: string): PaymentMethod => {
      switch (method) {
        case "credit_card":
          return PaymentMethod.CREDIT_CARD;
        case "debit_card":
          return PaymentMethod.DEBIT_CARD;
        case "bank_transfer":
          return PaymentMethod.BANK_TRANSFER;
        case "ach":
          return PaymentMethod.ACH;
        case "check":
          return PaymentMethod.CHECK;
        case "cash":
          return PaymentMethod.CASH;
        case "money_order":
          return PaymentMethod.MONEY_ORDER;
        case "other":
          return PaymentMethod.OTHER;
        case "online":
          return PaymentMethod.CREDIT_CARD;
        case "manual":
        default:
          return PaymentMethod.CASH;
      }
    };

    const inferredType: PaymentType =
      invoice.lineItems && invoice.lineItems[0]?.type
        ? (invoice.lineItems[0].type as PaymentType)
        : PaymentType.RENT;

    payment = new Payment({
      tenantId: invoice.tenantId,
      propertyId: invoice.propertyId,
      leaseId: invoice.leaseId,
      invoiceId: invoice._id,
      amount: amount,
      amountPaid: amount,
      paymentMethod: normalizeMethod(String(paymentMethod)),
      status: PaymentStatus.PAID,
      // Do not set paidDate yet to avoid validation against createdAt
      description: `Manual payment for invoice ${invoice.invoiceNumber}`,
      type: inferredType,
      dueDate: invoice.dueDate,
    });

    await payment.save();
    // Now set paidDate to be on/after createdAt to satisfy validator
    let pd = new Date(paidDate);
    if (isNaN(pd.getTime())) pd = new Date();
    if (pd < payment.createdAt) pd = payment.createdAt;
    payment.paidDate = pd;
    await payment.save();
  }

  // Update invoice payment tracking
  if (!invoice.paymentIds.includes(payment._id)) {
    invoice.paymentIds.push(payment._id);
  }

  // Update payment amounts
  invoice.amountPaid += amount;
  invoice.balanceRemaining = invoice.totalAmount - invoice.amountPaid;
  invoice.lastPaymentDate = new Date(paidDate);

  // Update status based on payment
  if (invoice.balanceRemaining <= 0) {
    invoice.status = InvoiceStatus.PAID;
  } else if (invoice.amountPaid > 0) {
    invoice.status = InvoiceStatus.PARTIAL;
  }

  await invoice.save();

  return invoice;
}

async function handleAddLateFee(invoice: any, data: any) {
  const { amount } = data;

  if (!amount || amount <= 0) {
    throw new Error("Valid late fee amount is required");
  }

  // Add late fee to invoice
  await invoice.addLateFee(amount);

  return invoice;
}

async function handleSendReminder(invoice: any, data: any) {
  const { type = "reminder", method = "email" } = data;

  // Add reminder to sent list
  invoice.remindersSent.push({
    type,
    sentDate: new Date(),
    method,
  });

  await invoice.save();

  return invoice;
}

async function handleMarkSent(invoice: any, data: any) {
  const { method = "email" } = data;

  // Mark invoice as sent
  invoice.emailSent = true;
  invoice.emailSentDate = new Date();

  // Update status if scheduled
  if (invoice.status === InvoiceStatus.SCHEDULED) {
    invoice.status = InvoiceStatus.ISSUED;
  }

  await invoice.save();

  return invoice;
}

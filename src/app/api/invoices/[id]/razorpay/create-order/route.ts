/**
 * PropertyPro - Invoice Razorpay Create Order API
 * Creates a PENDING Payment for an invoice plus a Razorpay order, returning the
 * order id + public key the browser opens Razorpay Checkout with. On success the
 * client posts the signature to the verify route to settle.
 */

import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Invoice, Payment, ensurePaymentIndexes } from "@/models";
import { PaymentStatus, PaymentMethod, PaymentType } from "@/types";
import { createOrder, getRazorpayConfig } from "@/lib/services/razorpay.service";
import { getPaymentCurrency } from "@/lib/services/payment-config.service";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from "@/lib/api-utils";
import { resolveAccessProfile } from "@/lib/server-permissions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    await ensurePaymentIndexes();

    const session = await auth();
    if (!session?.user) {
      return createErrorResponse("Authentication required", 401);
    }
    const accessProfile = await resolveAccessProfile(session.user.role);
    const userId = session.user.id;

    const { id: invoiceId } = await params;
    if (!Types.ObjectId.isValid(invoiceId)) {
      return createErrorResponse("Invalid invoice ID", 400);
    }

    const invoice = await Invoice.findById(invoiceId).populate(
      "propertyId",
      "name"
    );
    if (!invoice) {
      return createErrorResponse("Invoice not found", 404);
    }

    const tenantIdRef = invoice.tenantId as Types.ObjectId | null;
    if (!tenantIdRef) {
      return createErrorResponse(
        "Invoice tenant profile is unavailable. Please record this payment manually.",
        400
      );
    }

    if (accessProfile.isTenant && tenantIdRef.toString() !== userId) {
      return createErrorResponse("Access denied", 403);
    }

    if (invoice.status === "paid") {
      return createErrorResponse("Invoice is already paid", 400);
    }
    if (invoice.status === "cancelled") {
      return createErrorResponse("Cannot pay cancelled invoice", 400);
    }
    if (invoice.balanceRemaining <= 0) {
      return createErrorResponse("Invoice has no remaining balance", 400);
    }

    const body = await request.json().catch(() => ({}));
    const amount = Number(body?.amount);

    if (!amount || amount <= 0) {
      return createErrorResponse("Invalid payment amount", 400);
    }
    if (amount > invoice.balanceRemaining) {
      return createErrorResponse(
        "Payment amount exceeds remaining balance",
        400
      );
    }

    const payment = new Payment({
      tenantId: tenantIdRef,
      propertyId: invoice.propertyId._id,
      leaseId: invoice.leaseId,
      invoiceId: invoice._id,
      amount,
      paymentMethod: PaymentMethod.RAZORPAY,
      status: PaymentStatus.PENDING,
      type: PaymentType.INVOICE,
      dueDate: invoice.dueDate,
      description: `Online payment for invoice ${invoice.invoiceNumber}`,
      createdBy: userId,
    });
    await payment.save();

    const currency = await getPaymentCurrency();

    let order;
    try {
      order = await createOrder({
        amount,
        currency,
        paymentId: payment._id.toString(),
      });
    } catch (error) {
      // Roll back the pending payment so a failed setup doesn't leave clutter.
      await Payment.deleteOne({ _id: payment._id }).catch(() => undefined);
      console.error("Razorpay createOrder (invoice) failed:", error);
      return createErrorResponse(
        error instanceof Error
          ? error.message
          : "Failed to start Razorpay checkout. Please check your Razorpay configuration.",
        502
      );
    }

    payment.razorpayOrderId = order.id;
    await payment.save();

    const cfg = await getRazorpayConfig();

    return createSuccessResponse(
      {
        orderId: order.id,
        keyId: cfg.keyId,
        amount,
        amountMinor: order.amount,
        currency: order.currency,
        payment: {
          id: payment._id,
          amount: payment.amount,
          status: payment.status,
        },
      },
      "Razorpay order created"
    );
  } catch (error) {
    console.error(
      "Error in POST /api/invoices/[id]/razorpay/create-order:",
      error
    );
    return handleApiError(error);
  }
}

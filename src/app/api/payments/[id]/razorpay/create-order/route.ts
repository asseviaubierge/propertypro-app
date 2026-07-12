/**
 * PropertyPro - Payment Razorpay Create Order API
 * Creates a Razorpay order for an existing Payment record (tenant rent / due) and
 * returns the order id + public key the browser opens Razorpay Checkout with. On
 * success the client posts the signature back to the verify route to settle.
 */

import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Payment, ensurePaymentIndexes } from "@/models";
import { PaymentStatus, PaymentMethod } from "@/types";
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

    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return createErrorResponse("Invalid payment ID", 400);
    }

    const payment = await Payment.findById(id);
    if (!payment) {
      return createErrorResponse("Payment not found", 404);
    }

    // Tenants may only pay their own dues.
    if (accessProfile.isTenant && payment.tenantId.toString() !== userId) {
      return createErrorResponse("Access denied", 403);
    }

    if (payment.status === PaymentStatus.PAID) {
      return createErrorResponse("Payment is already completed", 400);
    }

    const remaining = Number(
      (payment.amount - (payment.amountPaid || 0)).toFixed(2)
    );
    if (remaining <= 0) {
      return createErrorResponse("Payment has no remaining balance", 400);
    }

    payment.paymentMethod = PaymentMethod.RAZORPAY;

    const currency = await getPaymentCurrency();

    let order;
    try {
      order = await createOrder({
        amount: remaining,
        currency,
        paymentId: payment._id.toString(),
      });
    } catch (error) {
      console.error("Razorpay createOrder (payment) failed:", error);
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
        amount: remaining,
        amountMinor: order.amount,
        currency: order.currency,
        payment: {
          id: payment._id,
          amount: remaining,
          status: payment.status,
        },
      },
      "Razorpay order created"
    );
  } catch (error) {
    console.error(
      "Error in POST /api/payments/[id]/razorpay/create-order:",
      error
    );
    return handleApiError(error);
  }
}

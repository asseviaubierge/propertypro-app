/**
 * PropertyPro - Payment PayPal Create Order API
 * Creates a PayPal order for an existing Payment record (tenant rent / due) and
 * returns the approval URL. The buyer is redirected to PayPal to approve, then
 * sent back to the payment's pay page where the order is captured.
 */

import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Payment, ensurePaymentIndexes } from "@/models";
import { PaymentStatus, PaymentMethod } from "@/types";
import { createOrder } from "@/lib/services/paypal.service";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from "@/lib/api-utils";
import { resolveAccessProfile } from "@/lib/server-permissions";

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

function resolveRequestOrigin(request: NextRequest): string {
  const configuredOrigin = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configuredOrigin) {
    return normalizeOrigin(configuredOrigin);
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    if (host) {
      const proto =
        request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
        "https";
      return `${proto}://${host}`;
    }
  }

  const host = request.headers.get("host");
  if (host) {
    const protocol = request.nextUrl.protocol?.replace(":", "") || "https";
    return `${protocol}://${host}`;
  }

  return request.nextUrl.origin || "http://localhost:3000";
}

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
    if (remaining < 0.5) {
      return createErrorResponse("Minimum payment amount is $0.50", 400);
    }

    payment.paymentMethod = PaymentMethod.PAYPAL;

    const origin = resolveRequestOrigin(request);
    const returnPath = `/dashboard/payments/${id}/pay`;
    const returnUrl = `${origin}${returnPath}?payment=success&provider=paypal`;
    const cancelUrl = `${origin}${returnPath}?payment=canceled`;

    let order;
    try {
      order = await createOrder({
        amount: remaining,
        currency: "USD",
        paymentId: payment._id.toString(),
        description: payment.description || `${payment.type} payment`,
        returnUrl,
        cancelUrl,
      });
    } catch (error) {
      console.error("PayPal createOrder (payment) failed:", error);
      return createErrorResponse(
        error instanceof Error
          ? error.message
          : "Failed to start PayPal checkout. Please check your PayPal configuration.",
        502
      );
    }

    if (!order.approveUrl) {
      return createErrorResponse(
        "PayPal did not return an approval URL. Please try again.",
        502
      );
    }

    payment.paypalOrderId = order.id;
    await payment.save();

    return createSuccessResponse(
      {
        orderId: order.id,
        approveUrl: order.approveUrl,
        payment: {
          id: payment._id,
          amount: remaining,
          status: payment.status,
        },
      },
      "PayPal order created"
    );
  } catch (error) {
    console.error("Error in POST /api/payments/[id]/paypal/create-order:", error);
    return handleApiError(error);
  }
}

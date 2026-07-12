/**
 * PropertyPro - Invoice PayPal Create Order API
 * Creates a PayPal order for an invoice and returns the approval URL. Mirrors
 * the Stripe Checkout flow: the buyer is redirected to PayPal to approve, then
 * sent back to the invoice page where the order is captured.
 */

import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Invoice, Payment, ensurePaymentIndexes } from "@/models";
import { PaymentStatus, PaymentMethod, PaymentType } from "@/types";
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

    // tenantId is the User ref (not populated here) — use it directly.
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
    if (amount < 0.5) {
      return createErrorResponse("Minimum payment amount is $0.50", 400);
    }

    const payment = new Payment({
      tenantId: tenantIdRef,
      propertyId: invoice.propertyId._id,
      leaseId: invoice.leaseId,
      invoiceId: invoice._id,
      amount,
      paymentMethod: PaymentMethod.PAYPAL,
      status: PaymentStatus.PENDING,
      type: PaymentType.INVOICE,
      dueDate: invoice.dueDate,
      description: `Online payment for invoice ${invoice.invoiceNumber}`,
      createdBy: userId,
    });
    await payment.save();

    const origin = resolveRequestOrigin(request);
    const returnPath = `/dashboard/accounting/invoices/${invoice._id.toString()}`;
    const returnUrl = `${origin}${returnPath}?payment=success&provider=paypal`;
    const cancelUrl = `${origin}${returnPath}?payment=canceled`;

    let order;
    try {
      order = await createOrder({
        amount,
        currency: "USD",
        paymentId: payment._id.toString(),
        description: `Invoice ${invoice.invoiceNumber}`,
        returnUrl,
        cancelUrl,
      });
    } catch (error) {
      // Roll back the pending payment so a failed setup doesn't leave clutter.
      await Payment.deleteOne({ _id: payment._id }).catch(() => undefined);
      console.error("PayPal createOrder failed:", error);
      return createErrorResponse(
        error instanceof Error
          ? error.message
          : "Failed to start PayPal checkout. Please check your PayPal configuration.",
        502
      );
    }

    if (!order.approveUrl) {
      await Payment.deleteOne({ _id: payment._id }).catch(() => undefined);
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
          amount: payment.amount,
          status: payment.status,
        },
      },
      "PayPal order created"
    );
  } catch (error) {
    console.error("Error in POST /api/invoices/[id]/paypal/create-order:", error);
    return handleApiError(error);
  }
}

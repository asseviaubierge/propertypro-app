/**
 * PropertyPro - Invoice Stripe Checkout Session API
 * Creates a hosted Stripe Checkout Session for an invoice and returns the redirect URL.
 */

import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Invoice, Payment, User, ensurePaymentIndexes } from "@/models";
import { PaymentStatus, PaymentMethod, PaymentType } from "@/types";
import { getStripeClient } from "@/lib/stripe";
import { stripePaymentService } from "@/lib/services/stripe-payment.service";
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

    const invoice = await Invoice.findById(invoiceId)
      .populate("tenantId", "firstName lastName email")
      .populate("propertyId", "name");

    if (!invoice) {
      return createErrorResponse("Invoice not found", 404);
    }

    const tenantRef = invoice.tenantId as
      | { _id?: Types.ObjectId; email?: string; firstName?: string; lastName?: string }
      | null;
    const tenantIdRef = tenantRef?._id;
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

    const tenant = await User.findById(tenantIdRef);
    if (!tenant) {
      return createErrorResponse("Tenant not found", 404);
    }

    const customer = await stripePaymentService.createOrGetCustomer(
      tenant._id.toString(),
      tenant.email,
      `${tenant.firstName} ${tenant.lastName}`.trim()
    );

    const payment = new Payment({
      tenantId: tenantIdRef,
      propertyId: invoice.propertyId._id,
      leaseId: invoice.leaseId,
      invoiceId: invoice._id,
      amount,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      status: PaymentStatus.PENDING,
      type: PaymentType.INVOICE,
      dueDate: invoice.dueDate,
      description: `Online payment for invoice ${invoice.invoiceNumber}`,
      createdBy: userId,
      stripeCustomerId: customer.id,
    });
    await payment.save();

    const origin = resolveRequestOrigin(request);

    const returnPath = `/dashboard/accounting/invoices/${invoice._id.toString()}`;
    const successUrl = `${origin}${returnPath}?payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}${returnPath}?payment=canceled`;

    const stripe = await getStripeClient();
    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer: customer.id,
        client_reference_id: payment._id.toString(),
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_intent_data: {
          description: `Invoice ${invoice.invoiceNumber}`,
          metadata: {
            source: "PropertyPro",
            paymentId: payment._id.toString(),
            invoiceId: invoice._id.toString(),
            invoiceNumber: invoice.invoiceNumber,
            tenantId: tenant._id.toString(),
            propertyId: invoice.propertyId._id.toString(),
            leaseId: invoice.leaseId?.toString() || "",
          },
        },
        metadata: {
          source: "PropertyPro",
          paymentId: payment._id.toString(),
          invoiceId: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          tenantId: tenant._id.toString(),
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: Math.round(amount * 100),
              product_data: {
                name: `Invoice ${invoice.invoiceNumber}`,
                description: `Payment to ${
                  (invoice.propertyId as { name?: string } | null)?.name ||
                  "property"
                }`,
              },
            },
          },
        ],
      },
      {
        idempotencyKey: `checkout-session-${payment._id.toString()}`,
      }
    );

    payment.stripeCheckoutSessionId = checkoutSession.id;
    if (checkoutSession.payment_intent) {
      payment.stripePaymentIntentId =
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : checkoutSession.payment_intent.id;
    }
    await payment.save();

    return createSuccessResponse(
      {
        url: checkoutSession.url,
        sessionId: checkoutSession.id,
        payment: {
          id: payment._id,
          amount: payment.amount,
          status: payment.status,
        },
      },
      "Checkout session created"
    );
  } catch (error) {
    console.error(
      "Error in POST /api/invoices/[id]/checkout-session:",
      error
    );
    return handleApiError(error);
  }
}

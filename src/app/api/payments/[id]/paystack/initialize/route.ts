/**
 * PropertyPro - Payment Paystack Initialize API
 * Initializes a Paystack transaction for an existing Payment record (tenant rent /
 * due) and returns the access code + public key the browser opens Paystack Inline
 * with. On success the client posts the reference to the verify route to settle.
 */

import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Payment, User, ensurePaymentIndexes } from "@/models";
import { PaymentStatus, PaymentMethod } from "@/types";
import {
  initializeTransaction,
  getPaystackConfig,
} from "@/lib/services/paystack.service";
import { getPaymentCurrency } from "@/lib/services/payment-config.service";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from "@/lib/api-utils";
import { resolveAccessProfile } from "@/lib/server-permissions";

/** A unique-per-attempt reference, prefixed so it is recognisable in dashboards. */
function buildReference(paymentId: string): string {
  return `pp_${paymentId}_${Date.now()}`;
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

    // Paystack requires a payer email — prefer the tenant's, fall back to the
    // signed-in user's.
    const tenant = await User.findById(payment.tenantId)
      .select("email")
      .lean<{ email?: string }>();
    const email = tenant?.email || session.user.email;
    if (!email) {
      return createErrorResponse(
        "A payer email is required to start a Paystack payment.",
        400
      );
    }

    payment.paymentMethod = PaymentMethod.PAYSTACK;
    const currency = await getPaymentCurrency();
    const reference = buildReference(payment._id.toString());

    let init;
    try {
      init = await initializeTransaction({
        amount: remaining,
        currency,
        email,
        paymentId: payment._id.toString(),
        reference,
      });
    } catch (error) {
      console.error("Paystack initialize (payment) failed:", error);
      return createErrorResponse(
        error instanceof Error
          ? error.message
          : "Failed to start Paystack checkout. Please check your Paystack configuration.",
        502
      );
    }

    payment.paystackReference = init.reference || reference;
    await payment.save();

    const cfg = await getPaystackConfig();

    return createSuccessResponse(
      {
        reference: payment.paystackReference,
        accessCode: init.accessCode,
        authorizationUrl: init.authorizationUrl,
        publicKey: cfg.publicKey,
        amount: remaining,
        currency,
        payment: {
          id: payment._id,
          amount: remaining,
          status: payment.status,
        },
      },
      "Paystack transaction initialized"
    );
  } catch (error) {
    console.error(
      "Error in POST /api/payments/[id]/paystack/initialize:",
      error
    );
    return handleApiError(error);
  }
}

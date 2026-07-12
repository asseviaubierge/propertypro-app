/**
 * PropertyPro - Invoice Paystack Initialize API
 * Creates a PENDING Payment for an invoice plus a Paystack transaction, returning
 * the access code + public key the browser opens Paystack Inline with. On success
 * the client posts the reference to the verify route to settle.
 */

import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Invoice, Payment, User, ensurePaymentIndexes } from "@/models";
import { PaymentStatus, PaymentMethod, PaymentType } from "@/types";
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

    // Paystack requires a payer email — prefer the tenant's, fall back to the
    // signed-in user's.
    const tenant = await User.findById(tenantIdRef)
      .select("email")
      .lean<{ email?: string }>();
    const email = tenant?.email || session.user.email;
    if (!email) {
      return createErrorResponse(
        "A payer email is required to start a Paystack payment.",
        400
      );
    }

    const payment = new Payment({
      tenantId: tenantIdRef,
      propertyId: invoice.propertyId._id,
      leaseId: invoice.leaseId,
      invoiceId: invoice._id,
      amount,
      paymentMethod: PaymentMethod.PAYSTACK,
      status: PaymentStatus.PENDING,
      type: PaymentType.INVOICE,
      dueDate: invoice.dueDate,
      description: `Online payment for invoice ${invoice.invoiceNumber}`,
      createdBy: userId,
    });
    await payment.save();

    const currency = await getPaymentCurrency();
    const reference = buildReference(payment._id.toString());

    let init;
    try {
      init = await initializeTransaction({
        amount,
        currency,
        email,
        paymentId: payment._id.toString(),
        reference,
      });
    } catch (error) {
      // Roll back the pending payment so a failed setup doesn't leave clutter.
      await Payment.deleteOne({ _id: payment._id }).catch(() => undefined);
      console.error("Paystack initialize (invoice) failed:", error);
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
        amount,
        currency,
        payment: {
          id: payment._id,
          amount: payment.amount,
          status: payment.status,
        },
      },
      "Paystack transaction initialized"
    );
  } catch (error) {
    console.error(
      "Error in POST /api/invoices/[id]/paystack/initialize:",
      error
    );
    return handleApiError(error);
  }
}

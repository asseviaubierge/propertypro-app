/**
 * PropertyPro - Checkout Session Reconcile
 * Called from the success redirect to pull fresh status from Stripe
 * without waiting for the webhook. Safe to call multiple times (idempotent).
 */

import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Invoice, Payment } from "@/models";
import { PaymentStatus, PaymentMethod } from "@/types";
import { getStripeClient } from "@/lib/stripe";
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

    const body = await request.json().catch(() => ({}));
    const sessionId = String(body?.sessionId || "");
    if (!sessionId) {
      return createErrorResponse("sessionId is required", 400);
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return createErrorResponse("Invoice not found", 404);
    }

    if (accessProfile.isTenant && invoice.tenantId.toString() !== userId) {
      return createErrorResponse("Access denied", 403);
    }

    const payment = await Payment.findOne({
      stripeCheckoutSessionId: sessionId,
      invoiceId: invoice._id,
    });
    if (!payment) {
      return createErrorResponse("Payment record not found", 404);
    }

    // Fresh state from Stripe
    const stripe = await getStripeClient();
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    if (payment.status === PaymentStatus.PAID) {
      return createSuccessResponse(
        {
          payment: {
            id: payment._id,
            status: payment.status,
            amountPaid: payment.amountPaid,
          },
          checkoutStatus: checkoutSession.payment_status,
        },
        "Already reconciled"
      );
    }

    if (checkoutSession.payment_status === "paid") {
      const paymentIntentId =
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : checkoutSession.payment_intent?.id;

      const amountPaid =
        typeof checkoutSession.amount_total === "number"
          ? checkoutSession.amount_total / 100
          : payment.amount;

      payment.status = PaymentStatus.PAID;
      payment.paidDate = new Date();
      payment.amountPaid = amountPaid;
      if (paymentIntentId) {
        payment.stripePaymentIntentId = paymentIntentId;
      }
      payment.paymentHistory.push({
        amount: amountPaid,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        paidDate: new Date(),
        transactionId: paymentIntentId || sessionId,
        notes: "Reconciled via Stripe Checkout return",
      });
      await payment.save();

      try {
        await (
          invoice as unknown as {
            addPayment: (id: unknown, amount: number) => Promise<void>;
          }
        ).addPayment(payment._id, amountPaid);
      } catch (error) {
        console.error("Error applying payment to invoice on reconcile:", error);
      }
    } else if (
      checkoutSession.status === "expired" ||
      checkoutSession.payment_status === "unpaid"
    ) {
      // Only mark FAILED if Stripe actually reports the session is done
      if (checkoutSession.status === "expired") {
        payment.status = PaymentStatus.FAILED;
        await payment.save();
      }
    }

    const fresh = await Payment.findById(payment._id);
    const freshInvoice = await Invoice.findById(invoice._id);

    return createSuccessResponse(
      {
        payment: {
          id: fresh?._id,
          status: fresh?.status,
          amountPaid: fresh?.amountPaid,
        },
        invoice: {
          id: freshInvoice?._id,
          status: freshInvoice?.status,
          amountPaid: freshInvoice?.amountPaid,
          balanceRemaining: freshInvoice?.balanceRemaining,
        },
        checkoutStatus: checkoutSession.payment_status,
      },
      "Reconciled"
    );
  } catch (error) {
    console.error(
      "Error in POST /api/invoices/[id]/checkout-session/reconcile:",
      error
    );
    return handleApiError(error);
  }
}

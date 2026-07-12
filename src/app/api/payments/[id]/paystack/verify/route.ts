/**
 * PropertyPro - Payment Paystack Verify API
 * Confirms a Paystack transaction server-side and settles the Payment. Safe to
 * call multiple times (idempotent at the Payment level); the webhook is the
 * authoritative backstop.
 */

import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Payment } from "@/models";
import { PaymentStatus } from "@/types";
import {
  verifyTransaction,
  finalizePaystackPayment,
} from "@/lib/services/paystack.service";
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

    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return createErrorResponse("Invalid payment ID", 400);
    }

    const body = await request.json().catch(() => ({}));
    const reference = String(body?.reference || "");
    if (!reference) {
      return createErrorResponse("reference is required", 400);
    }

    const payment = await Payment.findById(id);
    if (!payment) {
      return createErrorResponse("Payment not found", 404);
    }

    if (accessProfile.isTenant && payment.tenantId.toString() !== userId) {
      return createErrorResponse("Access denied", 403);
    }

    // The reference must belong to this payment.
    if (payment.paystackReference && payment.paystackReference !== reference) {
      return createErrorResponse("Reference does not match this payment", 400);
    }

    // Already settled (e.g. webhook beat us here) — return current state.
    if (payment.status === PaymentStatus.PAID) {
      return createSuccessResponse(
        {
          payment: {
            id: payment._id,
            status: payment.status,
            amountPaid: payment.amountPaid,
          },
        },
        "Already captured"
      );
    }

    const result = await verifyTransaction(reference);
    if (!result.success) {
      return createErrorResponse(
        `Paystack transaction not successful (status: ${result.status || "unknown"})`,
        400
      );
    }

    const amount =
      typeof result.amount === "number"
        ? result.amount
        : Number((payment.amount - (payment.amountPaid || 0)).toFixed(2));

    // Atomic + idempotent: only the winning caller applies to the invoice, so a
    // concurrent webhook can't double-count the payment.
    await finalizePaystackPayment(payment._id, { amount, reference });

    const fresh = await Payment.findById(payment._id);

    return createSuccessResponse(
      {
        payment: {
          id: fresh?._id,
          status: fresh?.status,
          amountPaid: fresh?.amountPaid,
        },
      },
      "Captured"
    );
  } catch (error) {
    console.error("Error in POST /api/payments/[id]/paystack/verify:", error);
    return handleApiError(error);
  }
}

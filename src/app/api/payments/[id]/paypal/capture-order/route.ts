/**
 * PropertyPro - Payment PayPal Capture Order API
 * Captures an approved PayPal order for an existing Payment record and settles
 * it. Safe to call multiple times (idempotent at the Payment level and via
 * PayPal's capture handling); the webhook is the authoritative backstop.
 */

import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Payment } from "@/models";
import { PaymentStatus } from "@/types";
import { captureOrder, finalizePayPalPayment } from "@/lib/services/paypal.service";
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
    const orderId = String(body?.orderId || "");
    if (!orderId) {
      return createErrorResponse("orderId is required", 400);
    }

    const payment = await Payment.findById(id);
    if (!payment) {
      return createErrorResponse("Payment not found", 404);
    }

    if (accessProfile.isTenant && payment.tenantId.toString() !== userId) {
      return createErrorResponse("Access denied", 403);
    }

    // The order must belong to this payment.
    if (payment.paypalOrderId && payment.paypalOrderId !== orderId) {
      return createErrorResponse("Order does not match this payment", 400);
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

    const result = await captureOrder(orderId);
    const isComplete =
      result.orderStatus === "COMPLETED" ||
      result.captureStatus === "COMPLETED";

    if (isComplete) {
      const amountPaid =
        typeof result.amount === "number" ? result.amount : payment.amount;
      // Atomic + idempotent: only the winning caller applies to the invoice,
      // so a concurrent webhook can't double-count the payment.
      await finalizePayPalPayment(payment._id, {
        amount: amountPaid,
        captureId: result.captureId,
        orderId,
      });
    }

    const fresh = await Payment.findById(payment._id);

    return createSuccessResponse(
      {
        payment: {
          id: fresh?._id,
          status: fresh?.status,
          amountPaid: fresh?.amountPaid,
        },
        orderStatus: result.orderStatus,
      },
      isComplete ? "Captured" : "Capture not completed"
    );
  } catch (error) {
    console.error(
      "Error in POST /api/payments/[id]/paypal/capture-order:",
      error
    );
    return handleApiError(error);
  }
}

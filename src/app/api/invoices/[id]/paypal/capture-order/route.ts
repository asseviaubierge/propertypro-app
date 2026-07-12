/**
 * PropertyPro - Invoice PayPal Capture Order API
 * Called from the success redirect to capture an approved PayPal order and
 * settle the payment without waiting for the webhook. Safe to call multiple
 * times (idempotent at the Payment level and via PayPal's capture handling).
 */

import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Invoice, Payment } from "@/models";
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

    const { id: invoiceId } = await params;
    if (!Types.ObjectId.isValid(invoiceId)) {
      return createErrorResponse("Invalid invoice ID", 400);
    }

    const body = await request.json().catch(() => ({}));
    const orderId = String(body?.orderId || "");
    if (!orderId) {
      return createErrorResponse("orderId is required", 400);
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return createErrorResponse("Invoice not found", 404);
    }

    if (accessProfile.isTenant && invoice.tenantId.toString() !== userId) {
      return createErrorResponse("Access denied", 403);
    }

    const payment = await Payment.findOne({
      paypalOrderId: orderId,
      invoiceId: invoice._id,
    });
    if (!payment) {
      return createErrorResponse("Payment record not found", 404);
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
        orderStatus: result.orderStatus,
      },
      isComplete ? "Captured" : "Capture not completed"
    );
  } catch (error) {
    console.error(
      "Error in POST /api/invoices/[id]/paypal/capture-order:",
      error
    );
    return handleApiError(error);
  }
}

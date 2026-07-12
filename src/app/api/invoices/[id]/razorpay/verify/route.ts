/**
 * PropertyPro - Invoice Razorpay Verify API
 * Validates the signature Razorpay Checkout returns on success and settles the
 * invoice's Payment. Safe to call multiple times (idempotent at the Payment
 * level); the webhook is the authoritative backstop.
 */

import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Invoice, Payment } from "@/models";
import { PaymentStatus } from "@/types";
import {
  verifyPaymentSignature,
  finalizeRazorpayPayment,
} from "@/lib/services/razorpay.service";
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
    const orderId = String(body?.orderId || body?.razorpay_order_id || "");
    const razorpayPaymentId = String(
      body?.paymentId || body?.razorpay_payment_id || ""
    );
    const signature = String(body?.signature || body?.razorpay_signature || "");
    if (!orderId || !razorpayPaymentId || !signature) {
      return createErrorResponse(
        "orderId, paymentId and signature are required",
        400
      );
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return createErrorResponse("Invoice not found", 404);
    }

    if (accessProfile.isTenant && invoice.tenantId.toString() !== userId) {
      return createErrorResponse("Access denied", 403);
    }

    const payment = await Payment.findOne({
      razorpayOrderId: orderId,
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

    const valid = await verifyPaymentSignature(
      orderId,
      razorpayPaymentId,
      signature
    );
    if (!valid) {
      return createErrorResponse("Invalid Razorpay payment signature", 400);
    }

    await finalizeRazorpayPayment(payment._id, {
      amount: payment.amount,
      razorpayPaymentId,
      orderId,
    });

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
      },
      "Captured"
    );
  } catch (error) {
    console.error("Error in POST /api/invoices/[id]/razorpay/verify:", error);
    return handleApiError(error);
  }
}

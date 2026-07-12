/**
 * PropertyPro - Payment Status API
 * Check Stripe payment intent status
 */

import { NextRequest } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { Payment } from "@/models";
import { PaymentStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";

// ============================================================================
// GET /api/payments/status/[paymentIntentId] - Check payment status
// ============================================================================

export const GET = withPermissionAndDB("payment_processing")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ paymentIntentId: string }> }
  ) => {
    try {
      const { paymentIntentId } = await params;

      if (!paymentIntentId) {
        return createErrorResponse("Payment intent ID is required", 400);
      }

      // Retrieve payment intent from Stripe
      const stripe = await getStripeClient();
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId
      );

      // Find the associated payment record (tenantId references User directly)
      const payment = await Payment.findOne({
        stripePaymentIntentId: paymentIntentId,
      }).populate("tenantId", "firstName lastName email");

      if (!payment) {
        return createErrorResponse("Payment record not found", 404);
      }

      // Role-based authorization
      if (user.isTenant) {
        const tenantUserId = payment.tenantId?._id?.toString();
        if (tenantUserId !== user.id) {
          return createErrorResponse(
            "You can only check status of your own payments",
            403
          );
        }
      }

      // Sync payment status with Stripe if needed
      let updatedPayment = payment;
      const previousStatus = payment.status;
      {
        switch (paymentIntent.status) {
          case "succeeded":
            payment.status = PaymentStatus.PAID;
            payment.paidDate = new Date();
            break;
          case "processing":
            payment.status = PaymentStatus.PENDING;
            break;
          case "requires_payment_method":
          case "requires_confirmation":
          case "requires_action":
            payment.status = PaymentStatus.PENDING;
            break;
          case "canceled":
          case "payment_failed":
            payment.status = PaymentStatus.FAILED;
            break;
        }
        if (payment.status !== previousStatus) {
          updatedPayment = await payment.save();
        }
      }

      return createSuccessResponse(
        {
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount / 100, // Convert from cents
          currency: paymentIntent.currency,
          paymentMethod: paymentIntent.payment_method_types,
          created: new Date(paymentIntent.created * 1000),
          payment: {
            id: updatedPayment._id,
            status: updatedPayment.status,
            amount: updatedPayment.amount,
            type: updatedPayment.type,
            dueDate: updatedPayment.dueDate,
            paidDate: updatedPayment.paidDate,
          },
        },
        "Payment status retrieved successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

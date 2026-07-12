/**
 * PropertyPro - Create Payment Intent API
 * Creates Stripe payment intents for rent payments
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { Payment } from "@/models";
import { PaymentStatus } from "@/types";
import { stripePaymentService } from "@/lib/services/stripe-payment.service";
import { ensureTenantProfile } from "@/lib/tenant-utils";
import {
  createSuccessResponse as createApiSuccessResponse,
  createErrorResponse as createApiErrorResponse,
} from "@/lib/api-utils";
import { resolveAccessProfile } from "@/lib/server-permissions";

// Helper functions
function createSuccessResponse(
  data: any,
  message: string,
  status: number = 200
) {
  return createApiSuccessResponse(data, message);
}

function createErrorResponse(message: string, status: number = 400) {
  return createApiErrorResponse(message, status, message);
}

function resolveId(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    const candidate = value as {
      _id?: unknown;
      toString?: () => string;
    };

    if (candidate._id) {
      if (typeof candidate._id === "string") {
        return candidate._id;
      }

      if (
        typeof candidate._id === "object" &&
        candidate._id !== null &&
        "toString" in candidate._id &&
        typeof (candidate._id as { toString: () => string }).toString ===
          "function"
      ) {
        return (candidate._id as { toString: () => string }).toString();
      }
    }

    if ("toString" in candidate && typeof candidate.toString === "function") {
      return candidate.toString();
    }
  }

  return null;
}

async function markPaymentAsCompleted(
  payment: any,
  {
    changedBy,
    paymentIntentId,
    paymentMethodId,
    customerId,
    amountPaid,
    reason,
  }: {
    changedBy?: string | null;
    paymentIntentId?: string | null;
    paymentMethodId?: string | null;
    customerId?: string | null;
    amountPaid?: number | null;
    reason?: string;
  }
) {
  payment.status = PaymentStatus.PAID;
  payment.amountPaid =
    typeof amountPaid === "number"
      ? Math.min(payment.amount, amountPaid)
      : payment.amount;
  payment.paidDate = payment.paidDate ?? new Date();

  if (paymentIntentId) {
    payment.stripePaymentIntentId = paymentIntentId;
  }

  if (paymentMethodId) {
    payment.stripePaymentMethodId = paymentMethodId;
  }

  if (customerId) {
    payment.stripeCustomerId = customerId;
  }

  if (!Array.isArray(payment.statusHistory)) {
    payment.statusHistory = [];
  }

  const lastStatus =
    payment.statusHistory[payment.statusHistory.length - 1]?.status;

  if (lastStatus !== PaymentStatus.PAID) {
    payment.statusHistory.push({
      status: PaymentStatus.PAID,
      changedAt: new Date(),
      changedBy: changedBy ?? "system",
      reason: reason ?? "Payment confirmed via Stripe",
    });
  }

  await payment.save();
}

// ============================================================================
// POST /api/payments/create-intent - Create a Stripe payment intent
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Connect to database
    await connectDB();

    // Get session
    const session = await auth();
    if (!session?.user) {
      return createErrorResponse("Authentication required", 401);
    }

    const accessProfile = await resolveAccessProfile(session.user.role);

    const body = await request.json();
    const { paymentId } = body;

    if (!paymentId) {
      return createErrorResponse("Payment ID is required", 400);
    }

    // Find the payment
    const payment = await Payment.findById(paymentId)
      .populate("tenantId", "firstName lastName email phone")
      .populate("propertyId", "name address");

    if (!payment) {
      return createErrorResponse("Payment not found", 404);
    }

    // Role-based authorization
    if (accessProfile.isTenant) {
      const tenant = await ensureTenantProfile(session.user.id);
      const paymentTenantUserId = resolveId(payment.tenantId);

      if (!tenant || paymentTenantUserId !== session.user.id) {
        return createErrorResponse(
          "You can only create payment intents for your own payments",
          403
        );
      }
    }

    if (payment.status === PaymentStatus.PAID) {
      await markPaymentAsCompleted(payment, {
        changedBy: session.user.id,
        paymentIntentId: payment.stripePaymentIntentId,
        paymentMethodId: payment.stripePaymentMethodId,
        customerId: payment.stripeCustomerId,
        amountPaid: payment.amountPaid ?? payment.amount,
        reason: "Payment intent requested after completion",
      });

      return createSuccessResponse(
        {
          alreadyCompleted: true,
          status: PaymentStatus.PAID,
          paymentIntentId: payment.stripePaymentIntentId ?? null,
        },
        "Payment is already completed"
      );
    }

    // Handle existing payment intent if present
    if (payment.stripePaymentIntentId) {
      try {
        const existingIntent = await stripePaymentService.getPaymentIntent(
          payment.stripePaymentIntentId
        );

        if (existingIntent.status === "succeeded") {
          await markPaymentAsCompleted(payment, {
            changedBy: session.user.id,
            paymentIntentId: existingIntent.id,
            paymentMethodId: existingIntent.paymentMethodId,
            customerId: payment.stripeCustomerId,
            amountPaid: existingIntent.amount,
            reason: "Stripe payment intent already succeeded",
          });

          return createSuccessResponse(
            {
              alreadyCompleted: true,
              status: PaymentStatus.PAID,
              paymentIntentId: existingIntent.id,
            },
            "Payment is already completed"
          );
        }

        if (existingIntent.status === "canceled") {
          payment.stripePaymentIntentId = undefined;
          payment.stripePaymentMethodId = undefined;
          await payment.save();
        } else {
          return createSuccessResponse(
            {
              clientSecret: existingIntent.clientSecret,
              paymentIntentId: existingIntent.id,
              amount: existingIntent.amount,
              currency: existingIntent.currency,
              customerId: payment.stripeCustomerId ?? null,
              status: existingIntent.status,
            },
            "Existing payment intent retrieved"
          );
        }
      } catch (intentError) {
        console.warn(
          "Existing Stripe payment intent could not be retrieved, creating a new one",
          intentError
        );
        payment.stripePaymentIntentId = undefined;
        payment.stripePaymentMethodId = undefined;
        await payment.save();
      }
    }

    // Create or update Stripe customer
    const tenantUser = payment.tenantId as unknown as {
      _id: { toString(): string };
      email: string;
      firstName?: string;
      lastName?: string;
    };

    if (!tenantUser?.email) {
      return createErrorResponse(
        "Tenant contact information is incomplete",
        400
      );
    }
    const tenantFullName = `${tenantUser.firstName ?? ""} ${
      tenantUser.lastName ?? ""
    }`
      .trim()
      .replace(/\s+/g, " ");
    const customer = await stripePaymentService.createOrGetCustomer(
      tenantUser._id.toString(),
      tenantUser.email,
      tenantFullName || tenantUser.email
    );

    // Create payment intent
    const paymentIntent = await stripePaymentService.createPaymentIntent(
      payment.amount,
      customer.id,
      undefined, // No payment method specified yet
      {
        paymentId: payment._id.toString(),
        paymentType: payment.type,
        propertyName: payment.propertyId.name,
        tenantName: tenantFullName || tenantUser.email,
        dueDate: payment.dueDate.toISOString(),
        tenantId: payment.tenantId._id.toString(),
        propertyId: payment.propertyId._id.toString(),
      }
    );

    payment.stripePaymentIntentId = paymentIntent.id;
    payment.stripeCustomerId = customer.id;
    payment.stripePaymentMethodId = undefined;
    await payment.save();

    return createSuccessResponse(
      {
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        customerId: customer.id,
      },
      "Payment intent created successfully"
    );
  } catch (error) {
    console.error("Error in POST /api/payments/create-intent:", error);
    return createErrorResponse("Failed to create payment intent", 500);
  }
}

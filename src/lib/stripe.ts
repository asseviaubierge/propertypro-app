/**
 * PropertyPro - Stripe Integration
 * Stripe payment processing utilities and webhook handling
 */

import Stripe from "stripe";
import { Payment } from "@/models";
import { PaymentStatus, PaymentMethod } from "@/types";
import { getStripeClient } from "@/lib/services/payment-config.service";

// The Stripe server client is resolved per call (DB-first, env-fallback) via
// getStripeClient() so admin-managed credentials take effect without a redeploy.
export { getStripeClient };

// ============================================================================
// PAYMENT INTENT CREATION
// ============================================================================

export interface CreatePaymentIntentParams {
  amount: number; // Amount in cents
  currency?: string;
  paymentId: string;
  tenantEmail: string;
  description?: string;
  metadata?: Record<string, string>;
}

export async function createPaymentIntent({
  amount,
  currency = "usd",
  paymentId,
  tenantEmail,
  description,
  metadata = {},
}: CreatePaymentIntentParams): Promise<Stripe.PaymentIntent> {
  try {
    // Validate amount is within Stripe's limits
    if (amount < 0.50 || amount > 999999.99) {
      throw new Error("Amount must be between $0.50 and $999,999.99");
    }

    const stripe = await getStripeClient();
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        receipt_email: tenantEmail,
        description: description || "Property rent payment",
        metadata: {
          paymentId,
          source: "PropertyPro",
          ...metadata,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      },
      {
        idempotencyKey: `payment-intent-${paymentId}-${Date.now()}`,
      }
    );

    // Update payment record with Stripe payment intent ID using model to trigger hooks
    const payment = await Payment.findById(paymentId);
    if (payment) {
      payment.stripePaymentIntentId = paymentIntent.id;
      payment.status = PaymentStatus.PENDING;
      await payment.save();
    }

    return paymentIntent;
  } catch (error) {
    console.error("Error creating payment intent:", error);
    if (error instanceof Stripe.errors.StripeError) {
      throw new Error(`Stripe error (${error.type}): ${error.message}`);
    }
    throw error instanceof Error ? error : new Error("Failed to create payment intent");
  }
}

// ============================================================================
// PAYMENT CONFIRMATION
// ============================================================================

export async function confirmPayment(
  paymentIntentId: string
): Promise<boolean> {
  try {
    const stripe = await getStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === "succeeded") {
      // Find and update the payment record
      const payment = await Payment.findOne({
        stripePaymentIntentId: paymentIntentId,
      });

      if (payment) {
        payment.status = PaymentStatus.PAID;
        payment.paidDate = new Date();
        await payment.save();
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error confirming payment:", error);
    return false;
  }
}

// ============================================================================
// REFUND PROCESSING
// ============================================================================

export interface CreateRefundParams {
  paymentIntentId: string;
  amount?: number; // Amount in cents, if partial refund
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
  metadata?: Record<string, string>;
}

export async function createRefund({
  paymentIntentId,
  amount,
  reason = "requested_by_customer",
  metadata = {},
}: CreateRefundParams): Promise<Stripe.Refund> {
  try {
    const stripe = await getStripeClient();
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
      reason,
      metadata: {
        source: "PropertyPro",
        ...metadata,
      },
    };

    if (amount) {
      refundParams.amount = Math.round(amount * 100); // Convert to cents
    }

    const refund = await stripe.refunds.create(refundParams);

    // Update payment record
    const payment = await Payment.findOne({
      stripePaymentIntentId: paymentIntentId,
    });

    if (payment) {
      payment.status = PaymentStatus.REFUNDED;
      await payment.save();
    }

    return refund;
  } catch (error) {
    console.error("Error creating refund:", error);
    throw new Error("Failed to create refund");
  }
}

// ============================================================================
// CUSTOMER MANAGEMENT
// ============================================================================

export async function createOrUpdateCustomer(
  email: string,
  name: string,
  phone?: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  try {
    const stripe = await getStripeClient();
    // Check if customer already exists
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      // Update existing customer
      const customer = await stripe.customers.update(
        existingCustomers.data[0].id,
        {
          name,
          phone,
          metadata: {
            source: "PropertyPro",
            ...metadata,
          },
        }
      );
      return customer;
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email,
        name,
        phone,
        metadata: {
          source: "PropertyPro",
          ...metadata,
        },
      });
      return customer;
    }
  } catch (error) {
    console.error("Error creating/updating customer:", error);
    throw new Error("Failed to create/update customer");
  }
}

// ============================================================================
// WEBHOOK HANDLING
// ============================================================================

export async function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  secret: string
): Promise<Stripe.Event> {
  try {
    const stripe = await getStripeClient();
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.error("Error constructing webhook event:", error);
    throw new Error("Invalid webhook signature");
  }
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  try {

    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.processing":
        await handlePaymentProcessing(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      case "payment_intent.requires_action":
        await handlePaymentRequiresAction(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      case "payment_intent.canceled":
        await handlePaymentCanceled(event.data.object as Stripe.PaymentIntent);
        break;

      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        await handleCheckoutSessionFailed(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case "charge.dispute.created":
        await handleChargeDispute(event.data.object as Stripe.Dispute);
        break;

      case "customer.created":
        await handleCustomerCreated(event.data.object as Stripe.Customer);
        break;

      case "payment_method.attached":
        await handlePaymentMethodAttached(
          event.data.object as Stripe.PaymentMethod
        );
        break;

      default:

    }


  } catch (error) {
    console.error(
      `Error handling webhook event ${event.type} (${event.id}):`,
      error
    );
    throw error;
  }
}

async function handlePaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  try {
    const payment = await Payment.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!payment) {
      console.warn("Payment not found for Stripe payment intent:", paymentIntent.id);
      return;
    }

    // Update payment status and details
    payment.status = PaymentStatus.PAID;
    payment.paidDate = new Date();
    payment.amountPaid = paymentIntent.amount / 100;

    // Add to payment history
    payment.paymentHistory.push({
      amount: paymentIntent.amount / 100,
      paymentMethod: "credit_card",
      paidDate: new Date(),
      transactionId: paymentIntent.id,
      notes: "Payment processed via Stripe",
    });

    await payment.save();

    // Sync with invoice if payment is linked to an invoice
    if (payment.invoiceId) {
      try {
        const { Invoice } = await import("@/models");
        const invoice = await Invoice.findById(payment.invoiceId);
        if (invoice) {
          await invoice.addPayment(payment._id, payment.amountPaid);
        } else {
          console.error("Invoice not found for payment:", payment.invoiceId);
        }
      } catch (error) {
        console.error("Error updating invoice:", error);
      }
    }

    // If no specific invoice, try to apply to oldest unpaid invoices for the tenant
    if (!payment.invoiceId && payment.tenantId) {
      try {
        const { paymentInvoiceLinkingService } = await import(
          "@/lib/services/payment-invoice-linking.service"
        );
        await paymentInvoiceLinkingService.applyPaymentToInvoices(
          payment._id.toString(),
          payment.tenantId.toString(),
          payment.amountPaid,
          payment.leaseId?.toString()
        );
      } catch (error) {
        console.error("Error linking payment to invoices:", error);
      }
    }
  } catch (error) {
    console.error("Error handling payment success:", error);
    throw error;
  }
}

async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  try {
    const payment = await Payment.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!payment) {
      console.warn("Payment not found for failed Stripe payment intent:", paymentIntent.id);
      return;
    }

    // Update payment status with failure details
    payment.status = PaymentStatus.FAILED;

    // Add failure details to payment history
    const errorMessage =
      paymentIntent.last_payment_error?.message || "Unknown error";
    payment.paymentHistory.push({
      amount: 0,
      paymentMethod: "credit_card",
      paidDate: new Date(),
      transactionId: paymentIntent.id,
      notes: `Payment failed: ${errorMessage}`,
    });

    await payment.save();
    console.error("Payment marked as failed:", payment._id.toString(), errorMessage);
  } catch (error) {
    console.error("Error handling payment failure:", error);
    throw error;
  }
}

async function handleChargeDispute(dispute: Stripe.Dispute): Promise<void> {
  // Handle charge disputes - could involve updating payment status
  // and notifying property managers

}

async function handlePaymentProcessing(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const payment = await Payment.findOne({
    stripePaymentIntentId: paymentIntent.id,
  });

  if (payment) {
    payment.status = PaymentStatus.PENDING;
    await payment.save();


  }
}

async function handlePaymentRequiresAction(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const payment = await Payment.findOne({
    stripePaymentIntentId: paymentIntent.id,
  });

  if (payment) {
    payment.status = PaymentStatus.PENDING;
    await payment.save();


  }
}

async function handlePaymentCanceled(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const payment = await Payment.findOne({
    stripePaymentIntentId: paymentIntent.id,
  });

  if (payment) {
    payment.status = PaymentStatus.FAILED;
    await payment.save();


  }
}

async function handleCustomerCreated(customer: Stripe.Customer): Promise<void> {

  // Could update tenant records with Stripe customer ID if needed
}

async function handlePaymentMethodAttached(
  paymentMethod: Stripe.PaymentMethod
): Promise<void> {

  // Could store payment method details for future use
}


async function handleCheckoutSessionCompleted(
  checkoutSession: Stripe.Checkout.Session
): Promise<void> {
  try {
    const paymentId =
      checkoutSession.client_reference_id ||
      (checkoutSession.metadata?.paymentId as string | undefined);

    const payment = paymentId
      ? await Payment.findById(paymentId)
      : await Payment.findOne({ stripeCheckoutSessionId: checkoutSession.id });

    if (!payment) {
      console.warn(
        "Payment not found for Checkout session:",
        checkoutSession.id
      );
      return;
    }

    // Idempotency at the Payment level — skip if already PAID
    if (payment.status === PaymentStatus.PAID) {
      return;
    }

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
    payment.stripeCheckoutSessionId = checkoutSession.id;
    if (paymentIntentId) {
      payment.stripePaymentIntentId = paymentIntentId;
    }

    payment.paymentHistory.push({
      amount: amountPaid,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      paidDate: new Date(),
      transactionId: paymentIntentId || checkoutSession.id,
      notes: "Payment processed via Stripe Checkout",
    });

    await payment.save();

    if (payment.invoiceId) {
      try {
        const { Invoice } = await import("@/models");
        const invoice = await Invoice.findById(payment.invoiceId);
        if (invoice) {
          await (
            invoice as unknown as {
              addPayment: (id: unknown, amount: number) => Promise<void>;
            }
          ).addPayment(payment._id, amountPaid);
        } else {
          console.error(
            "Invoice not found for checkout payment:",
            payment.invoiceId
          );
        }
      } catch (error) {
        console.error(
          "Error updating invoice after checkout completion:",
          error
        );
      }
    }
  } catch (error) {
    console.error("Error handling checkout.session.completed:", error);
    throw error;
  }
}

async function handleCheckoutSessionFailed(
  checkoutSession: Stripe.Checkout.Session
): Promise<void> {
  try {
    const paymentId =
      checkoutSession.client_reference_id ||
      (checkoutSession.metadata?.paymentId as string | undefined);

    const payment = paymentId
      ? await Payment.findById(paymentId)
      : await Payment.findOne({ stripeCheckoutSessionId: checkoutSession.id });

    if (!payment) return;
    if (payment.status === PaymentStatus.PAID) return;

    payment.status = PaymentStatus.FAILED;
    await payment.save();
  } catch (error) {
    console.error("Error handling checkout session failure:", error);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function formatStripeAmount(amount: number): number {
  return Math.round(amount * 100); // Convert dollars to cents
}

export function formatDisplayAmount(stripeAmount: number): number {
  return stripeAmount / 100; // Convert cents to dollars
}

export function isValidStripeAmount(amount: number): boolean {
  return amount >= 0.5 && amount <= 999999.99; // Stripe limits
}

export async function getPaymentMethods(
  customerId: string
): Promise<Stripe.PaymentMethod[]> {
  try {
    const stripe = await getStripeClient();
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
    });
    return paymentMethods.data;
  } catch (error) {
    console.error("Error retrieving payment methods:", error);
    return [];
  }
}

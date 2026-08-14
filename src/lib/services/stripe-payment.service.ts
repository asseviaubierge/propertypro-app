/**
 * PropertyPro - Stripe Payment Service
 * Stripe integration for payment processing, payment methods, and subscriptions
 */

import Stripe from "stripe";
import { IPayment, PaymentStatus } from "@/types";
import { handleStripeError, logPaymentError } from "@/lib/stripe-error-handler";
import { detectFraud, logSecurityEvent } from "@/lib/payment-security";
import {
  getStripeClient,
  getStripeWebhookSecret,
} from "@/lib/services/payment-config.service";

export interface StripePaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethodId?: string;
}

export interface StripePaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  bankAccount?: {
    last4: string;
    bankName: string;
    accountType: string;
  };
}

export interface StripeCustomer {
  id: string;
  email: string;
  name: string;
  defaultPaymentMethodId?: string;
}

class StripePaymentService {
  /**
   * Resolve the Stripe server client (DB-first, env-fallback). Cached inside
   * payment-config.service so this is cheap to call per operation.
   */
  private getStripe(): Promise<Stripe> {
    return getStripeClient();
  }

  /** Public accessor for callers that need the raw Stripe client. */
  getClient(): Promise<Stripe> {
    return getStripeClient();
  }

  /**
   * Create or retrieve a Stripe customer
   */
  async createOrGetCustomer(
    tenantId: string,
    email: string,
    name: string
  ): Promise<StripeCustomer> {
    try {
      // First, try to find existing customer by metadata
      const existingCustomers = await (await this.getStripe()).customers.list({
        email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        const customer = existingCustomers.data[0];
        return {
          id: customer.id,
          email: customer.email || email,
          name: customer.name || name,
          defaultPaymentMethodId: customer.invoice_settings
            .default_payment_method as string,
        };
      }

      // Create new customer
      const customer = await (await this.getStripe()).customers.create({
        email,
        name,
        metadata: {
          tenantId,
          source: "PropertyPro",
        },
      });

      return {
        id: customer.id,
        email: customer.email || email,
        name: customer.name || name,
      };
    } catch (error) {
      console.error("Error creating/getting Stripe customer:", error);
      throw new Error("Failed to create or retrieve customer");
    }
  }

  /**
   * Create a payment intent
   */
  async createPaymentIntent(
    amount: number,
    customerId: string,
    paymentMethodId?: string,
    metadata?: Record<string, string>
  ): Promise<StripePaymentIntent> {
    try {
      const paymentIntentData: Stripe.PaymentIntentCreateParams = {
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
        customer: customerId,
        metadata: {
          source: "PropertyPro",
          ...metadata,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      };

      if (paymentMethodId) {
        paymentIntentData.payment_method = paymentMethodId;
        paymentIntentData.confirmation_method = "manual";
        paymentIntentData.confirm = true;
      }

      const paymentIntent = await (await this.getStripe()).paymentIntents.create(
        paymentIntentData
      );

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        paymentMethodId: paymentIntent.payment_method as string,
      };
    } catch (error) {
      console.error("Error creating payment intent:", error);
      throw new Error("Failed to create payment intent");
    }
  }

  /**
   * Confirm a payment intent
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId?: string
  ): Promise<StripePaymentIntent> {
    try {
      const confirmData: Stripe.PaymentIntentConfirmParams = {};

      if (paymentMethodId) {
        confirmData.payment_method = paymentMethodId;
      }

      const paymentIntent = await (await this.getStripe()).paymentIntents.confirm(
        paymentIntentId,
        confirmData
      );

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        paymentMethodId: paymentIntent.payment_method as string,
      };
    } catch (error) {
      console.error("Error confirming payment intent:", error);
      throw new Error("Failed to confirm payment");
    }
  }

  /**
   * Get a payment intent
   */
  async getPaymentIntent(
    paymentIntentId: string
  ): Promise<StripePaymentIntent> {
    try {
      const paymentIntent = await (await this.getStripe()).paymentIntents.retrieve(
        paymentIntentId
      );

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        paymentMethodId: paymentIntent.payment_method as string,
      };
    } catch (error) {
      console.error("Error retrieving payment intent:", error);
      throw new Error("Failed to retrieve payment intent");
    }
  }

  /**
   * Attach payment method to customer
   */
  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string
  ): Promise<StripePaymentMethod> {
    try {
      const paymentMethod = await (await this.getStripe()).paymentMethods.attach(
        paymentMethodId,
        {
          customer: customerId,
        }
      );

      return this.formatPaymentMethod(paymentMethod);
    } catch (error) {
      console.error("Error attaching payment method:", error);
      throw new Error("Failed to attach payment method");
    }
  }

  /**
   * Detach payment method from customer
   */
  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      await (await this.getStripe()).paymentMethods.detach(paymentMethodId);
    } catch (error) {
      console.error("Error detaching payment method:", error);
      throw new Error("Failed to remove payment method");
    }
  }

  /**
   * List customer payment methods
   */
  async listCustomerPaymentMethods(
    customerId: string
  ): Promise<StripePaymentMethod[]> {
    try {
      const paymentMethods = await (await this.getStripe()).paymentMethods.list({
        customer: customerId,
        type: "card",
      });

      return paymentMethods.data.map((pm) => this.formatPaymentMethod(pm));
    } catch (error) {
      console.error("Error listing payment methods:", error);
      throw new Error("Failed to retrieve payment methods");
    }
  }

  /**
   * Set default payment method for customer
   */
  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<void> {
    try {
      await (await this.getStripe()).customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    } catch (error) {
      console.error("Error setting default payment method:", error);
      throw new Error("Failed to set default payment method");
    }
  }

  /**
   * Create a setup intent for saving payment methods
   */
  async createSetupIntent(
    customerId: string
  ): Promise<{ clientSecret: string; setupIntentId: string }> {
    try {
      const setupIntent = await (await this.getStripe()).setupIntents.create({
        customer: customerId,
        payment_method_types: ["card"],
        usage: "off_session",
      });

      return {
        clientSecret: setupIntent.client_secret!,
        setupIntentId: setupIntent.id,
      };
    } catch (error) {
      console.error("Error creating setup intent:", error);
      throw new Error("Failed to create setup intent");
    }
  }

  /**
   * Process refund
   */
  async processRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<{ refundId: string; amount: number; status: string }> {
    try {
      const refundData: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
        reason: reason as Stripe.RefundCreateParams.Reason,
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }

      const refund = await (await this.getStripe()).refunds.create(refundData);

      return {
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
      };
    } catch (error) {
      console.error("Error processing refund:", error);
      throw new Error("Failed to process refund");
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhookEvent(
    payload: string,
    signature: string
  ): Promise<{ type: string; data: any }> {
    try {
      const webhookSecret = await getStripeWebhookSecret();
      if (!webhookSecret) {
        throw new Error("Stripe webhook secret is not configured");
      }

      const event = (await this.getStripe()).webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );

      return {
        type: event.type,
        data: event.data.object,
      };
    } catch (error) {
      console.error("Error handling webhook:", error);
      throw new Error("Invalid webhook signature");
    }
  }

  /**
   * Format payment method for frontend
   */
  private formatPaymentMethod(
    paymentMethod: Stripe.PaymentMethod
  ): StripePaymentMethod {
    const formatted: StripePaymentMethod = {
      id: paymentMethod.id,
      type: paymentMethod.type,
    };

    if (paymentMethod.card) {
      formatted.card = {
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        expMonth: paymentMethod.card.exp_month,
        expYear: paymentMethod.card.exp_year,
      };
    }

    if (paymentMethod.us_bank_account) {
      formatted.bankAccount = {
        last4: paymentMethod.us_bank_account.last4,
        bankName: paymentMethod.us_bank_account.bank_name || "Inconnu",
        accountType: paymentMethod.us_bank_account.account_type || "checking",
      };
    }

    return formatted;
  }

  /**
   * Convert Stripe payment status to PropertyPro payment status
   */
  convertStripeStatus(stripeStatus: string): PaymentStatus {
    switch (stripeStatus) {
      case "succeeded":
        return PaymentStatus.PAID;
      case "processing":
        return PaymentStatus.PENDING;
      case "requires_payment_method":
      case "requires_confirmation":
      case "requires_action":
        return PaymentStatus.PENDING;
      case "canceled":
        return PaymentStatus.CANCELLED;
      default:
        return PaymentStatus.PENDING;
    }
  }
}

export const stripePaymentService = new StripePaymentService();

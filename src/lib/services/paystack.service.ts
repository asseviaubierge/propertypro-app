/**
 * PropertyPro - Paystack Integration (Initialize + Verify)
 *
 * Mirrors the PayPal/Stripe flow with Paystack's in-page Inline popup:
 *   1. initializeTransaction() -> creates a Paystack transaction for an existing
 *      PENDING Payment and returns the access code the browser opens Inline with.
 *   2. verifyTransaction() -> confirms the charge server-side on success.
 *   3. finalizePaystackPayment() -> atomic PENDING->PAID settlement, shared by the
 *      verify route and the webhook so neither can double-count.
 *   4. handlePaystackWebhookEvent() -> finalizes from signed webhooks
 *      (charge.success).
 *
 * Credentials resolve DB-first / env-fallback through the gateway registry via
 * payment-config.service (getGatewayConfig("paystack")). No SDK dependency — the
 * REST API is called directly with fetch, Bearer-authenticated with the secret key.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { Types } from "mongoose";
import connectDB from "@/lib/mongodb";
import { Payment } from "@/models";
import { PaymentStatus, PaymentMethod } from "@/types";
import { getGatewayConfig } from "@/lib/services/payment-config.service";
import { toMinorUnits, fromMinorUnits } from "@/lib/payments/amounts";

const API_BASE = "https://api.paystack.co";

export interface PaystackResolvedConfig {
  publicKey: string;
  secretKey: string;
  /** True when all required credentials are present (usable). */
  configured: boolean;
}

/** Resolve Paystack credentials (DB-first, env-fallback). */
export async function getPaystackConfig(
  force = false
): Promise<PaystackResolvedConfig> {
  const cfg = await getGatewayConfig("paystack", force);
  return {
    publicKey: cfg.credentials.publicKey || "",
    secretKey: cfg.credentials.secretKey || "",
    configured: cfg.configured,
  };
}

/** Authenticated Paystack REST call returning parsed JSON (throws on non-2xx). */
async function paystackRequest<T = any>(
  secretKey: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!secretKey) {
    throw new Error(
      "Paystack is not configured. Add a Secret Key in Admin → Settings → Payments, or set PAYSTACK_SECRET_KEY."
    );
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok || data?.status === false) {
    const detail =
      data?.message || `Paystack API error (${res.status})`;
    const error = new Error(detail) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }

  return data as T;
}

/**
 * Verify the secret key with a lightweight authenticated read. Used by the admin
 * "Test Connection" action so values can be checked before they are saved.
 * Throws if the key is invalid.
 */
export async function verifyCredentials(params: {
  secretKey: string;
}): Promise<{ ok: true }> {
  await paystackRequest(params.secretKey, "/balance", { method: "GET" });
  return { ok: true };
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

export interface InitializeTransactionParams {
  amount: number;
  currency: string;
  email: string;
  /** Our Payment _id — stored in metadata so webhooks can locate the record. */
  paymentId: string;
  /** Unique transaction reference we generate and store on the Payment. */
  reference: string;
  callbackUrl?: string;
}

export interface PaystackInitResult {
  reference: string;
  accessCode: string;
  authorizationUrl: string;
}

export async function initializeTransaction(
  params: InitializeTransactionParams
): Promise<PaystackInitResult> {
  const cfg = await getPaystackConfig();
  if (!cfg.configured) {
    throw new Error(
      "Paystack is not configured. Add credentials in Admin → Settings → Payments."
    );
  }

  const currency = (params.currency || "NGN").toUpperCase();
  const body: Record<string, unknown> = {
    amount: toMinorUnits(params.amount, currency),
    currency,
    email: params.email,
    reference: params.reference,
    metadata: { paymentId: params.paymentId },
  };
  if (params.callbackUrl) body.callback_url = params.callbackUrl;

  const result = await paystackRequest(
    cfg.secretKey,
    "/transaction/initialize",
    { method: "POST", body: JSON.stringify(body) }
  );

  return {
    reference: result.data?.reference,
    accessCode: result.data?.access_code,
    authorizationUrl: result.data?.authorization_url,
  };
}

export interface PaystackVerifyResult {
  reference: string;
  status: string;
  /** True when the charge succeeded. */
  success: boolean;
  amount?: number;
  currency?: string;
  paymentId?: string;
}

export async function verifyTransaction(
  reference: string
): Promise<PaystackVerifyResult> {
  const cfg = await getPaystackConfig();
  const result = await paystackRequest(
    cfg.secretKey,
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET" }
  );

  const data = result.data || {};
  const currency = data.currency || "NGN";
  return {
    reference: data.reference,
    status: data.status,
    success: data.status === "success",
    amount:
      data.amount != null
        ? fromMinorUnits(Number(data.amount), currency)
        : undefined,
    currency,
    paymentId: data.metadata?.paymentId,
  };
}

// ============================================================================
// FINALIZATION (shared, idempotent)
// ============================================================================

export interface PaystackSettlement {
  amount: number;
  reference?: string;
}

export interface FinalizeResult {
  /** True when THIS call settled the payment (false if another path already had). */
  applied: boolean;
  payment: any;
}

/**
 * Settle a Paystack Payment exactly once. Performs an atomic PENDING→PAID
 * transition (`status != PAID` guard) so the verify route and the webhook can't
 * both apply the same charge — only the caller that wins records the history
 * entry and applies the amount to the invoice. Invoice application is itself
 * idempotent (Invoice.addPayment dedupes by payment id).
 */
export async function finalizePaystackPayment(
  paymentId: string | Types.ObjectId,
  settlement: PaystackSettlement
): Promise<FinalizeResult> {
  await connectDB();

  const now = new Date();
  const set: Record<string, unknown> = {
    status: PaymentStatus.PAID,
    paidDate: now,
    amountPaid: settlement.amount,
    paymentMethod: PaymentMethod.PAYSTACK,
  };
  if (settlement.reference) set.paystackReference = settlement.reference;

  const claimed = await Payment.findOneAndUpdate(
    { _id: paymentId, status: { $ne: PaymentStatus.PAID } },
    {
      $set: set,
      $push: {
        paymentHistory: {
          amount: settlement.amount,
          paymentMethod: PaymentMethod.PAYSTACK,
          paidDate: now,
          transactionId: settlement.reference,
          notes: "Payment captured via Paystack",
        },
      },
    },
    { new: true }
  );

  // Another path already settled it — return current state without re-applying.
  if (!claimed) {
    const existing = await Payment.findById(paymentId);
    return { applied: false, payment: existing };
  }

  if (claimed.invoiceId) {
    try {
      const { Invoice } = await import("@/models");
      const invoice = await Invoice.findById(claimed.invoiceId);
      if (invoice) {
        await (
          invoice as unknown as {
            addPayment: (id: unknown, amount: number) => Promise<void>;
          }
        ).addPayment(claimed._id, settlement.amount);
      } else {
        console.error(
          "Paystack: invoice not found for payment",
          claimed.invoiceId
        );
      }
    } catch (error) {
      console.error("Paystack: error applying payment to invoice:", error);
    }
  }

  return { applied: true, payment: claimed };
}

// ============================================================================
// WEBHOOKS
// ============================================================================

/** Verify a Paystack webhook signature (HMAC-SHA512 of the raw body, secret key). */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secretKey: string
): boolean {
  if (!signature || !secretKey) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

interface PaystackWebhookEvent {
  event: string;
  data: any;
}

export async function handlePaystackWebhookEvent(
  event: PaystackWebhookEvent
): Promise<void> {
  switch (event.event) {
    case "charge.success":
      await applyChargeSuccess(event.data);
      break;
    default:
      // Other events are not actionable for our flow.
      break;
  }
}

/** Locate the Payment for a Paystack charge resource. */
async function findPaymentForData(data: any) {
  const paymentId: string | undefined = data?.metadata?.paymentId;
  const reference: string | undefined = data?.reference;

  if (paymentId) {
    const byId = await Payment.findById(paymentId).catch(() => null);
    if (byId) return byId;
  }
  if (reference) {
    return Payment.findOne({ paystackReference: reference });
  }
  return null;
}

async function applyChargeSuccess(data: any): Promise<void> {
  await connectDB();
  if (!data) return;
  const payment = await findPaymentForData(data);
  if (!payment) {
    console.warn(
      "Paystack: payment not found for charge",
      data?.reference,
      data?.metadata?.paymentId
    );
    return;
  }

  // Fast path; finalizePaystackPayment is the authoritative (atomic) guard.
  if (payment.status === PaymentStatus.PAID) return;
  if (data?.status !== "success") return;

  const amountPaid =
    data?.amount != null
      ? fromMinorUnits(Number(data.amount), data.currency || "NGN")
      : payment.amount;

  await finalizePaystackPayment(payment._id, {
    amount: amountPaid,
    reference: data?.reference,
  });
}

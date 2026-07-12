/**
 * PropertyPro - Razorpay Integration (Orders + Checkout)
 *
 * Mirrors the PayPal/Stripe flow with Razorpay's in-page Checkout modal:
 *   1. createOrder()  -> creates a Razorpay order for an existing PENDING Payment
 *      and returns the order id the browser opens Checkout with.
 *   2. verifyPaymentSignature() -> validates the signature Checkout returns on
 *      success (HMAC of "orderId|paymentId" with the key secret).
 *   3. finalizeRazorpayPayment() -> atomic PENDING->PAID settlement, shared by the
 *      verify route and the webhook so neither can double-count.
 *   4. handleRazorpayWebhookEvent() -> finalizes from signed webhooks
 *      (payment.captured / payment.failed).
 *
 * Credentials resolve DB-first / env-fallback through the gateway registry via
 * payment-config.service (getGatewayConfig("razorpay")). No SDK dependency — the
 * REST API is called directly with fetch, Basic-authenticated with keyId:keySecret.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { Types } from "mongoose";
import connectDB from "@/lib/mongodb";
import { Payment } from "@/models";
import { PaymentStatus, PaymentMethod } from "@/types";
import { getGatewayConfig } from "@/lib/services/payment-config.service";
import { toMinorUnits } from "@/lib/payments/amounts";

const API_BASE = "https://api.razorpay.com";

export interface RazorpayResolvedConfig {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
  /** True when all required credentials are present (usable). */
  configured: boolean;
}

/** Resolve Razorpay credentials (DB-first, env-fallback). */
export async function getRazorpayConfig(
  force = false
): Promise<RazorpayResolvedConfig> {
  const cfg = await getGatewayConfig("razorpay", force);
  return {
    keyId: cfg.credentials.keyId || "",
    keySecret: cfg.credentials.keySecret || "",
    webhookSecret: cfg.credentials.webhookSecret || undefined,
    configured: cfg.configured,
  };
}

function basicAuth(keyId: string, keySecret: string): string {
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

/** Authenticated Razorpay REST call returning parsed JSON (throws on non-2xx). */
async function razorpayRequest<T = any>(
  keyId: string,
  keySecret: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay is not configured. Add a Key ID and Secret in Admin → Settings → Payments, or set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET."
    );
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${basicAuth(keyId, keySecret)}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const detail =
      data?.error?.description ||
      data?.error?.reason ||
      data?.message ||
      `Razorpay API error (${res.status})`;
    const error = new Error(detail) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }

  return data as T;
}

/**
 * Verify explicit credentials with a lightweight authenticated read. Used by the
 * admin "Test Connection" action so values can be checked before they are saved.
 * Throws if the credentials are invalid.
 */
export async function verifyCredentials(params: {
  keyId: string;
  keySecret: string;
}): Promise<{ keyId: string }> {
  await razorpayRequest(params.keyId, params.keySecret, "/v1/payments?count=1", {
    method: "GET",
  });
  return { keyId: params.keyId };
}

// ============================================================================
// ORDERS
// ============================================================================

export interface CreateRazorpayOrderParams {
  amount: number;
  currency: string;
  /** Our Payment _id — stored in notes so webhooks can locate the record. */
  paymentId: string;
}

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export async function createOrder(
  params: CreateRazorpayOrderParams
): Promise<RazorpayOrderResult> {
  const cfg = await getRazorpayConfig();
  if (!cfg.configured) {
    throw new Error(
      "Razorpay is not configured. Add credentials in Admin → Settings → Payments."
    );
  }

  const currency = (params.currency || "INR").toUpperCase();
  const body = {
    amount: toMinorUnits(params.amount, currency),
    currency,
    // Razorpay receipts are capped at 40 chars; a Mongo ObjectId is 24.
    receipt: params.paymentId.slice(0, 40),
    notes: { paymentId: params.paymentId },
  };

  const order = await razorpayRequest(cfg.keyId, cfg.keySecret, "/v1/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    id: order.id,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
  };
}

/**
 * Validate the signature returned by Razorpay Checkout on success.
 * signature === HMAC_SHA256(`${orderId}|${razorpayPaymentId}`, keySecret).
 */
export async function verifyPaymentSignature(
  orderId: string,
  razorpayPaymentId: string,
  signature: string
): Promise<boolean> {
  const cfg = await getRazorpayConfig();
  if (!cfg.keySecret || !orderId || !razorpayPaymentId || !signature) {
    return false;
  }
  const expected = createHmac("sha256", cfg.keySecret)
    .update(`${orderId}|${razorpayPaymentId}`)
    .digest("hex");
  return safeEqualHex(expected, signature);
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// ============================================================================
// FINALIZATION (shared, idempotent)
// ============================================================================

export interface RazorpaySettlement {
  amount: number;
  razorpayPaymentId?: string;
  orderId?: string;
}

export interface FinalizeResult {
  /** True when THIS call settled the payment (false if another path already had). */
  applied: boolean;
  payment: any;
}

/**
 * Settle a Razorpay Payment exactly once. Performs an atomic PENDING→PAID
 * transition (`status != PAID` guard) so the verify route and the webhook can't
 * both apply the same payment — only the caller that wins records the history
 * entry and applies the amount to the invoice. Invoice application is itself
 * idempotent (Invoice.addPayment dedupes by payment id).
 */
export async function finalizeRazorpayPayment(
  paymentId: string | Types.ObjectId,
  settlement: RazorpaySettlement
): Promise<FinalizeResult> {
  await connectDB();

  const now = new Date();
  const set: Record<string, unknown> = {
    status: PaymentStatus.PAID,
    paidDate: now,
    amountPaid: settlement.amount,
    paymentMethod: PaymentMethod.RAZORPAY,
  };
  if (settlement.razorpayPaymentId)
    set.razorpayPaymentId = settlement.razorpayPaymentId;
  if (settlement.orderId) set.razorpayOrderId = settlement.orderId;

  const claimed = await Payment.findOneAndUpdate(
    { _id: paymentId, status: { $ne: PaymentStatus.PAID } },
    {
      $set: set,
      $push: {
        paymentHistory: {
          amount: settlement.amount,
          paymentMethod: PaymentMethod.RAZORPAY,
          paidDate: now,
          transactionId: settlement.razorpayPaymentId || settlement.orderId,
          notes: "Payment captured via Razorpay",
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
          "Razorpay: invoice not found for payment",
          claimed.invoiceId
        );
      }
    } catch (error) {
      console.error("Razorpay: error applying payment to invoice:", error);
    }
  }

  return { applied: true, payment: claimed };
}

// ============================================================================
// WEBHOOKS
// ============================================================================

/** Verify a Razorpay webhook signature (HMAC-SHA256 of the raw body). */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

interface RazorpayWebhookEvent {
  event: string;
  payload: any;
}

export async function handleRazorpayWebhookEvent(
  event: RazorpayWebhookEvent
): Promise<void> {
  switch (event.event) {
    case "payment.captured":
      await applyPaymentCaptured(event.payload?.payment?.entity);
      break;
    case "payment.failed":
      await applyPaymentFailed(event.payload?.payment?.entity);
      break;
    default:
      // Other events are not actionable for our flow.
      break;
  }
}

/** Locate the Payment for a Razorpay payment entity. */
async function findPaymentForEntity(entity: any) {
  const paymentId: string | undefined = entity?.notes?.paymentId;
  const orderId: string | undefined = entity?.order_id;

  if (paymentId) {
    const byId = await Payment.findById(paymentId).catch(() => null);
    if (byId) return byId;
  }
  if (orderId) {
    return Payment.findOne({ razorpayOrderId: orderId });
  }
  return null;
}

async function applyPaymentCaptured(entity: any): Promise<void> {
  await connectDB();
  if (!entity) return;
  const payment = await findPaymentForEntity(entity);
  if (!payment) {
    console.warn(
      "Razorpay: payment not found for capture",
      entity?.id,
      entity?.notes?.paymentId
    );
    return;
  }

  // Fast path; finalizeRazorpayPayment is the authoritative (atomic) guard.
  if (payment.status === PaymentStatus.PAID) return;

  const { fromMinorUnits } = await import("@/lib/payments/amounts");
  const amountPaid =
    entity?.amount != null
      ? fromMinorUnits(Number(entity.amount), entity.currency || "INR")
      : payment.amount;

  await finalizeRazorpayPayment(payment._id, {
    amount: amountPaid,
    razorpayPaymentId: entity?.id,
    orderId: entity?.order_id,
  });
}

async function applyPaymentFailed(entity: any): Promise<void> {
  await connectDB();
  if (!entity) return;
  const payment = await findPaymentForEntity(entity);
  if (!payment) return;
  if (payment.status === PaymentStatus.PAID) return;

  payment.status = PaymentStatus.FAILED;
  await payment.save();
}

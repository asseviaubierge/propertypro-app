/**
 * PropertyPro - PayPal Integration (Orders v2 REST)
 *
 * Mirrors the Stripe Checkout flow with a hosted, redirect-based approval:
 *   1. createOrder()  -> creates a PENDING Payment + PayPal order, returns the
 *      approval URL the buyer is redirected to.
 *   2. captureOrder() -> called on return (and idempotently from the webhook) to
 *      capture the funds and mark the Payment PAID.
 *   3. handlePayPalWebhookEvent() -> finalizes payments from PayPal webhooks
 *      (PAYMENT.CAPTURE.COMPLETED / DENIED / REFUNDED), signature-verified.
 *
 * Credentials resolve DB-first / env-fallback through the gateway registry via
 * payment-config.service (getGatewayConfig("paypal")). No SDK dependency — the
 * REST API is called directly with fetch. The OAuth access token is cached and
 * keyed by the credentials so a key change rebuilds it automatically.
 */

import { Types } from "mongoose";
import connectDB from "@/lib/mongodb";
import { Payment } from "@/models";
import { PaymentStatus, PaymentMethod } from "@/types";
import { getGatewayConfig } from "@/lib/services/payment-config.service";

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
const LIVE_BASE = "https://api-m.paypal.com";

export type PayPalMode = "sandbox" | "live";

export interface PayPalResolvedConfig {
  clientId: string;
  clientSecret: string;
  webhookId?: string;
  mode: PayPalMode;
  apiBase: string;
  /** True when all required credentials are present (usable). */
  configured: boolean;
}

/** REST base URL for a given mode (defaults to sandbox for safety). */
export function paypalApiBase(mode: string | undefined): string {
  return mode === "live" ? LIVE_BASE : SANDBOX_BASE;
}

/** Resolve PayPal credentials (DB-first, env-fallback) + computed API base. */
export async function getPayPalConfig(
  force = false
): Promise<PayPalResolvedConfig> {
  const cfg = await getGatewayConfig("paypal", force);
  const mode: PayPalMode =
    cfg.credentials.mode === "live" ? "live" : "sandbox";
  return {
    clientId: cfg.credentials.clientId || "",
    clientSecret: cfg.credentials.clientSecret || "",
    webhookId: cfg.credentials.webhookId || undefined,
    mode,
    apiBase: paypalApiBase(mode),
    configured: cfg.configured,
  };
}

// OAuth access token cache, keyed by the credentials it was minted with so a
// credential change invalidates it automatically.
let tokenCache: { key: string; token: string; expiresAt: number } | null = null;

async function requestToken(
  clientId: string,
  clientSecret: string,
  apiBase: string
): Promise<{ token: string; expiresIn: number }> {
  if (!clientId || !clientSecret) {
    throw new Error(
      "PayPal is not configured. Add a Client ID and Secret in Admin → Settings → Payments, or set PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET."
    );
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(
      data?.error_description ||
        data?.error ||
        `PayPal authentication failed (${res.status})`
    );
  }

  return {
    token: data.access_token as string,
    expiresIn: typeof data.expires_in === "number" ? data.expires_in : 3000,
  };
}

async function getAccessToken(cfg: PayPalResolvedConfig): Promise<string> {
  const key = `${cfg.mode}:${cfg.clientId}:${cfg.clientSecret}`;
  if (tokenCache && tokenCache.key === key && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  const { token, expiresIn } = await requestToken(
    cfg.clientId,
    cfg.clientSecret,
    cfg.apiBase
  );
  // Refresh a minute early to avoid edge-of-expiry failures.
  tokenCache = {
    key,
    token,
    expiresAt: Date.now() + Math.max(0, expiresIn - 60) * 1000,
  };
  return token;
}

/** Authenticated PayPal REST call returning parsed JSON (throws on non-2xx). */
async function paypalRequest<T = any>(
  cfg: PayPalResolvedConfig,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken(cfg);
  const res = await fetch(`${cfg.apiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const detail =
      data?.details?.[0]?.description ||
      data?.message ||
      data?.error_description ||
      `PayPal API error (${res.status})`;
    const error = new Error(detail) as Error & {
      paypalName?: string;
      status?: number;
    };
    error.paypalName = data?.name;
    error.status = res.status;
    throw error;
  }

  return data as T;
}

/**
 * Verify explicit credentials by minting an access token. Used by the admin
 * "Test Connection" action so values can be checked before they are saved.
 * Throws if the credentials are invalid.
 */
export async function verifyCredentials(params: {
  clientId: string;
  clientSecret: string;
  mode: string;
}): Promise<{ mode: PayPalMode }> {
  const mode: PayPalMode = params.mode === "live" ? "live" : "sandbox";
  await requestToken(params.clientId, params.clientSecret, paypalApiBase(mode));
  return { mode };
}

// ============================================================================
// ORDERS
// ============================================================================

export interface CreatePayPalOrderParams {
  amount: number;
  currency?: string;
  /** Our Payment _id — stored as custom_id so webhooks can locate the record. */
  paymentId: string;
  description?: string;
  returnUrl: string;
  cancelUrl: string;
  brandName?: string;
}

export interface PayPalOrderResult {
  id: string;
  status: string;
  approveUrl?: string;
}

export async function createOrder(
  params: CreatePayPalOrderParams
): Promise<PayPalOrderResult> {
  const cfg = await getPayPalConfig();
  if (!cfg.configured) {
    throw new Error(
      "PayPal is not configured. Add credentials in Admin → Settings → Payments."
    );
  }

  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: params.paymentId,
        custom_id: params.paymentId,
        description: params.description?.slice(0, 127),
        amount: {
          currency_code: (params.currency || "USD").toUpperCase(),
          value: params.amount.toFixed(2),
        },
      },
    ],
    application_context: {
      brand_name: params.brandName || "PropertyPro",
      user_action: "PAY_NOW",
      shipping_preference: "NO_SHIPPING",
      return_url: params.returnUrl,
      cancel_url: params.cancelUrl,
    },
  };

  const order = await paypalRequest(cfg, "/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify(body),
    // Idempotency: retrying the same Payment returns the same order.
    headers: { "PayPal-Request-Id": `order-${params.paymentId}` },
  });

  const approveUrl = (order.links || []).find(
    (l: { rel?: string; href?: string }) => l.rel === "approve"
  )?.href;

  return { id: order.id, status: order.status, approveUrl };
}

export async function getOrder(orderId: string): Promise<any> {
  const cfg = await getPayPalConfig();
  return paypalRequest(cfg, `/v2/checkout/orders/${orderId}`, { method: "GET" });
}

export interface PayPalCaptureResult {
  orderId: string;
  orderStatus: string;
  captureId?: string;
  captureStatus?: string;
  amount?: number;
  customId?: string;
}

function parseCapture(order: any): PayPalCaptureResult {
  const pu = order?.purchase_units?.[0];
  const capture = pu?.payments?.captures?.[0];
  return {
    orderId: order?.id,
    orderStatus: order?.status,
    captureId: capture?.id,
    captureStatus: capture?.status,
    amount:
      capture?.amount?.value != null ? Number(capture.amount.value) : undefined,
    customId: capture?.custom_id || pu?.custom_id,
  };
}

/**
 * Capture an approved order. Idempotent: if PayPal reports the order is already
 * captured, the existing order is fetched and its capture returned instead of
 * surfacing an error.
 */
export async function captureOrder(
  orderId: string
): Promise<PayPalCaptureResult> {
  const cfg = await getPayPalConfig();
  try {
    const result = await paypalRequest(
      cfg,
      `/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "PayPal-Request-Id": `capture-${orderId}` },
      }
    );
    return parseCapture(result);
  } catch (error) {
    const name = (error as { paypalName?: string }).paypalName;
    // Already captured (or capture in flight) — read the order's current state.
    if (
      name === "ORDER_ALREADY_CAPTURED" ||
      name === "UNPROCESSABLE_ENTITY"
    ) {
      const order = await getOrder(orderId);
      return parseCapture(order);
    }
    throw error;
  }
}

// ============================================================================
// FINALIZATION (shared, idempotent)
// ============================================================================

export interface PayPalSettlement {
  amount: number;
  captureId?: string;
  orderId?: string;
}

export interface FinalizeResult {
  /** True when THIS call settled the payment (false if another path already had). */
  applied: boolean;
  payment: any;
}

/**
 * Settle a PayPal Payment exactly once. Performs an atomic PENDING→PAID
 * transition (`status != PAID` guard) so the redirect-capture route and the
 * webhook can't both apply the same capture — only the caller that wins the
 * transition records the history entry and applies the amount to the invoice.
 * Invoice application is itself idempotent (Invoice.addPayment dedupes by
 * payment id), so a retry can never double-count.
 */
export async function finalizePayPalPayment(
  paymentId: string | Types.ObjectId,
  settlement: PayPalSettlement
): Promise<FinalizeResult> {
  await connectDB();

  const now = new Date();
  const set: Record<string, unknown> = {
    status: PaymentStatus.PAID,
    paidDate: now,
    amountPaid: settlement.amount,
    paymentMethod: PaymentMethod.PAYPAL,
  };
  if (settlement.captureId) set.paypalCaptureId = settlement.captureId;
  if (settlement.orderId) set.paypalOrderId = settlement.orderId;

  const claimed = await Payment.findOneAndUpdate(
    { _id: paymentId, status: { $ne: PaymentStatus.PAID } },
    {
      $set: set,
      $push: {
        paymentHistory: {
          amount: settlement.amount,
          paymentMethod: PaymentMethod.PAYPAL,
          paidDate: now,
          transactionId: settlement.captureId || settlement.orderId,
          notes: "Payment captured via PayPal",
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
          "PayPal: invoice not found for payment",
          claimed.invoiceId
        );
      }
    } catch (error) {
      console.error("PayPal: error applying payment to invoice:", error);
    }
  }

  return { applied: true, payment: claimed };
}

// ============================================================================
// WEBHOOKS
// ============================================================================

/** Verify a PayPal webhook signature against the configured webhook ID. */
export async function verifyWebhookSignature(
  headers: Record<string, string | null>,
  rawBody: string,
  webhookId: string
): Promise<boolean> {
  const cfg = await getPayPalConfig();
  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return false;
  }

  const payload = {
    auth_algo: headers["paypal-auth-algo"],
    cert_url: headers["paypal-cert-url"],
    transmission_id: headers["paypal-transmission-id"],
    transmission_sig: headers["paypal-transmission-sig"],
    transmission_time: headers["paypal-transmission-time"],
    webhook_id: webhookId,
    webhook_event: event,
  };

  if (
    !payload.auth_algo ||
    !payload.cert_url ||
    !payload.transmission_id ||
    !payload.transmission_sig ||
    !payload.transmission_time
  ) {
    return false;
  }

  try {
    const result = await paypalRequest(
      cfg,
      "/v1/notifications/verify-webhook-signature",
      { method: "POST", body: JSON.stringify(payload) }
    );
    return result?.verification_status === "SUCCESS";
  } catch (error) {
    console.error("PayPal webhook verification error:", error);
    return false;
  }
}

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource: any;
}

export async function handlePayPalWebhookEvent(
  event: PayPalWebhookEvent
): Promise<void> {
  switch (event.event_type) {
    case "PAYMENT.CAPTURE.COMPLETED":
      await applyCaptureCompleted(event.resource);
      break;
    case "PAYMENT.CAPTURE.DENIED":
    case "PAYMENT.CAPTURE.DECLINED":
      await applyCaptureFailed(event.resource);
      break;
    default:
      // Other events are not actionable for our flow.
      break;
  }
}

/** Locate the Payment for a PayPal capture/order resource. */
async function findPaymentForResource(resource: any) {
  const paymentId: string | undefined = resource?.custom_id;
  const orderId: string | undefined =
    resource?.supplementary_data?.related_ids?.order_id;

  if (paymentId) {
    const byId = await Payment.findById(paymentId).catch(() => null);
    if (byId) return byId;
  }
  if (orderId) {
    return Payment.findOne({ paypalOrderId: orderId });
  }
  return null;
}

async function applyCaptureCompleted(resource: any): Promise<void> {
  await connectDB();
  const payment = await findPaymentForResource(resource);
  if (!payment) {
    console.warn(
      "PayPal: payment not found for capture",
      resource?.id,
      resource?.custom_id
    );
    return;
  }

  // Fast path; finalizePayPalPayment is the authoritative (atomic) guard.
  if (payment.status === PaymentStatus.PAID) return;

  const amountPaid =
    resource?.amount?.value != null
      ? Number(resource.amount.value)
      : payment.amount;
  const orderId = resource?.supplementary_data?.related_ids?.order_id;

  await finalizePayPalPayment(payment._id, {
    amount: amountPaid,
    captureId: resource?.id,
    orderId,
  });
}

async function applyCaptureFailed(resource: any): Promise<void> {
  await connectDB();
  const payment = await findPaymentForResource(resource);
  if (!payment) return;
  if (payment.status === PaymentStatus.PAID) return;

  payment.status = PaymentStatus.FAILED;
  await payment.save();
}

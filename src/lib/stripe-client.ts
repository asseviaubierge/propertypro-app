/**
 * PropertyPro - Stripe Browser Client
 *
 * Resolves the Stripe.js publishable key at runtime (DB-first) from
 * /api/payments/config so admin-managed credentials take effect without a
 * rebuild, falling back to the NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY build-time
 * env var. No secrets are ever exposed here.
 */

import { loadStripe, Stripe } from "@stripe/stripe-js";

export interface PublicGatewayEntry {
  configured: boolean;
  [field: string]: string | boolean;
}
export interface PublicPaymentConfig {
  defaultProvider: string;
  gateways: Record<string, PublicGatewayEntry>;
}

let publicConfigPromise: Promise<PublicPaymentConfig | null> | null = null;
let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Shared, cached fetch of the browser-safe payment config (publishable keys +
 * `configured` flags per gateway). No secrets. Returns null if unreachable.
 */
export const getPublicPaymentConfig = (): Promise<PublicPaymentConfig | null> => {
  if (!publicConfigPromise) {
    publicConfigPromise = fetch("/api/payments/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.data ?? j ?? null))
      .catch(() => null);
  }
  return publicConfigPromise;
};

async function resolvePublishableKey(): Promise<string> {
  const envKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  const config = await getPublicPaymentConfig();
  const key = config?.gateways?.stripe?.publishableKey;
  return (key as string) || envKey;
}

/**
 * Shared, cached Stripe.js promise. Pass straight into `<Elements stripe={...}>`.
 */
export const getStripePromise = (): Promise<Stripe | null> => {
  if (!stripePromise) {
    stripePromise = resolvePublishableKey().then((key) =>
      key ? loadStripe(key) : Promise.resolve(null)
    );
  }
  return stripePromise;
};

export const getStripe = () => getStripePromise();

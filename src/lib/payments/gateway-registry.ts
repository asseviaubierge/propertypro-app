/**
 * PropertyPro - Payment Gateway Registry
 *
 * Single source of truth for every payment gateway's credential fields. This
 * one declaration drives:
 *   1. The Mongoose storage shape (SystemSettingsNew.paymentGateways).
 *   2. The generic admin UI (one card per gateway, fields rendered from here).
 *   3. Validation (which fields are required to enable a gateway).
 *   4. The env-variable fallback mapping (DB-first, env-fallback resolution).
 *
 * To add a gateway later (PayPal, Razorpay, Paystack): flip `implemented` to
 * true once its charge adapter exists. The credential storage + admin UI work
 * immediately from this declaration.
 */

export type GatewayId = "stripe" | "paypal" | "razorpay" | "paystack";

export type GatewayFieldType = "text" | "secret" | "select";

export interface GatewayField {
  /** Credential key, e.g. "secretKey". Matches the model + DB shape. */
  key: string;
  label: string;
  /** "secret" => masked in the UI and never returned to the client. */
  type: GatewayFieldType;
  /** Exposed to the browser (e.g. Stripe publishable key). */
  isPublic?: boolean;
  /** Required for the gateway to be enabled. */
  required?: boolean;
  placeholder?: string;
  /** Environment variable used as a fallback when the DB value is empty. */
  env?: string;
  helpText?: string;
  /** Options for `select` fields (e.g. PayPal sandbox/live). */
  options?: { value: string; label: string }[];
}

export interface GatewayDef {
  id: GatewayId;
  name: string;
  /** false => UI shows "Coming soon" and the gateway cannot be enabled. */
  implemented: boolean;
  description: string;
  fields: GatewayField[];
}

export const PAYMENT_GATEWAYS: GatewayDef[] = [
  {
    id: "stripe",
    name: "Stripe",
    implemented: true,
    description:
      "Cards, wallets and bank debits. Active gateway for online payments.",
    fields: [
      {
        key: "publishableKey",
        label: "Publishable Key",
        type: "text",
        isPublic: true,
        required: true,
        placeholder: "pk_live_…",
        env: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
        helpText: "Safe to expose in the browser.",
      },
      {
        key: "secretKey",
        label: "Secret Key",
        type: "secret",
        required: true,
        placeholder: "sk_live_…",
        env: "STRIPE_SECRET_KEY",
      },
      {
        key: "webhookSecret",
        label: "Webhook Signing Secret",
        type: "secret",
        placeholder: "whsec_…",
        env: "STRIPE_WEBHOOK_SECRET",
        helpText: "Used to verify incoming Stripe webhook events.",
      },
    ],
  },
  {
    id: "paypal",
    name: "PayPal",
    implemented: true,
    description:
      "PayPal Checkout. Buyers approve on PayPal and are redirected back to complete the payment.",
    fields: [
      {
        key: "mode",
        label: "Environment",
        type: "select",
        isPublic: true,
        required: true,
        env: "PAYPAL_MODE",
        helpText: "Use Sandbox while testing, Live to accept real payments.",
        options: [
          { value: "sandbox", label: "Sandbox (testing)" },
          { value: "live", label: "Live (production)" },
        ],
      },
      {
        key: "clientId",
        label: "Client ID",
        type: "text",
        isPublic: true,
        required: true,
        placeholder: "AeA1QIZ…",
        env: "PAYPAL_CLIENT_ID",
        helpText: "Safe to expose in the browser.",
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "secret",
        required: true,
        env: "PAYPAL_CLIENT_SECRET",
      },
      {
        key: "webhookId",
        label: "Webhook ID",
        type: "text",
        env: "PAYPAL_WEBHOOK_ID",
        helpText:
          "From your PayPal app's webhook settings — used to verify incoming webhook events.",
      },
    ],
  },
  {
    id: "razorpay",
    name: "Razorpay",
    implemented: true,
    description:
      "Razorpay Checkout (India). Buyers pay in an in-page modal; the payment is verified server-side.",
    fields: [
      {
        key: "keyId",
        label: "Key ID",
        type: "text",
        isPublic: true,
        required: true,
        placeholder: "rzp_live_…",
        env: "RAZORPAY_KEY_ID",
        helpText: "Safe to expose in the browser (used by Razorpay Checkout).",
      },
      {
        key: "keySecret",
        label: "Key Secret",
        type: "secret",
        required: true,
        env: "RAZORPAY_KEY_SECRET",
      },
      {
        key: "webhookSecret",
        label: "Webhook Secret",
        type: "secret",
        env: "RAZORPAY_WEBHOOK_SECRET",
        helpText:
          "From your Razorpay webhook settings — used to verify incoming webhook events.",
      },
    ],
  },
  {
    id: "paystack",
    name: "Paystack",
    implemented: true,
    description:
      "Paystack Inline (Africa). Buyers pay in an in-page popup; the transaction is verified server-side.",
    fields: [
      {
        key: "publicKey",
        label: "Public Key",
        type: "text",
        isPublic: true,
        required: true,
        placeholder: "pk_live_…",
        env: "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY",
        helpText: "Safe to expose in the browser (used by Paystack Inline).",
      },
      {
        key: "secretKey",
        label: "Secret Key",
        type: "secret",
        required: true,
        placeholder: "sk_live_…",
        env: "PAYSTACK_SECRET_KEY",
        helpText:
          "Used for server-side calls and to verify incoming webhook signatures.",
      },
    ],
  },
];

export function getGatewayDef(id: string): GatewayDef | undefined {
  return PAYMENT_GATEWAYS.find((g) => g.id === id);
}

/** Field keys that are safe to expose to the browser for a gateway. */
export function getPublicFieldKeys(id: string): string[] {
  return (
    getGatewayDef(id)?.fields.filter((f) => f.isPublic).map((f) => f.key) ?? []
  );
}

/** Required field keys for a gateway (used when enabling it). */
export function getRequiredFieldKeys(id: string): string[] {
  return (
    getGatewayDef(id)?.fields.filter((f) => f.required).map((f) => f.key) ?? []
  );
}

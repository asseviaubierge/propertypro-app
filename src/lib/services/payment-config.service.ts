/**
 * PropertyPro - Payment Gateway Configuration Resolver
 *
 * Resolves the active credentials for each payment gateway with a DB-first,
 * env-fallback strategy (mirrors email-config.service.ts):
 *   1. If an admin has saved & enabled a gateway in the database
 *      (SystemSettingsNew.paymentGateways.<id>), those credentials are used.
 *   2. Otherwise the configuration falls back to environment variables, mapped
 *      per field via the gateway registry.
 *
 * The resolved Stripe client is cached briefly to avoid hitting the database on
 * every charge. Call `clearPaymentConfigCache()` after settings change so the
 * next operation picks up the new values immediately.
 */

import Stripe from "stripe";
import connectDB from "@/lib/mongodb";
import {
  PAYMENT_GATEWAYS,
  getGatewayDef,
  getRequiredFieldKeys,
  type GatewayId,
} from "@/lib/payments/gateway-registry";

/** Single Stripe API version used by every server-side Stripe client. */
export const STRIPE_API_VERSION = "2024-06-20";
const CACHE_TTL_MS = 60 * 1000;

export interface ResolvedGatewayConfig {
  providerId: GatewayId;
  enabled: boolean;
  /** Resolved credential values keyed by registry field key. */
  credentials: Record<string, string>;
  /** Where the active credentials came from. */
  source: "database" | "environment";
  /** True when all required fields are present (i.e. usable). */
  configured: boolean;
}

interface ConfigCacheEntry {
  value: ResolvedGatewayConfig;
  expiresAt: number;
}

const configCache = new Map<GatewayId, ConfigCacheEntry>();

// Cached Stripe server client, keyed by the secret it was built with so a key
// change rebuilds it automatically.
let stripeClientCache: { key: string; client: Stripe } | null = null;

/** Read a gateway's stored sub-document from the DB (or null). */
async function getDbGateway(
  providerId: GatewayId
): Promise<Record<string, any> | null> {
  try {
    await connectDB();
    const { default: SystemSettingsNew } = await import(
      "@/models/SystemSettingsNew"
    );
    const settings = await SystemSettingsNew.getSettings();
    const gateway = settings?.paymentGateways?.[providerId];
    // Mongoose subdocs need a plain object for safe reads.
    return gateway
      ? typeof gateway.toObject === "function"
        ? gateway.toObject()
        : gateway
      : null;
  } catch (error) {
    console.error(
      `payment-config: DB read failed for ${providerId}, using env:`,
      error
    );
    return null;
  }
}

/** Build the env-variable based credentials for a gateway. */
export function getEnvCredentials(providerId: GatewayId): Record<string, string> {
  const def = getGatewayDef(providerId);
  const creds: Record<string, string> = {};
  for (const field of def?.fields ?? []) {
    const value = field.env ? process.env[field.env] : undefined;
    if (value) creds[field.key] = value;
  }
  return creds;
}

function hasAllRequired(
  providerId: GatewayId,
  creds: Record<string, string>
): boolean {
  const required = getRequiredFieldKeys(providerId);
  return required.every((key) => Boolean(creds[key]));
}

/**
 * Resolve the active credentials for a single gateway (DB-first, env-fallback).
 * Cached for a short period; pass `force` to bypass the cache.
 */
export async function getGatewayConfig(
  providerId: GatewayId,
  force = false
): Promise<ResolvedGatewayConfig> {
  const cached = configCache.get(providerId);
  if (!force && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const envCreds = getEnvCredentials(providerId);
  let resolved: ResolvedGatewayConfig = {
    providerId,
    enabled: false,
    credentials: envCreds,
    source: "environment",
    configured: hasAllRequired(providerId, envCreds),
  };

  const dbGateway = await getDbGateway(providerId);
  if (dbGateway?.enabled) {
    const def = getGatewayDef(providerId);
    const dbCreds: Record<string, string> = {};
    for (const field of def?.fields ?? []) {
      const value = dbGateway[field.key];
      if (value) dbCreds[field.key] = String(value);
    }

    if (hasAllRequired(providerId, dbCreds)) {
      resolved = {
        providerId,
        enabled: true,
        credentials: dbCreds,
        source: "database",
        configured: true,
      };
    }
  }

  configCache.set(providerId, {
    value: resolved,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return resolved;
}

/**
 * Returns a cached Stripe server client built from the resolved secret key
 * (DB-first, env-fallback). Rebuilds automatically when the key changes.
 */
export async function getStripeClient(force = false): Promise<Stripe> {
  const config = await getGatewayConfig("stripe", force);
  const secretKey = config.credentials.secretKey;

  if (!secretKey) {
    throw new Error(
      "Stripe is not configured. Add a secret key in Admin → Settings → Payments, or set STRIPE_SECRET_KEY."
    );
  }

  if (stripeClientCache && stripeClientCache.key === secretKey) {
    return stripeClientCache.client;
  }

  const client = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
  stripeClientCache = { key: secretKey, client };
  return client;
}

/** Resolve just the webhook signing secret for a gateway (DB-first). */
export async function getStripeWebhookSecret(
  force = false
): Promise<string | undefined> {
  const config = await getGatewayConfig("stripe", force);
  return config.credentials.webhookSecret;
}

export interface PublicGatewayEntry {
  /** True when the gateway is usable for payments (keys present, DB or env). */
  configured: boolean;
  /** Public credential fields (e.g. publishableKey). */
  [field: string]: string | boolean;
}

export interface PublicGatewayConfig {
  defaultProvider: string;
  gateways: Record<string, PublicGatewayEntry>;
}

/**
 * Build the browser-safe payment config: only `isPublic` fields plus the
 * enabled flag per gateway. No secrets are ever included.
 */
export async function getPublicGatewayConfig(): Promise<PublicGatewayConfig> {
  let defaultProvider = "stripe";
  try {
    await connectDB();
    const { default: SystemSettingsNew } = await import(
      "@/models/SystemSettingsNew"
    );
    const settings = await SystemSettingsNew.getSettings();
    if (settings?.paymentGateways?.defaultProvider) {
      defaultProvider = settings.paymentGateways.defaultProvider;
    }
  } catch {
    // fall back to default
  }

  const gateways: PublicGatewayConfig["gateways"] = {};
  for (const def of PAYMENT_GATEWAYS) {
    const config = await getGatewayConfig(def.id);
    const publicValues: Record<string, string> = {};
    for (const field of def.fields) {
      if (field.isPublic && config.credentials[field.key]) {
        publicValues[field.key] = config.credentials[field.key];
      }
    }
    gateways[def.id] = {
      configured: config.configured,
      ...publicValues,
    };
  }

  return { defaultProvider, gateways };
}

/**
 * Resolve the platform payment currency (e.g. "USD", "INR", "NGN") from settings.
 * Used by gateways that bill in a specific currency (Razorpay, Paystack) instead
 * of hardcoding USD. Falls back to USD when settings are unavailable.
 */
export async function getPaymentCurrency(): Promise<string> {
  try {
    await connectDB();
    const { default: SystemSettingsNew } = await import(
      "@/models/SystemSettingsNew"
    );
    const settings = await SystemSettingsNew.getSettings();
    const currency = settings?.payment?.currency;
    return currency ? String(currency).toUpperCase() : "USD";
  } catch {
    return "USD";
  }
}

/** Invalidate cached gateway configs + Stripe client (call after updates). */
export function clearPaymentConfigCache(): void {
  configCache.clear();
  stripeClientCache = null;
}

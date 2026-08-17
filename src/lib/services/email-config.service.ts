/**
 * PropertyPro - Email Configuration Resolver
 *
 * Resolves the active SMTP configuration with a DB-first, env-fallback strategy:
 *   1. If an admin has saved & enabled SMTP settings in the database
 *      (SystemSettingsNew.email), those are used.
 *   2. Otherwise the configuration falls back to environment variables.
 *
 * The resolved config is cached briefly to avoid hitting the database on every
 * outbound email. Call `clearEmailConfigCache()` after settings change so the
 * next send picks up the new values immediately.
 */

import connectDB from "@/lib/mongodb";

export type EmailEncryption = "none" | "tls" | "ssl";

export interface ResolvedEmailConfig {
  host: string;
  port: number;
  secure: boolean; // true => implicit TLS (port 465), false => STARTTLS/none
  encryption: EmailEncryption;
  auth: { user: string; pass: string };
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  /** Where the active config came from. */
  source: "database" | "environment";
  /** True when host + user + pass are all present (i.e. usable). */
  configured: boolean;
}

const CACHE_TTL_MS = 60 * 1000;
let cache: { value: ResolvedEmailConfig; expiresAt: number } | null = null;

/** Map an encryption mode to nodemailer's `secure` flag. */
export function encryptionToSecure(
  encryption: EmailEncryption,
  port: number
): boolean {
  if (encryption === "ssl") return true;
  if (encryption === "tls") return false; // STARTTLS upgrade
  return port === 465; // "none" but classic SSL port still implies secure
}

/**
 * Build the environment-variable based configuration. Supports both the
 * EMAIL_SERVER_* set (used by the main email service) and the legacy SMTP_*
 * set, preferring whichever is populated.
 */
export function getEnvEmailConfig(): ResolvedEmailConfig {
  const host =
    process.env.EMAIL_SERVER_HOST || process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(
    process.env.EMAIL_SERVER_PORT || process.env.SMTP_PORT || "587",
    10
  );
  const user = process.env.EMAIL_SERVER_USER || process.env.SMTP_USER || "";
  const pass =
    process.env.EMAIL_SERVER_PASSWORD || process.env.SMTP_PASS || "";
  const fromEmail =
    process.env.EMAIL_FROM || process.env.SMTP_FROM || user || "";
  const fromName = process.env.APP_NAME || "GESTION E-IMMO";
  const replyTo =
    process.env.SUPPORT_EMAIL || process.env.CONTACT_EMAIL || undefined;

  const encryption: EmailEncryption = port === 465 ? "ssl" : "tls";

  return {
    host,
    port,
    secure: encryptionToSecure(encryption, port),
    encryption,
    auth: { user, pass },
    fromEmail,
    fromName,
    replyTo,
    source: "environment",
    configured: Boolean(host && user && pass),
  };
}

/**
 * Resolve the active email configuration (DB-first, env-fallback).
 * Results are cached for a short period; pass `force` to bypass the cache.
 */
export async function getEmailConfig(
  force = false
): Promise<ResolvedEmailConfig> {
  if (!force && cache && cache.expiresAt > Date.now()) {
    return cache.value;
  }

  const envConfig = getEnvEmailConfig();
  let resolved = envConfig;

  try {
    await connectDB();
    const { default: SystemSettingsNew } = await import(
      "@/models/SystemSettingsNew"
    );
    const settings = await SystemSettingsNew.getSettings();
    const email = settings?.email;

    if (
      email?.enabled &&
      email.smtpHost &&
      email.smtpUser &&
      email.smtpPassword
    ) {
      const port = email.smtpPort || 587;
      const encryption = (email.encryption as EmailEncryption) || "tls";

      resolved = {
        host: email.smtpHost,
        port,
        secure: encryptionToSecure(encryption, port),
        encryption,
        auth: { user: email.smtpUser, pass: email.smtpPassword },
        fromEmail: email.fromEmail || email.smtpUser,
        fromName: email.fromName || envConfig.fromName,
        replyTo: email.adminEmail || undefined,
        source: "database",
        configured: true,
      };
    }
  } catch (error) {
    // DB unreachable or model missing — fall back to env config silently.
    console.error("getEmailConfig: falling back to env config:", error);
  }

  cache = { value: resolved, expiresAt: Date.now() + CACHE_TTL_MS };
  return resolved;
}

/** Invalidate the cached email config (call after settings are updated). */
export function clearEmailConfigCache(): void {
  cache = null;
}

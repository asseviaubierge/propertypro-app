/**
 * PropertyPro - Email (SMTP) Settings API
 *
 * Admin-only endpoints to read and update the system SMTP configuration that is
 * stored in the database (SystemSettingsNew.email). When enabled, this config
 * takes priority over environment variables for all outbound email.
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import {
  AuthenticatedAccessUser,
  withPermissionAndDB,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from "@/lib/api-utils";
import SystemSettingsNew from "@/models/SystemSettingsNew";
import {
  getEmailConfig,
  getEnvEmailConfig,
  clearEmailConfigCache,
  type EmailEncryption,
} from "@/lib/services/email-config.service";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shape returned to the client (password is never sent back).
function serializeEmailSettings(email: any) {
  return {
    enabled: !!email?.enabled,
    smtpHost: email?.smtpHost || "",
    smtpPort: email?.smtpPort ?? 587,
    smtpUser: email?.smtpUser || "",
    hasPassword: !!email?.smtpPassword,
    fromEmail: email?.fromEmail || "",
    fromName: email?.fromName || "",
    adminEmail: email?.adminEmail || "",
    encryption: (email?.encryption as EmailEncryption) || "tls",
  };
}

// ============================================================================
// GET /api/settings/email - read current SMTP settings + active source
// ============================================================================
export const GET = withPermissionAndDB("system_settings")(
  async (_user: AuthenticatedAccessUser) => {
    try {
      let settings = await SystemSettingsNew.getSettings();
      if (!settings) {
        settings = await SystemSettingsNew.createDefaultSettings();
      }

      const resolved = await getEmailConfig(true);
      const env = getEnvEmailConfig();

      return createSuccessResponse({
        settings: serializeEmailSettings(settings.email),
        active: {
          source: resolved.source,
          configured: resolved.configured,
          host: resolved.host,
          port: resolved.port,
          fromEmail: resolved.fromEmail,
          fromName: resolved.fromName,
        },
        env: {
          configured: env.configured,
          host: env.host,
          fromEmail: env.fromEmail,
        },
      });
    } catch (error) {
      console.error("GET /api/settings/email error:", error);
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PUT /api/settings/email - update SMTP settings
// ============================================================================
export const PUT = withPermissionAndDB("system_settings")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const body = await request.json();

      const enabled = !!body.enabled;
      const smtpHost = (body.smtpHost || "").trim();
      const smtpPort = Number(body.smtpPort) || 587;
      const smtpUser = (body.smtpUser || "").trim();
      const smtpPassword =
        typeof body.smtpPassword === "string" ? body.smtpPassword : undefined;
      const fromEmail = (body.fromEmail || "").trim();
      const fromName = (body.fromName || "").trim();
      const adminEmail = (body.adminEmail || "").trim();
      const encryption: EmailEncryption = ["none", "tls", "ssl"].includes(
        body.encryption
      )
        ? body.encryption
        : "tls";

      // Validate emails when provided.
      for (const [label, value] of [
        ["From email", fromEmail],
        ["Admin email", adminEmail],
      ] as const) {
        if (value && !EMAIL_REGEX.test(value)) {
          return createErrorResponse(`${label} is not a valid email`, 400);
        }
      }

      if (smtpPort < 1 || smtpPort > 65535) {
        return createErrorResponse("SMTP port must be between 1 and 65535", 400);
      }

      // When enabling DB config, require the essentials.
      if (enabled) {
        const missing: string[] = [];
        if (!smtpHost) missing.push("SMTP host");
        if (!smtpUser) missing.push("SMTP username");
        if (missing.length > 0) {
          return createErrorResponse(
            `Cannot enable database SMTP: missing ${missing.join(", ")}`,
            400
          );
        }
      }

      let settings = await SystemSettingsNew.getSettings();
      if (!settings) {
        settings = await SystemSettingsNew.createDefaultSettings();
      }

      const existingPassword = settings.email?.smtpPassword || "";

      // Keep the saved password when the field is left blank (so the admin
      // doesn't have to re-enter it on every edit).
      const nextPassword =
        smtpPassword === undefined || smtpPassword === ""
          ? existingPassword
          : smtpPassword;

      // Block enabling when there is no password available at all.
      if (enabled && !nextPassword) {
        return createErrorResponse(
          "Cannot enable database SMTP: missing SMTP password",
          400
        );
      }

      // Set fields individually so unrelated email settings (testMode,
      // dailyLimit) are preserved and we avoid spreading the Mongoose subdoc.
      if (!settings.email) settings.email = {} as any;
      settings.email.enabled = enabled;
      settings.email.smtpHost = smtpHost;
      settings.email.smtpPort = smtpPort;
      settings.email.smtpUser = smtpUser;
      settings.email.smtpPassword = nextPassword;
      settings.email.fromEmail = fromEmail;
      settings.email.fromName = fromName;
      settings.email.adminEmail = adminEmail;
      settings.email.encryption = encryption;
      settings.updatedBy = user.id as any;

      await settings.save();

      // Make the new config take effect immediately for the next send.
      clearEmailConfigCache();

      const resolved = await getEmailConfig(true);

      return createSuccessResponse({
        settings: serializeEmailSettings(settings.email),
        active: {
          source: resolved.source,
          configured: resolved.configured,
        },
        message: "Email settings saved successfully",
      });
    } catch (error) {
      console.error("PUT /api/settings/email error:", error);
      return handleApiError(error);
    }
  }
);

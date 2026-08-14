/**
 * PropertyPro - Email (SMTP) Test API
 *
 * Sends a test email using either the values currently in the admin form
 * (so settings can be verified before saving) or the active resolved config.
 * Admin-only.
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import nodemailer from "nodemailer";
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
  encryptionToSecure,
  type EmailEncryption,
} from "@/lib/services/email-config.service";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildTestEmail(fromName: string, recipient: string) {
  const sentAt = new Date().toLocaleString();
  return {
    subject: `${fromName} - SMTP Test Email`,
    html: `
      <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111827; margin: 0 0 8px;">SMTP Test Successful</h2>
        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 16px;">
          This is a test email confirming that your ${fromName} SMTP configuration
          is working correctly.
        </p>
        <div style="background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 14px 16px; color: #065f46;">
          <strong>✓ Your email settings are configured correctly.</strong>
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          Sent to ${recipient} at ${sentAt}
        </p>
      </div>
    `,
    text: `${fromName} - SMTP Test Email\n\nThis is a test email confirming that your SMTP configuration is working correctly.\n\n✓ Your email settings are configured correctly.\n\nSent to ${recipient} at ${sentAt}`,
  };
}

// ============================================================================
// POST /api/settings/email/test - send a test email
// ============================================================================
export const POST = withPermissionAndDB("system_settings")(
  async (_user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const body = await request.json();
      const to = (body.to || "").trim();

      if (!to || !EMAIL_REGEX.test(to)) {
        return createErrorResponse(
          "A valid recipient email address is required",
          400
        );
      }

      // Active resolved config + saved DB record act as fallbacks for any
      // field the admin left blank in the form.
      const resolved = await getEmailConfig(true);
      const saved = await SystemSettingsNew.getSettings();
      const savedEmail = saved?.email;

      const host = (body.smtpHost || "").trim() || resolved.host;
      const port = Number(body.smtpPort) || resolved.port;
      const encryption: EmailEncryption = ["none", "tls", "ssl"].includes(
        body.encryption
      )
        ? body.encryption
        : resolved.encryption;
      const user = (body.smtpUser || "").trim() || resolved.auth.user;
      // Use the typed password if present, else the saved one, else env.
      const pass =
        typeof body.smtpPassword === "string" && body.smtpPassword.length > 0
          ? body.smtpPassword
          : savedEmail?.smtpPassword || resolved.auth.pass;
      const fromEmail =
        (body.fromEmail || "").trim() || resolved.fromEmail || user;
      const fromName = (body.fromName || "").trim() || resolved.fromName;
      const replyTo = (body.adminEmail || "").trim() || resolved.replyTo;

      if (!host || !user || !pass) {
        return createErrorResponse(
          "SMTP configuration is incomplete. Provide host, username and password.",
          400
        );
      }

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: encryptionToSecure(encryption, port),
        auth: { user, pass },
      });

      // Verify connection/credentials first for a clearer error message.
      try {
        await transporter.verify();
      } catch (verifyError: any) {
        return createErrorResponse(
          `SMTP connection failed: ${
            verifyError?.message || "could not connect / authenticate"
          }`,
          400
        );
      }

      const template = buildTestEmail(fromName || "GESTION E-IMMO", to);
      const info = await transporter.sendMail({
        from: `${fromName || "GESTION E-IMMO"} <${fromEmail}>`,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
        ...(replyTo ? { replyTo } : {}),
      });

      return createSuccessResponse({
        message: `Test email sent to ${to}`,
        messageId: info.messageId,
        sentAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("POST /api/settings/email/test error:", error);
      return createErrorResponse(
        `Failed to send test email: ${error?.message || "unknown error"}`,
        500
      );
    }
  }
);

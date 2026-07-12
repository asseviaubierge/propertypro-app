/**
 * PropertyPro - Payment Gateway Test API
 *
 * Verifies a gateway's credentials using either the values currently in the
 * admin form (so settings can be checked before saving) or the saved/env
 * fallbacks. Admin-only.
 *
 * Stripe is verified by retrieving the account balance (validates the secret
 * key). Other gateways return 400 until their adapters are implemented.
 */

export const dynamic = "force-dynamic";

import Stripe from "stripe";
import { NextRequest } from "next/server";
import {
  AuthenticatedAccessUser,
  withPermissionAndDB,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from "@/lib/api-utils";
import SystemSettingsNew from "@/models/SystemSettingsNew";
import { getGatewayDef, type GatewayId } from "@/lib/payments/gateway-registry";
import {
  getEnvCredentials,
  STRIPE_API_VERSION,
} from "@/lib/services/payment-config.service";
import { verifyCredentials as verifyPayPalCredentials } from "@/lib/services/paypal.service";
import { verifyCredentials as verifyRazorpayCredentials } from "@/lib/services/razorpay.service";
import { verifyCredentials as verifyPaystackCredentials } from "@/lib/services/paystack.service";

// ============================================================================
// POST /api/settings/payment/test - verify a gateway's credentials
// ============================================================================
export const POST = withPermissionAndDB("system_settings")(
  async (_user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const body = await request.json();
      const provider = (body.provider || "stripe") as GatewayId;

      const def = getGatewayDef(provider);
      if (!def) {
        return createErrorResponse("Unknown payment gateway", 400);
      }
      if (!def.implemented) {
        return createErrorResponse(
          `${def.name} testing is not supported yet.`,
          400
        );
      }

      if (provider === "stripe") {
        // Resolve the secret: form value → saved DB value → env fallback.
        const saved = await SystemSettingsNew.getSettings();
        const savedSecret =
          saved?.paymentGateways?.stripe?.secretKey || "";
        const envSecret = getEnvCredentials("stripe").secretKey || "";

        const secretKey =
          typeof body.secretKey === "string" && body.secretKey.length > 0
            ? body.secretKey
            : savedSecret || envSecret;

        if (!secretKey) {
          return createErrorResponse(
            "No Stripe secret key available to test. Enter a secret key first.",
            400
          );
        }

        const stripe = new Stripe(secretKey, {
          apiVersion: STRIPE_API_VERSION,
        });

        try {
          const balance = await stripe.balance.retrieve();
          const currency =
            balance.available?.[0]?.currency?.toUpperCase() ||
            balance.pending?.[0]?.currency?.toUpperCase() ||
            "—";
          const mode = secretKey.startsWith("sk_live_") ? "live" : "test";

          return createSuccessResponse({
            message: `Stripe connection successful (${mode} mode).`,
            provider: "stripe",
            mode,
            currency,
          });
        } catch (stripeError: any) {
          return createErrorResponse(
            `Stripe connection failed: ${
              stripeError?.message || "could not authenticate with the secret key"
            }`,
            400
          );
        }
      }

      if (provider === "paypal") {
        // Resolve each credential: form value → saved DB value → env fallback.
        const saved = await SystemSettingsNew.getSettings();
        const savedPaypal = saved?.paymentGateways?.paypal;
        const envCreds = getEnvCredentials("paypal");

        const clientId =
          (typeof body.clientId === "string" && body.clientId.trim()) ||
          savedPaypal?.clientId ||
          envCreds.clientId ||
          "";
        const clientSecret =
          (typeof body.clientSecret === "string" && body.clientSecret.length > 0
            ? body.clientSecret
            : "") ||
          savedPaypal?.clientSecret ||
          envCreds.clientSecret ||
          "";
        const mode =
          (typeof body.mode === "string" && body.mode.trim()) ||
          savedPaypal?.mode ||
          envCreds.mode ||
          "sandbox";

        if (!clientId || !clientSecret) {
          return createErrorResponse(
            "Enter a PayPal Client ID and Secret to test.",
            400
          );
        }

        try {
          const { mode: resolvedMode } = await verifyPayPalCredentials({
            clientId,
            clientSecret,
            mode,
          });
          return createSuccessResponse({
            message: `PayPal connection successful (${resolvedMode} mode).`,
            provider: "paypal",
            mode: resolvedMode,
          });
        } catch (paypalError: any) {
          return createErrorResponse(
            `PayPal connection failed: ${
              paypalError?.message ||
              "could not authenticate with these credentials"
            }`,
            400
          );
        }
      }

      if (provider === "razorpay") {
        // Resolve each credential: form value → saved DB value → env fallback.
        const saved = await SystemSettingsNew.getSettings();
        const savedRzp = saved?.paymentGateways?.razorpay;
        const envCreds = getEnvCredentials("razorpay");

        const keyId =
          (typeof body.keyId === "string" && body.keyId.trim()) ||
          savedRzp?.keyId ||
          envCreds.keyId ||
          "";
        const keySecret =
          (typeof body.keySecret === "string" && body.keySecret.length > 0
            ? body.keySecret
            : "") ||
          savedRzp?.keySecret ||
          envCreds.keySecret ||
          "";

        if (!keyId || !keySecret) {
          return createErrorResponse(
            "Enter a Razorpay Key ID and Secret to test.",
            400
          );
        }

        try {
          await verifyRazorpayCredentials({ keyId, keySecret });
          const mode = keyId.startsWith("rzp_live_") ? "live" : "test";
          return createSuccessResponse({
            message: `Razorpay connection successful (${mode} mode).`,
            provider: "razorpay",
            mode,
          });
        } catch (rzpError: any) {
          return createErrorResponse(
            `Razorpay connection failed: ${
              rzpError?.message ||
              "could not authenticate with these credentials"
            }`,
            400
          );
        }
      }

      if (provider === "paystack") {
        // Resolve the secret: form value → saved DB value → env fallback.
        const saved = await SystemSettingsNew.getSettings();
        const savedSecret = saved?.paymentGateways?.paystack?.secretKey || "";
        const envSecret = getEnvCredentials("paystack").secretKey || "";

        const secretKey =
          typeof body.secretKey === "string" && body.secretKey.length > 0
            ? body.secretKey
            : savedSecret || envSecret;

        if (!secretKey) {
          return createErrorResponse(
            "Enter a Paystack Secret Key to test.",
            400
          );
        }

        try {
          await verifyPaystackCredentials({ secretKey });
          const mode = secretKey.startsWith("sk_live_") ? "live" : "test";
          return createSuccessResponse({
            message: `Paystack connection successful (${mode} mode).`,
            provider: "paystack",
            mode,
          });
        } catch (paystackError: any) {
          return createErrorResponse(
            `Paystack connection failed: ${
              paystackError?.message ||
              "could not authenticate with this secret key"
            }`,
            400
          );
        }
      }

      return createErrorResponse(
        `Testing for ${def.name} is not supported yet.`,
        400
      );
    } catch (error) {
      console.error("POST /api/settings/payment/test error:", error);
      return handleApiError(error);
    }
  }
);

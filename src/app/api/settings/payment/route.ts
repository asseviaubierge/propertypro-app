/**
 * PropertyPro - Payment Gateway Settings API
 *
 * Admin-only endpoints to read and update the payment gateway credentials
 * stored in the database (SystemSettingsNew.paymentGateways). When a gateway is
 * enabled, its DB credentials take priority over environment variables for all
 * payment processing. Secret values are never returned to the client.
 *
 * The set of gateways and their fields is driven entirely by the registry in
 * src/lib/payments/gateway-registry.ts, so adding a gateway needs no changes here.
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
  PAYMENT_GATEWAYS,
  getGatewayDef,
  getRequiredFieldKeys,
  type GatewayId,
} from "@/lib/payments/gateway-registry";
import {
  getGatewayConfig,
  getEnvCredentials,
  clearPaymentConfigCache,
} from "@/lib/services/payment-config.service";

// Browser-safe view of one gateway: text values inline, secrets as booleans.
function serializeGateway(providerId: GatewayId, dbGateway: any) {
  const def = getGatewayDef(providerId)!;
  const out: Record<string, any> = { enabled: !!dbGateway?.enabled };
  const secretSet: Record<string, boolean> = {};
  for (const field of def.fields) {
    if (field.type === "secret") {
      secretSet[field.key] = !!dbGateway?.[field.key];
    } else {
      out[field.key] = dbGateway?.[field.key] || "";
    }
  }
  out.secretSet = secretSet;
  return out;
}

function envConfigured(providerId: GatewayId): boolean {
  const creds = getEnvCredentials(providerId);
  return getRequiredFieldKeys(providerId).every((k) => Boolean(creds[k]));
}

async function buildResponse(settings: any) {
  const gateways: Record<string, any> = {};
  const active: Record<string, any> = {};
  const env: Record<string, any> = {};

  for (const def of PAYMENT_GATEWAYS) {
    const dbGateway = settings?.paymentGateways?.[def.id];
    gateways[def.id] = serializeGateway(def.id, dbGateway);
    const resolved = await getGatewayConfig(def.id, true);
    active[def.id] = {
      source: resolved.source,
      configured: resolved.configured,
    };
    env[def.id] = { configured: envConfigured(def.id) };
  }

  return {
    defaultProvider: settings?.paymentGateways?.defaultProvider || "stripe",
    gateways,
    active,
    env,
  };
}

// ============================================================================
// GET /api/settings/payment - read gateway settings + active source
// ============================================================================
export const GET = withPermissionAndDB("system_settings")(
  async (_user: AuthenticatedAccessUser) => {
    try {
      let settings = await SystemSettingsNew.getSettings();
      if (!settings) {
        settings = await SystemSettingsNew.createDefaultSettings();
      }
      return createSuccessResponse(await buildResponse(settings));
    } catch (error) {
      console.error("GET /api/settings/payment error:", error);
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PUT /api/settings/payment - update gateway credentials
// ============================================================================
export const PUT = withPermissionAndDB("system_settings")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const body = await request.json();
      const incoming = body?.gateways ?? {};

      let settings = await SystemSettingsNew.getSettings();
      if (!settings) {
        settings = await SystemSettingsNew.createDefaultSettings();
      }

      for (const def of PAYMENT_GATEWAYS) {
        const patch = incoming[def.id];
        if (!patch) continue; // gateway not present in this submission

        const existing = settings.paymentGateways?.[def.id] ?? {};
        const wantsEnabled = !!patch.enabled;

        // Resolve the final value of every field (secrets keep stored value
        // when left blank, mirroring the SMTP password behaviour).
        const resolved: Record<string, string> = {};
        for (const field of def.fields) {
          const submitted = patch[field.key];
          if (field.type === "secret") {
            resolved[field.key] =
              typeof submitted === "string" && submitted.length > 0
                ? submitted
                : existing[field.key] || "";
          } else {
            resolved[field.key] =
              typeof submitted === "string"
                ? submitted.trim()
                : existing[field.key] || "";
          }
        }

        // Guard rails when enabling a gateway.
        if (wantsEnabled) {
          if (!def.implemented) {
            return createErrorResponse(
              `${def.name} is not available yet and cannot be enabled.`,
              400
            );
          }
          const missing = getRequiredFieldKeys(def.id).filter(
            (k) => !resolved[k]
          );
          if (missing.length > 0) {
            const labels = missing.map(
              (k) => def.fields.find((f) => f.key === k)?.label || k
            );
            return createErrorResponse(
              `Cannot enable ${def.name}: missing ${labels.join(", ")}`,
              400
            );
          }
        }

        // Persist using dot paths so missing nested objects are created.
        settings.set(`paymentGateways.${def.id}.enabled`, wantsEnabled);
        for (const field of def.fields) {
          settings.set(
            `paymentGateways.${def.id}.${field.key}`,
            resolved[field.key]
          );
        }
      }

      // Default provider (must be a known, implemented gateway).
      if (typeof body.defaultProvider === "string") {
        const target = getGatewayDef(body.defaultProvider);
        if (!target || !target.implemented) {
          return createErrorResponse("Invalid default gateway", 400);
        }
        settings.set("paymentGateways.defaultProvider", body.defaultProvider);
      }

      settings.updatedBy = user.id as any;
      await settings.save();

      // New credentials take effect on the next charge.
      clearPaymentConfigCache();

      return createSuccessResponse({
        ...(await buildResponse(settings)),
        message: "Payment settings saved successfully",
      });
    } catch (error) {
      console.error("PUT /api/settings/payment error:", error);
      return handleApiError(error);
    }
  }
);

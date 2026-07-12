/**
 * PropertyPro - Public Payment Config API
 *
 * Returns browser-safe payment gateway config (publishable keys + enabled
 * flags) so the client can initialize the active gateway at runtime instead of
 * relying on build-time NEXT_PUBLIC_* env vars. No secrets are ever returned.
 *
 * Available to any authenticated user (tenants need the publishable key to pay).
 */

export const dynamic = "force-dynamic";

import {
  AuthenticatedAccessUser,
  withAccessAndDB,
  createSuccessResponse,
  handleApiError,
} from "@/lib/api-utils";
import { getPublicGatewayConfig } from "@/lib/services/payment-config.service";

// ============================================================================
// GET /api/payments/config - public (non-secret) gateway config for the browser
// ============================================================================
export const GET = withAccessAndDB({})(
  async (_user: AuthenticatedAccessUser) => {
    try {
      const config = await getPublicGatewayConfig();
      return createSuccessResponse(config);
    } catch (error) {
      console.error("GET /api/payments/config error:", error);
      return handleApiError(error);
    }
  }
);

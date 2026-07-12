/**
 * PropertyPro - Session Debug API
 * Debug endpoint to check current session and user role
 */

import { NextRequest } from "next/server";
import {
  withPermissionAndDB,
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/api-utils";

export const GET = withPermissionAndDB("profile_management")(
  async (user: any, _request: NextRequest) => {
    try {
      return createSuccessResponse({
        session: { user },
        user,
        isAuthenticated: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Session debug error:", error);
      return createErrorResponse("Failed to get session info", 500);
    }
  }
);

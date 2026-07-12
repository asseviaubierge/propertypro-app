/**
 * PropertyPro - Google Calendar OAuth Callback API
 * Handle Google Calendar OAuth callback and token exchange
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { User } from "@/models";
import {
  createErrorResponse,
  handleApiError,
  withDatabase,
} from "@/lib/api-utils";
// import { googleCalendarService } from "@/lib/services/google-calendar.service";

// ============================================================================
// GET /api/calendar/google/callback - Handle OAuth callback
// ============================================================================
export const GET = withDatabase(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // Contains user ID
    const error = searchParams.get("error");

    if (error) {
      console.error("Google OAuth error:", error);
      return redirect("/dashboard/calendar?error=oauth_failed");
    }

    if (!code || !state) {
      return createErrorResponse("Missing authorization code or state", 400);
    }

    // TODO: Re-enable when google-calendar.service is implemented
    return redirect("/dashboard/calendar?error=integration_disabled");
    /*
    try {
      // Exchange code for tokens
      const tokens = await googleCalendarService.exchangeCodeForTokens(code);

      // Store tokens in user record
      await User.findByIdAndUpdate(state, {
        $set: {
          "integrations.googleCalendar": {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiryDate: tokens.expiry_date
              ? new Date(tokens.expiry_date)
              : null,
            connected: true,
            connectedAt: new Date(),
          },
        },
      });

      // Redirect to calendar page with success message
      return redirect("/dashboard/calendar?success=google_connected");
    } catch (error) {
      console.error("Token exchange failed:", error);
      return redirect("/dashboard/calendar?error=token_exchange_failed");
    }
    */
  } catch (error) {
    console.error("OAuth callback error:", error);
    return redirect("/dashboard/calendar?error=callback_failed");
  }
});

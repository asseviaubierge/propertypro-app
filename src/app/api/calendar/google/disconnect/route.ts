/**
 * PropertyPro - Google Calendar Disconnect API
 * Disconnect Google Calendar integration
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { User } from "@/models";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";

// ============================================================================
// POST /api/calendar/google/disconnect - Disconnect Google Calendar
// ============================================================================
export const POST = withPermissionAndDB("profile_management")(
  async (user: any, request: NextRequest) => {
  try {
    // Remove Google Calendar integration data from user
    await User.findByIdAndUpdate(user.id, {
      $unset: {
        "integrations.googleCalendar": 1,
      },
    });

    return createSuccessResponse(
      { disconnected: true },
      "Google Calendar disconnected successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
  }
);

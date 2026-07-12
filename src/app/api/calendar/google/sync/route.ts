/**
 * PropertyPro - Google Calendar Sync API
 * Handle bidirectional sync between PropertyPro and Google Calendar
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { User } from "@/models";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
  parseRequestBody,
} from "@/lib/api-utils";
// import { googleCalendarService } from "@/lib/services/google-calendar.service";
import { z } from "zod";

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const syncSchema = z.object({
  calendarId: z.string().min(1, "Calendar ID is required"),
  direction: z.enum(["import", "export", "bidirectional"]),
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
});

// ============================================================================
// POST /api/calendar/google/sync - Sync events with Google Calendar
// ============================================================================
export const POST = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error ?? "Invalid request body", 400);
    }

    // Validate request body
    const validation = syncSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        `Validation failed: ${validation.error.errors
          .map((e) => e.message)
          .join(", ")}`,
        400,
      );
    }

    const { calendarId, direction, timeMin, timeMax } = validation.data;

    // TODO: Re-enable when google-calendar.service is implemented
    return createErrorResponse(
      "Google Calendar integration is temporarily disabled",
      503,
    );
    /*
    // Get user's Google Calendar tokens
    const user = await User.findById(session.user.id);
    if (!user?.integrations?.googleCalendar?.accessToken) {
      return createErrorResponse("Google Calendar not connected", 400);
    }

    // Set up Google Calendar service with user's tokens
    googleCalendarService.setCredentials({
      access_token: user.integrations.googleCalendar.accessToken,
      refresh_token: user.integrations.googleCalendar.refreshToken,
      expiry_date: user.integrations.googleCalendar.expiryDate?.getTime(),
    });

    const timeMinDate = timeMin ? new Date(timeMin) : new Date();
    const timeMaxDate = timeMax ? new Date(timeMax) : undefined;

    let result;

    switch (direction) {
      case "import":
        result = await googleCalendarService.importEvents(
          calendarId,
          session.user.id,
          timeMinDate,
          timeMaxDate
        );
        break;

      case "export":
        // Get PropertyPro events to export
        const { Event } = await import("@/models");
        const events = await Event.find({
          createdBy: session.user.id,
          $or: [
            { "metadata.googleEventId": { $exists: false } },
            { "metadata.googleEventId": null },
          ],
          startDate: {
            $gte: timeMinDate,
            ...(timeMaxDate && { $lte: timeMaxDate }),
          },
        });

        result = await googleCalendarService.exportEvents(calendarId, events);
        break;

      case "bidirectional":
        result = await googleCalendarService.syncEvents(
          calendarId,
          session.user.id,
          timeMinDate,
          timeMaxDate
        );
        break;

      default:
        return createErrorResponse("Invalid sync direction", 400);
    }

    return createSuccessResponse(result, "Sync completed successfully");
    */
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// GET /api/calendar/google/sync - Get sync status
// ============================================================================
export const GET = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    // Get user's Google Calendar integration status
    const currentUser = await User.findById(user.id);
    const integration = currentUser?.integrations?.googleCalendar;

    if (!integration?.connected) {
      return createSuccessResponse(
        {
          connected: false,
          lastSync: null,
          calendars: [],
        },
        "Google Calendar not connected",
      );
    }

    // TODO: Re-enable when google-calendar.service is implemented
    return createSuccessResponse(
      {
        connected: false,
        lastSync: null,
        calendars: [],
        error: "Google Calendar integration temporarily disabled",
      },
      "Google Calendar integration temporarily disabled",
    );
    /*
    // Set up Google Calendar service with user's tokens
    googleCalendarService.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken,
      expiry_date: integration.expiryDate?.getTime(),
    });

    try {
      // Get user's calendar list
      const calendars = await googleCalendarService.getCalendarList();

      return createSuccessResponse(
        {
          connected: true,
          lastSync: integration.lastSync || null,
          calendars,
          connectedAt: integration.connectedAt,
        },
        "Sync status retrieved successfully"
      );
    } catch (error) {
      console.error("Failed to fetch calendar list:", error);

      // If token is expired, mark as disconnected
      if (
        error.message.includes("invalid_grant") ||
        error.message.includes("unauthorized")
      ) {
        await User.findByIdAndUpdate(session.user.id, {
          $set: {
            "integrations.googleCalendar.connected": false,
          },
        });

        return createSuccessResponse(
          {
            connected: false,
            lastSync: null,
            calendars: [],
            error: "Token expired, please reconnect",
          },
          "Google Calendar token expired"
        );
      }

      throw error;
    }
    */
  } catch (error) {
    return handleApiError(error);
  }
});

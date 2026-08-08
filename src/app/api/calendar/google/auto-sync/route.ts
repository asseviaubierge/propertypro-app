/**
 * PropertyPro - Google Calendar Auto-Sync API
 * Manage automatic sync settings for Google Calendar
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
import { z } from "zod";

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const autoSyncSchema = z.object({
  enabled: z.boolean(),
  calendarId: z.string().optional(),
  syncDirection: z.enum(["import", "export", "bidirectional"]).optional(),
  syncInterval: z.number().min(5).max(1440).optional(), // 5 minutes to 24 hours
});

// ============================================================================
// POST /api/calendar/google/auto-sync - Update auto-sync settings
// ============================================================================
export const POST = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error ?? "Requête invalide", 400);
    }

    // Validate request body
    const validation = autoSyncSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        `Validation failed: ${validation.error.errors
          .map((e) => e.message)
          .join(", ")}`,
        400,
      );
    }

    const { enabled, calendarId, syncDirection, syncInterval } =
      validation.data;

    // Check if user has Google Calendar connected
    const currentUser = await User.findById(user.id);
    if (!currentUser?.integrations?.googleCalendar?.connected) {
      return createErrorResponse("Google Agenda n’est pas connecté", 400);
    }

    // Update auto-sync settings
    const updateData: any = {
      "integrations.googleCalendar.autoSync": enabled,
    };

    if (calendarId) {
      updateData["integrations.googleCalendar.selectedCalendarId"] = calendarId;
    }

    if (syncDirection) {
      updateData["integrations.googleCalendar.syncDirection"] = syncDirection;
    }

    if (syncInterval) {
      updateData["integrations.googleCalendar.syncInterval"] = syncInterval;
    }

    await User.findByIdAndUpdate(user.id, {
      $set: updateData,
    });

    return createSuccessResponse(
      {
        autoSync: enabled,
        calendarId:
          calendarId ??
          currentUser.integrations.googleCalendar.selectedCalendarId,
        syncDirection:
          syncDirection ??
          currentUser.integrations.googleCalendar.syncDirection ??
          "bidirectional",
        syncInterval:
          syncInterval ??
          currentUser.integrations.googleCalendar.syncInterval ??
          15,
      },
      "Auto-sync settings updated successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// GET /api/calendar/google/auto-sync - Get auto-sync settings
// ============================================================================
export const GET = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    // Get user's auto-sync settings
    const currentUser = await User.findById(user.id);
    const integration = currentUser?.integrations?.googleCalendar;

    if (!integration?.connected) {
      return createErrorResponse("Google Agenda n’est pas connecté", 400);
    }

    return createSuccessResponse(
      {
        autoSync: integration.autoSync ?? false,
        calendarId: integration.selectedCalendarId ?? null,
        syncDirection: integration.syncDirection ?? "bidirectional",
        syncInterval: integration.syncInterval ?? 15,
        lastSync: integration.lastSync ?? null,
      },
      "Auto-sync settings retrieved successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

/**
 * PropertyPro - Calendar Settings API
 * Manage user calendar preferences and settings
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { CalendarSettings } from "@/models";
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

const calendarSettingsSchema = z.object({
  defaultView: z
    .enum(["dayGridMonth", "timeGridWeek", "timeGridDay", "listWeek"])
    .optional(),
  weekends: z.boolean().optional(),
  firstDay: z.number().min(0).max(6).optional(),
  timezone: z.string().optional(),

  businessHours: z
    .object({
      enabled: z.boolean().optional(),
      startTime: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .optional(),
      endTime: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .optional(),
      daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
    })
    .optional(),

  slotDuration: z
    .string()
    .regex(/^[0-9]{2}:[0-5][0-9]$/)
    .optional(),
  snapDuration: z
    .string()
    .regex(/^[0-9]{2}:[0-5][0-9]$/)
    .optional(),
  defaultEventDuration: z
    .string()
    .regex(/^[0-9]{2}:[0-5][0-9]$/)
    .optional(),

  defaultEventType: z.string().optional(),
  defaultEventPriority: z.string().optional(),
  defaultReminders: z.array(z.number().min(0)).optional(),

  emailNotifications: z
    .object({
      invitations: z.boolean().optional(),
      reminders: z.boolean().optional(),
      updates: z.boolean().optional(),
      cancellations: z.boolean().optional(),
    })
    .optional(),

  showWeekNumbers: z.boolean().optional(),
  showDeclinedEvents: z.boolean().optional(),
  eventLimit: z.number().min(1).max(10).optional(),

  eventColors: z.record(z.string()).optional(),
});

// ============================================================================
// GET /api/calendar/settings - Get user calendar settings
// ============================================================================
export const GET = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    // Get or create settings for user
    let settings = await CalendarSettings.findOne({ userId: user.id });
    if (!settings) {
      settings = await CalendarSettings.create({ userId: user.id });
    }

    return createSuccessResponse(
      settings,
      "Paramètres du calendrier récupérés avec succès",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// PUT /api/calendar/settings - Update user calendar settings
// ============================================================================
export const PUT = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error ?? "Requête invalide", 400);
    }

    // Validate request body
    const validation = calendarSettingsSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        `Validation failed: ${validation.error.errors
          .map((e) => e.message)
          .join(", ")}`,
        400,
      );
    }

    const updateData = validation.data;

    // Get or create settings for user
    let settings = await CalendarSettings.findOne({ userId: user.id });

    if (!settings) {
      settings = await CalendarSettings.create({
        userId: user.id,
        ...updateData,
      });
    } else {
      // Update existing settings
      Object.keys(updateData).forEach((key) => {
        if (updateData[key as keyof typeof updateData] !== undefined) {
          settings.set(key, updateData[key as keyof typeof updateData]);
        }
      });
      await settings.save();
    }

    return createSuccessResponse(
      settings,
      "Paramètres du calendrier mis à jour avec succès",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// PATCH /api/calendar/settings - Update specific setting
// ============================================================================
export const PATCH = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error ?? "Requête invalide", 400);
    }

    const { path, value } = body;

    if (!path || value === undefined) {
      return createErrorResponse("Path and value are required", 400);
    }

    // Get or create settings for user
    let settings = await CalendarSettings.findOne({ userId: user.id });
    if (!settings) {
      settings = await CalendarSettings.create({ userId: user.id });
    }

    // Update specific setting
    if (!settings) {
      return createErrorResponse("Unable to create calendar settings", 500);
    }
    await (settings as any).updateSetting(path, value);

    return createSuccessResponse(
      settings,
      "Paramètre du calendrier mis à jour avec succès",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// DELETE /api/calendar/settings - Reset settings to defaults
// ============================================================================
export const DELETE = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    // Get or create settings for user
    let settings = await CalendarSettings.findOne({ userId: user.id });
    if (!settings) {
      settings = await CalendarSettings.create({ userId: user.id });
    }

    // Reset to defaults
    if (!settings) {
      return createErrorResponse("Unable to create calendar settings", 500);
    }
    await (settings as any).resetToDefaults();

    return createSuccessResponse(
      settings,
      "Paramètres du calendrier réinitialisés",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

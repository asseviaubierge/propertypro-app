/**
 * PropertyPro - Notification Settings API Routes
 * CRUD operations for user notification settings using separate collection
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { NotificationSettings } from "@/models";
import {
  withPermissionAndDB,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  parseRequestBody,
} from "@/lib/api-utils";
import { notificationSettingsSchema } from "@/lib/validations";
import {
  rateLimit,
  rateLimitConfigs,
  createRateLimitResponse,
  addSecurityHeaders,
  sanitizeInput,
  userBasedKeyGenerator,
} from "@/lib/rate-limit";

// ============================================================================
// GET /api/settings/notifications - Get user notification settings
// ============================================================================
export const GET = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const userId = user.id;

    // Find existing notification settings
    let notificationSettings = await NotificationSettings.findByUserId(userId);

    // If no settings exist, create default settings
    if (!notificationSettings) {
      notificationSettings =
        await NotificationSettings.createDefaultNotifications(userId);
    }

    const response = createSuccessResponse({
      settings: notificationSettings,
      message: "Notification settings retrieved successfully",
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Get notification settings error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// PUT /api/settings/notifications - Update notification settings
// ============================================================================
export const PUT = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const userId = user.id;

    // Rate limiting
    const limiter = rateLimit({
      ...rateLimitConfigs.settingsUpdate,
      keyGenerator: () => userBasedKeyGenerator(userId),
    });

    const rateLimitResult = limiter.check(request);
    if (!rateLimitResult.success) {
      return createRateLimitResponse(
        "Too many notification updates. Please try again later.",
        rateLimitResult.resetTime,
      );
    }

    // Parse and validate request body
    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error ?? "Invalid request body", 400);
    }

    // Sanitize input data
    const sanitizedBody = sanitizeInput(body);

    // Validate the request body
    const validation = notificationSettingsSchema.safeParse(sanitizedBody);
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => e.message).join(", ");
      return createErrorResponse(`Validation failed: ${errors}`, 400);
    }

    const notificationData = validation.data;

    // Find existing settings
    let notificationSettings = await NotificationSettings.findByUserId(userId);

    if (!notificationSettings) {
      // Create new settings if they don't exist
      notificationSettings = await NotificationSettings.create({
        userId,
        ...notificationData,
        createdBy: userId,
      });
    } else {
      // Update existing settings
      await notificationSettings.updateNotifications({
        ...notificationData,
        updatedBy: userId,
      });
    }

    const response = createSuccessResponse({
      settings: notificationSettings,
      message: "Notification settings updated successfully",
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Update notification settings error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// PATCH /api/settings/notifications - Partial update notification settings
// ============================================================================
export const PATCH = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const userId = user.id;

    // Rate limiting
    const limiter = rateLimit({
      ...rateLimitConfigs.settingsUpdate,
      keyGenerator: () => userBasedKeyGenerator(userId),
    });

    const rateLimitResult = limiter.check(request);
    if (!rateLimitResult.success) {
      return createRateLimitResponse(
        "Too many notification updates. Please try again later.",
        rateLimitResult.resetTime,
      );
    }

    // Parse and validate request body
    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error ?? "Invalid request body", 400);
    }

    // Sanitize input data
    const sanitizedBody = sanitizeInput(body);

    // Validate the request body (partial validation)
    const validation = notificationSettingsSchema
      .partial()
      .safeParse(sanitizedBody);
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => e.message).join(", ");
      return createErrorResponse(`Validation failed: ${errors}`, 400);
    }

    const notificationData = validation.data;

    // Find existing settings
    let notificationSettings = await NotificationSettings.findByUserId(userId);

    if (!notificationSettings) {
      // Create new settings if they don't exist
      notificationSettings =
        await NotificationSettings.createDefaultNotifications(userId);
      // Apply the partial update
      await notificationSettings.updateNotifications({
        ...notificationData,
        createdBy: userId,
      });
    } else {
      // Update existing settings
      await notificationSettings.updateNotifications({
        ...notificationData,
        updatedBy: userId,
      });
    }

    const response = createSuccessResponse({
      settings: notificationSettings,
      message: "Notification settings updated successfully",
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Patch notification settings error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// DELETE /api/settings/notifications - Reset notification settings to defaults
// ============================================================================
export const DELETE = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const userId = user.id;

    // Rate limiting
    const limiter = rateLimit({
      ...rateLimitConfigs.settingsUpdate,
      keyGenerator: () => userBasedKeyGenerator(userId),
    });

    const rateLimitResult = limiter.check(request);
    if (!rateLimitResult.success) {
      return createRateLimitResponse(
        "Too many notification updates. Please try again later.",
        rateLimitResult.resetTime,
      );
    }

    // Find and deactivate existing settings
    const existingSettings = await NotificationSettings.findByUserId(userId);
    if (existingSettings) {
      existingSettings.isActive = false;
      await existingSettings.save();
    }

    // Create new default settings
    const defaultSettings =
      await NotificationSettings.createDefaultNotifications(userId);
    defaultSettings.createdBy = userId;
    await defaultSettings.save();

    const response = createSuccessResponse({
      settings: defaultSettings,
      message: "Notification settings reset to defaults successfully",
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Delete notification settings error:", error);
    return handleApiError(error);
  }
});

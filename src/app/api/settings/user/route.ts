/**
 * PropertyPro - User Settings API Routes
 * CRUD operations for user-specific settings and preferences
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Settings } from "@/models";
import {
  withPermissionAndDB,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  parseRequestBody,
} from "@/lib/api-utils";
import { userSettingsSchema, profileUpdateSchema } from "@/lib/validations";
import {
  rateLimit,
  rateLimitConfigs,
  createRateLimitResponse,
  addSecurityHeaders,
  sanitizeInput,
  userBasedKeyGenerator,
} from "@/lib/rate-limit";

// ============================================================================
// GET /api/settings/user - Get user settings
// ============================================================================
export const GET = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const userId = user.id;

    // Try to find existing settings
    let userSettings;

    try {
      userSettings = await Settings.findByUserId(userId);
    } catch (validationError) {
      console.warn(
        "Settings validation error, recreating defaults:",
        validationError,
      );
      // If there's a validation error, delete corrupted settings and recreate
      await Settings.deleteMany({ userId, type: "user" });
      userSettings = null;
    }

    // If no settings exist or they were corrupted, create default settings
    if (!userSettings) {
      userSettings = await Settings.createDefaultSettings(userId);
    }

    return createSuccessResponse({
      settings: userSettings,
      message: "User settings retrieved successfully",
    });
  } catch (error) {
    console.error("Get user settings error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// PUT /api/settings/user - Update user settings
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
        "Too many settings updates. Please try again later.",
        rateLimitResult.resetTime,
      );
    }

    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error ?? "Invalid request body", 400);
    }

    // Sanitize input data
    const sanitizedBody = sanitizeInput(body);

    // Validate the request body
    const validation = userSettingsSchema.safeParse(sanitizedBody);
    if (!validation.success) {
      const errors = validation.error.issues.map((e: any) => e.message).join(", ");
      return createErrorResponse(`Validation failed: ${errors}`, 400);
    }

    const settingsData = validation.data;

    // Find existing settings or create new ones
    let userSettings = await Settings.findByUserId(userId);

    if (!userSettings) {
      userSettings = await Settings.createDefaultSettings(userId);
    }

    // Update specific sections if provided
    if (settingsData.notifications) {
      await (userSettings as any).updateNotifications?.(settingsData.notifications);
    }

    if (settingsData.security) {
      await (userSettings as any).updateSecurity?.(settingsData.security);
    }

    if (settingsData.display) {
      await (userSettings as any).updateDisplay?.(settingsData.display);
    }

    if (settingsData.privacy) {
      await (userSettings as any).updatePrivacy?.(settingsData.privacy);
    }

    // Reload the updated settings
    const updatedSettings = await Settings.findByUserId(userId);

    const response = createSuccessResponse({
      settings: updatedSettings,
      message: "User settings updated successfully",
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Update user settings error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// PATCH /api/settings/user - Partial update of user settings
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
        "Too many settings updates. Please try again later.",
        rateLimitResult.resetTime,
      );
    }

    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error ?? "Invalid request body", 400);
    }

    // Sanitize input data
    const sanitizedBody = sanitizeInput(body);

    // Extract the section and data from the request
    const { section, data } = sanitizedBody;

    if (!section || !data) {
      return createErrorResponse("Section and data are required", 400);
    }

    // Find existing settings or create new ones
    let userSettings = await Settings.findByUserId(userId);

    if (!userSettings) {
      userSettings = await Settings.createDefaultSettings(userId);
    }

    // Update the specific section
    switch (section) {
      case "profile":
        const profileValidation = profileUpdateSchema.safeParse(data);
        if (!profileValidation.success) {
          const errors = profileValidation.error.issues
            .map((e: any) => e.message)
            .join(", ");
          return createErrorResponse(`Validation failed: ${errors}`, 400);
        }
        await (userSettings as any).updateProfile?.(profileValidation.data);
        break;

      case "notifications":
        const notificationValidation =
          userSettingsSchema.shape.notifications!.safeParse(data);
        if (!notificationValidation.success) {
          const errors = notificationValidation.error.issues
            .map((e: any) => e.message)
            .join(", ");
          return createErrorResponse(`Validation failed: ${errors}`, 400);
        }
        await (userSettings as any).updateNotifications?.(notificationValidation.data);
        break;

      case "security":
        const securityValidation =
          userSettingsSchema.shape.security!.safeParse(data);
        if (!securityValidation.success) {
          const errors = securityValidation.error.issues
            .map((e: any) => e.message)
            .join(", ");
          return createErrorResponse(`Validation failed: ${errors}`, 400);
        }
        await (userSettings as any).updateSecurity?.(securityValidation.data);
        break;

      case "display":
        // Enhanced validation for display settings
        const displayValidation =
          userSettingsSchema.shape.display!.safeParse(data);
        if (!displayValidation.success) {
          const errors = displayValidation.error.issues
            .map((e: any) => `${e.path.join(".")}: ${e.message}`)
            .join(", ");

          // Log validation errors for debugging
          console.warn(
            `Display settings validation failed for user ${userId}:`,
            {
              errors: displayValidation.error.issues,
              data: JSON.stringify(data, null, 2),
            },
          );

          return createErrorResponse(`Validation failed: ${errors}`, 400);
        }

        // Additional business logic validation
        const validatedData = displayValidation.data;

        // Validate color scheme values
        if (validatedData.colorScheme) {
          const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
          const { primary, secondary, accent } = validatedData.colorScheme;

          if (
            !colorRegex.test(primary) ||
            !colorRegex.test(secondary) ||
            !colorRegex.test(accent)
          ) {
            return createErrorResponse(
              "Invalid color format. Colors must be valid hex codes.",
              400,
            );
          }
        }

        // Validate items per page range
        if (
          validatedData.itemsPerPage &&
          (validatedData.itemsPerPage < 10 || validatedData.itemsPerPage > 100)
        ) {
          return createErrorResponse(
            "Items per page must be between 10 and 100.",
            400,
          );
        }

        // Store previous settings for audit log
        const previousSettings = userSettings.display ?? {};

        // Update display settings
        await (userSettings as any).updateDisplay?.(validatedData);

        // Audit log for display settings changes
        console.info(`Display settings updated for user ${userId}:`, {
          userId,
          timestamp: new Date().toISOString(),
          changes: {
            previous: previousSettings,
            updated: validatedData,
          },
          userAgent: request.headers.get("user-agent"),
          ip:
            request.headers.get("x-forwarded-for") ??
            request.headers.get("x-real-ip"),
        });

        break;

      case "privacy":
        const privacyValidation =
          userSettingsSchema.shape.privacy!.safeParse(data);
        if (!privacyValidation.success) {
          const errors = privacyValidation.error.issues
            .map((e: any) => e.message)
            .join(", ");
          return createErrorResponse(`Validation failed: ${errors}`, 400);
        }
        await (userSettings as any).updatePrivacy?.(privacyValidation.data);
        break;

      default:
        return createErrorResponse("Invalid settings section", 400);
    }

    // Reload the updated settings
    const updatedSettings = await Settings.findByUserId(userId);

    const response = createSuccessResponse({
      settings: updatedSettings,
      message: `${section} settings updated successfully`,
    });

    return addSecurityHeaders(response);
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// DELETE /api/settings/user - Reset user settings to defaults
// ============================================================================
export const DELETE = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const userId = user.id;

    // Rate limiting (more restrictive for delete operations)
    const limiter = rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3, // Only 3 resets per hour
      keyGenerator: () => userBasedKeyGenerator(userId),
    });

    const rateLimitResult = limiter.check(request);
    if (!rateLimitResult.success) {
      return createRateLimitResponse(
        "Too many reset attempts. Please try again later.",
        rateLimitResult.resetTime,
      );
    }

    // Delete existing settings
    await Settings.deleteMany({ userId, type: "user" });

    // Create new default settings
    const defaultSettings = await Settings.createDefaultSettings(userId);

    const response = createSuccessResponse({
      settings: defaultSettings,
      message: "User settings reset to defaults successfully",
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Reset user settings error:", error);
    return handleApiError(error);
  }
});

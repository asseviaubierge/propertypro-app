/**
 * PropertyPro - Privacy Settings API Routes
 * CRUD operations for user privacy settings using separate collection
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { PrivacySettings } from "@/models";
import {
  withPermissionAndDB,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  parseRequestBody,
} from "@/lib/api-utils";
import { privacySettingsSchema } from "@/lib/validations";
import {
  rateLimit,
  rateLimitConfigs,
  createRateLimitResponse,
  addSecurityHeaders,
  sanitizeInput,
  userBasedKeyGenerator,
} from "@/lib/rate-limit";

// ============================================================================
// GET /api/settings/privacy - Get user privacy settings
// ============================================================================
export const GET = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const userId = user.id;

    // Find existing privacy settings
    let privacySettings = await PrivacySettings.findByUserId(userId);

    // If no settings exist, create default settings
    if (!privacySettings) {
      privacySettings = await PrivacySettings.createDefaultPrivacy(userId);
    }

    const response = createSuccessResponse({
      settings: privacySettings,
      message: "Privacy settings retrieved successfully",
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Get privacy settings error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// PUT /api/settings/privacy - Update privacy settings
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
        "Too many privacy updates. Please try again later.",
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
    const validation = privacySettingsSchema.safeParse(sanitizedBody);
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => e.message).join(", ");
      return createErrorResponse(`Validation failed: ${errors}`, 400);
    }

    const privacyData = validation.data;

    // Find existing settings
    let privacySettings = await PrivacySettings.findByUserId(userId);

    if (!privacySettings) {
      // Create new settings if they don't exist
      privacySettings = await PrivacySettings.create({
        userId,
        ...privacyData,
        createdBy: userId,
      });
    } else {
      // Update existing settings
      await privacySettings.updatePrivacy({
        ...privacyData,
        updatedBy: userId,
      });
    }

    const response = createSuccessResponse({
      settings: privacySettings,
      message: "Privacy settings updated successfully",
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Update privacy settings error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// PATCH /api/settings/privacy - Partial update privacy settings
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
        "Too many privacy updates. Please try again later.",
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
    const validation = privacySettingsSchema.partial().safeParse(sanitizedBody);
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => e.message).join(", ");
      return createErrorResponse(`Validation failed: ${errors}`, 400);
    }

    const privacyData = validation.data;

    // Find existing settings
    let privacySettings = await PrivacySettings.findByUserId(userId);

    if (!privacySettings) {
      // Create new settings if they don't exist
      privacySettings = await PrivacySettings.createDefaultPrivacy(userId);
      // Apply the partial update
      await privacySettings.updatePrivacy({
        ...privacyData,
        createdBy: userId,
      });
    } else {
      // Update existing settings
      await privacySettings.updatePrivacy({
        ...privacyData,
        updatedBy: userId,
      });
    }

    const response = createSuccessResponse({
      settings: privacySettings,
      message: "Privacy settings updated successfully",
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Patch privacy settings error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// DELETE /api/settings/privacy - Reset privacy settings to defaults
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
        "Too many privacy updates. Please try again later.",
        rateLimitResult.resetTime,
      );
    }

    // Find and deactivate existing settings
    const existingSettings = await PrivacySettings.findByUserId(userId);
    if (existingSettings) {
      existingSettings.isActive = false;
      await existingSettings.save();
    }

    // Create new default settings
    const defaultSettings = await PrivacySettings.createDefaultPrivacy(userId);
    defaultSettings.createdBy = userId;
    await defaultSettings.save();

    const response = createSuccessResponse({
      settings: defaultSettings,
      message: "Privacy settings reset to defaults successfully",
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Delete privacy settings error:", error);
    return handleApiError(error);
  }
});

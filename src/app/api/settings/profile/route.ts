/**
 * PropertyPro - Profile Settings API Routes
 * CRUD operations for user profile settings using separate collection
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { ProfileSettings } from "@/models";
import {
  withPermissionAndDB,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  parseRequestBody,
} from "@/lib/api-utils";
import { profileSettingsSchema } from "@/lib/validations";
import {
  rateLimit,
  rateLimitConfigs,
  createRateLimitResponse,
  addSecurityHeaders,
  sanitizeInput,
  userBasedKeyGenerator,
} from "@/lib/rate-limit";

// ============================================================================
// GET /api/settings/profile - Get user profile settings
// ============================================================================
export const GET = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const userId = user.id;

    // Find existing profile settings
    let profileSettings = await ProfileSettings.findByUserId(userId);

    // If no settings exist, create default settings
    if (!profileSettings) {
      try {
        profileSettings = await ProfileSettings.createDefaultProfile(userId, {
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          email: user.email || "",
        });
      } catch (createError) {
        console.error("Error creating default profile:", createError);
        // If creation fails, return null to indicate no settings exist
        profileSettings = null;
      }
    }

    // Return response with settings (even if null)
    const response = createSuccessResponse({
      settings: profileSettings,
      message: profileSettings
        ? "Profile settings retrieved successfully"
        : "No profile settings found",
      hasSettings: !!profileSettings,
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Get profile settings error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// PUT /api/settings/profile - Update profile settings
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
        "Too many profile updates. Please try again later.",
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
    const validation = profileSettingsSchema.safeParse(sanitizedBody);
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => e.message).join(", ");
      return createErrorResponse(`Validation failed: ${errors}`, 400);
    }

    const profileData = validation.data;

    // Update or create profile settings
    const updatedSettings = await ProfileSettings.updateByUserId(userId, {
      ...profileData,
      updatedBy: userId,
    });

    const response = createSuccessResponse({
      settings: updatedSettings,
      message: "Profile settings updated successfully",
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Update profile settings error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// PATCH /api/settings/profile - Partial update profile settings
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
        "Too many profile updates. Please try again later.",
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
    const validation = profileSettingsSchema.partial().safeParse(sanitizedBody);
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => e.message).join(", ");
      return createErrorResponse(`Validation failed: ${errors}`, 400);
    }

    const profileData = validation.data;

    // Find existing settings
    let profileSettings = await ProfileSettings.findByUserId(userId);

    if (!profileSettings) {
      // Create new settings if they don't exist
      profileSettings = await ProfileSettings.createDefaultProfile(userId, {
        ...profileData,
        createdBy: userId,
      });
    } else {
      // Update existing settings
      await profileSettings.updateProfile({
        ...profileData,
        updatedBy: userId,
      });
    }

    const response = createSuccessResponse({
      settings: profileSettings,
      message: "Profile settings updated successfully",
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Patch profile settings error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// DELETE /api/settings/profile - Reset profile settings to defaults
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
        "Too many profile updates. Please try again later.",
        rateLimitResult.resetTime,
      );
    }

    // Find and deactivate existing settings
    const existingSettings = await ProfileSettings.findByUserId(userId);
    if (existingSettings) {
      existingSettings.isActive = false;
      await existingSettings.save();
    }

    // Create new default settings
    const defaultSettings = await ProfileSettings.createDefaultProfile(userId, {
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      createdBy: userId,
    });

    const response = createSuccessResponse({
      settings: defaultSettings,
      message: "Profile settings reset to defaults successfully",
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Delete profile settings error:", error);
    return handleApiError(error);
  }
});

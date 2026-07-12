/**
 * PropertyPro - Security Settings API Routes
 * CRUD operations for user security settings using separate collection
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { SecuritySettings } from "@/models";
import {
  withPermissionAndDB,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  parseRequestBody,
} from "@/lib/api-utils";
import { securitySettingsSchema } from "@/lib/validations";
import {
  rateLimit,
  rateLimitConfigs,
  createRateLimitResponse,
  addSecurityHeaders,
  sanitizeInput,
  userBasedKeyGenerator,
} from "@/lib/rate-limit";

// ============================================================================
// GET /api/settings/security - Get user security settings
// ============================================================================
export const GET = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const userId = user.id;

    // Find existing security settings
    let securitySettings = await SecuritySettings.findByUserId(userId);

    // If no settings exist, create default settings
    if (!securitySettings) {
      securitySettings = await SecuritySettings.createDefaultSecurity(userId);
    }

    // Remove sensitive data from response
    const sanitizedSettings = {
      ...securitySettings.toObject(),
      twoFactorAuth: {
        ...securitySettings.twoFactorAuth,
        secret: undefined, // Don't expose 2FA secret
        backupCodes: securitySettings.twoFactorAuth.backupCodes?.length ?? 0, // Only show count
      },
      trustedDevices: securitySettings.trustedDevices.map((device: any) => ({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        addedAt: device.addedAt,
        lastUsed: device.lastUsed,
        // Don't expose userAgent or ipAddress for privacy
      })),
      securityQuestions: securitySettings.securityQuestions.map((q: any) => ({
        question: q.question,
        createdAt: q.createdAt,
        // Don't expose answer
      })),
    };

    const response = createSuccessResponse({
      settings: sanitizedSettings,
      message: "Security settings retrieved successfully",
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Get security settings error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// PUT /api/settings/security - Update security settings
// ============================================================================
export const PUT = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const userId = user.id;

    // Rate limiting (stricter for security settings)
    const limiter = rateLimit({
      ...rateLimitConfigs.settingsUpdate,
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // Only 5 security updates per 15 minutes
      keyGenerator: () => userBasedKeyGenerator(userId),
    });

    const rateLimitResult = limiter.check(request);
    if (!rateLimitResult.success) {
      return createRateLimitResponse(
        "Too many security updates. Please try again later.",
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
    const validation = securitySettingsSchema.safeParse(sanitizedBody);
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => e.message).join(", ");
      return createErrorResponse(`Validation failed: ${errors}`, 400);
    }

    const securityData = validation.data;

    // Find existing settings
    let securitySettings = await SecuritySettings.findByUserId(userId);

    if (!securitySettings) {
      // Create new settings if they don't exist
      securitySettings = await SecuritySettings.create({
        userId,
        ...securityData,
        createdBy: userId,
      });
    } else {
      // Update existing settings
      await securitySettings.updateSecurity({
        ...securityData,
        updatedBy: userId,
      });
    }

    // Remove sensitive data from response
    const sanitizedSettings = {
      ...securitySettings.toObject(),
      twoFactorAuth: {
        ...securitySettings.twoFactorAuth,
        secret: undefined,
        backupCodes: securitySettings.twoFactorAuth.backupCodes?.length ?? 0,
      },
    };

    const response = createSuccessResponse({
      settings: sanitizedSettings,
      message: "Security settings updated successfully",
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Update security settings error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// PATCH /api/settings/security - Partial update security settings
// ============================================================================
export const PATCH = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const userId = user.id;

    // Rate limiting (stricter for security settings)
    const limiter = rateLimit({
      ...rateLimitConfigs.settingsUpdate,
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // 10 partial security updates per 15 minutes
      keyGenerator: () => userBasedKeyGenerator(userId),
    });

    const rateLimitResult = limiter.check(request);
    if (!rateLimitResult.success) {
      return createRateLimitResponse(
        "Too many security updates. Please try again later.",
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
    const validation = securitySettingsSchema
      .partial()
      .safeParse(sanitizedBody);
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => e.message).join(", ");
      return createErrorResponse(`Validation failed: ${errors}`, 400);
    }

    const securityData = validation.data;

    // Find existing settings
    let securitySettings = await SecuritySettings.findByUserId(userId);

    if (!securitySettings) {
      // Create new settings if they don't exist
      securitySettings = await SecuritySettings.createDefaultSecurity(userId);
      // Apply the partial update
      await securitySettings.updateSecurity({
        ...securityData,
        createdBy: userId,
      });
    } else {
      // Update existing settings
      await securitySettings.updateSecurity({
        ...securityData,
        updatedBy: userId,
      });
    }

    // Remove sensitive data from response
    const sanitizedSettings = {
      ...securitySettings.toObject(),
      twoFactorAuth: {
        ...securitySettings.twoFactorAuth,
        secret: undefined,
        backupCodes: securitySettings.twoFactorAuth.backupCodes?.length ?? 0,
      },
    };

    const response = createSuccessResponse({
      settings: sanitizedSettings,
      message: "Security settings updated successfully",
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Patch security settings error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// DELETE /api/settings/security - Reset security settings to defaults
// ============================================================================
export const DELETE = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const userId = user.id;

    // Rate limiting (very strict for security reset)
    const limiter = rateLimit({
      ...rateLimitConfigs.settingsUpdate,
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 2, // Only 2 security resets per hour
      keyGenerator: () => userBasedKeyGenerator(userId),
    });

    const rateLimitResult = limiter.check(request);
    if (!rateLimitResult.success) {
      return createRateLimitResponse(
        "Too many security resets. Please try again later.",
        rateLimitResult.resetTime,
      );
    }

    // Find and deactivate existing settings
    const existingSettings = await SecuritySettings.findByUserId(userId);
    if (existingSettings) {
      existingSettings.isActive = false;
      await existingSettings.save();
    }

    // Create new default settings
    const defaultSettings =
      await SecuritySettings.createDefaultSecurity(userId);
    defaultSettings.createdBy = userId;
    await defaultSettings.save();

    // Remove sensitive data from response
    const sanitizedSettings = {
      ...defaultSettings.toObject(),
      twoFactorAuth: {
        ...defaultSettings.twoFactorAuth,
        secret: undefined,
        backupCodes: 0,
      },
    };

    const response = createSuccessResponse({
      settings: sanitizedSettings,
      message: "Security settings reset to defaults successfully",
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Delete security settings error:", error);
    return handleApiError(error);
  }
});

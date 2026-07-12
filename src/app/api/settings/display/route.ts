/**
 * PropertyPro - Display Settings API Routes
 * Enhanced CRUD operations specifically for display settings
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { DisplaySettings, User } from "@/models";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  parseRequestBody,
  withAccessAndDB,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { displaySettingsSchema } from "@/lib/validations";
import {
  rateLimit,
  rateLimitConfigs,
  createRateLimitResponse,
  addSecurityHeaders,
  userBasedKeyGenerator,
} from "@/lib/rate-limit";
import UserSettingsHistory from "@/models/UserSettingsHistory";
import { z } from "zod";
import { deleteFromR2 } from "@/lib/r2-server";
import { isR2Url, extractObjectKey } from "@/lib/r2";
import { resolveAccessProfile } from "@/lib/server-permissions";

const DisplaySettingsModel = DisplaySettings as any;
const UserSettingsHistoryModel = UserSettingsHistory as any;

/**
 * The single canonical admin who owns the GLOBAL display & branding settings.
 *
 * Display & branding is one app-wide setting managed by admins, so every
 * account (every admin, manager, and tenant) reads and writes the same
 * document. The owner is resolved deterministically (oldest active admin) so
 * the logo/branding never changes when switching between accounts. Returns
 * null only when no active admin exists (e.g. a fresh install), letting
 * callers fall back to the current user.
 */
async function resolveGlobalDisplayOwnerId(): Promise<string | null> {
  const activeUsers = await User.find({ isActive: true })
    .select("_id role createdAt")
    .sort({ createdAt: 1 })
    .lean();

  for (const activeUser of activeUsers as Array<{
    _id: { toString(): string };
    role?: string;
  }>) {
    const accessProfile = await resolveAccessProfile(activeUser.role);
    if (accessProfile.isAdmin) {
      return activeUser._id.toString();
    }
  }

  return null;
}

/**
 * Delete old branding images from R2 when they are being replaced
 */
async function deleteOldBrandingImages(
  currentBranding: any,
  newBranding: any,
): Promise<void> {
  const imagesToDelete: string[] = [];

  // Check each branding image type
  const imageTypes = ["logoLight", "logoDark", "favicon"] as const;

  for (const imageType of imageTypes) {
    const currentUrl = currentBranding?.[imageType];
    const newUrl = newBranding?.[imageType];

    // If the URL is changing and the old URL exists, delete it
    if (currentUrl && newUrl && currentUrl !== newUrl) {
      imagesToDelete.push(currentUrl);
    }
  }

  // Delete all old images
  if (imagesToDelete.length > 0) {
    try {
      const deleteResults = await Promise.allSettled(
        imagesToDelete.map(async (url) => {
          // Extract object key from URL
          let objectKey: string | null = url;
          if (url.startsWith("http://") || url.startsWith("https://")) {
            if (isR2Url(url)) {
              objectKey = extractObjectKey(url);
            } else {
              console.warn(`Skipping non-R2 URL: ${url}`);
              return false;
            }
          }

          if (!objectKey) {
            console.warn(`Could not extract object key from: ${url}`);
            return false;
          }

          return await deleteFromR2(objectKey);
        }),
      );

      deleteResults.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value) {
        } else if (result.status === "rejected") {
          console.warn(
            `Failed to delete old branding image from R2: ${imagesToDelete[index]}`,
            result.reason,
          );
        }
      });
    } catch (error) {
      console.error("Error deleting old branding images:", error);
      // Don't throw - continue with the update even if deletion fails
    }
  }
}

// Enhanced validation schema for partial updates
const partialDisplaySettingsSchema = displaySettingsSchema.partial();

// Bulk update schema
const bulkUpdateSchema = z.object({
  operations: z.array(
    z.object({
      field: z.string(),
      value: z.any(),
      operation: z.enum(["set", "unset", "merge"]).default("set"),
    }),
  ),
});

// ============================================================================
// GET /api/settings/display - Get display settings with enhanced features
// ============================================================================
export const GET = withAccessAndDB({})(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
) => {
  try {
    const settingsOwnerId =
      (await resolveGlobalDisplayOwnerId()) ?? user.id;
    const url = new URL(request.url);
    const includeDefaults = url.searchParams.get("includeDefaults") === "true";
    const format = url.searchParams.get("format") ?? "json";

    let displaySettings =
      await DisplaySettingsModel.findByUserId(settingsOwnerId);

    if (!displaySettings) {
      displaySettings =
        await DisplaySettingsModel.createDefaultDisplay(settingsOwnerId);
    } else if (!displaySettings.branding) {
      displaySettings.branding = {
        logoLight: "/images/logo-light.png",
        logoDark: "/images/logo-dark.png",
        favicon: "/favicon.ico",
        primaryColor: "#3B82F6",
        secondaryColor: "#64748B",
      };

      if (!displaySettings.dashboardLayout) {
        displaySettings.dashboardLayout = "grid";
      }
      if (!displaySettings.itemsPerPage) {
        displaySettings.itemsPerPage = 25;
      }

      await displaySettings.save();
    }

    let responseData = {
      settings: displaySettings,
      metadata: {
        lastUpdated: displaySettings.updatedAt,
        version: displaySettings.version ?? 1,
      },
    };

    if (includeDefaults) {
      const defaultSettings =
        await DisplaySettingsModel.createDefaultDisplay(settingsOwnerId);
      responseData = {
        ...responseData,
        defaults: defaultSettings,
        isDefault:
          JSON.stringify(displaySettings) === JSON.stringify(defaultSettings),
      } as any;
    }

    if (format === "export") {
      responseData = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        settings: displaySettings,
        metadata: {
          exportedBy: user.id,
          exportedAt: new Date().toISOString(),
          lastUpdated: displaySettings.updatedAt,
          version: displaySettings.version ?? 1,
        },
      } as any;
    }

    const response = createSuccessResponse(responseData);
    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Get display settings error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// PUT /api/settings/display - Complete update display settings
// ============================================================================
export const PUT = withPermissionAndDB(["company_settings", "system_settings"])(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      if (!user.isAdmin) {
        return addSecurityHeaders(
          createErrorResponse(
            "Only administrators can change display & branding settings.",
            403,
          ),
        );
      }

      const actorId = user.id;
      const settingsOwnerId =
        (await resolveGlobalDisplayOwnerId()) ?? user.id;

      const limiter = rateLimit({
        ...rateLimitConfigs.settingsUpdate,
        keyGenerator: () => userBasedKeyGenerator(actorId),
      });

      const rateLimitResult = limiter.check(request);
      if (!rateLimitResult.success) {
        return createRateLimitResponse(
          "Too many display updates. Please try again later.",
          rateLimitResult.resetTime,
        );
      }

      // Parse request body
      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error ?? "Invalid request body", 400);
      }

      // Validate complete update data
      const validation = displaySettingsSchema.safeParse(body);
      if (!validation.success) {
        const errors = validation.error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ");
        return createErrorResponse(`Validation failed: ${errors}`, 400);
      }

      // Get or create settings
      let displaySettings =
        await DisplaySettingsModel.findByUserId(settingsOwnerId);
      if (!displaySettings) {
        displaySettings =
          await DisplaySettingsModel.createDefaultDisplay(settingsOwnerId);
      }

      const currentSettings = displaySettings.toObject();

      // Delete old branding images from R2 if they are being replaced
      if (validation.data.branding) {
        await deleteOldBrandingImages(
          currentSettings.branding,
          validation.data.branding,
        );
      }

      // Create history entry before updating
      await UserSettingsHistoryModel.createHistoryEntry(
        settingsOwnerId,
        "display",
        currentSettings,
        validation.data,
        {
          source: "user",
          userAgent: request.headers.get("user-agent"),
          ipAddress:
            request.headers.get("x-forwarded-for") ??
            request.headers.get("x-real-ip"),
          triggeredBy: actorId,
        },
      );

      // Update settings completely
      await displaySettings.updateDisplay(validation.data);

      // Get updated settings
      const updatedSettings =
        await DisplaySettingsModel.findByUserId(settingsOwnerId);

      const response = createSuccessResponse({
        settings: updatedSettings,
        message: "Display settings updated successfully",
      });

      return addSecurityHeaders(response);
    } catch (error) {
      console.error("PUT display settings error:", error);
      return handleApiError(error);
    }
  },
);

// ============================================================================
// PATCH /api/settings/display - Partial update display settings
// ============================================================================
export const PATCH = withPermissionAndDB([
  "company_settings",
  "system_settings",
])(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    if (!user.isAdmin) {
      return addSecurityHeaders(
        createErrorResponse(
          "Only administrators can change display & branding settings.",
          403,
        ),
      );
    }

    const actorId = user.id;
    const settingsOwnerId = (await resolveGlobalDisplayOwnerId()) ?? user.id;

    // Rate limiting
    const limiter = rateLimit({
      ...rateLimitConfigs.settingsUpdate,
      keyGenerator: () => userBasedKeyGenerator(actorId),
    });

    const rateLimitResult = limiter.check(request);
    if (!rateLimitResult.success) {
      return createRateLimitResponse(
        "Too many display updates. Please try again later.",
        rateLimitResult.resetTime,
      );
    }

    // Parse request body
    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error ?? "Invalid request body", 400);
    }

    // Validate partial update data
    const validation = partialDisplaySettingsSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      return createErrorResponse(`Validation failed: ${errors}`, 400);
    }

    // Get current settings
    let displaySettings =
      await DisplaySettingsModel.findByUserId(settingsOwnerId);
    if (!displaySettings) {
      // Create default settings if they don't exist
      displaySettings =
        await DisplaySettingsModel.createDefaultDisplay(settingsOwnerId);
    }

    // Merge with existing settings (deep merge for nested objects like branding)
    const currentDisplay = displaySettings.toObject();

    // Delete old branding images from R2 if they are being replaced
    if (validation.data.branding) {
      await deleteOldBrandingImages(
        currentDisplay.branding,
        validation.data.branding,
      );
    }

    const updatedDisplay = {
      ...currentDisplay,
      ...validation.data,
      // Deep merge branding object if it exists in the update
      ...(validation.data.branding && {
        branding: {
          ...currentDisplay.branding,
          ...validation.data.branding,
        },
      }),
    };

    // Validate the complete merged settings
    const completeValidation = displaySettingsSchema.safeParse(updatedDisplay);
    if (!completeValidation.success) {
      const errors = completeValidation.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      return createErrorResponse(
        `Complete settings validation failed: ${errors}`,
        400,
      );
    }

    // Create history entry before updating
    await UserSettingsHistoryModel.createHistoryEntry(
      settingsOwnerId,
      "display",
      currentDisplay,
      completeValidation.data,
      {
        source: "user",
        userAgent: request.headers.get("user-agent"),
        ipAddress:
          request.headers.get("x-forwarded-for") ??
          request.headers.get("x-real-ip"),
        triggeredBy: actorId,
      },
    );

    // Update settings
    await displaySettings.updateDisplay(completeValidation.data);

    // Get updated settings
    const updatedSettings =
      await DisplaySettingsModel.findByUserId(settingsOwnerId);

    const response = createSuccessResponse({
      settings: updatedSettings,
      message: "Display settings updated successfully",
      updatedFields: Object.keys(validation.data),
    });

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Patch display settings error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// POST /api/settings/display - Bulk operations and advanced features
// ============================================================================
export const POST = withPermissionAndDB([
  "company_settings",
  "system_settings",
])(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    if (!user.isAdmin) {
      return addSecurityHeaders(
        createErrorResponse(
          "Only administrators can change display & branding settings.",
          403,
        ),
      );
    }

    const actorId = user.id;
    const settingsOwnerId = (await resolveGlobalDisplayOwnerId()) ?? user.id;
    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error ?? "Invalid request body", 400);
    }

    const { action, ...data } = body;

    switch (action) {
      case "reset":
        // Reset to default settings
        let displaySettingsReset =
          await DisplaySettingsModel.findByUserId(settingsOwnerId);

        if (!displaySettingsReset) {
          displaySettingsReset =
            await DisplaySettingsModel.createDefaultDisplay(settingsOwnerId);
        }

        const currentSettings = displaySettingsReset.toObject();
        const defaultSettings =
          await DisplaySettingsModel.createDefaultDisplay(settingsOwnerId);

        // Create history entry for reset
        await UserSettingsHistoryModel.createHistoryEntry(
          settingsOwnerId,
          "display",
          currentSettings,
          defaultSettings.toObject(),
          {
            source: "reset",
            userAgent: request.headers.get("user-agent"),
            ipAddress:
              request.headers.get("x-forwarded-for") ??
              request.headers.get("x-real-ip"),
            triggeredBy: actorId,
          },
        );

        // Reset to defaults
        await displaySettingsReset.updateDisplay(defaultSettings.toObject());

        return createSuccessResponse({
          settings: defaultSettings,
          message: "Display settings reset to defaults",
        });

      case "bulk":
        // Bulk update operations
        const bulkValidation = bulkUpdateSchema.safeParse(data);
        if (!bulkValidation.success) {
          return createErrorResponse("Invalid bulk operation format", 400);
        }

        let displaySettingsBulk =
          await DisplaySettingsModel.findByUserId(settingsOwnerId);
        if (!displaySettingsBulk) {
          displaySettingsBulk =
            await DisplaySettingsModel.createDefaultDisplay(settingsOwnerId);
        }

        const currentSettingsBulk = { ...displaySettingsBulk.toObject() };
        const originalSettings = { ...currentSettingsBulk };

        // Apply bulk operations
        for (const operation of bulkValidation.data.operations) {
          const { field, value, operation: op } = operation;

          switch (op) {
            case "set":
              // Set field value using dot notation
              const keys = field.split(".");
              let target = currentSettingsBulk;
              for (let i = 0; i < keys.length - 1; i++) {
                if (!target[keys[i]]) target[keys[i]] = {};
                target = target[keys[i]];
              }
              target[keys[keys.length - 1]] = value;
              break;

            case "unset":
              // Remove field
              const unsetKeys = field.split(".");
              let unsetTarget = currentSettingsBulk;
              for (let i = 0; i < unsetKeys.length - 1; i++) {
                if (!unsetTarget[unsetKeys[i]]) break;
                unsetTarget = unsetTarget[unsetKeys[i]];
              }
              delete unsetTarget[unsetKeys[unsetKeys.length - 1]];
              break;

            case "merge":
              // Merge object values
              if (typeof value === "object" && value !== null) {
                const mergeKeys = field.split(".");
                let mergeTarget = currentSettingsBulk;
                for (let i = 0; i < mergeKeys.length - 1; i++) {
                  if (!mergeTarget[mergeKeys[i]])
                    mergeTarget[mergeKeys[i]] = {};
                  mergeTarget = mergeTarget[mergeKeys[i]];
                }
                mergeTarget[mergeKeys[mergeKeys.length - 1]] = {
                  ...mergeTarget[mergeKeys[mergeKeys.length - 1]],
                  ...value,
                };
              }
              break;
          }
        }

        // Validate final settings
        const finalValidation =
          displaySettingsSchema.safeParse(currentSettingsBulk);
        if (!finalValidation.success) {
          return createErrorResponse(
            "Bulk operations resulted in invalid settings",
            400,
          );
        }

        // Create history entry for bulk operations
        await UserSettingsHistoryModel.createHistoryEntry(
          settingsOwnerId,
          "display",
          originalSettings,
          finalValidation.data,
          {
            source: "user",
            userAgent: request.headers.get("user-agent"),
            ipAddress:
              request.headers.get("x-forwarded-for") ??
              request.headers.get("x-real-ip"),
            triggeredBy: actorId,
          },
        );

        await displaySettingsBulk.updateDisplay(finalValidation.data);

        return createSuccessResponse({
          settings: finalValidation.data,
          message: "Bulk operations completed successfully",
          operationsApplied: bulkValidation.data.operations.length,
        });

      default:
        return createErrorResponse("Invalid action", 400);
    }
  } catch (error) {
    console.error("POST display settings error:", error);
    return handleApiError(error);
  }
});

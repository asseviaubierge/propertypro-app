/**
 * PropertyPro - Unified Settings API Route
 * Main API for all settings operations using the unified Settings collection
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Settings, { SettingsType, SettingsCategory } from "@/models/Settings";
import SystemSettings from "@/models/SystemSettings";
import {
  auditSettingsChange,
  AuditAction,
  AuditCategory,
} from "@/lib/settings-audit";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from "@/lib/api-utils";
import { resolveAccessProfile } from "@/lib/server-permissions";

// Helper function to create default branding settings
async function createDefaultBrandingSettings(adminUserId: string) {
  const defaultBrandingSettings = [
    {
      category: "branding",
      key: "logo_light",
      value: "/images/logo-light.png",
      dataType: "file",
      description: "Light theme logo",
      isPublic: true,
      isEditable: true,
      metadata: { group: "logos", order: 1 },
    },
    {
      category: "branding",
      key: "logo_dark",
      value: "/images/logo-dark.png",
      dataType: "file",
      description: "Dark theme logo",
      isPublic: true,
      isEditable: true,
      metadata: { group: "logos", order: 2 },
    },
    {
      category: "branding",
      key: "favicon",
      value: "/favicon.ico",
      dataType: "file",
      description: "Website favicon",
      isPublic: true,
      isEditable: true,
      metadata: { group: "logos", order: 3 },
    },
    {
      category: "branding",
      key: "primary_color",
      value: "#3B82F6",
      dataType: "color",
      description: "Primary brand color",
      isPublic: true,
      isEditable: true,
      metadata: { group: "colors", order: 1 },
    },
    {
      category: "branding",
      key: "secondary_color",
      value: "#64748B",
      dataType: "color",
      description: "Secondary brand color",
      isPublic: true,
      isEditable: true,
      metadata: { group: "colors", order: 2 },
    },
  ];

  for (const setting of defaultBrandingSettings) {
    await SystemSettings.findOneAndUpdate(
      { category: setting.category, key: setting.key },
      { ...setting, lastModifiedBy: adminUserId },
      { upsert: true, new: true },
    );
  }
}

// ============================================================================
// GET /api/settings - Get user settings
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const session = await auth();

    if (!session?.user?.id) {
      return createErrorResponse("Unauthorized", 401);
    }

    const accessProfile = await resolveAccessProfile(session.user.role);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as SettingsCategory;
    const type =
      (searchParams.get("type") as SettingsType) ?? SettingsType.USER;

    let query: any = {
      isActive: true,
      type,
    };

    // Handle user settings
    if (type === SettingsType.USER) {
      query.userId = session.user.id;

      const settings = await Settings.find(query).sort({ category: 1 });

      // If no user settings found, create default ones
      if (settings.length === 0) {
        const defaultSettings = await Settings.createDefaultUserSettings(
          session.user.id,
        );
        return createSuccessResponse({
          settings: defaultSettings,
          message: "Default settings created",
        });
      }

      // Transform settings into a more usable format
      const settingsMap: Record<string, any> = {};
      settings.forEach((setting) => {
        settingsMap[setting.category] = setting[setting.category];
      });

      return createSuccessResponse({
        settings: settingsMap,
        raw: settings, // Include raw settings for advanced use
      });
    }

    // Handle system settings
    else if (type === SettingsType.SYSTEM) {
      if (!accessProfile.permissions.includes("system_settings")) {
        return createErrorResponse("Insufficient permissions", 403);
      }

      // Build query for SystemSettings collection
      const systemQuery: any = {};
      if (category) {
        systemQuery.category = category;
      }

      let systemSettings = await SystemSettings.find(systemQuery).sort({
        category: 1,
        key: 1,
      });

      // If requesting branding settings and none exist, create defaults
      if (category === "branding" && systemSettings.length === 0) {
        await createDefaultBrandingSettings(session.user.id);
        systemSettings = await SystemSettings.find(systemQuery).sort({
          category: 1,
          key: 1,
        });
      }

      // Transform system settings into a more usable format
      const settingsMap: Record<string, any> = {};
      systemSettings.forEach((setting) => {
        if (!settingsMap[setting.category]) {
          settingsMap[setting.category] = {};
        }
        settingsMap[setting.category][setting.key] = setting.value;
      });

      return createSuccessResponse({
        settings: settingsMap,
        raw: systemSettings, // Include raw settings for advanced use
      });
    }

    return createErrorResponse("Invalid settings type", 400);
  } catch (error) {
    console.error("Get settings error:", error);
    return handleApiError(error);
  }
}

// ============================================================================
// PUT /api/settings - Update settings
// ============================================================================
export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    const session = await auth();

    if (!session?.user?.id) {
      return createErrorResponse("Unauthorized", 401);
    }

    const accessProfile = await resolveAccessProfile(session.user.role);

    const body = await request.json();
    const { category, data, type = SettingsType.USER } = body;

    if (!category || !data) {
      return createErrorResponse("Category and data are required", 400);
    }

    // Validate category
    if (!Object.values(SettingsCategory).includes(category)) {
      return createErrorResponse("Invalid category", 400);
    }

    // Check permissions for system settings
    if (
      type === SettingsType.SYSTEM &&
      !accessProfile.permissions.includes("system_settings")
    ) {
      return createErrorResponse("Insufficient permissions", 403);
    }

    let query: any = {
      category,
      type,
      isActive: true,
    };

    if (type === SettingsType.USER) {
      query.userId = session.user.id;
    }

    // Find existing setting
    let setting = await Settings.findOne(query);

    if (!setting) {
      // Create new setting
      setting = new Settings({
        ...query,
        [category]: data,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      });
    } else {
      // Update existing setting
      const oldData = setting[category];
      setting[category] = { ...setting[category], ...data };
      setting.version += 1;
      setting.updatedBy = session.user.id;

      // Log the change for audit
      await auditSettingsChange({
        userId: session.user.id,
        category: category as AuditCategory,
        action: AuditAction.UPDATE,
        field: category,
        oldValue: oldData,
        newValue: setting[category],
        metadata: {
          userAgent: request.headers.get("user-agent") ?? undefined,
          ipAddress:
            request.headers.get("x-forwarded-for") ??
            request.headers.get("x-real-ip") ??
            undefined,
          source: "web",
        },
      });
    }

    await setting.save();

    return createSuccessResponse({
      setting: setting[category],
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return handleApiError(error);
  }
}

// ============================================================================
// PATCH /api/settings - Partial update settings
// ============================================================================
export async function PATCH(request: NextRequest) {
  try {
    await connectDB();
    const session = await auth();

    if (!session?.user?.id) {
      return createErrorResponse("Unauthorized", 401);
    }

    const accessProfile = await resolveAccessProfile(session.user.role);

    const body = await request.json();
    const { category, field, value, type = SettingsType.USER } = body;

    if (!category || !field || value === undefined) {
      return createErrorResponse(
        "Category, field, and value are required",
        400,
      );
    }

    // Check permissions for system settings
    if (
      type === SettingsType.SYSTEM &&
      !accessProfile.permissions.includes("system_settings")
    ) {
      return createErrorResponse("Insufficient permissions", 403);
    }

    // Handle system settings
    if (type === SettingsType.SYSTEM) {
      // Use SystemSettings collection for system settings
      const systemSetting = await SystemSettings.findOneAndUpdate(
        { category, key: field },
        {
          value,
          lastModifiedBy: session.user.id,
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        },
      );

      return createSuccessResponse({
        field,
        value,
        message: "System setting updated successfully",
      });
    }

    // Handle user settings
    let query: any = {
      category,
      type,
      isActive: true,
      userId: session.user.id,
    };

    const setting = await Settings.findOne(query);

    if (!setting) {
      return createErrorResponse("Settings not found", 404);
    }

    // Get old value for audit
    const oldValue = setting[category]?.[field];

    // Update the specific field
    if (!setting[category]) {
      setting[category] = {};
    }
    setting[category][field] = value;
    setting.version += 1;
    setting.updatedBy = session.user.id;

    await setting.save();

    // Log the change for audit
    await auditSettingsChange({
      userId: session.user.id,
      category: category as AuditCategory,
      action: AuditAction.UPDATE,
      field: `${category}.${field}`,
      oldValue,
      newValue: value,
      metadata: {
        userAgent: request.headers.get("user-agent") ?? undefined,
        ipAddress:
          request.headers.get("x-forwarded-for") ??
          request.headers.get("x-real-ip") ??
          undefined,
        source: "web",
      },
    });

    return createSuccessResponse({
      field,
      value,
      message: "Setting updated successfully",
    });
  } catch (error) {
    console.error("Patch settings error:", error);
    return handleApiError(error);
  }
}

// ============================================================================
// DELETE /api/settings - Reset settings to default
// ============================================================================
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const session = await auth();

    if (!session?.user?.id) {
      return createErrorResponse("Unauthorized", 401);
    }

    const accessProfile = await resolveAccessProfile(session.user.role);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as SettingsCategory;
    const type =
      (searchParams.get("type") as SettingsType) ?? SettingsType.USER;

    // Check permissions for system settings
    if (
      type === SettingsType.SYSTEM &&
      !accessProfile.permissions.includes("system_settings")
    ) {
      return createErrorResponse("Insufficient permissions", 403);
    }

    let query: any = {
      type,
      isActive: true,
    };

    if (type === SettingsType.USER) {
      query.userId = session.user.id;
    }

    if (category) {
      query.category = category;
    }

    if (category) {
      // Reset specific category to defaults
      const setting = await Settings.findOne(query);

      if (setting) {
        const oldData = setting[category];

        // Create new instance to get default values
        const defaultSetting = new Settings({
          ...query,
          [category]: {},
        });

        setting[category] = defaultSetting[category];
        setting.version += 1;
        setting.updatedBy = session.user.id;

        await setting.save();

        // Log the reset for audit
        await auditSettingsChange({
          userId: session.user.id,
          category: category as AuditCategory,
          action: AuditAction.UPDATE,
          field: `${category}_reset`,
          oldValue: oldData,
          newValue: setting[category],
          metadata: {
            userAgent: request.headers.get("user-agent") ?? undefined,
            ipAddress:
              request.headers.get("x-forwarded-for") ??
              request.headers.get("x-real-ip") ??
              undefined,
            source: "web",
            reason: "Settings reset to defaults",
          },
        });
      }
    } else {
      // Reset all settings for the user/system
      await Settings.deleteMany(query);

      if (type === SettingsType.USER) {
        await Settings.createDefaultUserSettings(session.user.id);
      }

      // Log the bulk reset for audit
      await auditSettingsChange({
        userId: session.user.id,
        category: AuditCategory.SYSTEM,
        action: AuditAction.DELETE,
        field: "all_settings_reset",
        oldValue: "all_settings",
        newValue: "default_settings",
        metadata: {
          userAgent: request.headers.get("user-agent") ?? undefined,
          ipAddress:
            request.headers.get("x-forwarded-for") ??
            request.headers.get("x-real-ip") ??
            undefined,
          source: "web",
          reason: "All settings reset to defaults",
        },
      });
    }

    return createSuccessResponse({
      message: category
        ? `${category} settings reset to defaults`
        : "All settings reset to defaults",
    });
  } catch (error) {
    console.error("Delete settings error:", error);
    return handleApiError(error);
  }
}

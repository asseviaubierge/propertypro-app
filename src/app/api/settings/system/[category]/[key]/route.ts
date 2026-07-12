/**
 * PropertyPro - Individual System Setting API Routes
 * CRUD operations for individual system settings by category and key
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { SystemSettings } from "@/models";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  parseRequestBody,
  withAccessAndDB,
  withPermissionAndDB,
} from "@/lib/api-utils";

const MANAGER_ALLOWED_CATEGORIES = ["branding", "appearance", "notifications"];

function canManageAllSettings(user: AuthenticatedAccessUser): boolean {
  return user.permissions.includes("system_settings");
}

function canManageCompanySettings(user: AuthenticatedAccessUser): boolean {
  return (
    canManageAllSettings(user) || user.permissions.includes("company_settings")
  );
}

function canAccessSetting(
  user: AuthenticatedAccessUser,
  settingCategory: string,
  isPublic: boolean,
): boolean {
  if (canManageAllSettings(user)) {
    return true;
  }

  if (isPublic) {
    return true;
  }

  return (
    canManageCompanySettings(user) &&
    MANAGER_ALLOWED_CATEGORIES.includes(settingCategory)
  );
}

interface RouteParams {
  params: Promise<{
    category: string;
    key: string;
  }>;
}

// ============================================================================
// GET /api/settings/system/[category]/[key] - Get specific system setting
// ============================================================================

export const GET = withAccessAndDB({})(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
  { params }: RouteParams,
) => {
  try {
    const { category, key } = await params;
    const setting = await (SystemSettings as any).getSetting(category, key);

    if (!setting) {
      return createErrorResponse("Setting not found", 404);
    }

    if (!canAccessSetting(user, setting.category, setting.isPublic)) {
      return createErrorResponse("Insufficient permissions", 403);
    }

    await setting.populate("lastModifiedByUser");

    return createSuccessResponse(
      { setting },
      "System setting retrieved successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// PUT /api/settings/system/[category]/[key] - Update specific system setting
// ============================================================================

export const PUT = withPermissionAndDB(["company_settings", "system_settings"])(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: RouteParams,
  ) => {
    try {
      const { category, key } = await params;
      const { success, data, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error ?? "Invalid request body", 400);
      }

      const { value } = data ?? {};
      if (value === undefined) {
        return createErrorResponse("Value is required", 400);
      }

      const setting = await (SystemSettings as any).getSetting(category, key);
      if (!setting) {
        return createErrorResponse("Setting not found", 404);
      }

      if (
        !canManageAllSettings(user) &&
        !(
          canManageCompanySettings(user) &&
          MANAGER_ALLOWED_CATEGORIES.includes(setting.category)
        )
      ) {
        return createErrorResponse("Insufficient permissions", 403);
      }

      if (!setting.isEditable) {
        return createErrorResponse("This setting is not editable", 403);
      }

      if (!setting.isValidValue(value)) {
        return createErrorResponse("Invalid value for this setting", 400);
      }

      const updatedSetting = await setting.updateValue(value, user.id);
      await updatedSetting.populate("lastModifiedByUser");

      return createSuccessResponse(
        { setting: updatedSetting },
        "System setting updated successfully",
      );
    } catch (error) {
      return handleApiError(error);
    }
  },
);

// ============================================================================
// DELETE /api/settings/system/[category]/[key] - Delete specific system setting
// ============================================================================

export const DELETE = withPermissionAndDB([
  "company_settings",
  "system_settings",
])(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
  { params }: RouteParams,
) => {
  try {
    const { category, key } = await params;
    const setting = await (SystemSettings as any).getSetting(category, key);

    if (!setting) {
      return createErrorResponse("Setting not found", 404);
    }

    if (
      !canManageAllSettings(user) &&
      !(
        canManageCompanySettings(user) &&
        MANAGER_ALLOWED_CATEGORIES.includes(setting.category)
      )
    ) {
      return createErrorResponse("Insufficient permissions", 403);
    }

    if (!setting.isEditable) {
      return createErrorResponse("This setting cannot be deleted", 403);
    }

    await SystemSettings.findByIdAndDelete(setting._id);

    return createSuccessResponse(
      { message: "System setting deleted successfully" },
      "System setting deleted successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

/**
 * PropertyPro - System Settings API Routes
 * CRUD operations for system-wide configuration settings
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
import {
  systemSettingSchema,
  systemSettingsQuerySchema,
  validateSchema,
} from "@/lib/validations";

const MANAGER_ALLOWED_CATEGORIES = ["branding", "appearance", "notifications"];

function canManageAllSettings(user: AuthenticatedAccessUser): boolean {
  return user.permissions.includes("system_settings");
}

function canManageCompanySettings(user: AuthenticatedAccessUser): boolean {
  return (
    canManageAllSettings(user) || user.permissions.includes("company_settings")
  );
}

function getSettingsAccessQuery(
  user: AuthenticatedAccessUser,
  category?: string,
  isPublic?: boolean,
) {
  const hasAllSettingsAccess = canManageAllSettings(user);
  const hasCompanySettingsAccess = canManageCompanySettings(user);

  if (hasAllSettingsAccess) {
    return isPublic === undefined ? {} : { isPublic };
  }

  if (category) {
    if (
      MANAGER_ALLOWED_CATEGORIES.includes(category) &&
      hasCompanySettingsAccess
    ) {
      if (isPublic === undefined) {
        return { category };
      }

      return { category, isPublic };
    }

    return {
      category,
      isPublic: isPublic === undefined ? true : isPublic,
    };
  }

  if (!hasCompanySettingsAccess) {
    if (isPublic === false) {
      return { _id: { $exists: false } };
    }

    return { isPublic: true };
  }

  if (isPublic === true) {
    return { isPublic: true };
  }

  if (isPublic === false) {
    return {
      isPublic: false,
      category: { $in: MANAGER_ALLOWED_CATEGORIES },
    };
  }

  return {
    $or: [
      { isPublic: true },
      { category: { $in: MANAGER_ALLOWED_CATEGORIES } },
    ],
  };
}

function canMutateCategory(
  user: AuthenticatedAccessUser,
  category: string,
): boolean {
  if (canManageAllSettings(user)) {
    return true;
  }

  return (
    canManageCompanySettings(user) &&
    MANAGER_ALLOWED_CATEGORIES.includes(category)
  );
}

// ============================================================================
// GET /api/settings/system - Get system settings
// ============================================================================

export const GET = withAccessAndDB({})(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
) => {
  try {
    const { searchParams } = new URL(request.url);
    const validation = validateSchema(systemSettingsQuerySchema, {
      category: searchParams.get("category") ?? undefined,
      isPublic: searchParams.has("isPublic")
        ? searchParams.get("isPublic") === "true"
        : undefined,
      isEditable: searchParams.has("isEditable")
        ? searchParams.get("isEditable") === "true"
        : undefined,
      search: searchParams.get("search") ?? undefined,
      page: parseInt(searchParams.get("page") ?? "1"),
      limit: Math.min(parseInt(searchParams.get("limit") ?? "20"), 100),
      sortBy: searchParams.get("sortBy") ?? undefined,
      sortOrder: searchParams.get("sortOrder") === "desc" ? "desc" : "asc",
    });

    if (!validation.success) {
      return createErrorResponse(
        `Invalid query parameters: ${validation.errors.join(", ")}`,
        400,
      );
    }

    const {
      category,
      isPublic,
      isEditable,
      page = 1,
      limit = 20,
      sortBy,
      sortOrder,
    } = validation.data;

    const query: Record<string, unknown> = getSettingsAccessQuery(
      user,
      category,
      isPublic,
    );

    if (isEditable !== undefined) {
      query.isEditable = isEditable;
    }

    const result = (await (SystemSettings as any).paginate)
      ? await (SystemSettings as any).paginate(query, {
          page,
          limit,
          sort: { [sortBy ?? "category"]: sortOrder === "asc" ? 1 : -1 },
        })
      : await (async () => {
          const skip = (page - 1) * limit;
          const sort: Record<string, 1 | -1> = {
            [sortBy ?? "category"]: sortOrder === "asc" ? 1 : -1,
          };
          const [data, total] = await Promise.all([
            SystemSettings.find(query)
              .sort(sort)
              .skip(skip)
              .limit(limit)
              .lean(),
            SystemSettings.countDocuments(query),
          ]);

          return {
            data,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
              hasNext: page * limit < total,
              hasPrev: page > 1,
            },
          };
        })();

    const data = Array.isArray(result.data) ? result.data : result.docs;
    const pagination =
      result.pagination ??
      (result.docs
        ? {
            page: result.page,
            limit: result.limit,
            total: result.totalDocs,
            totalPages: result.totalPages,
            hasNext: result.hasNextPage,
            hasPrev: result.hasPrevPage,
          }
        : undefined);

    const populatedSettings = await SystemSettings.populate(data, {
      path: "lastModifiedByUser",
      select: "name email",
    });

    return createSuccessResponse(
      {
        settings: populatedSettings,
        pagination,
      },
      "System settings retrieved successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// POST /api/settings/system - Create new system setting
// ============================================================================

export const POST = withPermissionAndDB([
  "company_settings",
  "system_settings",
])(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const { success, data, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error ?? "Invalid request body", 400);
    }

    const validation = validateSchema(systemSettingSchema, data);
    if (!validation.success) {
      return createErrorResponse(
        `Validation failed: ${validation.errors.join(", ")}`,
        400,
      );
    }

    const settingData = {
      ...validation.data,
      lastModifiedBy: user.id,
    };

    if (!canMutateCategory(user, settingData.category)) {
      return createErrorResponse("Insufficient permissions", 403);
    }

    const existingSetting = await (SystemSettings as any).getSetting(
      settingData.category,
      settingData.key,
    );

    if (existingSetting) {
      return createErrorResponse(
        "Setting with this category and key already exists",
        409,
      );
    }

    const newSetting = new SystemSettings(settingData);
    await newSetting.save();
    await newSetting.populate("lastModifiedByUser");

    return createSuccessResponse(
      { setting: newSetting },
      "System setting created successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// PUT /api/settings/system - Update system setting
// ============================================================================

export const PUT = withPermissionAndDB(["company_settings", "system_settings"])(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { success, data, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error ?? "Invalid request body", 400);
      }

      const { category, key, value } = data ?? {};

      if (!category || !key || value === undefined) {
        return createErrorResponse(
          "Category, key, and value are required",
          400,
        );
      }

      const setting = await (SystemSettings as any).getSetting(category, key);
      if (!setting) {
        return createErrorResponse("Setting not found", 404);
      }

      if (!canMutateCategory(user, setting.category)) {
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
// DELETE /api/settings/system - Delete system setting
// ============================================================================

export const DELETE = withPermissionAndDB([
  "company_settings",
  "system_settings",
])(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const key = searchParams.get("key");

    if (!category || !key) {
      return createErrorResponse("Category and key are required", 400);
    }

    const setting = await (SystemSettings as any).getSetting(category, key);
    if (!setting) {
      return createErrorResponse("Setting not found", 404);
    }

    if (!canMutateCategory(user, setting.category)) {
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

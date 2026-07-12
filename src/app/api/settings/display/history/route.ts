/**
 * PropertyPro - Display Settings History API
 * Manage display settings history and versioning
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Settings } from "@/models";
import UserSettingsHistory from "@/models/UserSettingsHistory";
import {
  withPermissionAndDB,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from "@/lib/api-utils";
import { addSecurityHeaders } from "@/lib/rate-limit";

// ============================================================================
// GET /api/settings/display/history - Get display settings history
// ============================================================================
export const GET = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const userId = user.id;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "20");
    const skip = parseInt(url.searchParams.get("skip") ?? "0");
    const fromDate = url.searchParams.get("fromDate");
    const toDate = url.searchParams.get("toDate");
    const source = url.searchParams.get("source");
    const format = url.searchParams.get("format") ?? "detailed";

    const options: any = { limit, skip };

    if (fromDate) options.fromDate = new Date(fromDate);
    if (toDate) options.toDate = new Date(toDate);
    if (source) options.source = source;

    const history = await UserSettingsHistory.getHistory(
      userId,
      "display",
      options,
    );

    let responseData;

    if (format === "summary") {
      // Return summarized version
      responseData = {
        history: history.map((entry: any) => ({
          version: entry.version,
          createdAt: entry.createdAt,
          source: entry.metadata.source,
          changeCount: entry.changes.length,
          majorChanges: entry.changes
            .filter((change: any) =>
              ["theme", "colorScheme", "fontSize", "dashboardLayout"].includes(
                change.field.split(".")[0],
              ),
            )
            .map((change: any) => ({
              field: change.field,
              changeType: change.changeType,
            })),
        })),
        totalCount: history.length,
      };
    } else {
      // Return detailed version
      responseData = {
        history: history.map((entry: any) => ({
          ...entry,
          formattedChanges: entry.changes.map((change: any) => ({
            ...change,
            fieldLabel: formatFieldLabel(change.field),
            formattedPreviousValue: formatValue(change.previousValue),
            formattedNewValue: formatValue(change.newValue),
          })),
        })),
        totalCount: history.length,
      };
    }

    const response = createSuccessResponse(responseData);
    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Get display settings history error:", error);
    return handleApiError(error);
  }
});

// ============================================================================
// POST /api/settings/display/history - Revert to previous version
// ============================================================================
export const POST = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const userId = user.id;
    const body = await request.json();
    const { action, version } = body;

    if (action === "revert") {
      if (!version) {
        return createErrorResponse(
          "Version number is required for revert action",
          400,
        );
      }

      // Get the settings for the specified version
      const historicalSettings = await UserSettingsHistory.getSettingsByVersion(
        userId,
        "display",
        version,
      );

      if (!historicalSettings) {
        return createErrorResponse("Version not found", 404);
      }

      // Get current settings
      const userSettings = await Settings.findByUserId(userId);
      if (!userSettings) {
        return createErrorResponse("Current settings not found", 404);
      }

      const currentSettings = userSettings.display ?? {};

      // Create history entry for the revert action
      await UserSettingsHistory.createHistoryEntry(
        userId,
        "display",
        currentSettings,
        historicalSettings,
        {
          source: "user",
          userAgent: request.headers.get("user-agent"),
          ipAddress:
            request.headers.get("x-forwarded-for") ??
            request.headers.get("x-real-ip"),
        },
      );

      // Update the settings
      await userSettings.updateDisplay(historicalSettings);

      // Get updated settings
      const updatedSettings = await Settings.findByUserId(userId);

      return createSuccessResponse({
        settings: updatedSettings?.display,
        message: `Settings reverted to version ${version}`,
        revertedToVersion: version,
      });
    }

    if (action === "compare") {
      const { compareVersion } = body;

      if (!version || !compareVersion) {
        return createErrorResponse(
          "Both version and compareVersion are required for compare action",
          400,
        );
      }

      const settings1 = await UserSettingsHistory.getSettingsByVersion(
        userId,
        "display",
        version,
      );
      const settings2 = await UserSettingsHistory.getSettingsByVersion(
        userId,
        "display",
        compareVersion,
      );

      if (!settings1 || !settings2) {
        return createErrorResponse("One or both versions not found", 404);
      }

      // Calculate differences
      const differences = calculateDifferences(settings1, settings2);

      return createSuccessResponse({
        version1: version,
        version2: compareVersion,
        settings1,
        settings2,
        differences,
      });
    }

    return createErrorResponse("Invalid action", 400);
  } catch (error) {
    console.error("Display settings history action error:", error);
    return handleApiError(error);
  }
});

// Helper functions
function formatFieldLabel(field: string): string {
  return field
    .split(".")
    .map((part) => part.replace(/([A-Z])/g, " $1").trim())
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" → ");
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function calculateDifferences(
  settings1: any,
  settings2: any,
  path: string = "",
): any[] {
  const differences: any[] = [];

  if (typeof settings1 !== "object" || typeof settings2 !== "object") {
    if (settings1 !== settings2) {
      differences.push({
        field: path || "root",
        value1: settings1,
        value2: settings2,
        type: "modified",
      });
    }
    return differences;
  }

  const allKeys = new Set([
    ...Object.keys(settings1 ?? {}),
    ...Object.keys(settings2 ?? {}),
  ]);

  for (const key of allKeys) {
    const newPath = path ? `${path}.${key}` : key;
    const value1 = settings1?.[key];
    const value2 = settings2?.[key];

    if (!(key in (settings1 ?? {}))) {
      differences.push({
        field: newPath,
        value1: undefined,
        value2,
        type: "added_in_v2",
      });
    } else if (!(key in (settings2 ?? {}))) {
      differences.push({
        field: newPath,
        value1,
        value2: undefined,
        type: "removed_in_v2",
      });
    } else {
      differences.push(...calculateDifferences(value1, value2, newPath));
    }
  }

  return differences;
}

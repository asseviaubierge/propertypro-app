/**
 * PropertyPro - Tenant Notification Settings API
 * Handles CRUD operations for tenant notification preferences
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { NotificationSettings } from "@/models";
import {
  createSuccessResponse as createApiSuccessResponse,
  createErrorResponse as createApiErrorResponse,
} from "@/lib/api-utils";
import { resolveAccessProfile } from "@/lib/server-permissions";

// ============================================================================
// GET - Fetch tenant's notification settings
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return createApiErrorResponse(
        "Authentication required",
        401,
        "Authentication required"
      );
    }

    const accessProfile = await resolveAccessProfile(session.user.role);
    if (!accessProfile.isTenant) {
      return createApiErrorResponse(
        "Access denied. Tenant role required.",
        403,
        "Access denied. Tenant role required."
      );
    }

    await connectDB();

    // Find the tenant's notification settings
    const settings = await NotificationSettings.findOne({
      tenantId: session.user.id,
    }).lean();

    return createApiSuccessResponse<typeof settings | null>(
      settings ?? null,
      "Notification settings fetched successfully"
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to fetch notification settings";

    return createApiErrorResponse(errorMessage, 500, errorMessage);
  }
}

// ============================================================================
// POST - Create new notification settings
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return createApiErrorResponse(
        "Authentication required",
        401,
        "Authentication required"
      );
    }

    const accessProfile = await resolveAccessProfile(session.user.role);
    if (!accessProfile.isTenant) {
      return createApiErrorResponse(
        "Access denied. Tenant role required.",
        403,
        "Access denied. Tenant role required."
      );
    }

    const body = await request.json();
    const { emailNotifications, reminderSchedule, preferences } = body;

    // Validation
    if (!emailNotifications || !reminderSchedule || !preferences) {
      return createApiErrorResponse(
        "Missing required fields",
        400,
        "Missing required fields"
      );
    }

    if (!preferences.emailAddress) {
      return createApiErrorResponse(
        "Email address is required",
        400,
        "Email address is required"
      );
    }

    await connectDB();

    // Check if settings already exist
    const existingSettings = await NotificationSettings.findOne({
      tenantId: session.user.id,
    });

    if (existingSettings) {
      return createApiErrorResponse(
        "Notification settings already exist. Use PUT to update.",
        409,
        "Notification settings already exist. Use PUT to update."
      );
    }

    // Create new notification settings
    const settings = new NotificationSettings({
      tenantId: session.user.id,
      emailNotifications: {
        paymentReminders: emailNotifications.paymentReminders || false,
        paymentConfirmations: emailNotifications.paymentConfirmations || false,
        overdueNotices: emailNotifications.overdueNotices || false,
        receiptDelivery: emailNotifications.receiptDelivery || false,
      },
      reminderSchedule: {
        daysBeforeDue: reminderSchedule.daysBeforeDue || [7, 3, 1],
        overdueReminders: reminderSchedule.overdueReminders || false,
        overdueFrequency: reminderSchedule.overdueFrequency || "weekly",
      },
      preferences: {
        emailAddress: preferences.emailAddress,
        phoneNumber: preferences.phoneNumber || null,
        smsNotifications: preferences.smsNotifications || false,
        timezone: preferences.timezone || "America/New_York",
      },
    });

    await settings.save();

    return createApiSuccessResponse<typeof settings>(
      settings,
      "Notification settings created successfully"
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to create notification settings";

    return createApiErrorResponse(errorMessage, 500, errorMessage);
  }
}

// ============================================================================
// PUT - Update notification settings
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return createApiErrorResponse(
        "Authentication required",
        401,
        "Authentication required"
      );
    }

    const accessProfile = await resolveAccessProfile(session.user.role);
    if (!accessProfile.isTenant) {
      return createApiErrorResponse(
        "Access denied. Tenant role required.",
        403,
        "Access denied. Tenant role required."
      );
    }

    const body = await request.json();
    const { emailNotifications, reminderSchedule, preferences } = body;

    await connectDB();

    // Find existing settings
    let settings = await NotificationSettings.findOne({
      tenantId: session.user.id,
    });

    if (!settings) {
      // Create new settings if they don't exist
      settings = new NotificationSettings({
        tenantId: session.user.id,
        emailNotifications: {
          paymentReminders: false,
          paymentConfirmations: false,
          overdueNotices: false,
          receiptDelivery: false,
        },
        reminderSchedule: {
          daysBeforeDue: [7, 3, 1],
          overdueReminders: false,
          overdueFrequency: "weekly",
        },
        preferences: {
          emailAddress: session.user.email || "",
          smsNotifications: false,
          timezone: "America/New_York",
        },
      });
    }

    // Update settings
    if (emailNotifications) {
      settings.emailNotifications = {
        paymentReminders:
          emailNotifications.paymentReminders ??
          settings.emailNotifications.paymentReminders,
        paymentConfirmations:
          emailNotifications.paymentConfirmations ??
          settings.emailNotifications.paymentConfirmations,
        overdueNotices:
          emailNotifications.overdueNotices ??
          settings.emailNotifications.overdueNotices,
        receiptDelivery:
          emailNotifications.receiptDelivery ??
          settings.emailNotifications.receiptDelivery,
      };
    }

    if (reminderSchedule) {
      settings.reminderSchedule = {
        daysBeforeDue:
          reminderSchedule.daysBeforeDue ??
          settings.reminderSchedule.daysBeforeDue,
        overdueReminders:
          reminderSchedule.overdueReminders ??
          settings.reminderSchedule.overdueReminders,
        overdueFrequency:
          reminderSchedule.overdueFrequency ??
          settings.reminderSchedule.overdueFrequency,
      };
    }

    if (preferences) {
      settings.preferences = {
        emailAddress:
          preferences.emailAddress ?? settings.preferences.emailAddress,
        phoneNumber:
          preferences.phoneNumber ?? settings.preferences.phoneNumber,
        smsNotifications:
          preferences.smsNotifications ?? settings.preferences.smsNotifications,
        timezone: preferences.timezone ?? settings.preferences.timezone,
      };
    }

    await settings.save();

    return createApiSuccessResponse<typeof settings>(
      settings,
      "Notification settings updated successfully"
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to update notification settings";

    return createApiErrorResponse(errorMessage, 500, errorMessage);
  }
}

// ============================================================================
// DELETE - Delete notification settings
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return createApiErrorResponse(
        "Authentication required",
        401,
        "Authentication required"
      );
    }

    const accessProfile = await resolveAccessProfile(session.user.role);
    if (!accessProfile.isTenant) {
      return createApiErrorResponse(
        "Access denied. Tenant role required.",
        403,
        "Access denied. Tenant role required."
      );
    }

    await connectDB();

    // Delete the notification settings
    const result = await NotificationSettings.findOneAndDelete({
      tenantId: session.user.id,
    });

    if (!result) {
      return createApiErrorResponse(
        "Notification settings not found",
        404,
        "Notification settings not found"
      );
    }

    return createApiSuccessResponse<null>(
      null,
      "Notification settings deleted successfully"
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to delete notification settings";

    return createApiErrorResponse(errorMessage, 500, errorMessage);
  }
}

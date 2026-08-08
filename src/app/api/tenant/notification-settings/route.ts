import { NextRequest } from "next/server";
import { NotificationSettings } from "@/models";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";

const DEFAULT_SETTINGS = {
  email: { enabled: true, paymentReminders: true, maintenanceUpdates: true, leaseReminders: true },
  sms: { enabled: false, paymentReminders: false, maintenanceUpdates: false, leaseReminders: false },
  push: { enabled: true, paymentReminders: true, maintenanceUpdates: true, leaseReminders: true, tenantMessages: true },
  inApp: { enabled: true, showDesktop: true, playSound: true, showBadges: true, autoMarkRead: false, retentionDays: 30 },
};

export const GET = withPermissionAndDB("profile_management")(
  async (user: AuthenticatedAccessUser) => {
    try {
      let settings = await NotificationSettings.findOne({ userId: user.id, isActive: true }).lean();
      if (!settings) {
        settings = await NotificationSettings.create({ userId: user.id, ...DEFAULT_SETTINGS, createdBy: user.id });
      }
      return createSuccessResponse(settings, "Préférences de notification récupérées");
    } catch (error) {
      return handleApiError(error, "Impossible de charger les préférences de notification");
    }
  },
);

export const PUT = withPermissionAndDB("profile_management")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const body = await request.json();
      const allowed = ["email", "sms", "push", "inApp"];
      const update: Record<string, unknown> = { updatedBy: user.id, isActive: true };
      for (const key of allowed) if (body?.[key] && typeof body[key] === "object") update[key] = body[key];
      const settings = await NotificationSettings.findOneAndUpdate(
        { userId: user.id },
        { $set: update, $setOnInsert: { userId: user.id, createdBy: user.id } },
        { new: true, upsert: true, runValidators: true },
      );
      return createSuccessResponse(settings, "Préférences de notification mises à jour");
    } catch (error) {
      return handleApiError(error, "Impossible de mettre à jour les préférences de notification");
    }
  },
);

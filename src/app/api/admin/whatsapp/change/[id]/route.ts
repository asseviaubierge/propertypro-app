import { NextRequest } from "next/server";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";
import User from "@/models/User";
import Notification from "@/models/Notification";
import {
  notificationService,
  NotificationPriority,
  NotificationType,
} from "@/lib/notification-service";

export const PATCH = withPermissionAndDB("system_settings")(
  async (admin: any, request: NextRequest, context: any) => {
    try {
      const { id } = await context.params;
      const body = await request.json().catch(() => ({}));
      if (!["approve", "reject"].includes(body.action)) {
        return createErrorResponse("Décision WhatsApp invalide", 400);
      }
      const action: "approve" | "reject" = body.action;

      const user: any = await User.findById(id);
      if (!user) return createErrorResponse("Utilisateur introuvable", 404);
      if (user.whatsappChangeStatus !== "pending") {
        return createErrorResponse(
          "Cette demande de changement WhatsApp a déjà été traitée.",
          409
        );
      }
      if (
        user.whatsappVerificationStatus !== "verified" ||
        !user.whatsappChangeRequestedNumber ||
        String(user.whatsappChangeReason || "").trim().length < 10
      ) {
        return createErrorResponse(
          "La demande de changement WhatsApp est incomplète ou invalide.",
          400
        );
      }

      user.whatsappChangeStatus = action === "approve" ? "approved" : "rejected";
      user.whatsappChangeReviewedAt = new Date();
      user.whatsappChangeReviewedBy = admin.id;
      await user.save();

      await Notification.updateMany(
        {
          "metadata.whatsappChangeUserId": String(user._id),
          read: false,
        },
        { $set: { read: true, readAt: new Date() } }
      );

      const approved = action === "approve";
      await notificationService.sendNotification({
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        priority: approved
          ? NotificationPriority.HIGH
          : NotificationPriority.NORMAL,
        userId: String(user._id),
        title: approved
          ? "Changement WhatsApp autorisé"
          : "Changement WhatsApp refusé",
        message: approved
          ? `E-IMMO autorise le changement vers ${user.whatsappChangeRequestedNumber}. Envoyez maintenant le code depuis ce nouveau numéro pour terminer sa vérification. Votre ancien numéro reste valide jusqu'à la confirmation finale.`
          : `E-IMMO a refusé le changement vers ${user.whatsappChangeRequestedNumber}. Votre numéro WhatsApp actuellement vérifié reste inchangé.`,
        data: { actionUrl: "/dashboard/settings/profile#whatsapp-eimmo" },
        preferences: { email: false, sms: false, push: true, inApp: true },
      });

      return createSuccessResponse({
        whatsappChangeStatus: user.whatsappChangeStatus,
        whatsappChangeReviewedAt: user.whatsappChangeReviewedAt,
      });
    } catch (error) {
      return handleApiError(
        error,
        "Impossible de traiter la demande de changement WhatsApp"
      );
    }
  }
);

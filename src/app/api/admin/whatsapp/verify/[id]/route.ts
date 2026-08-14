import { NextRequest } from "next/server";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";
import User from "@/models/User";
import Notification from "@/models/Notification";
import WhatsAppVerificationRequest from "@/models/WhatsAppVerificationRequest";
import {
  notificationService,
  NotificationPriority,
  NotificationType,
} from "@/lib/notification-service";

function normalizePhone(value: string) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  return raw.startsWith("+") ? `+${digits}` : digits;
}

export const PATCH = withPermissionAndDB("system_settings")(
  async (admin: any, request: NextRequest, context: any) => {
    try {
      const { id } = await context.params;
      const body = await request.json().catch(() => ({}));
      const action = body.action === "reject" ? "reject" : "verify";

      const user: any = await User.findById(id);
      if (!user) return createErrorResponse("Utilisateur introuvable", 404);

      const verificationRequest: any = body.requestId
        ? await WhatsAppVerificationRequest.findOne({
            _id: body.requestId,
            userId: user._id,
            status: "pending",
          })
        : await WhatsAppVerificationRequest.findOne({
            userId: user._id,
            status: "pending",
          }).sort({ requestedAt: -1 });

      if (!verificationRequest) {
        return createErrorResponse(
          "Aucune demande de vérification WhatsApp en attente pour ce compte",
          400
        );
      }

      const isNumberChange =
        user.whatsappVerificationStatus === "verified" &&
        user.whatsappChangeStatus === "verification_pending" &&
        normalizePhone(user.whatsappChangeRequestedNumber || "") ===
          normalizePhone(verificationRequest.requestedNumber || "");

      if (action === "reject") {
        verificationRequest.status = "rejected";
        verificationRequest.reviewedBy = admin.id;
        verificationRequest.reviewedAt = new Date();
        verificationRequest.rejectedAt = new Date();
        await verificationRequest.save();

        if (isNumberChange) {
          // Le refus de la vérification du nouveau numéro ne révoque jamais
          // l'ancien numéro déjà vérifié.
          user.whatsappChangeStatus = "rejected";
          user.whatsappChangeReviewedAt = new Date();
          user.whatsappChangeReviewedBy = admin.id;
        } else {
          user.whatsappVerificationStatus = "rejected";
          user.whatsappVerificationRejectedAt = new Date();
          user.whatsappVerifiedAt = null;
          user.whatsappVerifiedBy = null;
        }
        await user.save();

        await Notification.updateMany(
          { "metadata.whatsappVerificationRequestId": String(verificationRequest._id), read: false },
          { $set: { read: true, readAt: new Date() } }
        );

        await notificationService.sendNotification({
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          priority: NotificationPriority.NORMAL,
          userId: String(user._id),
          title: isNumberChange
            ? "Nouveau numéro WhatsApp non confirmé"
            : "Vérification WhatsApp refusée",
          message: isNumberChange
            ? `E-IMMO n'a pas pu confirmer le nouveau numéro ${verificationRequest.requestedNumber}. Votre ancien numéro ${user.whatsappNumber} reste vérifié et inchangé.`
            : "E-IMMO n'a pas pu confirmer votre numéro WhatsApp. Vérifiez le numéro puis envoyez une nouvelle demande.",
          data: { actionUrl: "/dashboard/settings/profile#whatsapp-eimmo" },
          preferences: { email: false, sms: false, push: true, inApp: true },
        });

        return createSuccessResponse({ status: "rejected" });
      }

      // Sans message réellement reçu sur WhatsApp, aucune validation n'est autorisée.
      if (body.messageReceived !== true) {
        return createErrorResponse(
          "Confirmez d'abord que le message a réellement été reçu sur le WhatsApp officiel E-IMMO.",
          400
        );
      }

      const receivedCode = String(body.receivedCode || "").trim().toUpperCase();
      const expectedCode = String(verificationRequest.verificationCode || "").trim().toUpperCase();
      if (!receivedCode) {
        return createErrorResponse("Saisissez le code reçu dans le message WhatsApp.", 400);
      }
      if (receivedCode !== expectedCode) {
        return createErrorResponse("Le code reçu sur WhatsApp ne correspond pas à la demande E-IMMO.", 400);
      }

      const verifiedNumber = normalizePhone(
        body.whatsappNumber || verificationRequest.requestedNumber || user.phone || ""
      );
      const digits = verifiedNumber.replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 15) {
        return createErrorResponse("Numéro WhatsApp invalide", 400);
      }
      if (
        isNumberChange &&
        verifiedNumber !== normalizePhone(user.whatsappChangeRequestedNumber || "")
      ) {
        return createErrorResponse(
          "Le numéro expéditeur ne correspond pas au nouveau numéro autorisé. Refusez cette vérification et demandez une nouvelle justification.",
          400
        );
      }

      verificationRequest.status = "verified";
      verificationRequest.confirmedSenderNumber = verifiedNumber;
      verificationRequest.receivedCode = receivedCode;
      verificationRequest.messageConfirmedReceived = true;
      verificationRequest.reviewedBy = admin.id;
      verificationRequest.reviewedAt = new Date();
      await verificationRequest.save();

      if (isNumberChange) {
        user.whatsappPreviousNumber = user.whatsappNumber || "";
        user.whatsappChangeStatus = "completed";
        user.whatsappChangeReviewedAt = new Date();
        user.whatsappChangeReviewedBy = admin.id;
      }
      user.whatsappNumber = verifiedNumber;
      user.whatsappVerificationStatus = "verified";
      user.whatsappVerifiedAt = new Date();
      user.whatsappVerifiedBy = admin.id;
      user.whatsappVerificationRejectedAt = null;
      await user.save();

      await Notification.updateMany(
        { "metadata.whatsappVerificationRequestId": String(verificationRequest._id), read: false },
        { $set: { read: true, readAt: new Date() } }
      );

      await notificationService.sendNotification({
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        priority: NotificationPriority.NORMAL,
        userId: String(user._id),
        title: isNumberChange
          ? "Nouveau numéro WhatsApp vérifié"
          : "WhatsApp vérifié par E-IMMO",
        message: isNumberChange
          ? `Votre nouveau numéro WhatsApp ${verifiedNumber} a été vérifié par E-IMMO et remplace désormais l'ancien numéro.`
          : `Votre numéro WhatsApp ${verifiedNumber} a été vérifié par E-IMMO.`,
        data: { actionUrl: "/dashboard/settings/profile#whatsapp-eimmo" },
        preferences: { email: false, sms: false, push: true, inApp: true },
      });

      return createSuccessResponse({
        _id: user._id,
        requestId: verificationRequest._id,
        whatsappNumber: user.whatsappNumber,
        whatsappVerificationStatus: "verified",
        whatsappVerifiedAt: user.whatsappVerifiedAt,
      });
    } catch (error) {
      return handleApiError(error, "Impossible de traiter la vérification WhatsApp");
    }
  }
);

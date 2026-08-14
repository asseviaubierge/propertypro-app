export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Notification from "@/models/Notification";
import WhatsAppVerificationRequest from "@/models/WhatsAppVerificationRequest";
import { notificationService, NotificationPriority, NotificationType } from "@/lib/notification-service";
import { UserRole } from "@/types";
import { createErrorResponse, createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { getPublicBranding } from "@/lib/utils/public-branding";

function normalizePhone(value: string) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  return raw.startsWith("+") ? `+${digits}` : digits;
}
function validPhone(value: string) { const n = value.replace(/\D/g, "").length; return n >= 8 && n <= 15; }
async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  await connectDB();
  return User.findById(session.user.id);
}
function payload(profile: any) {
  return {
    phone: profile.phone || "", whatsappNumber: profile.whatsappNumber || profile.phone || "",
    whatsappVerificationStatus: profile.whatsappVerificationStatus || "not_requested",
    whatsappVerificationCode: profile.whatsappVerificationCode || "",
    whatsappVerificationRequestedAt: profile.whatsappVerificationRequestedAt || null,
    whatsappVerificationRejectedAt: profile.whatsappVerificationRejectedAt || null,
    whatsappVerifiedAt: profile.whatsappVerifiedAt || null,
    whatsappPreviousNumber: profile.whatsappPreviousNumber || "",
    whatsappChangeRequestedNumber: profile.whatsappChangeRequestedNumber || "",
    whatsappChangeReason: profile.whatsappChangeReason || "",
    whatsappChangeStatus: profile.whatsappChangeStatus || "none",
    whatsappChangeRequestedAt: profile.whatsappChangeRequestedAt || null,
    whatsappChangeReviewedAt: profile.whatsappChangeReviewedAt || null,
  };
}
export async function GET() {
  try { const profile:any=await getCurrentUser(); if(!profile) return createErrorResponse("Authentification requise",401); return createSuccessResponse(payload(profile)); }
  catch(error){ return handleApiError(error,"Impossible de charger les informations WhatsApp"); }
}
export async function POST(request: NextRequest) {
  try {
    const profile:any=await getCurrentUser(); if(!profile) return createErrorResponse("Authentification requise",401);
    let body:any={}; try{body=await request.json();}catch{return createErrorResponse("Données de vérification WhatsApp invalides",400);}
    const number=normalizePhone(body.whatsappNumber || profile.whatsappNumber || profile.phone || "");
    if(!validPhone(number)) return createErrorResponse("Numéro WhatsApp invalide. Vérifiez le numéro puis réessayez.",400);

    const currentVerifiedNumber = normalizePhone(profile.whatsappNumber || "");
    const startingApprovedChange =
      profile.whatsappVerificationStatus === "verified" &&
      profile.whatsappChangeStatus === "approved" &&
      number === normalizePhone(profile.whatsappChangeRequestedNumber || "");
    const approvedChangeVerification =
      profile.whatsappVerificationStatus === "verified" &&
      ["approved", "verification_pending"].includes(profile.whatsappChangeStatus) &&
      number === normalizePhone(profile.whatsappChangeRequestedNumber || "");

    if (
      profile.whatsappVerificationStatus === "verified" &&
      number === currentVerifiedNumber
    ) {
      return createErrorResponse(
        "Ce numéro WhatsApp est déjà vérifié. Saisissez un autre numéro pour demander un changement.",
        409
      );
    }

    // Un numéro déjà vérifié ne peut être remplacé directement. Une demande
    // motivée doit d'abord être autorisée par le Super Admin E-IMMO.
    if(
      profile.whatsappVerificationStatus === "verified" &&
      number !== currentVerifiedNumber &&
      !approvedChangeVerification
    ) {
      const reason=String(body.changeReason || "").trim();
      if(reason.length < 10) return createErrorResponse("Expliquez le motif du changement de numéro (au moins 10 caractères).",400);
      if(["pending", "verification_pending"].includes(profile.whatsappChangeStatus)) {
        return createErrorResponse("Une demande de changement WhatsApp est déjà en cours de traitement.",409);
      }
      profile.whatsappChangeRequestedNumber=number;
      profile.whatsappChangeReason=reason;
      profile.whatsappChangeStatus="pending";
      profile.whatsappChangeRequestedAt=new Date();
      profile.whatsappChangeReviewedAt=null;
      profile.whatsappChangeReviewedBy=null;
      await profile.save();

      const admins: any[] = await User.find({
        role: UserRole.ADMIN,
        isActive: { $ne: false },
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      }).select("_id").lean();
      const accountName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || profile.email || "Utilisateur E-IMMO";

      for (const admin of admins) {
        const alreadyNotified = await Notification.exists({
          userId: admin._id,
          read: false,
          "metadata.whatsappChangeUserId": String(profile._id),
        });
        if (!alreadyNotified) {
          await notificationService.sendNotification({
            type: NotificationType.SYSTEM_ANNOUNCEMENT,
            priority: NotificationPriority.HIGH,
            userId: String(admin._id),
            title: "Changement WhatsApp à autoriser",
            message: `${accountName} demande le changement du numéro ${currentVerifiedNumber} vers ${number}. Consultez la justification avant de décider.`,
            data: {
              actionUrl: "/dashboard/admin/whatsapp",
              whatsappChangeUserId: String(profile._id),
              currentNumber: currentVerifiedNumber,
              requestedNumber: number,
              reason,
              audience: "admin",
              recipientRole: "admin",
            },
            preferences: { email: false, sms: false, push: true, inApp: true },
          });
        }
      }
      return createSuccessResponse({...payload(profile), changeRequestCreated:true});
    }

    // Une autorisation ne remplace pas encore l'ancien numéro : elle permet
    // seulement d'ouvrir la vérification du nouveau numéro.
    if(
      startingApprovedChange ||
      !profile.whatsappVerificationCode ||
      profile.whatsappVerificationStatus === "rejected"
    ) {
      profile.whatsappVerificationCode=`WA-${randomBytes(3).toString("hex").toUpperCase()}`;
    }
    profile.whatsappVerificationRequestedAt=new Date();
    profile.whatsappVerificationRejectedAt=null;

    if (approvedChangeVerification) {
      profile.whatsappChangeStatus="verification_pending";
    } else {
      // Tant que le premier numéro n'est pas vérifié, il reste librement modifiable.
      profile.whatsappNumber=number;
      profile.whatsappVerificationStatus="pending";
      profile.whatsappVerifiedAt=null;
      profile.whatsappVerifiedBy=null;
    }

    // IMPORTANT : la demande est enregistrée AVANT l'ouverture de WhatsApp.
    // Le Super Admin doit donc voir immédiatement ce compte dans « En attente »,
    // même si l'utilisateur ferme WhatsApp sans envoyer le message.
    await profile.save();

    // Sécurité supplémentaire : persister explicitement le statut de la demande.
    // Ainsi la page Super Admin voit immédiatement la demande « pending »,
    // indépendamment de l'ouverture ou de l'envoi effectif du message WhatsApp.
    const persistedFields: any = {
      whatsappVerificationCode: profile.whatsappVerificationCode,
      whatsappVerificationRequestedAt: profile.whatsappVerificationRequestedAt,
      whatsappVerificationRejectedAt: null,
    };
    if (approvedChangeVerification) {
      persistedFields.whatsappChangeStatus = "verification_pending";
    } else {
      Object.assign(persistedFields, {
        whatsappNumber: number,
        whatsappVerificationStatus: "pending",
        whatsappVerifiedAt: null,
        whatsappVerifiedBy: null,
      });
    }

    await User.updateOne(
      { _id: profile._id },
      { $set: persistedFields }
    );

    // Dossier autonome de vérification : c'est désormais la source de vérité
    // de la file « En attente » du Super Admin.
    let verificationRequest: any = await WhatsAppVerificationRequest.findOne({
      userId: profile._id,
      status: "pending",
    }).sort({ requestedAt: -1 });

    if (verificationRequest) {
      verificationRequest.requestedNumber = number;
      verificationRequest.verificationCode = profile.whatsappVerificationCode;
      verificationRequest.requestedAt = profile.whatsappVerificationRequestedAt;
      verificationRequest.messageConfirmedReceived = false;
      verificationRequest.confirmedSenderNumber = null;
      verificationRequest.receivedCode = null;
      await verificationRequest.save();
    } else {
      verificationRequest = await WhatsAppVerificationRequest.create({
        userId: profile._id,
        requestedNumber: number,
        verificationCode: profile.whatsappVerificationCode,
        status: "pending",
        requestedAt: profile.whatsappVerificationRequestedAt,
      });
    }

    // Notification interne adressée à chaque compte Super Admin.
    const admins: any[] = await User.find({
      role: UserRole.ADMIN,
      isActive: { $ne: false },
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    }).select("_id").lean();

    const accountName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || profile.email || "Utilisateur E-IMMO";

    for (const admin of admins) {
      const alreadyNotified = await Notification.exists({
        userId: admin._id,
        read: false,
        "metadata.whatsappVerificationRequestId": String(verificationRequest._id),
      });

      if (!alreadyNotified) {
        await notificationService.sendNotification({
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          priority: NotificationPriority.HIGH,
          userId: String(admin._id),
          title: "Vérification WhatsApp à contrôler",
          message: `${accountName} demande la vérification du numéro ${number}. Attendez le message WhatsApp puis comparez le code reçu avant validation.`,
          data: {
            actionUrl: "/dashboard/admin/whatsapp",
            whatsappVerificationRequestId: String(verificationRequest._id),
            requesterUserId: String(profile._id),
            requestedNumber: number,
            verificationCode: profile.whatsappVerificationCode,
            audience: "admin",
            recipientRole: "admin",
          },
          preferences: { email: false, sms: false, push: true, inApp: true },
        });
      }
    }

    const branding=await getPublicBranding();
    if(!branding.whatsappEnabled || !branding.whatsappNumber) return createErrorResponse("Le numéro WhatsApp officiel E-IMMO n'est pas encore configuré dans les paramètres d'administration.",503);
    const adminNumber=String(branding.whatsappNumber).replace(/\D/g,"");
    if(adminNumber.length<8) return createErrorResponse("Le numéro WhatsApp officiel E-IMMO configuré est invalide.",503);
    const message=["Bonjour Admin E-IMMO,","",approvedChangeVerification?"je vérifie mon nouveau numéro WhatsApp autorisé depuis mon compte E-IMMO.":"je vérifie mon numéro WhatsApp depuis mon compte E-IMMO.","",`Compte : ${accountName}`,`E-mail : ${profile.email||""}`,`Code de vérification : ${profile.whatsappVerificationCode}`,"","Merci de confirmer mon numéro dans GESTION E-IMMO."].join("\n");
    return createSuccessResponse({...payload(profile), whatsappUrl:`https://wa.me/${adminNumber}?text=${encodeURIComponent(message)}`});
  } catch(error){ return handleApiError(error,"Impossible de démarrer la vérification WhatsApp"); }
}

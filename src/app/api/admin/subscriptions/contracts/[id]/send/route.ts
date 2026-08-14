import { NextRequest } from "next/server";
import {
  createSuccessResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";
import SubscriptionContract from "@/models/SubscriptionContract";
import { emailService } from "@/lib/services/email.service";

const digits = (value: string) => String(value || "").replace(/\D/g, "");

export const POST = withPermissionAndDB("system_settings")(
  async (_user: any, req: NextRequest, context: any) => {
    try {
      const { id } = await context.params;
      const body = await req.json().catch(() => ({}));
      const channel = body?.channel === "whatsapp" ? "whatsapp" : "email";

      const contract: any = await SubscriptionContract.findById(id)
        .populate(
          "accountId",
          "firstName lastName businessName email phone whatsappNumber whatsappVerificationStatus whatsappVerifiedAt"
        )
        .exec();

      if (!contract) {
        return Response.json(
          { success: false, error: "Contrat introuvable" },
          { status: 404 }
        );
      }

      if (
        !String(contract.contractBody || "").includes(
          "ARTICLE 22 — VALIDATION AVANT ACCÈS"
        )
      ) {
        return Response.json(
          {
            success: false,
            error:
              "Le contrat doit d'abord être régénéré avec la version complète avant envoi.",
          },
          { status: 400 }
        );
      }

      const account: any = contract.accountId || {};
      const baseUrl =
        process.env.NEXTAUTH_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3000";

      const reviewUrl = `${baseUrl}/dashboard/contracts/${contract._id}`;
      const pdfUrl = `${baseUrl}/api/contracts/${contract._id}/pdf`;
      const name =
        account.businessName ||
        `${account.firstName || ""} ${account.lastName || ""}`.trim() ||
        "Contractant";

      let whatsappUrl: string | null = null;

      if (channel === "email") {
        if (!account.email) {
          return Response.json(
            {
              success: false,
              error: "Le contractant ne possède pas d'adresse e-mail.",
            },
            { status: 400 }
          );
        }

        const result = await emailService.sendEmail({
          to: account.email,
          subject: `E-IMMO.BJ — Contrat ${contract.contractNumber} à lire et signer`,
          text: `Bonjour ${name},

E-IMMO.BJ vous a transmis le contrat ${contract.contractNumber}. Prenez le temps de le lire avant de le signer.

Consulter le contrat : ${reviewUrl}
PDF : ${pdfUrl}

Le document restera conservé dans votre espace E-IMMO.`,
          html: `<p>Bonjour <b>${name}</b>,</p>
<p>E-IMMO.BJ vous a transmis le contrat <b>${contract.contractNumber}</b>.</p>
<p>Prenez le temps de lire l'intégralité du document avant signature.</p>
<p><a href="${reviewUrl}">Consulter et signer le contrat</a></p>
<p><a href="${pdfUrl}">Voir le PDF</a></p>`,
        });

        if (!result.success) {
          return Response.json(
            {
              success: false,
              error: `E-mail non envoyé : ${
                result.error || "configuration SMTP à vérifier"
              }`,
            },
            { status: 502 }
          );
        }
      } else {
        if (
          account.whatsappVerificationStatus !== "verified" ||
          !account.whatsappVerifiedAt ||
          !account.whatsappNumber
        ) {
          return Response.json(
            {
              success: false,
              error:
                "Le numéro WhatsApp du contractant doit d'abord être vérifié par le Super Administrateur E-IMMO.",
            },
            { status: 400 }
          );
        }

        const message = `Bonjour ${name},

GESTION E-IMMO.BJ vous transmet le contrat ${contract.contractNumber} pour lecture et signature.

Lire et signer :
${reviewUrl}

Document PDF :
${pdfUrl}

Prenez le temps de lire l'intégralité du document avant de signer.`;

        whatsappUrl =
          `https://wa.me/${digits(account.whatsappNumber)}?text=` +
          encodeURIComponent(message);
      }

      contract.signatureStatus = "pending_signature";
      contract.status = "pending_signature";
      contract.sentAt = new Date();
      contract.lastDeliveryChannel = channel;
      await contract.save();

      const updated = await SubscriptionContract.findById(id)
        .populate(
          "accountId",
          "firstName lastName businessName email phone whatsappNumber whatsappVerificationStatus whatsappVerifiedAt role accountType"
        )
        .lean();

      return createSuccessResponse(
        { contract: updated, whatsappUrl },
        channel === "whatsapp"
          ? "Conversation WhatsApp préparée. Vérifiez le message puis appuyez sur Envoyer dans WhatsApp."
          : "Contrat envoyé par e-mail pour lecture et signature"
      );
    } catch (error) {
      return handleApiError(
        error,
        "Impossible d'envoyer le contrat au contractant"
      );
    }
  }
);

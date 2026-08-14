export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
} from "@/lib/api-utils";
import { getPublicBranding } from "@/lib/utils/public-branding";

function normalizePhone(value: string) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  return raw.startsWith("+") ? `+${digits}` : digits;
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return createErrorResponse("Données de vérification invalides", 400);
    }

    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim().toUpperCase();
    const requestedNumber = normalizePhone(body.whatsappNumber || "");

    if (!email || !code) {
      return createErrorResponse(
        "Adresse e-mail ou code de vérification manquant",
        400
      );
    }

    const user: any = await User.findOne({
      email,
      whatsappVerificationCode: code,
      isActive: { $ne: false },
    });

    if (!user) {
      return createErrorResponse(
        "Impossible d'identifier ce compte pour la vérification WhatsApp",
        404
      );
    }

    if (!user.emailVerified) {
      return createErrorResponse(
        "L'adresse e-mail doit d'abord être vérifiée",
        403
      );
    }

    if (user.whatsappVerificationStatus === "verified") {
      return createSuccessResponse({
        alreadyVerified: true,
        whatsappVerificationStatus: "verified",
        whatsappNumber: user.whatsappNumber || user.phone || "",
      });
    }

    const number = requestedNumber || normalizePhone(user.phone || "");
    const digits = number.replace(/\D/g, "");

    if (digits.length < 8 || digits.length > 15) {
      return createErrorResponse(
        "Le numéro enregistré est invalide. Corrigez-le avant la vérification WhatsApp.",
        400
      );
    }

    user.whatsappNumber = number;
    user.whatsappVerificationStatus = "pending";
    user.whatsappVerificationRequestedAt = new Date();
    user.whatsappVerificationRejectedAt = null;
    user.whatsappVerifiedAt = null;
    user.whatsappVerifiedBy = null;
    await user.save();

    const branding = await getPublicBranding();
    if (!branding.whatsappEnabled || !branding.whatsappNumber) {
      return createErrorResponse(
        "Le numéro WhatsApp officiel E-IMMO n'est pas configuré.",
        503
      );
    }

    const adminNumber = String(branding.whatsappNumber).replace(/\D/g, "");
    const accountName =
      `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;

    const message = [
      "Bonjour Admin E-IMMO,",
      "",
      "je vérifie mon numéro WhatsApp depuis mon compte E-IMMO.",
      "",
      `Compte : ${accountName}`,
      `E-mail : ${user.email}`,
      `Code de vérification : ${user.whatsappVerificationCode}`,
      "",
      "Merci de confirmer mon numéro dans GESTION E-IMMO.",
    ].join("\\n");

    return createSuccessResponse({
      whatsappVerificationStatus: "pending",
      whatsappVerificationRequestedAt: user.whatsappVerificationRequestedAt,
      whatsappNumber: user.whatsappNumber,
      verificationCode: user.whatsappVerificationCode,
      whatsappUrl:
        `https://wa.me/${adminNumber}?text=` + encodeURIComponent(message),
    });
  } catch (error) {
    return handleApiError(
      error,
      "Impossible de démarrer la vérification WhatsApp"
    );
  }
}

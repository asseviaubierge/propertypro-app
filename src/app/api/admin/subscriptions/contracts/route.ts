import { NextRequest } from "next/server";
import { createSuccessResponse, handleApiError, withPermissionAndDB } from "@/lib/api-utils";
import SubscriptionContract from "@/models/SubscriptionContract";
import User from "@/models/User";
import { calculatePortfolioSnapshot } from "@/lib/services/subscription-portfolio.service";

function contractNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `EIMMO-CTR-${stamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export const GET = withPermissionAndDB("system_settings")(async () => {
  try {
    const contracts = await SubscriptionContract.find({})
      .populate("accountId", "firstName lastName email role businessName accountType phone whatsappNumber whatsappVerificationStatus whatsappVerifiedAt")
      .sort({ updatedAt: -1 })
      .lean();
    return createSuccessResponse(contracts);
  } catch (error) {
    return handleApiError(error, "Impossible de charger les abonnements et mandats");
  }
});

export const POST = withPermissionAndDB("system_settings")(async (user: any, req: NextRequest) => {
  try {
    const body = await req.json();
    const account = await User.findById(body.accountId).select("_id role");
    if (!account) {
      return Response.json({ success: false, error: "Compte introuvable" }, { status: 404 });
    }

    const { snapshot } = await calculatePortfolioSnapshot(String(body.accountId));

    const doc = await SubscriptionContract.create({
      ...body,
      portfolioSnapshot: snapshot,
      contractNumber: contractNumber(),
      platformName: "E-IMMO.BJ",
      platformRepresentative: "GESTION E-IMMO",
      createdBy: user._id || user.id,
      updatedBy: user._id || user.id,
    });

    return createSuccessResponse(doc);
  } catch (error) {
    return handleApiError(error, "Impossible de créer le contrat E-IMMO");
  }
});

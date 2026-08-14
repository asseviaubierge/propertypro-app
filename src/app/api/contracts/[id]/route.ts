import { NextRequest } from "next/server";
import { createSuccessResponse, handleApiError, withAccessAndDB } from "@/lib/api-utils";
import SubscriptionContract from "@/models/SubscriptionContract";
import { UserRole } from "@/types";

function ownsContract(user: any, contract: any) {
  return user.systemRole === UserRole.ADMIN || String(contract.accountId?._id || contract.accountId) === String(user.id);
}

export const GET = withAccessAndDB({})(async (user: any, _req: NextRequest, context: any) => {
  try {
    const { id } = await context.params;
    const contract: any = await SubscriptionContract.findById(id)
      .populate("accountId", "firstName lastName businessName email phone role accountType")
      .lean();
    if (!contract) return Response.json({ success: false, error: "Contrat introuvable" }, { status: 404 });
    if (!ownsContract(user, contract)) return Response.json({ success: false, error: "Vous n'êtes pas autorisé à consulter ce contrat." }, { status: 403 });

    if (user.systemRole !== UserRole.ADMIN && contract.signatureStatus === "pending_signature" && !contract.viewedAt) {
      await SubscriptionContract.findByIdAndUpdate(id, { viewedAt: new Date() });
      contract.viewedAt = new Date();
    }
    return createSuccessResponse(contract);
  } catch (error) {
    return handleApiError(error, "Impossible de charger le contrat");
  }
});

export const PATCH = withAccessAndDB({})(async (user: any, req: NextRequest, context: any) => {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const contract: any = await SubscriptionContract.findById(id).populate("accountId", "firstName lastName businessName email phone");
    if (!contract) return Response.json({ success: false, error: "Contrat introuvable" }, { status: 404 });
    if (!ownsContract(user, contract)) return Response.json({ success: false, error: "Vous n'êtes pas autorisé à signer ce contrat." }, { status: 403 });
    if (user.systemRole === UserRole.ADMIN) return Response.json({ success: false, error: "La signature du client doit être effectuée depuis son propre compte." }, { status: 400 });
    if (contract.signatureStatus !== "pending_signature") return Response.json({ success: false, error: "Ce contrat n'est pas actuellement en attente de signature." }, { status: 400 });
    if (!body.acknowledged || !String(body.signatoryName || "").trim()) return Response.json({ success: false, error: "Vous devez confirmer la lecture du contrat et saisir votre nom avant signature." }, { status: 400 });

    contract.signatureStatus = "signed";
    contract.status = "signed";
    contract.signatoryAcknowledgement = true;
    contract.signatoryName = String(body.signatoryName).trim();
    contract.signedAt = new Date();
    contract.viewedAt = contract.viewedAt || new Date();
    await contract.save();

    const updated = await SubscriptionContract.findById(id)
      .populate("accountId", "firstName lastName businessName email phone role accountType")
      .lean();
    return createSuccessResponse(updated, "Contrat signé et conservé dans E-IMMO");
  } catch (error) {
    return handleApiError(error, "Impossible de signer le contrat");
  }
});

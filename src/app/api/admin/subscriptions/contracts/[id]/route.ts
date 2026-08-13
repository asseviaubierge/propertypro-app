import { NextRequest } from "next/server";
import { createSuccessResponse, handleApiError, withPermissionAndDB } from "@/lib/api-utils";
import SubscriptionContract from "@/models/SubscriptionContract";

export const GET = withPermissionAndDB("system_settings")(async (_user: any, _req: NextRequest, context: any) => {
  try {
    const { id } = await context.params;
    const contract = await SubscriptionContract.findById(id)
      .populate("accountId", "firstName lastName email phone role businessName accountType cip ifu rccm")
      .lean();
    if (!contract) return Response.json({ success: false, error: "Contrat introuvable" }, { status: 404 });
    return createSuccessResponse(contract);
  } catch (error) {
    return handleApiError(error, "Impossible de charger le contrat");
  }
});

export const PATCH = withPermissionAndDB("system_settings")(async (user: any, req: NextRequest, context: any) => {
  try {
    const { id } = await context.params;
    const body = await req.json();
    delete body._id;
    delete body.contractNumber;
    delete body.createdBy;
    delete body.accountId;
    delete body.platformName;
    const contract = await SubscriptionContract.findByIdAndUpdate(
      id,
      { ...body, updatedBy: user._id || user.id, platformName: "E-IMMO" },
      { new: true, runValidators: true }
    );
    if (!contract) return Response.json({ success: false, error: "Contrat introuvable" }, { status: 404 });
    return createSuccessResponse(contract);
  } catch (error) {
    return handleApiError(error, "Impossible de modifier le contrat");
  }
});

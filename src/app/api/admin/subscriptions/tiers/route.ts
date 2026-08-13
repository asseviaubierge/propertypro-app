import { NextRequest } from "next/server";
import { createSuccessResponse, handleApiError, withPermissionAndDB } from "@/lib/api-utils";
import SubscriptionTier from "@/models/SubscriptionTier";

export const GET = withPermissionAndDB("system_settings")(async () => {
  try {
    return createSuccessResponse(await SubscriptionTier.find({}).sort({ sortOrder: 1, minHouseholds: 1 }).lean());
  } catch (error) {
    return handleApiError(error, "Impossible de charger les barèmes");
  }
});

export const POST = withPermissionAndDB("system_settings")(async (_user: any, req: NextRequest) => {
  try {
    const body = await req.json();
    return createSuccessResponse(await SubscriptionTier.create(body));
  } catch (error) {
    return handleApiError(error, "Impossible d'enregistrer le barème");
  }
});

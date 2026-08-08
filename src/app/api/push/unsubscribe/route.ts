import { NextRequest } from "next/server";
import { PushSubscription } from "@/models";
import { AuthenticatedAccessUser, createErrorResponse, createSuccessResponse, handleApiError, withPermissionAndDB } from "@/lib/api-utils";

export const POST = withPermissionAndDB("profile_management")(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const body = await request.json();
    const endpoint = String(body?.endpoint || "");
    if (!endpoint) return createErrorResponse("Point d’abonnement manquant", 400);
    await PushSubscription.deleteOne({ endpoint, userId: user.id });
    return createSuccessResponse({ endpoint }, "Notifications push désactivées");
  } catch (error) { return handleApiError(error, "Impossible de désactiver les notifications push"); }
});

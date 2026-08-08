import { NextRequest } from "next/server";
import { PushSubscription } from "@/models";
import { AuthenticatedAccessUser, createErrorResponse, createSuccessResponse, handleApiError, withPermissionAndDB } from "@/lib/api-utils";

export const POST = withPermissionAndDB("profile_management")(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const body = await request.json();
    const endpoint = String(body?.endpoint || "");
    const p256dh = String(body?.keys?.p256dh || "");
    const auth = String(body?.keys?.auth || "");
    if (!endpoint || !p256dh || !auth) return createErrorResponse("Abonnement push invalide", 400);
    const subscription = await PushSubscription.findOneAndUpdate(
      { endpoint },
      { $set: { userId: user.id, endpoint, keys: { p256dh, auth }, userAgent: request.headers.get("user-agent") || undefined } },
      { new: true, upsert: true, runValidators: true },
    );
    return createSuccessResponse(subscription, "Notifications push activées");
  } catch (error) { return handleApiError(error, "Impossible d’activer les notifications push"); }
});

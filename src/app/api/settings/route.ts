import { NextRequest } from "next/server";
import { Settings } from "@/models";
import { AuthenticatedAccessUser, createSuccessResponse, handleApiError, withPermissionAndDB } from "@/lib/api-utils";

export const GET = withPermissionAndDB("profile_management")(async (user: AuthenticatedAccessUser) => {
  try {
    const settings = await (Settings as any).findByUserId?.(String(user.id)) || await Settings.find({ userId: user.id }).lean();
    return createSuccessResponse({ settings }, "Paramètres récupérés");
  } catch (error) { return handleApiError(error, "Impossible de charger les paramètres"); }
});

export const PUT = withPermissionAndDB("profile_management")(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const body = await request.json();
    const category = String(body?.category || "");
    if (!category) return handleApiError(new Error("Catégorie de paramètres manquante"));
    const settings = await Settings.findOneAndUpdate(
      { userId: user.id, type: "user", category },
      { $set: { data: body?.data || body?.settings || {}, updatedAt: new Date() }, $setOnInsert: { userId: user.id, type: "user", category } },
      { upsert: true, new: true, runValidators: true },
    );
    return createSuccessResponse(settings, "Paramètres mis à jour");
  } catch (error) { return handleApiError(error, "Impossible de mettre à jour les paramètres"); }
});

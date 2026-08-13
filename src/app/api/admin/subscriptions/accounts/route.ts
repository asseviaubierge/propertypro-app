import { createSuccessResponse, handleApiError, withPermissionAndDB } from "@/lib/api-utils";
import User from "@/models/User";

export const GET = withPermissionAndDB("system_settings")(async () => {
  try {
    const accounts = await User.find({
      role: { $in: ["manager", "property_manager", "owner"] }
    }).select("_id firstName lastName email phone role businessName accountType").sort({ firstName: 1 }).lean();
    return createSuccessResponse(accounts);
  } catch (error) {
    return handleApiError(error, "Impossible de charger les comptes gestionnaires");
  }
});

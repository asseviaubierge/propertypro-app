export const dynamic = "force-dynamic";

import { createSuccessResponse, handleApiError, withPermissionAndDB } from "@/lib/api-utils";
import User from "@/models/User";
import { UserRole } from "@/types";

export const GET = withPermissionAndDB("system_settings")(async () => {
  try {
    // Propriétaires directs, agences et gestionnaires utilisent le rôle système
    // MANAGER et sont distingués par accountType. On exclut les locataires.
    const accounts = await User.find({
      role: { $ne: UserRole.TENANT },
      isActive: { $ne: false },
      deletedAt: null,
    })
      .select("_id firstName lastName email phone role businessName accountType cip ifu rccm")
      .sort({ businessName: 1, firstName: 1, lastName: 1 })
      .lean();

    return createSuccessResponse(accounts);
  } catch (error) {
    return handleApiError(error, "Impossible de charger les comptes contractants");
  }
});

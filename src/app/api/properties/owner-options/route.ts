export const dynamic = "force-dynamic";

import { User } from "@/models";
import { UserRole } from "@/types";
import {
  AuthenticatedAccessUser,
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";

const OWNER_FIELDS =
  "firstName lastName email phone role accountType businessName isActive";

function serializeOwner(owner: any) {
  return {
    _id: String(owner._id),
    firstName: owner.firstName || "",
    lastName: owner.lastName || "",
    email: owner.email || "",
    phone: owner.phone || "",
    role: owner.role || "",
    accountType: owner.accountType || "",
    businessName: owner.businessName || "",
  };
}

/**
 * Retourne le contexte du propriétaire pour le formulaire de création.
 * - Property Manager : son propre compte, auto-sélectionné et non modifiable.
 * - Super Admin : liste des comptes propriétaires/gestionnaires sélectionnables.
 */
export const GET = withPermissionAndDB("property_create")(
  async (user: AuthenticatedAccessUser) => {
    try {
      const currentUser = await User.findById(user.id)
        .select(OWNER_FIELDS)
        .lean();

      if (!currentUser) {
        return createErrorResponse("Compte utilisateur introuvable", 404);
      }

      if (!user.isAdmin) {
        const owner = serializeOwner(currentUser);
        return createSuccessResponse({
          owners: [owner],
          currentOwnerId: owner._id,
          canSelectOwner: false,
        });
      }

      const candidates = await User.find({
        deletedAt: null,
        isActive: { $ne: false },
        role: { $ne: UserRole.TENANT },
      })
        .select(OWNER_FIELDS)
        .sort({ businessName: 1, firstName: 1, lastName: 1 })
        .lean();

      const owners = candidates.map(serializeOwner);
      const currentOwnerId = String(currentUser._id);

      return createSuccessResponse({
        owners,
        currentOwnerId,
        canSelectOwner: true,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
);

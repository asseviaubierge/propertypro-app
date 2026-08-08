import { NextRequest } from "next/server";
import { Property, Lease } from "@/models";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { getScopedPropertyIds } from "@/lib/property-scope";

export const dynamic = "force-dynamic";

/**
 * Propriétés utilisables comme contexte d'une conversation.
 * Cette route est volontairement distincte de /api/properties : elle est
 * accessible à tout utilisateur authentifié et ne retourne que le minimum
 * nécessaire, dans son propre périmètre.
 */
export const GET = withPermissionAndDB("profile_management")(
  async (user: AuthenticatedAccessUser, _request: NextRequest, context?: { tenantProfile?: any }) => {
    try {
      let propertyIds = await getScopedPropertyIds(user);

      // Un locataire accède seulement aux biens de ses propres baux.
      if (user.isTenant) {
        const tenantIds = [user.id, context?.tenantProfile?._id]
          .filter(Boolean)
          .map(String);
        propertyIds = await Lease.distinct("propertyId", {
          tenantId: { $in: tenantIds },
          deletedAt: null,
        });
      }

      const query: Record<string, unknown> = { deletedAt: null };
      if (propertyIds !== null) query._id = { $in: propertyIds };

      const properties = await Property.find(query)
        .select("name type address ownerId managerId")
        .sort({ name: 1 })
        .limit(200)
        .lean();

      return createSuccessResponse({ properties }, "Propriétés disponibles");
    } catch (error) {
      return handleApiError(error, "Impossible de charger les propriétés de la messagerie");
    }
  },
);

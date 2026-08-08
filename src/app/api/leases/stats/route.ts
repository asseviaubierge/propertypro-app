/**
 * Gestion E-Immo - Statistiques des baux
 * Retourne les compteurs limités au périmètre de l'utilisateur connecté.
 */

import { NextRequest } from "next/server";
import { Lease } from "@/models";
import { LeaseStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  handleApiError,
  withAccessAndDB,
} from "@/lib/api-utils";
import { LEASE_READ_ACCESS } from "@/lib/lease-access";
import { getScopedPropertyIds } from "@/lib/property-scope";

// GET /api/leases/stats
export const GET = withAccessAndDB(LEASE_READ_ACCESS)(
  async (user: AuthenticatedAccessUser, _request: NextRequest) => {
    try {
      const baseQuery: Record<string, unknown> = {
        deletedAt: null,
      };

      if (user.isTenant) {
        // Un locataire ne voit que ses propres baux.
        baseQuery.tenantId = user.id;
      } else if (!user.isAdmin) {
        // Un gestionnaire voit les baux des biens qu'il possède ou administre.
        const propertyIds = await getScopedPropertyIds(user);
        baseQuery.propertyId = { $in: propertyIds ?? [] };
      }
      // Le Super administrateur conserve la vue globale.

      const now = new Date();
      const endOfCurrentMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );

      const [
        total,
        active,
        draft,
        pending,
        expired,
        terminated,
        expiringThisMonth,
      ] = await Promise.all([
        Lease.countDocuments(baseQuery),
        Lease.countDocuments({ ...baseQuery, status: LeaseStatus.ACTIVE }),
        Lease.countDocuments({ ...baseQuery, status: LeaseStatus.DRAFT }),
        Lease.countDocuments({ ...baseQuery, status: LeaseStatus.PENDING }),
        Lease.countDocuments({ ...baseQuery, status: LeaseStatus.EXPIRED }),
        Lease.countDocuments({ ...baseQuery, status: LeaseStatus.TERMINATED }),
        Lease.countDocuments({
          ...baseQuery,
          status: LeaseStatus.ACTIVE,
          endDate: {
            $gte: now,
            $lte: endOfCurrentMonth,
          },
        }),
      ]);

      return createSuccessResponse(
        {
          total,
          active,
          draft,
          pending,
          expired,
          terminated,
          expiringThisMonth,
        },
        "Statistiques des baux récupérées avec succès",
      );
    } catch (error) {
      return handleApiError(error);
    }
  },
);

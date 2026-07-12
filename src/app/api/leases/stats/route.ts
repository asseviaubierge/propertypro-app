/**
 * PropertyPro - Lease Statistics API Route
 * Get lease statistics and metrics
 */

import { NextRequest } from "next/server";
import { Lease } from "@/models";
import { UserRole, LeaseStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  handleApiError,
  withAccessAndDB,
} from "@/lib/api-utils";
import { LEASE_READ_ACCESS } from "@/lib/lease-access";

// ============================================================================
// GET /api/leases/stats - Get lease statistics
// ============================================================================

export const GET = withAccessAndDB(LEASE_READ_ACCESS)(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    // Build base query based on user role
    let baseQuery: any = {};

    // Role-based filtering for single company architecture
    if (user.isTenant) {
      // For tenant users, filter leases by their user ID directly
      baseQuery.tenantId = user.id;
    }
    // Admin and Manager can see all company leases - no filtering needed

    // Get total count by status
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
      // Count leases expiring this month
      Lease.countDocuments({
        ...baseQuery,
        status: LeaseStatus.ACTIVE,
        endDate: {
          $gte: new Date(),
          $lte: new Date(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            0
          ),
        },
      }),
    ]);

    const stats = {
      total,
      active,
      draft,
      pending,
      expired,
      terminated,
      expiringThisMonth,
    };

    return createSuccessResponse(stats, "Lease statistics retrieved successfully");
  } catch (error) {
    return handleApiError(error);
  }
  }
);

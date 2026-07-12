/**
 * PropertyPro - User Statistics API Route
 * Aggregates real counts (properties, leases, payments, maintenance) for a user.
 * Stats are role-aware:
 *  - Tenants  -> their own leases / payments / maintenance
 *  - Staff    -> the portfolio of properties they own or manage
 */

import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { Lease, User, Property, Payment, MaintenanceRequest } from "@/models";
import { UserRole, PaymentStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  isValidObjectId,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { resolveAccessProfile } from "@/lib/server-permissions";
import { canViewTargetUser } from "@/lib/permissions-manager";

// Number of properties to include in the inline preview list.
const PROPERTY_PREVIEW_LIMIT = 6;

// ============================================================================
// GET /api/users/[id]/stats - Aggregate activity metrics for a user
// ============================================================================

export const GET = withPermissionAndDB(["user_view", "user_management"])(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid user ID", 400);
      }

      const targetUser = await User.findById(id).select("_id role").lean();
      if (!targetUser) {
        return createErrorResponse("User not found", 404);
      }

      // Respect the same visibility rules as the user detail endpoint.
      const targetAccess = await resolveAccessProfile(targetUser.role);
      if (
        !canViewTargetUser(user, targetAccess, {
          isSelf: targetUser._id.toString() === user.id,
        })
      ) {
        return createErrorResponse("Access denied", 403);
      }

      const userObjectId = new mongoose.Types.ObjectId(id);
      const isTenant = targetUser.role === UserRole.TENANT;

      const sumPaidPayments = async (match: Record<string, unknown>) => {
        const result = await Payment.aggregate([
          { $match: { ...match, status: PaymentStatus.PAID, deletedAt: null } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);
        return result[0]?.total ?? 0;
      };

      let propertiesCount = 0;
      let leasesCount = 0;
      let totalPayments = 0;
      let maintenanceRequests = 0;
      let properties: Array<{
        _id: string;
        name: string;
        address: string;
        status?: string;
      }> = [];

      if (isTenant) {
        // Tenant-centric metrics: their leases, payments and requests.
        const tenantLeases = await Lease.find({
          tenantId: userObjectId,
          deletedAt: null,
        })
          .select("propertyId")
          .lean();

        const propertyIds = [
          ...new Set(tenantLeases.map((l) => l.propertyId?.toString()).filter(Boolean)),
        ];

        const [paid, maintenance, previewProps] = await Promise.all([
          sumPaidPayments({ tenantId: userObjectId }),
          MaintenanceRequest.countDocuments({
            tenantId: userObjectId,
            deletedAt: null,
          }),
          Property.find({
            _id: { $in: propertyIds.map((p) => new mongoose.Types.ObjectId(p)) },
            deletedAt: null,
          })
            .select("name address status")
            .limit(PROPERTY_PREVIEW_LIMIT)
            .lean(),
        ]);

        propertiesCount = propertyIds.length;
        leasesCount = tenantLeases.length;
        totalPayments = paid;
        maintenanceRequests = maintenance;
        properties = previewProps.map(mapPropertyPreview);
      } else {
        // Staff-centric metrics: the portfolio they own or manage.
        const ownedProperties = await Property.find({
          $or: [{ ownerId: userObjectId }, { managerId: userObjectId }],
          deletedAt: null,
        })
          .select("name address status")
          .lean();

        const propertyIds = ownedProperties.map((p) => p._id);

        const [leases, paid, maintenance] = await Promise.all([
          Lease.countDocuments({
            propertyId: { $in: propertyIds },
            deletedAt: null,
          }),
          sumPaidPayments({ propertyId: { $in: propertyIds } }),
          MaintenanceRequest.countDocuments({
            propertyId: { $in: propertyIds },
            deletedAt: null,
          }),
        ]);

        propertiesCount = ownedProperties.length;
        leasesCount = leases;
        totalPayments = paid;
        maintenanceRequests = maintenance;
        properties = ownedProperties
          .slice(0, PROPERTY_PREVIEW_LIMIT)
          .map(mapPropertyPreview);
      }

      return createSuccessResponse({
        propertiesCount,
        leasesCount,
        totalPayments,
        maintenanceRequests,
        properties,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// Shape a property document into the lightweight preview the UI renders.
function mapPropertyPreview(property: any) {
  const address = property.address
    ? [property.address.street, property.address.city, property.address.state]
        .filter(Boolean)
        .join(", ")
    : "";

  return {
    _id: property._id.toString(),
    name: property.name ?? "Untitled property",
    address,
    status: property.status,
  };
}

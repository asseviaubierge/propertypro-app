/**
 * PropertyPro - Property Tenants API
 * Get tenants associated with a specific property through active leases
 */

import { NextRequest } from "next/server";
import { UserRole } from "@/types";
import {
  createSuccessResponse,
  createErrorResponse,
  withPermissionAndDB,
  isValidObjectId,
} from "@/lib/api-utils";
import Lease from "@/models/Lease";
import User from "@/models/User";
import Property from "@/models/Property";

export const GET = withPermissionAndDB("property_view")(
  async (
    user,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id: propertyId } = await params;

      // Validate property ID
      if (!isValidObjectId(propertyId)) {
        return createErrorResponse("Invalid property ID", 400);
      }

      // Get query parameters
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status") || "active";
      const unitId = searchParams.get("unitId"); // Optional unit filter

      // Build query for active leases
      const leaseQuery: any = {
        propertyId,
      };

      // Add unit filter if specified
      if (unitId) {
        leaseQuery.unitId = unitId;
      }

      // Filter by lease status
      if (status === "active") {
        leaseQuery.status = "active";
        leaseQuery.endDate = { $gte: new Date() };
      } else if (status === "expired") {
        leaseQuery.endDate = { $lt: new Date() };
      } else if (status === "all") {
        // No additional filters
      } else {
        leaseQuery.status = status;
      }

      // Find leases and populate tenant information
      // Note: unitId is not populated because units are embedded in Property
      const leases = await Lease.find(leaseQuery)
        .populate("tenantId", "firstName lastName email phone avatar")
        .sort({ startDate: -1 })
        .lean();

      // Get property with units to match unit information
      const property = await Property.findById(propertyId)
        .select("units")
        .lean();

      // Extract unique tenants from leases
      const tenantMap = new Map();

      leases.forEach((lease: any) => {
        if (lease.tenantId) {
          const user = lease.tenantId;

          // Find unit information from property's embedded units
          let unitInfo = null;
          if (lease.unitId && property?.units) {
            unitInfo = property.units.find(
              (unit: any) =>
                unit._id?.toString() === lease.unitId.toString()
            );
          }

          if (!tenantMap.has(user?._id?.toString() ?? "")) {
            tenantMap.set(user?._id?.toString() ?? "", {
              id: user?._id,
              userId: user?._id,
              firstName: user?.firstName ?? "",
              lastName: user?.lastName ?? "",
              email: user?.email ?? "",
              phone: user?.phone ?? "",
              avatar: user?.avatar,
              unit: unitInfo
                ? {
                    id: unitInfo?._id,
                    unitNumber: unitInfo?.unitNumber ?? "",
                    type: unitInfo?.unitType ?? "apartment",
                  }
                : null,
              lease: {
                id: lease?._id,
                startDate: lease?.startDate,
                endDate: lease?.endDate,
                status: lease?.status,
                monthlyRent: lease?.terms?.rentAmount || 0,
              },
              emergencyContact: null, // Not available from User model
              moveInDate: null, // Not available from User model
              moveOutDate: null, // Not available from User model
              status: "active", // Derived from lease status
            });
          }
        }
      });

      const tenants = Array.from(tenantMap.values());

      return createSuccessResponse({
        tenants,
        total: tenants.length,
        status,
      });
    } catch (error) {
      return createErrorResponse("Failed to fetch property tenants", 500);
    }
  }
);

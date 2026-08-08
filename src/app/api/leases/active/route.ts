/**
 * PropertyPro - Active Leases API Route
 * Get all active leases with pagination and filtering
 */

import { NextRequest } from "next/server";
import { Lease } from "@/models";
import { LeaseStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withAccessAndDB,
  parsePaginationParams,
  paginateQuery,
} from "@/lib/api-utils";
import { paginationSchema, validateSchema } from "@/lib/validations";
import { LEASE_READ_ACCESS } from "@/lib/lease-access";

// ============================================================================
// GET /api/leases/active - Get all active leases with pagination and filtering
// ============================================================================

export const GET = withAccessAndDB(LEASE_READ_ACCESS)(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
    const { searchParams } = new URL(request.url);
    const paginationParams = parsePaginationParams(searchParams);

    // Parse filter parameters
    const filterParams = {
      ...paginationParams,
      propertyId: searchParams.get("propertyId") || undefined,
      tenantId: searchParams.get("tenantId") || undefined,
      search: searchParams.get("search") || undefined,
    };

    // Validate filter parameters
    const validation = validateSchema(paginationSchema, filterParams);
    if (!validation.success) {
      return createErrorResponse(validation.errors.join(", "), 400);
    }

      const filters = validation.data as typeof validation.data & {
        propertyId?: string;
        tenantId?: string;
      };

    // Build query based on user role and filters
    let query: any = {
      status: LeaseStatus.ACTIVE, // Only active leases
    };

    // Role-based filtering
     if (user.isTenant) {
     query.tenantId = user.id;
     } else if (user.isManager && !user.isAdmin) {
     query.propertyId = { $in: [] };
     }

    // Apply filters
    if (filters.propertyId) query.propertyId = filters.propertyId;
    if (filters.tenantId) query.tenantId = filters.tenantId;

    // Handle search - we need to filter after populate since propertyId and tenantId are references
    // Create a regex for searching if search term is provided
    let searchRegex: RegExp | null = null;
    if (
      filters.search &&
      typeof filters.search === "string" &&
      filters.search.trim()
    ) {
      const searchTerm = filters.search.trim();
      // Escape special regex characters for safety
      const escapedSearchTerm = searchTerm.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      searchRegex = new RegExp(escapedSearchTerm, "i");
    }

    // Execute paginated query
    const result = await paginateQuery(Lease, query, filters);

    // Populate property and tenant information
      const populatedData = (await Lease.populate(result.data as any[], [
      {
        path: "propertyId",
        select:
          "name address type bedrooms bathrooms squareFootage units isMultiUnit totalUnits",
        populate: {
          path: "ownerId",
          select: "firstName lastName email",
        },
      },
      {
        path: "tenantId",
        select:
          "firstName lastName email phone avatar dateOfBirth employmentInfo emergencyContacts creditScore backgroundCheckStatus moveInDate moveOutDate applicationDate tenantStatus",
      },
    ])) as any[];

    // Filter out leases with null tenants (orphaned leases), apply search, and add unit information
    const validLeases = populatedData
      .filter((lease: any) => lease.tenantId !== null)
      .filter((lease: any) => {
        // Apply search filter across populated fields if search term exists
        if (!searchRegex) return true;

        // Search across tenant fields
        const tenantFirstName = lease.tenantId?.firstName || "";
        const tenantLastName = lease.tenantId?.lastName || "";
        const tenantFullName = `${tenantFirstName} ${tenantLastName}`.trim();
        const tenantEmail = lease.tenantId?.email || "";
        const tenantPhone = lease.tenantId?.phone || "";

        // Search across property fields
        const propertyName = lease.propertyId?.name || "";
        const propertyStreet = lease.propertyId?.address?.street || "";
        const propertyCity = lease.propertyId?.address?.city || "";
        const propertyState = lease.propertyId?.address?.state || "";
        const fullAddress =
          `${propertyStreet} ${propertyCity} ${propertyState}`.trim();

        // Search across unit number if available
        let unitNumber = "";
        if (
          lease.propertyId?.units &&
          Array.isArray(lease.propertyId.units) &&
          lease.unitId
        ) {
          const unitInfo = lease.propertyId.units.find(
            (unit: any) => unit._id.toString() === lease.unitId?.toString()
          );
          unitNumber = unitInfo?.unitNumber || "";
        }

        // Check if any field matches the search term
        return (
          searchRegex.test(tenantFullName) ||
          searchRegex.test(tenantFirstName) ||
          searchRegex.test(tenantLastName) ||
          searchRegex.test(tenantEmail) ||
          searchRegex.test(tenantPhone) ||
          searchRegex.test(propertyName) ||
          searchRegex.test(fullAddress) ||
          searchRegex.test(propertyStreet) ||
          searchRegex.test(propertyCity) ||
          searchRegex.test(unitNumber)
        );
      })
      .map((lease: any) => {
        // Convert to plain object if it's a Mongoose document
        const leaseObj = lease.toObject ? lease.toObject() : lease;

        // Add unit information if property has units
        if (
          leaseObj.propertyId?.units &&
          Array.isArray(leaseObj.propertyId.units)
        ) {
          const unitInfo = leaseObj.propertyId.units.find(
            (unit: any) => unit._id.toString() === leaseObj.unitId?.toString()
          );
          if (unitInfo) {
            // Add unit information as a virtual property
            (leaseObj as any).unit = unitInfo;
          }
        }

        return leaseObj;
      });

    // Update pagination count if we filtered out any leases due to search
    const filteredPagination = {
      ...result.pagination,
      total: validLeases.length,
      totalPages: Math.ceil(validLeases.length / (filters.limit || 10)),
    };

    return createSuccessResponse(
      {
        data: validLeases,
        pagination: filteredPagination,
      },
      "Active leases retrieved successfully"
    );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

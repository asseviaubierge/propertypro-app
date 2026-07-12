/**
 * PropertyPro - Properties API Routes
 * CRUD operations for property management
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Property } from "@/models";
import { UserRole, PropertyStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
  parsePaginationParams,
  paginateQuery,
  parseRequestBody,
} from "@/lib/api-utils";
import {
  propertyCreateSchema,
  propertyQuerySchema,
  validateSchema,
} from "@/lib/validations";
import { calculatePropertyStatusFromUnits } from "@/utils/property-status-calculator";
import mongoose from "mongoose";

// ============================================================================
// GET /api/properties - Get all properties with pagination and filtering
// ============================================================================

export const GET = withPermissionAndDB("property_view")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const paginationParams = parsePaginationParams(searchParams);

      // Parse filter parameters
      const filterParams = {
        ...paginationParams,
        type: searchParams.get("type") || undefined,
        status: searchParams.get("status") || undefined,
        minRent: searchParams.get("minRent")
          ? parseFloat(searchParams.get("minRent")!)
          : undefined,
        maxRent: searchParams.get("maxRent")
          ? parseFloat(searchParams.get("maxRent")!)
          : undefined,
        bedrooms: searchParams.get("bedrooms")
          ? parseInt(searchParams.get("bedrooms")!)
          : undefined,
        bathrooms: searchParams.get("bathrooms")
          ? parseInt(searchParams.get("bathrooms")!)
          : undefined,
        city: searchParams.get("city") || undefined,
        state: searchParams.get("state") || undefined,
        unitType: searchParams.get("unitType") || undefined,
        isMultiUnit:
          searchParams.get("isMultiUnit") === "true"
            ? true
            : searchParams.get("isMultiUnit") === "false"
            ? false
            : undefined,
        features: searchParams.get("features") || undefined,
        amenities: searchParams.get("amenities") || undefined,
        hasAvailableUnits: searchParams.get("hasAvailableUnits") === "true",
      };

      // Validate filter parameters
      const validation = validateSchema(propertyQuerySchema, filterParams);
      if (!validation.success) {
        return createErrorResponse(validation.errors.join(", "), 400);
      }

      const filters = validation.data;

      // Build query based on user role and filters
      let query: any = {
        deletedAt: null, // Exclude soft-deleted properties
      };

      // Single company architecture - Admin and Manager see all properties
      // No role-based filtering needed for company staff

      // Apply filters
      if (filters.type) query.type = filters.type;
      if (filters.status) query.status = filters.status;
      // Filter by unit-level fields (bedrooms, bathrooms, rentAmount are now in units array)
      if (filters.minRent || filters.maxRent) {
        query["units.rentAmount"] = {};
        if (filters.minRent) query["units.rentAmount"].$gte = filters.minRent;
        if (filters.maxRent) query["units.rentAmount"].$lte = filters.maxRent;
      }
      if (filters.bedrooms) query["units.bedrooms"] = filters.bedrooms;
      if (filters.bathrooms) query["units.bathrooms"] = filters.bathrooms;
      if (filters.city)
        query["address.city"] = { $regex: filters.city, $options: "i" };
      if (filters.state)
        query["address.state"] = { $regex: filters.state, $options: "i" };
      // Note: unitType filtering now requires joining with Unit collection
      // This will be handled in the aggregation pipeline below
      if (filters.isMultiUnit !== undefined)
        query.isMultiUnit = filters.isMultiUnit;
      // Note: features field has been removed from Property model
      // Property-level features should be handled through amenities
      if (filters.amenities) {
        const amenityArray = filters.amenities.split(",").map((a) => a.trim());
        query["amenities.name"] = { $in: amenityArray };
      }
      // Filter for properties with available units
      if (filters.hasAvailableUnits) {
        query["units.status"] = "available";
      }

      // For admin users, show non-deleted by default; include deleted when explicitly requested
      let result;
      if (user.isAdmin) {
        // Handle includeDeleted flag for admins
        const { page, limit, sortBy, sortOrder, search } = filters;
        const includeDeleted = searchParams.get("includeDeleted") === "true";

        // Override the mongoose middleware by explicitly setting deletedAt in query
        if (includeDeleted) {
          // Include all properties (deleted and non-deleted)
          query.deletedAt = { $exists: true }; // This will include both null and non-null values
        } else {
          // Only non-deleted properties
          query.deletedAt = null;
        }

        // Add search functionality manually for admin
        if (search) {
          query.$or = [
            { name: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ];
        }

        // Calculate skip value
        const skip = (page - 1) * limit;

        // Build sort object
        const sort: any = {};
        if (sortBy) {
          sort[sortBy] = sortOrder === "asc" ? 1 : -1;
        } else {
          sort.createdAt = -1; // Default sort by creation date
        }

        // Use raw MongoDB collection to bypass Mongoose middleware completely
        const [data, total] = await Promise.all([
          Property.collection
            .find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .toArray(),
          Property.collection.countDocuments(query),
        ]);

        // Convert MongoDB documents to Mongoose documents
        const mongooseData = data.map((doc) => new Property(doc));

        const pagination = {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        };

        result = { data: mongooseData, pagination };
      } else {
        // Use normal paginated query with soft delete filter for other users
        result = await paginateQuery(Property, query, filters);
      }

      // Populate owner and manager information
      const populatedData = await Property.populate(result.data, [
        { path: "ownerId", select: "firstName lastName email" },
        { path: "managerId", select: "firstName lastName email" },
      ]);

      // Convert to plain objects (units are already embedded in the property document)
      const propertiesWithUnits = populatedData.map((property: any) => {
        // Check if it's a Mongoose document with toObject method
        const propertyObj = property.toObject ? property.toObject() : property;

        // Derive property status from unit statuses whenever embedded units exist
        if (Array.isArray(propertyObj.units) && propertyObj.units.length > 0) {
          const unitStatuses = propertyObj.units
            .map((unit: any) => unit?.status)
            .filter((status: any): status is PropertyStatus =>
              Object.values(PropertyStatus).includes(status)
            );

          if (unitStatuses.length > 0) {
            propertyObj.status = calculatePropertyStatusFromUnits(unitStatuses);
          }
        }

        // Units are already embedded in the property document
        // No need to fetch from separate collection
        return propertyObj;
      });

      return createSuccessResponse(
        propertiesWithUnits,
        "Properties retrieved successfully",
        result.pagination
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// POST /api/properties - Create a new property
// ============================================================================

export const POST = withPermissionAndDB("property_create")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      // Validate request body
      const validation = validateSchema(propertyCreateSchema, body);
      if (!validation.success) {
        return createErrorResponse(validation.errors.join(", "), 400);
      }

      const propertyData = validation.data;

      // Prepare property data with proper ownership
      // Strip deprecated fields that should only exist at unit level
      const {
        bedrooms: _bedrooms,
        bathrooms: _bathrooms,
        squareFootage: _squareFootage,
        rentAmount: _rentAmount,
        securityDeposit: _securityDeposit,
        ...cleanPropertyData
      } = propertyData;

      const newPropertyData: any = {
        ...cleanPropertyData,
      };

      // Note: bedrooms, bathrooms, squareFootage, rentAmount, securityDeposit
      // are now stored only at the unit level - no property root level fields needed

      // Single company architecture - Admin and Manager can create properties
      // Set default owner to the creating user if not specified
      newPropertyData.ownerId = propertyData.ownerId || user.id;

      // Managers can optionally assign themselves as manager
      if (user.isManager && propertyData.managerId) {
        newPropertyData.managerId = propertyData.managerId;
      } else if (user.isManager) {
        newPropertyData.managerId = user.id;
      }

      // Admins can assign any manager
      if (user.isAdmin && propertyData.managerId) {
        newPropertyData.managerId = propertyData.managerId;
      }

      // Unified approach: units are embedded directly in the property document
      // No need to extract units - they're part of the property data

      // Create the property with embedded units
      const property = new Property(newPropertyData);
      await property.save();

      // Populate owner and manager information
      await property.populate([
        { path: "ownerId", select: "firstName lastName email" },
        { path: "managerId", select: "firstName lastName email" },
      ]);

      // Return the complete property with embedded units
      const responseData = property.toObject ? property.toObject() : property;

      // Get units count from the embedded units array
      const unitsCount = property.units?.length || 0;

      return createSuccessResponse(
        responseData,
        `Property created successfully${
          unitsCount > 0
            ? ` with ${unitsCount} unit${unitsCount > 1 ? "s" : ""}`
            : ""
        }`,
        undefined
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PUT /api/properties - Bulk update properties (admin only)
// ============================================================================

export const PUT = withPermissionAndDB(
  ["property_edit", "bulk_operations"],
  {
    requireAllPermissions: true,
  }
)(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      if (!user.isAdmin) {
        return createErrorResponse("Insufficient permissions", 403);
      }

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      const { propertyIds, updates } = body;

      if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
        return createErrorResponse("Property IDs array is required", 400);
      }

      if (!updates || typeof updates !== "object") {
        return createErrorResponse("Updates object is required", 400);
      }

      // Remove fields that shouldn't be bulk updated
      const allowedUpdates = { ...updates };
      delete allowedUpdates._id;
      delete allowedUpdates.ownerId;
      delete allowedUpdates.createdAt;
      delete allowedUpdates.updatedAt;
      // Strip deprecated fields that should only exist at unit level
      delete allowedUpdates.bedrooms;
      delete allowedUpdates.bathrooms;
      delete allowedUpdates.squareFootage;
      delete allowedUpdates.rentAmount;
      delete allowedUpdates.securityDeposit;

      // Perform bulk update
      const result = await Property.updateMany(
        { _id: { $in: propertyIds } },
        { $set: allowedUpdates }
      );

      return createSuccessResponse(
        {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
        },
        `${result.modifiedCount} properties updated successfully`
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// DELETE /api/properties - Bulk delete properties (admin and manager)
// ============================================================================

export const DELETE = withPermissionAndDB(
  ["property_delete", "bulk_operations"],
  {
    requireAllPermissions: true,
  }
)(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      if (!user.isAdmin) {
        return createErrorResponse("Insufficient permissions", 403);
      }

      const { searchParams } = new URL(request.url);
      const propertyIds = searchParams.get("ids")?.split(",") || [];

      if (propertyIds.length === 0) {
        return createErrorResponse("Property IDs are required", 400);
      }

      // Check which properties exist and are not already deleted
      const existingProperties = await Property.collection
        .find({
          _id: {
            $in: propertyIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
          deletedAt: null,
        })
        .toArray();

      if (existingProperties.length === 0) {
        return createErrorResponse(
          "No properties found to delete or all selected properties are already deleted",
          400
        );
      }

      const existingIds = existingProperties.map((p) => p._id);

      // Perform soft delete only on non-deleted properties
      const result = await Property.updateMany(
        { _id: { $in: existingIds } },
        { $set: { deletedAt: new Date(), status: PropertyStatus.UNAVAILABLE } }
      );

      return createSuccessResponse(
        {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
        },
        `${result.modifiedCount} properties deleted successfully`
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

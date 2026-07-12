/**
 * PropertyPro - Individual Property API Routes
 * CRUD operations for individual properties
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
  withAccessAndDB,
  withPermissionAndDB,
  parseRequestBody,
  isValidObjectId,
} from "@/lib/api-utils";
import { propertyUpdateSchema, validateSchema } from "@/lib/validations";
import { calculatePropertyStatusFromUnits } from "@/utils/property-status-calculator";
import mongoose from "mongoose";
import { deleteFromR2 } from "@/lib/r2-server";
import { isR2Url, extractObjectKey } from "@/lib/r2";

// ============================================================================
// GET /api/properties/[id] - Get a specific property
// ============================================================================

export const GET = withAccessAndDB({
  roles: [UserRole.TENANT],
  permissions: ["property_view"],
  match: "any",
})(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid property ID", 400);
      }

      // Find the property
      const property = await Property.findById(id)
        .populate("ownerId", "firstName lastName email")
        .populate("managerId", "firstName lastName email");

      if (!property) {
        return createErrorResponse("Property not found", 404);
      }

      // Role-based authorization for single company architecture
      if (user.isTenant) {
        // Tenants can only view properties they are associated with
        // This would need additional logic to check tenant-property relationships
        // For now, we'll allow all authenticated users to view properties
      }
      // Admin and Manager can view all company properties

      // Convert to plain object to ensure proper JSON serialization
      const propertyObject = property.toObject ? property.toObject() : property;

      // Derive property status from unit statuses whenever embedded units exist
      if (
        Array.isArray(propertyObject.units) &&
        propertyObject.units.length > 0
      ) {
        const unitStatuses = propertyObject.units
          .map((unit: any) => unit?.status)
          .filter((status: any): status is PropertyStatus =>
            Object.values(PropertyStatus).includes(status)
          );

        if (unitStatuses.length > 0) {
          propertyObject.status =
            calculatePropertyStatusFromUnits(unitStatuses);
        }
      }

      // Units are already embedded in the property document
      // No need to fetch separately - they're in propertyObject.units

      return createSuccessResponse(
        propertyObject,
        "Property retrieved successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PUT /api/properties/[id] - Update a specific property
// ============================================================================

export const PUT = withPermissionAndDB("property_edit")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid property ID", 400);
      }

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      // Find the property
      const property = await Property.findById(id);
      if (!property) {
        return createErrorResponse("Property not found", 404);
      }

      // Role-based authorization
      // Managers can update all properties (single company architecture)
      // Only admins can change ownership and manager assignments

      // Validate update data (partial schema)
      const validation = validateSchema(propertyUpdateSchema, body);
      if (!validation.success) {
        return createErrorResponse(validation.errors.join(", "), 400);
      }

      const updateData = validation.data;

      // Prevent certain fields from being updated by non-admins
      if (!user.isAdmin) {
        delete updateData.ownerId;
        if (user.isManager) {
          delete updateData.managerId;
        }
      }

      // Handle units in unified architecture
      // Strip deprecated fields that should only exist at unit level
      const {
        units,
        bedrooms: _bedrooms,
        bathrooms: _bathrooms,
        squareFootage: _squareFootage,
        rentAmount: _rentAmount,
        securityDeposit: _securityDeposit,
        ...propertyUpdateData
      } = updateData;

      // Update the property data
      Object.assign(property, propertyUpdateData);

      // Update units if provided (unified architecture)
      if (units && Array.isArray(units)) {
        property.units = units;
        // Auto-calculate multi-unit status
        property.isMultiUnit = units.length > 1;
        property.totalUnits = units.length;
      }

      await property.save();

      // Populate owner and manager information
      await property.populate([
        { path: "ownerId", select: "firstName lastName email" },
        { path: "managerId", select: "firstName lastName email" },
      ]);

      return createSuccessResponse(property, "Property updated successfully");
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// DELETE /api/properties/[id] - Delete a specific property
// ============================================================================

export const DELETE = withPermissionAndDB("property_delete")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid property ID", 400);
      }

      // Find the property (bypass soft-delete query middleware)
      const rawProperty = await Property.collection.findOne({
        _id: new mongoose.Types.ObjectId(id),
      });
      if (!rawProperty) {
        return createErrorResponse("Property not found", 404);
      }
      // If already soft-deleted, return appropriate error
      if (rawProperty.deletedAt) {
        return createErrorResponse("Property has already been deleted", 410);
      }

      // Role-based authorization - only admins and managers can delete properties
      // Check if property has active leases
      const Lease = require("@/models/Lease").default;
      const activeLeases = await Lease.find({
        propertyId: id,
        status: "active",
      });

      if (activeLeases.length > 0) {
        return createErrorResponse(
          "Cannot delete property with active leases. Please terminate all leases first.",
          409
        );
      }

      // Delete all property images from storage before deleting the property
      if (Array.isArray(rawProperty?.images)) {
        const imageDeletePromises = rawProperty.images.map(
          async (imageUrl: string) => {
            try {
              // Extract object key from URL
              let objectKey: string | null = imageUrl;
              if (
                imageUrl.startsWith("http://") ||
                imageUrl.startsWith("https://")
              ) {
                if (isR2Url(imageUrl)) {
                  objectKey = extractObjectKey(imageUrl);
                } else {
                  console.warn(`Skipping non-R2 URL: ${imageUrl}`);
                  return;
                }
              }

              if (!objectKey) {
                console.warn(`Could not extract object key from: ${imageUrl}`);
                return;
              }

              const deleted = await deleteFromR2(objectKey);
              if (deleted) {
              } else {
                console.warn(
                  `Failed to delete property image from storage: ${imageUrl}`
                );
              }
            } catch (error) {
              console.error(
                `Error deleting property image from storage: ${imageUrl}`,
                error
              );
              // Continue even if storage deletion fails
            }
          }
        );

        // Wait for all image deletions to complete
        await Promise.allSettled(imageDeletePromises);
      }

      // Perform permanent deletion
      await Property.deleteOne({ _id: new mongoose.Types.ObjectId(id) });

      return createSuccessResponse({ id }, "Property permanently deleted");
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PATCH /api/properties/[id] - Partial update (status change, etc.)
// ============================================================================

export const PATCH = withPermissionAndDB("property_edit")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid property ID", 400);
      }

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      // Find the property
      const property = await Property.findById(id);
      if (!property) {
        return createErrorResponse("Property not found", 404);
      }

      // Role-based authorization
      // Managers can update all properties (single company architecture)
      // Only admins can change ownership and manager assignments

      // Handle specific patch operations
      const { action, ...data } = body;

      switch (action) {
        case "updateStatus":
          if (!data.status) {
            return createErrorResponse("Status is required", 400);
          }
          property.status = data.status;
          break;

        case "addImages":
          if (!Array.isArray(data.images)) {
            return createErrorResponse("Images array is required", 400);
          }
          property.images.push(...data.images);
          break;

        case "removeImages":
          if (!Array.isArray(data.images)) {
            return createErrorResponse("Images array is required", 400);
          }

          // Delete images from storage (R2) before removing from database
          const deletePromises = data.images.map(async (imageUrl: string) => {
            try {
              // Extract object key from URL
              let objectKey: string | null = imageUrl;
              if (
                imageUrl.startsWith("http://") ||
                imageUrl.startsWith("https://")
              ) {
                if (isR2Url(imageUrl)) {
                  objectKey = extractObjectKey(imageUrl);
                } else {
                  console.warn(`Skipping non-R2 URL: ${imageUrl}`);
                  return;
                }
              }

              if (!objectKey) {
                console.warn(`Could not extract object key from: ${imageUrl}`);
                return;
              }

              const deleted = await deleteFromR2(objectKey);
              if (deleted) {
              } else {
                console.warn(
                  `Failed to delete image from storage: ${imageUrl}`
                );
              }
            } catch (error) {
              console.error(
                `Error deleting image from storage: ${imageUrl}`,
                error
              );
              // Continue even if storage deletion fails
            }
          });

          // Wait for all storage deletions to complete
          await Promise.allSettled(deletePromises);

          // Remove images from database
          property.images = property.images.filter(
            (img) => !data.images.includes(img)
          );
          break;

        case "addAmenities":
          if (!Array.isArray(data.amenities)) {
            return createErrorResponse("Amenities array is required", 400);
          }
          property.amenities.push(...data.amenities);
          break;

        case "removeAmenities":
          if (!Array.isArray(data.amenityNames)) {
            return createErrorResponse("Amenity names array is required", 400);
          }
          property.amenities = property.amenities.filter(
            (amenity) => !data.amenityNames.includes(amenity.name)
          );
          break;

        default:
          return createErrorResponse("Invalid action", 400);
      }

      await property.save();

      return createSuccessResponse(
        property,
        `Property ${action} completed successfully`
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

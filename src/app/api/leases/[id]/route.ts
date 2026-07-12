/**
 * PropertyPro - Individual Lease API Routes
 * CRUD operations for individual leases
 */

import { NextRequest } from "next/server";
import { Lease, Property } from "@/models";
import { LeaseStatus } from "@/types";
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
import {
  leaseSchema,
  leaseUpdateSchema,
  validateSchema,
} from "@/lib/validations";
import {
  LEASE_PATCH_ACCESS,
  LEASE_READ_ACCESS,
  canManageLeases,
  isLeaseTenantUser,
} from "@/lib/lease-access";

// ============================================================================
// GET /api/leases/[id] - Get a specific lease
// ============================================================================

export const GET = withAccessAndDB(LEASE_READ_ACCESS)(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid lease ID", 400);
      }

      // Find the lease
      const lease = await Lease.findById(id)
        .populate({
          path: "propertyId",
          select:
            "name address type bedrooms bathrooms squareFootage ownerId managerId",
          populate: [
            { path: "ownerId", select: "firstName lastName email" },
            { path: "managerId", select: "firstName lastName email" },
          ],
        })
        .populate({
          path: "tenantId",
          select:
            "firstName lastName email phone avatar dateOfBirth employmentInfo emergencyContacts creditScore backgroundCheckStatus moveInDate moveOutDate applicationDate",
        });

      if (!lease) {
        return createErrorResponse("Lease not found", 404);
      }

      // Role-based authorization
      if (user.isTenant && !isLeaseTenantUser(user, lease)) {
        return createErrorResponse("You can only view your own leases", 403);
      }
      // Admin and manager can view all leases (single-company architecture)

      return createSuccessResponse(lease, "Lease retrieved successfully");
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PUT /api/leases/[id] - Update a specific lease
// ============================================================================

export const PUT = withPermissionAndDB(["lease_edit", "lease_management"])(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid lease ID", 400);
      }

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      // Find the lease
      const lease = await Lease.findById(id);
      if (!lease) {
        return createErrorResponse("Lease not found", 404);
      }

      // Prevent updating active leases
      if (lease.status === LeaseStatus.ACTIVE) {
        return createErrorResponse(
          "Cannot update active lease. Use PATCH for status changes.",
          400
        );
      }

      // Validate update data
      const validation = validateSchema(leaseUpdateSchema as any, body);
      if (!validation.success) {
        return createErrorResponse(validation.errors.join(", "), 400);
      }

      const updateData = validation.data as any;

      // Validate date range if both dates are provided
      if (updateData.startDate && updateData.endDate) {
        if (updateData.endDate <= updateData.startDate) {
          return createErrorResponse("End date must be after start date", 400);
        }
      }

      // Check for overlapping leases if dates are being updated
      if (updateData.startDate || updateData.endDate) {
        const startDate = updateData.startDate || lease.startDate;
        const endDate = updateData.endDate || lease.endDate;

        const overlappingLease = await Lease.findOne({
          _id: { $ne: id },
          propertyId: lease.propertyId,
          status: { $in: [LeaseStatus.ACTIVE, LeaseStatus.PENDING] },
          $or: [
            {
              startDate: { $lte: endDate },
              endDate: { $gte: startDate },
            },
          ],
        });

        if (overlappingLease) {
          return createErrorResponse(
            "Lease dates overlap with existing lease for this property",
            409
          );
        }
      }

      // Update the lease
      Object.assign(lease, updateData);
      await lease.save();

      // Populate property and tenant information
      await lease.populate([
        {
          path: "propertyId",
          select: "name address type bedrooms bathrooms squareFootage",
        },
        {
          path: "tenantId",
          select:
            "firstName lastName email phone avatar dateOfBirth employmentInfo emergencyContacts creditScore backgroundCheckStatus moveInDate moveOutDate applicationDate",
        },
      ]);

      return createSuccessResponse(lease, "Lease updated successfully");
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// DELETE /api/leases/[id] - Delete a specific lease
// ============================================================================

export const DELETE = withPermissionAndDB(["lease_edit", "lease_management"])(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid lease ID", 400);
      }

      // Find the lease
      const lease = await Lease.findById(id);
      if (!lease) {
        return createErrorResponse("Lease not found", 404);
      }

      // Only draft leases can be deleted. Anything that has progressed beyond
      // draft (active/pending/terminated/expired) has or may have financial
      // records, so it must be terminated and/or archived instead of deleted.
      if (lease.status !== LeaseStatus.DRAFT) {
        return createErrorResponse(
          lease.status === LeaseStatus.ACTIVE
            ? "Cannot delete an active lease. Terminate it first, then archive."
            : "Only draft leases can be deleted. Archive this lease instead to keep its financial records.",
          409
        );
      }

      // Perform soft delete
      lease.deletedAt = new Date();
      await lease.save({ validateModifiedOnly: true });

      return createSuccessResponse(
        { id: lease._id },
        "Lease deleted successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PATCH /api/leases/[id] - Partial update (status change, etc.)
// ============================================================================

export const PATCH = withAccessAndDB(LEASE_PATCH_ACCESS)(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid lease ID", 400);
      }

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      // Find the lease
      const lease = await Lease.findById(id);
      if (!lease) {
        return createErrorResponse("Lease not found", 404);
      }

      // Role-based authorization for tenant actions
      if (user.isTenant && !isLeaseTenantUser(user, lease)) {
        return createErrorResponse("You can only modify your own leases", 403);
      }

      // Handle specific patch operations
      const { action, ...data } = body;

      switch (action) {
        case "activate":
          if (!canManageLeases(user)) {
            return createErrorResponse("Tenants cannot activate leases", 403);
          }
          lease.status = LeaseStatus.ACTIVE;
          if (!lease.signedDate) {
            lease.signedDate = new Date();
          }
          // Update unit status to occupied
          if (lease.unitId) {
            await Property.updateOne(
              { _id: lease.propertyId, "units._id": lease.unitId },
              {
                $set: {
                  "units.$.status": "occupied",
                  "units.$.currentTenantId": lease.tenantId,
                  "units.$.currentLeaseId": lease._id,
                },
              }
            );
          } else {
            // Fallback for old leases without unitId
            await Property.findByIdAndUpdate(lease.propertyId, {
              status: "occupied",
            });
          }
          break;

        case "sign":
          lease.signedDate = new Date();
          if (lease.status === LeaseStatus.PENDING) {
            lease.status = LeaseStatus.ACTIVE;
            // Update unit status to occupied
            if (lease.unitId) {
              await Property.updateOne(
                { _id: lease.propertyId, "units._id": lease.unitId },
                {
                  $set: {
                    "units.$.status": "occupied",
                    "units.$.currentTenantId": lease.tenantId,
                    "units.$.currentLeaseId": lease._id,
                  },
                }
              );
            } else {
              // Fallback for old leases without unitId
              await Property.findByIdAndUpdate(lease.propertyId, {
                status: "occupied",
              });
            }
          }
          break;

        case "terminate":
          if (!canManageLeases(user)) {
            return createErrorResponse("Tenants cannot terminate leases", 403);
          }
          lease.status = LeaseStatus.TERMINATED;
          // Update unit status to available
          if (lease.unitId) {
            await Property.updateOne(
              { _id: lease.propertyId, "units._id": lease.unitId },
              {
                $set: {
                  "units.$.status": "available",
                  "units.$.currentTenantId": null,
                  "units.$.currentLeaseId": null,
                },
              }
            );
          } else {
            // Fallback for old leases without unitId
            await Property.findByIdAndUpdate(lease.propertyId, {
              status: "available",
            });
          }
          break;

        case "expire":
          if (!canManageLeases(user)) {
            return createErrorResponse("Tenants cannot expire leases", 403);
          }
          lease.status = LeaseStatus.EXPIRED;
          // Update property status to available
          await Property.findByIdAndUpdate(lease.propertyId, {
            status: "available",
          });
          break;

        case "changeStatus":
          if (!canManageLeases(user)) {
            return createErrorResponse(
              "Tenants cannot change lease status",
              403
            );
          }

          if (
            !data.status ||
            !Object.values(LeaseStatus).includes(data.status)
          ) {
            return createErrorResponse("Valid status is required", 400);
          }

          const oldStatus = lease.status;
          lease.status = data.status;

          // Handle unit status changes based on lease status
          if (
            data.status === LeaseStatus.ACTIVE &&
            oldStatus !== LeaseStatus.ACTIVE
          ) {
            if (lease.unitId) {
              await Property.updateOne(
                { _id: lease.propertyId, "units._id": lease.unitId },
                {
                  $set: {
                    "units.$.status": "occupied",
                    "units.$.currentTenantId": lease.tenantId,
                    "units.$.currentLeaseId": lease._id,
                  },
                }
              );
            } else {
              // Fallback for old leases without unitId
              await Property.findByIdAndUpdate(lease.propertyId, {
                status: "occupied",
              });
            }
            if (!lease.signedDate) {
              lease.signedDate = new Date();
            }
          } else if (
            (data.status === LeaseStatus.TERMINATED ||
              data.status === LeaseStatus.EXPIRED) &&
            oldStatus === LeaseStatus.ACTIVE
          ) {
            if (lease.unitId) {
              await Property.updateOne(
                { _id: lease.propertyId, "units._id": lease.unitId },
                {
                  $set: {
                    "units.$.status": "available",
                    "units.$.currentTenantId": null,
                    "units.$.currentLeaseId": null,
                  },
                }
              );
            } else {
              // Fallback for old leases without unitId
              await Property.findByIdAndUpdate(lease.propertyId, {
                status: "available",
              });
            }
          }
          break;

        case "addDocument":
          if (!data.document) {
            return createErrorResponse("Document URL is required", 400);
          }
          lease.documents.push(data.document);
          break;

        case "removeDocument":
          if (!data.document) {
            return createErrorResponse("Document URL is required", 400);
          }
          lease.documents = lease.documents.filter(
            (doc) => doc !== data.document
          );
          break;

        case "updateRenewalOptions":
          if (!canManageLeases(user)) {
            return createErrorResponse(
              "Tenants cannot update renewal options",
              403
            );
          }
          if (!data.renewalOptions) {
            return createErrorResponse("Renewal options are required", 400);
          }
          lease.renewalOptions = data.renewalOptions;
          break;

        case "requestRenewal":
          // Tenant can request renewal
          if (!lease.renewalOptions?.available) {
            return createErrorResponse(
              "Renewal is not available for this lease",
              400
            );
          }
          // This would typically create a renewal request record
          // For now, we'll just add a note
          break;

        case "archive":
          if (!canManageLeases(user)) {
            return createErrorResponse("Tenants cannot archive leases", 403);
          }
          // Only ended leases can be archived; finished records are preserved
          if (
            lease.status !== LeaseStatus.TERMINATED &&
            lease.status !== LeaseStatus.EXPIRED
          ) {
            return createErrorResponse(
              "Only terminated or expired leases can be archived",
              409
            );
          }
          lease.archivedAt = new Date();
          break;

        case "unarchive":
          if (!canManageLeases(user)) {
            return createErrorResponse("Tenants cannot restore leases", 403);
          }
          lease.archivedAt = null;
          break;

        default:
          return createErrorResponse("Invalid action", 400);
      }

      await lease.save({ validateModifiedOnly: true });

      return createSuccessResponse(
        lease,
        `Lease ${action} completed successfully`
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

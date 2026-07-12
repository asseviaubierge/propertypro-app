/**
 * PropertyPro - Individual Tenant API Routes
 * CRUD operations for individual tenants
 */

import { NextRequest } from "next/server";
import { Lease, User, Tenant } from "@/models";
import { LeaseStatus, UserRole } from "@/types";
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
import { userSchema, validateSchema } from "@/lib/validations";
import { z } from "zod";
import { deleteFromR2 } from "@/lib/r2-server";
import { isR2Url, extractObjectKey } from "@/lib/r2";

// ============================================================================
// GET /api/tenants/[id] - Get a specific tenant
// ============================================================================

export const GET = withAccessAndDB({
  roles: [UserRole.TENANT],
  permissions: ["tenant_view"],
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
        return createErrorResponse("Invalid tenant ID", 400);
      }

      // Find the tenant user
      const tenantUser = await User.findOne({ _id: id, role: UserRole.TENANT });

      if (!tenantUser) {
        return createErrorResponse("Tenant not found", 404);
      }

      // Role-based authorization
      if (
        user.isTenant &&
        tenantUser._id.toString() !== user.id
      ) {
        return createErrorResponse(
          "You can only view your own tenant profile",
          403
        );
      }

      // Find the tenant profile
      const tenantProfile = await Tenant.findOne({ userId: id });

      const activeLeaseCount = await Lease.countDocuments({
        tenantId: id,
        status: LeaseStatus.ACTIVE,
        deletedAt: null,
      });

      // Combine user and tenant profile data
      const combinedTenantData = {
        ...tenantUser.toObject(),
        ...(tenantProfile ? tenantProfile.toObject() : {}),
        hasActiveLease: activeLeaseCount > 0,
        activeLeaseCount,
      };

      return createSuccessResponse(
        combinedTenantData,
        "Tenant retrieved successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PUT /api/tenants/[id] - Update a specific tenant
// ============================================================================

export const PUT = withAccessAndDB({
  roles: [UserRole.TENANT],
  permissions: ["tenant_edit"],
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
        return createErrorResponse("Invalid tenant ID", 400);
      }

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      // Find the tenant user
      const tenantUser = await User.findOne({ _id: id, role: UserRole.TENANT });
      if (!tenantUser) {
        return createErrorResponse("Tenant not found", 404);
      }

      // Role-based authorization
      if (
        user.isTenant &&
        tenantUser._id.toString() !== user.id
      ) {
        return createErrorResponse(
          "You can only update your own tenant profile",
          403
        );
      }

      // Find or create the tenant profile
      let tenantProfile = await Tenant.findOne({ userId: id });
      if (!tenantProfile) {
        // Create tenant profile if it doesn't exist
        tenantProfile = new Tenant({
          userId: id,
          applicationDate: new Date(),
        });
      }

      // Create a tenant-specific update schema that handles string dates
      const tenantUpdateSchema = z.object({
        userId: z.string().optional(), // Allow userId for creation
        dateOfBirth: z
          .union([z.string(), z.date()])
          .optional()
          .transform((val) => {
            if (!val) return undefined;
            if (typeof val === "string") return new Date(val);
            return val;
          }),
        ssn: z.string().optional(),
        employmentInfo: z
          .object({
            employer: z.string(),
            position: z.string(),
            income: z.number(),
            startDate: z.union([z.string(), z.date()]).transform((val) => {
              if (typeof val === "string") return new Date(val);
              return val;
            }),
          })
          .optional(),
        emergencyContacts: z
          .array(
            z.object({
              name: z.string(),
              relationship: z.string(),
              phone: z.string(),
              email: z.string().optional(),
            })
          )
          .optional(),
        creditScore: z.number().min(300).max(850).optional(),
        moveInDate: z
          .union([z.string(), z.date()])
          .optional()
          .transform((val) => {
            if (!val) return undefined;
            if (typeof val === "string") return new Date(val);
            return val;
          }),
        moveOutDate: z
          .union([z.string(), z.date()])
          .optional()
          .transform((val) => {
            if (!val) return undefined;
            if (typeof val === "string") return new Date(val);
            return val;
          }),
        applicationDate: z
          .union([z.string(), z.date()])
          .optional()
          .transform((val) => {
            if (!val) return undefined;
            if (typeof val === "string") return new Date(val);
            return val;
          }),
        documents: z.array(z.string()).optional(),
        notes: z.string().optional(),
      });

      const validation = validateSchema(tenantUpdateSchema, body);
      if (!validation.success) {
        return createErrorResponse(validation.errors.join(", "), 400);
      }

      const updateData = validation.data;

      // Prevent certain fields from being updated by tenants
      if (user.isTenant) {
        delete updateData.creditScore;
        delete updateData.moveInDate;
        delete updateData.moveOutDate;
      }

      // Update the tenant profile with tenant-specific data
      Object.assign(tenantProfile, updateData);
      await tenantProfile.save();

      // Update User model fields (firstName, lastName, email, phone, avatar, tenantStatus)
      const userUpdateData: any = {};

      if (body.firstName !== undefined)
        userUpdateData.firstName = body.firstName;
      if (body.lastName !== undefined) userUpdateData.lastName = body.lastName;
      if (body.email !== undefined) userUpdateData.email = body.email;
      if (body.phone !== undefined) userUpdateData.phone = body.phone;
      if (body.tenantStatus !== undefined)
        userUpdateData.tenantStatus = body.tenantStatus;

      // Handle avatar update with old avatar deletion
      if (body.avatar !== undefined) {
        // Delete old avatar from R2 if it exists and is different from the new one
        if (tenantUser.avatar && tenantUser.avatar !== body.avatar) {
          try {
            // Extract object key from URL
            let objectKey: string | null = tenantUser.avatar;
            if (
              tenantUser.avatar.startsWith("http://") ||
              tenantUser.avatar.startsWith("https://")
            ) {
              if (isR2Url(tenantUser.avatar)) {
                objectKey = extractObjectKey(tenantUser.avatar);
              } else {
                console.warn(`Skipping non-R2 URL: ${tenantUser.avatar}`);
                objectKey = null;
              }
            }

            if (objectKey) {
              const deleted = await deleteFromR2(objectKey);
              if (deleted) {
              } else {
                console.warn(
                  `Failed to delete old tenant avatar from R2: ${tenantUser.avatar}`
                );
              }
            }
          } catch (error) {
            console.error(
              `Error deleting old tenant avatar from R2: ${tenantUser.avatar}`,
              error
            );
            // Continue even if old avatar deletion fails
          }
        }
        userUpdateData.avatar = body.avatar;
      }

      // Update the User model if there are any user fields to update
      if (Object.keys(userUpdateData).length > 0) {
        await User.findByIdAndUpdate(id, userUpdateData, {
          new: true,
          runValidators: true,
        });
      }

      // Return the updated tenant user with populated tenant profile
      const updatedTenant = await User.findById(id).lean();

      return createSuccessResponse(
        {
          ...updatedTenant,
          ...tenantProfile.toObject(),
        },
        "Tenant updated successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// DELETE /api/tenants/[id] - Delete a specific tenant
// ============================================================================

export const DELETE = withPermissionAndDB("tenant_edit")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid tenant ID", 400);
      }

      // Find the tenant user
      const tenant = await User.findOne({ _id: id, role: UserRole.TENANT });
      if (!tenant) {
        return createErrorResponse("Tenant not found", 404);
      }

      // Check if tenant has active leases
      const activeLeases = await Lease.find({
        tenantId: id,
        status: LeaseStatus.ACTIVE,
        deletedAt: null,
      });

      if (activeLeases.length > 0) {
        return createErrorResponse(
          "Cannot delete tenant with active leases. Please terminate all leases first.",
          409
        );
      }

      // Delete tenant avatar from storage if it exists
      if (tenant.avatar) {
        try {
          // Extract object key from URL
          let objectKey: string | null = tenant.avatar;
          if (
            tenant.avatar.startsWith("http://") ||
            tenant.avatar.startsWith("https://")
          ) {
            if (isR2Url(tenant.avatar)) {
              objectKey = extractObjectKey(tenant.avatar);
            } else {
              console.warn(`Skipping non-R2 URL: ${tenant.avatar}`);
              objectKey = null;
            }
          }

          if (objectKey) {
            const deleted = await deleteFromR2(objectKey);
            if (deleted) {
            } else {
              console.warn(
                `Failed to delete tenant avatar from storage: ${tenant.avatar}`
              );
            }
          }
        } catch (error) {
          console.error(
            `Error deleting tenant avatar from storage: ${tenant.avatar}`,
            error
          );
          // Continue even if avatar deletion fails
        }
      }

      // Perform soft delete on User and Tenant profile
      tenant.deletedAt = new Date();
      tenant.isActive = false;
      await tenant.save({ validateBeforeSave: false });

      const tenantProfile = await Tenant.findOne({ userId: id });
      if (tenantProfile) {
        tenantProfile.deletedAt = new Date();
        await tenantProfile.save({ validateBeforeSave: false });
      }

      return createSuccessResponse({ id }, "Tenant deleted successfully");
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PATCH /api/tenants/[id] - Partial update (status change, etc.)
// ============================================================================

export const PATCH = withPermissionAndDB("tenant_edit")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid tenant ID", 400);
      }

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      // Find the tenant user
      const tenant = await User.findOne({ _id: id, role: UserRole.TENANT });
      if (!tenant) {
        return createErrorResponse("Tenant not found", 404);
      }

      // Handle specific patch operations
      const { action, ...data } = body;

      switch (action) {
        case "approveApplication":
          await tenant.approveApplication(
            user.id,
            data.reason || "Application approved by staff",
            data.notes
          );
          break;

        case "rejectApplication":
          await tenant.rejectApplication(
            user.id,
            data.reason || "Application rejected by staff",
            data.notes
          );
          break;

        case "changeStatus":
          if (!data.newStatus) {
            return createErrorResponse("New status is required", 400);
          }
          await tenant.changeStatus(
            data.newStatus,
            user.id,
            data.reason,
            data.notes
          );
          break;

        case "moveIn":
          if (!data.moveInDate) {
            return createErrorResponse("Move-in date is required", 400);
          }
          await tenant.moveIn(new Date(data.moveInDate), user.id, data.leaseId);
          break;

        case "moveOut":
          if (!data.moveOutDate) {
            return createErrorResponse("Move-out date is required", 400);
          }
          await tenant.moveOut(
            new Date(data.moveOutDate),
            user.id,
            data.reason
          );
          break;

        case "updateCreditScore":
          if (
            !data.creditScore ||
            data.creditScore < 300 ||
            data.creditScore > 850
          ) {
            return createErrorResponse(
              "Valid credit score (300-850) is required",
              400
            );
          }
          tenant.creditScore = data.creditScore;
          await tenant.save();
          break;

        case "updateScreeningScore":
          if (
            data.screeningScore !== undefined &&
            (data.screeningScore < 0 || data.screeningScore > 100)
          ) {
            return createErrorResponse(
              "Valid screening score (0-100) is required",
              400
            );
          }
          tenant.screeningScore = data.screeningScore;
          await tenant.save();
          break;

        case "addDocument":
          if (!data.document) {
            return createErrorResponse("Document URL is required", 400);
          }
          tenant.documents.push(data.document);
          break;

        case "removeDocument":
          if (!data.document) {
            return createErrorResponse("Document URL is required", 400);
          }
          tenant.documents = tenant.documents.filter(
            (doc) => doc !== data.document
          );
          break;

        case "addEmergencyContact":
          if (!data.contact) {
            return createErrorResponse("Emergency contact is required", 400);
          }
          tenant.emergencyContacts.push(data.contact);
          break;

        case "removeEmergencyContact":
          if (data.contactIndex === undefined) {
            return createErrorResponse("Contact index is required", 400);
          }
          tenant.emergencyContacts.splice(data.contactIndex, 1);
          break;

        case "updateEmployment":
          if (!data.employmentInfo) {
            return createErrorResponse(
              "Employment information is required",
              400
            );
          }
          tenant.employmentInfo = data.employmentInfo;
          await tenant.save();
          break;

        case "updateApplicationNotes":
          tenant.applicationNotes = data.notes || "";
          await tenant.save();
          break;

        case "verifyEmergencyContact":
          tenant.emergencyContactVerified = data.verified === true;
          await tenant.save();
          break;

        case "updatePreferredContact":
          if (!["email", "phone", "text", "app"].includes(data.method)) {
            return createErrorResponse("Invalid contact method", 400);
          }
          tenant.preferredContactMethod = data.method;
          await tenant.save();
          break;

        case "startReview":
          await tenant.changeStatus(
            "under_review",
            user.id,
            data.reason || "Application review started",
            data.notes
          );
          break;

        case "activateTenant":
          await tenant.changeStatus(
            "active",
            user.id,
            data.reason || "Tenant activated",
            data.notes
          );
          break;

        case "deactivateTenant":
          await tenant.changeStatus(
            "inactive",
            user.id,
            data.reason || "Tenant deactivated",
            data.notes
          );
          break;

        case "terminateTenant":
          await tenant.changeStatus(
            "terminated",
            user.id,
            data.reason || "Tenant terminated",
            data.notes
          );
          break;

        default:
          return createErrorResponse("Invalid action", 400);
      }

      // Refresh tenant data to get updated fields
      const updatedTenant = await User.findById(tenant._id);

      return createSuccessResponse(
        updatedTenant,
        `Tenant ${action} completed successfully`
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

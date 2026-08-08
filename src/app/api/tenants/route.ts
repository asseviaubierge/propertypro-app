/**
 * PropertyPro - Tenants API Routes
 * CRUD operations for tenant management
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { Lease, User } from "@/models";
import { LeaseStatus, UserRole } from "@/types";
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
  userSchema,
  paginationSchema,
  validateSchema,
} from "@/lib/validations";
import { z } from "zod";
import mongoose from "mongoose";
import { getScopedPropertyIds } from "@/lib/property-scope";
import {
  createEmailVerificationToken,
  sendEmailVerificationLink,
} from "@/lib/invitation-utils";

// Schema for tenants listing filters (extends pagination with status)
const tenantFilterSchema = paginationSchema.extend({
  status: z
    .enum([
      "pending",
      "approved",
      "active",
      "inactive",
      "moved_out",
      "terminated",
      "under_review",
      "application_submitted",
    ])
    .optional(),
  propertyId: z.string().optional(),
});

async function addActiveLeaseMetadata(tenants: any[]) {
  if (!Array.isArray(tenants) || tenants.length === 0) {
    return [];
  }

  const tenantIds = tenants.map((tenant) => tenant._id).filter(Boolean);
  if (tenantIds.length === 0) {
    return tenants.map((tenant) => ({
      ...tenant,
      hasActiveLease: false,
      activeLeaseCount: 0,
    }));
  }

  const activeLeaseCounts = await Lease.aggregate([
    {
      $match: {
        tenantId: { $in: tenantIds },
        status: LeaseStatus.ACTIVE,
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: "$tenantId",
        count: { $sum: 1 },
      },
    },
  ]);

  const countByTenantId = new Map(
    activeLeaseCounts.map((item) => [item._id.toString(), item.count])
  );

  return tenants.map((tenant) => {
    const activeLeaseCount = countByTenantId.get(tenant._id.toString()) || 0;

    return {
      ...tenant,
      hasActiveLease: activeLeaseCount > 0,
      activeLeaseCount,
    };
  });
}

// ============================================================================
// GET /api/tenants - Get all tenants with pagination and filtering
// ============================================================================

export const GET = withPermissionAndDB("tenant_view")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const paginationParams = parsePaginationParams(searchParams);

      // Parse filter parameters
      const filterParams = {
        ...paginationParams,
        status: searchParams.get("status") || undefined,
        propertyId: searchParams.get("propertyId") || undefined,
      };

      // Validate filter parameters (use tenant-specific filter schema)
      const validation = validateSchema(tenantFilterSchema, filterParams);
      if (!validation.success) {
        return createErrorResponse(validation.errors.join(", "), 400);
      }

      const filters = validation.data;

      // Build query based on user role and filters
      let query: any = {
        role: UserRole.TENANT, // Only fetch users with tenant role
        deletedAt: null, // Exclude soft-deleted tenants
      };

      if (!user.isAdmin) {
        const propertyIds = await getScopedPropertyIds(user);
        const leasedTenantIds = propertyIds?.length
          ? await Lease.distinct("tenantId", {
              propertyId: { $in: propertyIds },
              deletedAt: null,
            })
          : [];

        // A newly created tenant may not have a lease yet. Keep it visible to
        // the Property Manager who created it, while also including tenants
        // attached to leases on properties within the manager's scope.
        query.$and = [
          ...(query.$and || []),
          {
            $or: [
              { managerId: new mongoose.Types.ObjectId(user.id) },
              { createdBy: new mongoose.Types.ObjectId(user.id) },
              { _id: { $in: leasedTenantIds } },
            ],
          },
        ];
      }


      // Apply filters - support both legacy and new status filtering
      if (filters.status) {
        switch (filters.status) {
          case "pending":
            // Legacy support: map to new status system
            query.$or = [
              { tenantStatus: "application_submitted" },
              { tenantStatus: "under_review" },
            ];
            break;
          case "approved":
            query.tenantStatus = "approved";
            break;
          case "active":
            query.tenantStatus = "active";
            break;
          case "inactive":
            query.tenantStatus = "inactive";
            break;
          case "moved_out":
            query.tenantStatus = "moved_out";
            break;
          case "terminated":
            query.tenantStatus = "terminated";
            break;
          case "under_review":
            query.tenantStatus = "under_review";
            break;
          case "application_submitted":
            query.tenantStatus = "application_submitted";
            break;
          default:
            // If it's a direct tenant status, use it
            if (
              [
                "application_submitted",
                "under_review",
                "approved",
                "active",
                "inactive",
                "moved_out",
                "terminated",
              ].includes(filters.status)
            ) {
              query.tenantStatus = filters.status;
            }
            break;
        }
      }

      console.log(
        "🔍 Tenant API - Query after status filter:",
        JSON.stringify(query)
      );

      // For admin users, allow "Show All" option with high limit
      let result;
      if (user.isAdmin && (filters.limit ?? 0) >= 1000) {
        // Get all tenants for super admin when "Show All" is selected
        const { sortBy, sortOrder, search } = filters;

        // Add search functionality manually for super admin
        // IMPORTANT: Don't overwrite $or if it exists (for status filtering)
        if (search) {
          if (query.$or) {
            // If $or already exists (from status filter), combine with $and
            query.$and = [
              { $or: query.$or }, // Keep the status filter
              {
                $or: [
                  { firstName: { $regex: search, $options: "i" } },
                  { lastName: { $regex: search, $options: "i" } },
                  { email: { $regex: search, $options: "i" } },
                ],
              },
            ];
            delete query.$or; // Remove the old $or since we're using $and now
          } else {
            // No existing $or, safe to add search $or
            query.$or = [
              { firstName: { $regex: search, $options: "i" } },
              { lastName: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
            ];
          }
        }

        // Build sort object
        const sort: any = {};
        if (sortBy) {
          sort[sortBy] = sortOrder === "asc" ? 1 : -1;
        } else {
          sort.createdAt = -1; // Default sort by creation date
        }

        console.log(
          "🔍 Tenant API - Final query (admin, limit >= 1000):",
          JSON.stringify(query)
        );

        // Execute query without pagination for super admin "Show All"
        const [data, total] = await Promise.all([
          User.find(query).sort(sort).lean(),
          User.countDocuments(query),
        ]);

        result = {
          data,
          pagination: {
            page: 1,
            limit: total,
            total,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        };
      } else {
        // Use normal paginated query for all other cases
        // IMPORTANT: Add search functionality for User model (tenants)
        // The paginateQuery function only searches 'name' and 'description' fields,
        // but User model has firstName, lastName, email instead
        const { search } = filters;
        if (search) {
          const searchCondition = {
            $or: [
              { firstName: { $regex: search, $options: "i" } },
              { lastName: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
            ],
          };

          if (query.$or) {
            // If $or already exists (from status filter), combine with $and
            query.$and = [
              { $or: query.$or }, // Keep the status filter
              searchCondition,
            ];
            delete query.$or; // Remove the old $or since we're using $and now
          } else {
            // No existing $or, safe to add search $or
            query.$or = searchCondition.$or;
          }
        }

        console.log(
          "🔍 Tenant API - Final query (normal pagination):",
          JSON.stringify(query)
        );
        result = await paginateQuery(User, query, filters);
      }

      // No need to populate since we're fetching users directly
      const populatedData = await addActiveLeaseMetadata(result.data);

      return createSuccessResponse(
        populatedData,
        "Tenants retrieved successfully",
        result.pagination
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// POST /api/tenants - Create a new tenant
// ============================================================================

export const POST = withPermissionAndDB("tenant_create")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      // Transform and prepare tenant data
      const tenantData = {
        ...body,
        role: UserRole.TENANT, // Ensure tenant role
        // Transform date strings to Date objects
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        moveInDate: body.moveInDate ? new Date(body.moveInDate) : undefined,
        applicationDate: new Date(), // Set current date as application date
        // Set default tenant status if not provided
        tenantStatus: body.tenantStatus || "application_submitted",
        // Transform employment info dates
        employmentInfo:
          body.employmentInfo?.employer
            ? {
                ...body.employmentInfo,
                startDate: body.employmentInfo.startDate
                  ? new Date(body.employmentInfo.startDate)
                  : new Date(),
              }
            : undefined,
      };

      // Validate the transformed data
      const validation = validateSchema(userSchema, tenantData);
      if (!validation.success) {
        return createErrorResponse(validation.errors.join(", "), 400);
      }

      const userData = validation.data;

      // Check if user with this email already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        return createErrorResponse("User with this email already exists", 409);
      }

      // Keep the tenant attached to the account that created it. This makes
      // applications visible before a lease has been created.
      if (!mongoose.Types.ObjectId.isValid(user.id)) {
        return createErrorResponse("Identifiant du gestionnaire invalide", 400);
      }

      const managerObjectId = new mongoose.Types.ObjectId(user.id);

      const tenant = new User({
        ...userData,
        createdBy: managerObjectId,
        managerId: managerObjectId,
      });
      await tenant.save();

      // Double écriture volontaire via la collection native : elle évite qu'un
      // ancien modèle Mongoose mis en cache par Turbopack ignore les nouveaux
      // champs de rattachement pendant le développement.
      await User.collection.updateOne(
        { _id: tenant._id },
        {
          $set: {
            createdBy: managerObjectId,
            managerId: managerObjectId,
          },
        }
      );

      const ownershipCheck = await User.collection.findOne(
        { _id: tenant._id },
        { projection: { createdBy: 1, managerId: 1 } }
      );

      if (!ownershipCheck?.managerId) {
        await User.collection.deleteOne({ _id: tenant._id });
        return createErrorResponse(
          "Le locataire n'a pas pu être rattaché au Property Manager",
          500
        );
      }
      
            // Send the email verification link automatically after tenant creation.
      // Tenant creation remains successful even if sending the email fails.
      try {
        const tokenResult = await createEmailVerificationToken(
          tenant._id.toString(),
          tenant.email
        );

        if (tokenResult.success && tokenResult.token) {
          const userName =
            `${tenant.firstName} ${tenant.lastName}`.trim();

          const sendResult = await sendEmailVerificationLink(
            tokenResult.token,
            userName
          );

          if (!sendResult.success) {
            console.error(
              "Tenant created, but verification email could not be sent:",
              sendResult.error
            );
          }
        } else {
          console.error(
            "Tenant created, but verification token could not be created:",
            tokenResult.error
          );
        }
      } catch (emailError) {
        console.error(
          "Tenant created, but automatic email verification failed:",
          emailError
        );
      }
      return createSuccessResponse(
        tenant,
        "Tenant created successfully",
        undefined
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PUT /api/tenants - Bulk update tenants (admin only)
// ============================================================================

export const PUT = withPermissionAndDB(["tenant_edit", "bulk_operations"], {
  requireAllPermissions: true,
})(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      if (!user.isAdmin) {
        return createErrorResponse("Insufficient permissions", 403);
      }

    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error!, 400);
    }

    const { tenantIds, updates } = body;

    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      return createErrorResponse("Tenant IDs array is required", 400);
    }

    if (!updates || typeof updates !== "object") {
      return createErrorResponse("Updates object is required", 400);
    }

    // Remove fields that shouldn't be bulk updated
    const allowedUpdates = { ...updates };
    delete allowedUpdates._id;
    delete allowedUpdates.userId;
    delete allowedUpdates.createdAt;
    delete allowedUpdates.updatedAt;

    // Perform bulk update on users with tenant role
    const result = await User.updateMany(
      { _id: { $in: tenantIds }, role: UserRole.TENANT },
      { $set: allowedUpdates }
    );

    return createSuccessResponse(
      {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
      `${result.modifiedCount} tenants updated successfully`
    );
  } catch (error) {
    return handleApiError(error);
  }
  }
);

// ============================================================================
// DELETE /api/tenants - Bulk delete tenants (admin only)
// ============================================================================

export const DELETE = withPermissionAndDB(
  ["tenant_edit", "bulk_operations"],
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
    const tenantIds = searchParams.get("ids")?.split(",") || [];

    if (tenantIds.length === 0) {
      return createErrorResponse("Tenant IDs are required", 400);
    }

    // Check for active leases
    const activeLeases = await Lease.find({
      tenantId: { $in: tenantIds },
      status: LeaseStatus.ACTIVE,
      deletedAt: null,
    });

    if (activeLeases.length > 0) {
      return createErrorResponse(
        "Cannot delete tenants with active leases. Please terminate leases first.",
        409
      );
    }

    // Perform permanent deletion on users with tenant role
    const result = await User.deleteMany({
      _id: { $in: tenantIds },
      role: UserRole.TENANT,
    });

    // Also delete associated tenant profiles
    const Tenant = require("@/models/Tenant").default;
    await Tenant.deleteMany({
      userId: { $in: tenantIds },
    });

    return createSuccessResponse(
      {
        deletedCount: result.deletedCount,
      },
      `${result.deletedCount} tenants permanently deleted`
    );
  } catch (error) {
    return handleApiError(error);
  }
  }
);

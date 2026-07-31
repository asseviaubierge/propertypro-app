/**
 * PropertyPro - Users API Routes
 * Handle user-related operations with role-based access control
 */

import { NextRequest } from "next/server";
import { Lease, User, Role } from "@/models";
import { AccountType, LeaseStatus, UserRole } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { auditService } from "@/lib/audit-service";
import { AuditCategory, AuditAction, AuditSeverity } from "@/models/AuditLog";
import {
  canManageRoles,
  canManageTargetRole,
  canManageTargetUser,
  canViewTargetUser,
  canViewUsers,
  createAccessProfile,
} from "@/lib/permissions-manager";
import { resolveAccessProfile } from "@/lib/server-permissions";
import {
  createEmailVerificationToken,
  sendEmailVerificationLink,
} from "@/lib/invitation-utils";

async function getRoleAccessMap(users: Array<{ role?: string | null }>) {
  const uniqueRoles = [...new Set(users.map((user) => user.role || UserRole.TENANT))];
  const accessEntries = await Promise.all(
    uniqueRoles.map(async (role) => [role, await resolveAccessProfile(role)] as const)
  );

  return new Map(accessEntries);
}

// ============================================================================
// GET /api/users - Get all users with filtering and pagination
// ============================================================================

export const GET = withPermissionAndDB(["user_view", "user_management"])(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    if (!canViewUsers(user)) {
      return createErrorResponse("Insufficient permissions", 403);
    }

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const isActive = searchParams.get("isActive");
    const excludeTenant = searchParams.get("excludeTenant") === "true";
    const companyStaffOnly = searchParams.get("companyStaffOnly") === "true";

    // Build filter query
    const filter: any = {
      // Exclude soft-deleted users
      deletedAt: null,
    };

    // Search filter
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Role filter - support multiple roles separated by comma
    if (role) {
      const roles = role
        .split(",")
        .map((r) => r.trim())
        .filter((r) => r);
      if (roles.length === 1) {
        filter.role = roles[0];
      } else if (roles.length > 1) {
        filter.role = { $in: roles };
      }
    }

    // Exclude tenants when requested and no specific role filter is applied
    if (excludeTenant) {
      if (!filter.role) {
        filter.role = { $ne: UserRole.TENANT };
      } else if (typeof filter.role === "string") {
        if (filter.role === UserRole.TENANT) {
          // Force no tenant results
          filter.role = { $ne: UserRole.TENANT };
        }
      } else if (filter.role && (filter.role as any).$in) {
        const rolesIn: string[] = (filter.role as any).$in.filter(
          (r: string) => r !== UserRole.TENANT
        );
        filter.role =
          rolesIn.length > 0 ? { $in: rolesIn } : { $ne: UserRole.TENANT };
      }
    }

    // Active status filter
    if (isActive !== null && isActive !== undefined && isActive !== "") {
      filter.isActive = isActive === "true";
    }

    const allUsers = await User.find(filter)
      .select("-password -__v")
      .sort({ createdAt: -1 })
      .lean();

    const roleAccessMap = await getRoleAccessMap(allUsers);
    const visibleUsers = allUsers.filter((targetUser) => {
      const targetAccess = roleAccessMap.get(targetUser.role || UserRole.TENANT);
      if (!targetAccess) {
        return false;
      }

      if (excludeTenant && targetAccess.isTenant) {
        return false;
      }

      if (companyStaffOnly && !targetAccess.isCompanyStaff) {
        return false;
      }

      return canViewTargetUser(user, targetAccess, {
        isSelf: targetUser._id.toString() === user.id,
      });
    });

    const skip = (page - 1) * limit;
    const users = visibleUsers.slice(skip, skip + limit).map((targetUser) => ({
      ...targetUser,
      accessProfile:
        roleAccessMap.get(targetUser.role || UserRole.TENANT) ?? null,
    }));
    const total = visibleUsers.length;

    // Calculate pagination info
    const pages = Math.ceil(total / limit);
    const hasNext = page < pages;
    const hasPrev = page > 1;

    return createSuccessResponse({
      users: users,
      pagination: {
        page,
        limit,
        total,
        pages,
        hasNext,
        hasPrev,
      },
    });
  } catch {
    return createErrorResponse("Failed to fetch users", 500);
  }
  }
);

// ============================================================================
// POST /api/users - Create a new user (Admin only)
// ============================================================================

export const POST = withPermissionAndDB("user_management")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const body = await request.json();

    // Basic validation
    if (!body.email || !body.password || !body.firstName || !body.lastName) {
      return createErrorResponse("Missing required fields", 400);
    }

    // Validate role (system role or existing custom role)
    if (body.role) {
      const isSystemRole = Object.values(UserRole).includes(body.role);
      const targetRoleAccess = isSystemRole
        ? createAccessProfile(body.role)
        : null;

      if (!isSystemRole) {
        const roleExists = await Role.findOne({
          name: body.role,
          isActive: true,
          deletedAt: null,
        }).lean();
        if (!roleExists) {
          return createErrorResponse("Invalid role specified", 400);
        }

        const targetAccess = createAccessProfile(
          roleExists.name,
          roleExists.permissions
        );
        if (!canManageRoles(user) || !canManageTargetRole(user, targetAccess)) {
          return createErrorResponse(
            "You do not have permission to assign this role",
            403
          );
        }
      } else if (body.role !== UserRole.TENANT) {
        if (!canManageRoles(user) || !canManageTargetRole(user, targetRoleAccess!)) {
          return createErrorResponse(
            "You do not have permission to assign this role",
            403
          );
        }
      }
    }
    
    // Validation de l'identité professionnelle
if (body.role !== UserRole.TENANT) {
  if (!body.accountType) {
    return createErrorResponse(
      "Le type de compte est obligatoire",
      400
    );
  }

  if (!Object.values(AccountType).includes(body.accountType)) {
    return createErrorResponse(
      "Le type de compte est invalide",
      400
    );
  }

  const cip = String(body.cip || "").trim();

  if (!cip) {
    return createErrorResponse(
      "Le numéro CIP est obligatoire",
      400
    );
  }

  if (cip.length < 5 || cip.length > 30) {
    return createErrorResponse(
      "Le numéro CIP doit contenir entre 5 et 30 caractères",
      400
    );
  }

  if (
    (body.accountType === AccountType.AGENCY ||
      body.accountType === AccountType.E_IMMO) &&
    !String(body.businessName || "").trim()
  ) {
    return createErrorResponse(
      "Le nom commercial est obligatoire pour une agence ou E-IMMO",
      400
    );
  }
}

    // Check if user already exists
    const existingUser = await User.findOne({ email: body.email });
    if (existingUser) {
      return createErrorResponse("User with this email already exists", 400);
    }

    // Create new user
    const newUser = new User({
  firstName: body.firstName,
  lastName: body.lastName,
  email: body.email,
  password: body.password, // Will be hashed by the model
  role: body.role || UserRole.TENANT,
  phone: body.phone || undefined,

  // Identité professionnelle / gestion immobilière
  accountType: body.accountType || undefined,
  cip: body.cip?.trim() || undefined,
  businessName: body.businessName?.trim() || undefined,
  ifu: body.ifu?.trim() || undefined,
  rccm: body.rccm?.trim() || undefined,

  avatar: body.avatar || undefined,
  isActive: body.isActive !== undefined ? body.isActive : true,
});

    const savedUser = await newUser.save();
    
    // Send the email verification link automatically after account creation.
// User creation must remain successful even if the email cannot be sent.
try {
  const tokenResult = await createEmailVerificationToken(
    savedUser._id.toString(),
    savedUser.email
  );

  if (tokenResult.success && tokenResult.token) {
    const userName =
      `${savedUser.firstName} ${savedUser.lastName}`.trim();

    const sendResult = await sendEmailVerificationLink(
      tokenResult.token,
      userName
    );

    if (!sendResult.success) {
      console.error(
        "User created, but verification email could not be sent:",
        sendResult.error
      );
    }
  } else {
    console.error(
      "User created, but verification token could not be created:",
      tokenResult.error
    );
  }
} catch (emailError) {
  console.error(
    "User created, but automatic email verification failed:",
    emailError
  );
}

    // Remove password from response
    const userResponse = savedUser.toObject();
    delete userResponse.password;

    const context = auditService.extractContextFromRequest(request, user);

    await auditService.logEvent(
      {
        category: AuditCategory.USER_MANAGEMENT,
        action: AuditAction.CREATE,
        severity: AuditSeverity.LOW,
        description: `Created user: ${savedUser.firstName} ${savedUser.lastName}`,
        resourceType: "user",
        resourceId: savedUser._id.toString(),
        resourceName: `${savedUser.firstName} ${savedUser.lastName}`,
        newValues: {
          firstName: savedUser.firstName,
          lastName: savedUser.lastName,
          email: savedUser.email,
          role: savedUser.role,
          isActive: savedUser.isActive,
        },
        tags: ["user", "create"],
      },
      context
    );

    return createSuccessResponse(
      { data: userResponse },
      "User created successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
  }
);

// ============================================================================
// PUT /api/users - Bulk update users (Admin only)
// ============================================================================

export const PUT = withPermissionAndDB("user_management")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const body = await request.json();
      const { userIds, updates } = body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return createErrorResponse("User IDs are required", 400);
      }

      if (!updates || typeof updates !== "object") {
        return createErrorResponse("Updates are required", 400);
      }

      const targetUsers = await User.find({
        _id: { $in: userIds },
      })
        .select("_id role")
        .lean();

      if (targetUsers.length !== userIds.length) {
        return createErrorResponse("Some users were not found", 404);
      }

      const roleAccessMap = await getRoleAccessMap(targetUsers);
      const blockedTarget = targetUsers.find((targetUser) => {
        const targetAccess = roleAccessMap.get(targetUser.role || UserRole.TENANT);
        return (
          !targetAccess ||
          !canManageTargetUser(user, targetAccess, {
            isSelf: targetUser._id.toString() === user.id,
          })
        );
      });

      if (blockedTarget) {
        return createErrorResponse(
          "You do not have permission to update one or more selected users",
          403
        );
      }

      if (updates.role) {
        const targetRoleAccess = await resolveAccessProfile(updates.role);
        if (!canManageRoles(user) || !canManageTargetRole(user, targetRoleAccess)) {
          return createErrorResponse(
            "You do not have permission to assign the selected role",
            403
          );
        }
      }

      // Remove sensitive fields from updates
      delete updates.password;
      delete updates._id;
      delete updates.__v;

      // Perform bulk update
      const result = await User.updateMany(
        { _id: { $in: userIds } },
        { $set: updates }
      );

      await auditService.logEvent(
        {
          category: AuditCategory.USER_MANAGEMENT,
          action: AuditAction.BULK_UPDATE,
          severity: AuditSeverity.MEDIUM,
          description: `Bulk updated ${userIds.length} users`,
          details: { userIds, updates },
          tags: ["user", "bulk_update"],
        },
        auditService.extractContextFromRequest(request, user)
      );

      return createSuccessResponse({
        data: {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
        },
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// DELETE /api/users - Bulk deactivate users (Admin only)
// ============================================================================

export const DELETE = withPermissionAndDB("user_management")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const idsParam = searchParams.get("ids");

      if (!idsParam) {
        return createErrorResponse("User IDs are required", 400);
      }

      const userIds = idsParam.split(",");

      if (userIds.includes(user.id)) {
        return createErrorResponse("You cannot deactivate yourself", 400);
      }

      const targetUsers = await User.find({
        _id: { $in: userIds },
      })
        .select("_id role")
        .lean();

      if (targetUsers.length !== userIds.length) {
        return createErrorResponse("Some users were not found", 404);
      }

      const roleAccessMap = await getRoleAccessMap(targetUsers);
      const blockedTarget = targetUsers.find((targetUser) => {
        const targetAccess = roleAccessMap.get(targetUser.role || UserRole.TENANT);
        return !targetAccess || !canManageTargetUser(user, targetAccess);
      });

      if (blockedTarget) {
        return createErrorResponse(
          "You do not have permission to deactivate one or more selected users",
          403
        );
      }

      const tenantUserIds = targetUsers
        .filter((targetUser) => targetUser.role === UserRole.TENANT)
        .map((targetUser) => targetUser._id);

      if (tenantUserIds.length > 0) {
        const activeLease = await Lease.exists({
          tenantId: { $in: tenantUserIds },
          status: LeaseStatus.ACTIVE,
          deletedAt: null,
        });

        if (activeLease) {
          return createErrorResponse(
            "Cannot deactivate tenants with active leases. Please terminate the leases first.",
            409
          );
        }
      }

      // Deactivate users instead of deleting them
      const result = await User.updateMany(
        { _id: { $in: userIds } },
        { $set: { isActive: false } }
      );

      await auditService.logEvent(
        {
          category: AuditCategory.USER_MANAGEMENT,
          action: AuditAction.BULK_DELETE,
          severity: AuditSeverity.HIGH,
          description: `Bulk deactivated ${userIds.length} users`,
          details: { userIds },
          tags: ["user", "bulk_deactivate"],
        },
        auditService.extractContextFromRequest(request, user)
      );

      return createSuccessResponse({
        data: {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
        },
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
);

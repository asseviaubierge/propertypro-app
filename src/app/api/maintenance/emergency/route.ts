/**
 * PropertyPro - Emergency Maintenance Requests API Routes
 * Specialized API endpoints for emergency maintenance request management
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { MaintenanceRequest, Property, User } from "@/models";
import { UserRole, MaintenancePriority, MaintenanceStatus } from "@/types";
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
import { maintenanceListScope, assertMaintenancePropertyAccess } from "@/lib/maintenance-access";
import {
  maintenanceRequestSchema,
  paginationSchema,
  validateSchema,
} from "@/lib/validations";
import { hasAnyPermission } from "@/lib/role-utils";
import { resolveAccessProfile } from "@/lib/server-permissions";
import { z } from "zod";

const EMERGENCY_STAFF_PERMISSIONS = [
  "maintenance_management",
  "maintenance_assign",
  "work_orders",
];

function canHandleEmergencyMaintenance(profile: {
  isCompanyStaff: boolean;
  permissions: string[];
}) {
  return (
    profile.isCompanyStaff &&
    hasAnyPermission(profile.permissions, EMERGENCY_STAFF_PERMISSIONS)
  );
}

// ============================================================================
// GET /api/maintenance/emergency - Get emergency maintenance requests
// ============================================================================

export const GET = withPermissionAndDB("maintenance_management")(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const paginationParams = parsePaginationParams(searchParams);

    // Emergency-specific filters
    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("status") || "all";
    const responseTime = searchParams.get("responseTime") || "all"; // overdue, urgent, normal
    const propertyId = searchParams.get("propertyId");
    const assignedTo = searchParams.get("assignedTo");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Build base query for emergency requests
    let baseQuery: any = {
      priority: MaintenancePriority.EMERGENCY,
      deletedAt: null,
    };

    // Apply status filter - by default, exclude completed/cancelled to show only active emergencies
    if (status !== "all") {
      if (status === "active") {
        baseQuery.status = {
          $in: [
            MaintenanceStatus.SUBMITTED,
            MaintenanceStatus.ASSIGNED,
            MaintenanceStatus.IN_PROGRESS,
          ],
        };
      } else {
        baseQuery.status = status;
      }
    } else {
      // Default: exclude completed and cancelled items
      baseQuery.status = {
        $nin: [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
      };
    }

    baseQuery = await maintenanceListScope(user, baseQuery);

    // Apply property filter without allowing scope bypass.
    if (propertyId) {
      if (!(await assertMaintenancePropertyAccess(user, propertyId))) {
        return createErrorResponse("Forbidden property", 403);
      }
      baseQuery.propertyId = propertyId;
    }

    // Apply assigned user filter
    if (assignedTo) {
      if (assignedTo === "unassigned") {
        baseQuery.assignedTo = { $exists: false };
      } else {
        baseQuery.assignedTo = assignedTo;
      }
    }

    // Role-based access control
    // Single company architecture - Managers can view all emergency maintenance requests

    const escapedSearch = search
      ? search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      : "";
    const searchRegex = escapedSearch ? new RegExp(escapedSearch, "i") : null;

    // Build aggregation pipeline for emergency requests with response time calculation
    const pipeline = [
      { $match: baseQuery },
      {
        $addFields: {
          // Calculate hours since creation
          hoursSinceCreation: {
            $divide: [
              { $subtract: [new Date(), "$createdAt"] },
              1000 * 60 * 60, // Convert to hours
            ],
          },
          // Determine if overdue (emergency should be responded to within 2 hours)
          isOverdue: {
            $and: [
              {
                $not: {
                  $in: [
                    "$status",
                    [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
                  ],
                },
              },
              {
                $gt: [
                  {
                    $divide: [
                      { $subtract: [new Date(), "$createdAt"] },
                      1000 * 60 * 60,
                    ],
                  },
                  2,
                ],
              },
            ],
          },
          // Determine urgency level
          urgencyLevel: {
            $cond: {
              if: {
                $in: [
                  "$status",
                  [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
                ],
              },
              then: "completed",
              else: {
                $cond: {
                  if: {
                    $gt: [
                      {
                        $divide: [
                          { $subtract: [new Date(), "$createdAt"] },
                          1000 * 60 * 60,
                        ],
                      },
                      4,
                    ],
                  },
                  then: "critical",
                  else: {
                    $cond: {
                      if: {
                        $gt: [
                          {
                            $divide: [
                              { $subtract: [new Date(), "$createdAt"] },
                              1000 * 60 * 60,
                            ],
                          },
                          2,
                        ],
                      },
                      then: "overdue",
                      else: "normal",
                    },
                  },
                },
              },
            },
          },
        },
      },
      // Apply response time filter
      ...(responseTime !== "all"
        ? [
            {
              $match: {
                urgencyLevel:
                  responseTime === "overdue"
                    ? { $in: ["overdue", "critical"] }
                    : responseTime,
              },
            },
          ]
        : []),
      // Populate related data
      {
        $lookup: {
          from: "properties",
          localField: "propertyId",
          foreignField: "_id",
          as: "property",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "tenantId",
          foreignField: "_id",
          as: UserRole.TENANT,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "assignedUser",
        },
      },
      // Unwind arrays
      { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$assignedUser", preserveNullAndEmptyArrays: true } },
      // Apply search after lookups so we can search property + tenant fields too
      ...(searchRegex
        ? [
            {
              $match: {
                $or: [
                  { title: searchRegex },
                  { description: searchRegex },
                  { category: searchRegex },
                  { "property.name": searchRegex },
                  { "property.address.street": searchRegex },
                  { "property.address.city": searchRegex },
                  { "property.address.state": searchRegex },
                  { "property.address.zipCode": searchRegex },
                  { "tenant.firstName": searchRegex },
                  { "tenant.lastName": searchRegex },
                  { "tenant.email": searchRegex },
                  { "assignedUser.firstName": searchRegex },
                  { "assignedUser.lastName": searchRegex },
                  { "assignedUser.email": searchRegex },
                ],
              },
            },
          ]
        : []),
      // Project final fields
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          priority: 1,
          status: 1,
          category: 1,
          images: 1,
          estimatedCost: 1,
          actualCost: 1,
          scheduledDate: 1,
          completedDate: 1,
          notes: 1,
          createdAt: 1,
          updatedAt: 1,
          hoursSinceCreation: 1,
          isOverdue: 1,
          urgencyLevel: 1,
          property: {
            _id: "$property._id",
            name: "$property.name",
            address: {
              $concat: [
                "$property.address.street",
                ", ",
                "$property.address.city",
                ", ",
                "$property.address.state",
                " ",
                "$property.address.zipCode",
              ],
            },
          },
          tenant: {
            _id: "$tenant._id",
            firstName: "$tenant.firstName",
            lastName: "$tenant.lastName",
            email: "$tenant.email",
            phone: "$tenant.phone",
            avatar: "$tenant.avatar",
          },
          assignedUser: {
            _id: "$assignedUser._id",
            firstName: "$assignedUser.firstName",
            lastName: "$assignedUser.lastName",
            email: "$assignedUser.email",
            avatar: "$assignedUser.avatar",
          },
        },
      },
      // Sort
      { $sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 } },
    ];

    // Execute aggregation with pagination manually since paginateQuery doesn't support aggregation
    const { page, limit } = paginationParams;
    const skip = ((page || 1) - 1) * (limit || 12);

    // Add pagination to pipeline
    const paginatedPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    // Get total count
    const countPipeline = [
      ...pipeline.slice(0, -1), // Remove sort stage for count
      { $count: "total" },
    ];

    // Execute both queries
    const [data, countResult] = await Promise.all([
      MaintenanceRequest.aggregate(paginatedPipeline as any),
      MaintenanceRequest.aggregate(countPipeline as any),
    ]);

    const total = countResult[0]?.total || 0;
    const pages = Math.ceil(total / (limit || 12));

    const result = {
      data,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    };

    // Get emergency statistics - only count active emergencies (exclude completed/cancelled)
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats = await MaintenanceRequest.aggregate([
      {
        $match: {
          priority: MaintenancePriority.EMERGENCY,
          deletedAt: null,
          status: {
            $nin: [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
          },
        },
      },
      {
        $addFields: {
          hoursSinceCreation: {
            $divide: [
              { $subtract: [new Date(), "$createdAt"] },
              1000 * 60 * 60,
            ],
          },
          isOverdue: {
            $and: [
              {
                $not: {
                  $in: [
                    "$status",
                    [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
                  ],
                },
              },
              {
                $gt: [
                  {
                    $divide: [
                      { $subtract: [new Date(), "$createdAt"] },
                      1000 * 60 * 60,
                    ],
                  },
                  2,
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    [
                      MaintenanceStatus.SUBMITTED,
                      MaintenanceStatus.ASSIGNED,
                      MaintenanceStatus.IN_PROGRESS,
                    ],
                  ],
                },
                1,
                0,
              ],
            },
          },
          critical: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $not: {
                        $in: [
                          "$status",
                          [
                            MaintenanceStatus.COMPLETED,
                            MaintenanceStatus.CANCELLED,
                          ],
                        ],
                      },
                    },
                    { $gt: ["$hoursSinceCreation", 4] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          overdue: { $sum: { $cond: ["$isOverdue", 1, 0] } },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", MaintenanceStatus.COMPLETED] }, 1, 0],
            },
          },
          unassigned: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $not: { $ifNull: ["$assignedTo", false] } },
                    {
                      $in: [
                        "$status",
                        [
                          MaintenanceStatus.SUBMITTED,
                          MaintenanceStatus.ASSIGNED,
                          MaintenanceStatus.IN_PROGRESS,
                        ],
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          todayCreated: {
            $sum: {
              $cond: [{ $gte: ["$createdAt", startOfToday] }, 1, 0],
            },
          },
          weekCreated: {
            $sum: {
              $cond: [{ $gte: ["$createdAt", sevenDaysAgo] }, 1, 0],
            },
          },
          avgResponseTime: {
            $avg: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", MaintenanceStatus.COMPLETED] },
                    { $ne: ["$completedDate", null] },
                  ],
                },
                {
                  $divide: [
                    { $subtract: ["$completedDate", "$createdAt"] },
                    1000 * 60 * 60, // Convert to hours
                  ],
                },
                null,
              ],
            },
          },
          escalated: { $sum: 0 },
        },
      },
    ]);

    const statistics = stats[0] || {
      total: 0,
      active: 0,
      critical: 0,
      overdue: 0,
      completed: 0,
      unassigned: 0,
      avgResponseTime: 0,
      escalated: 0,
      todayCreated: 0,
      weekCreated: 0,
    };

    return createSuccessResponse(
      {
        requests: result.data,
        pagination: result.pagination,
        statistics,
      },
      "Emergency maintenance requests retrieved successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// POST /api/maintenance/emergency - Create emergency maintenance request
// ============================================================================

export const POST = withPermissionAndDB("maintenance_management")(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error!, 400);
    }

    // Validate request body with emergency-specific requirements
    const emergencySchema = maintenanceRequestSchema.extend({
      priority: z.literal(MaintenancePriority.EMERGENCY),
      category: z.enum([
        "Emergency",
        "Plumbing",
        "Electrical",
        "HVAC",
        "Sécurité",
        "Autre",
      ]),
      contactPhone: z.string().optional(),
      emergencyType: z
        .enum([
          "water_leak",
          "electrical_hazard",
          "gas_leak",
          "security_breach",
          "fire_hazard",
          "structural_damage",
          "hvac_failure",
          "other",
        ])
        .optional(),
    });

    const validation = validateSchema(emergencySchema, {
      ...body,
      priority: MaintenancePriority.EMERGENCY, // Force emergency priority
    });

    if (!validation.success) {
      return createErrorResponse(validation.errors.join(", "), 400);
    }

    const emergencyData = validation.data;

    // Verify property exists
    const property = await Property.findById(emergencyData.propertyId);
    if (!property) {
      return createErrorResponse("Property not found", 404);
    }

    const tenant = await User.findById(emergencyData.tenantId);
    if (!tenant || !(tenant as any).isActive) {
      return createErrorResponse("Tenant not found", 404);
    }

    const tenantAccessProfile = await resolveAccessProfile((tenant as any).role);
    if (!tenantAccessProfile.isTenant) {
      return createErrorResponse("Selected user is not a tenant account", 400);
    }

    let assignedTo = emergencyData.assignedTo;
    if (!assignedTo) {
      const availableStaff = await User.find({ isActive: true })
        .select("_id role createdAt")
        .sort({ createdAt: 1 });

      for (const staffUser of availableStaff) {
        const staffAccessProfile = await resolveAccessProfile((staffUser as any).role);
        if (!canHandleEmergencyMaintenance(staffAccessProfile)) {
          continue;
        }

        assignedTo = String(staffUser._id);
        break;
      }
    }

    // Create emergency maintenance request
    const emergencyRequest = new MaintenanceRequest({
      ...emergencyData,
      assignedTo,
      status: assignedTo
        ? MaintenanceStatus.ASSIGNED
        : MaintenanceStatus.SUBMITTED,
      priority: MaintenancePriority.EMERGENCY,
      category: emergencyData.category || "Emergency",
    });

    await emergencyRequest.save();

    // Populate the created request for response
    const populatedRequest = await MaintenanceRequest.findById(
      emergencyRequest._id,
    )
      .populate("propertyId", "name address")
      .populate("tenantId", "firstName lastName email phone")
      .populate("assignedTo", "firstName lastName email");

    // TODO: Trigger emergency notifications (email, SMS, push notifications)
    // This would be implemented in a separate notification service

    return createSuccessResponse(
      populatedRequest,
      "Emergency maintenance request created successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

import { z } from "zod";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
  parseRequestBody,
} from "@/lib/api-utils";
import { UserRole } from "@/types";
export const dynamic = "force-dynamic";
import { Announcement } from "@/models";
import { NextRequest } from "next/server";
import { messagingService } from "@/lib/services/messaging.service";
import {
  buildAnnouncementVisibilityFilter,
  mergeInboxFilters,
} from "@/lib/inbox-visibility";

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  content: z
    .string()
    .min(1, "Content is required")
    .max(5000, "Content too long"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  type: z
    .enum(["general", "maintenance", "policy", "emergency", "event", "system"])
    .default("general"),
  targetAudience: z.object({
    roles: z.array(z.nativeEnum(UserRole)).optional(),
    propertyIds: z.array(z.string()).optional(),
    userIds: z.array(z.string()).optional(),
    tenantIds: z.array(z.string()).optional(),
    includeAll: z.boolean().default(false),
  }),
  scheduledFor: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  expiresAt: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  attachments: z
    .array(
      z.object({
        fileName: z.string(),
        fileUrl: z.string(),
        fileSize: z.number(),
        fileType: z.string(),
      }),
    )
    .default([]),
  actionButton: z
    .object({
      text: z.string().max(50),
      url: z.string(),
    })
    .optional(),
  isSticky: z.boolean().default(false),
  allowComments: z.boolean().default(true),
});

const querySchema = z.object({
  status: z
    .enum(["draft", "scheduled", "published", "expired", "archived"])
    .optional(),
  type: z
    .enum(["general", "maintenance", "policy", "emergency", "event", "system"])
    .optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  activeOnly: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ============================================================================
// GET /api/announcements - Get announcements
// ============================================================================
export const GET = withPermissionAndDB("profile_management")(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
  context?: { tenantProfile?: any },
) => {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    // Validate query parameters
    const validation = querySchema.safeParse(queryParams);
    if (!validation.success) {
      return createErrorResponse(
        `Invalid query parameters: ${validation.error.errors
          .map((e) => e.message)
          .join(", ")}`,
        400,
      );
    }

    const {
      status,
      type,
      priority,
      activeOnly,
      page,
      limit,
      search,
      from,
      to,
    } = validation.data;

    const queryClauses: Record<string, any>[] = [];
    const forceAudienceScope = activeOnly || !user.isCompanyStaff;

    if (forceAudienceScope) {
      queryClauses.push(
        await buildAnnouncementVisibilityFilter(user, context?.tenantProfile, {
          activeOnly: true,
        }),
      );
    } else {
      queryClauses.push({ deletedAt: null });
    }

    // Admin/Manager view - all announcements with filtering
    if (status && !forceAudienceScope) queryClauses.push({ status });
    if (type) queryClauses.push({ type });
    if (priority) queryClauses.push({ priority });

    // Text search (regex fallback avoids requiring text index in MongoDB)
    if (search?.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), "i");
      queryClauses.push({
        $or: [{ title: searchRegex }, { content: searchRegex }],
      });
    }

    // Date range filter (createdAt)
    if (from || to) {
      const dateQuery: Record<string, Date> = {};

      if (from) {
        const fromDate = new Date(from);
        if (!Number.isNaN(fromDate.getTime())) {
          fromDate.setHours(0, 0, 0, 0);
          dateQuery.$gte = fromDate;
        }
      }

      if (to) {
        const toDate = new Date(to);
        if (!Number.isNaN(toDate.getTime())) {
          toDate.setHours(23, 59, 59, 999);
          dateQuery.$lte = toDate;
        }
      }

      if (Object.keys(dateQuery).length > 0) {
        queryClauses.push({ createdAt: dateQuery });
      }
    }

    const query = mergeInboxFilters(...queryClauses);

    // Execute query with pagination
    const skip = (page - 1) * limit;

    const [announcements, total] = await Promise.all([
      Announcement.find(query)
        .sort({ isSticky: -1, publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate([
          { path: "createdBy", select: "firstName lastName email" },
          { path: "targetAudience.propertyIds", select: "name address" },
        ])
        .lean(),
      Announcement.countDocuments(query),
    ]);

    return createSuccessResponse(
      {
        announcements,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
      "Announcements retrieved successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// POST /api/announcements - Create announcement
// ============================================================================
export const POST = withPermissionAndDB("company_settings")(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
) => {
  try {
    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error ?? "Invalid request body", 400);
    }

    // Validate request body
    const validation = createAnnouncementSchema.safeParse(body);
    if (!validation.success) {
      console.error(
        "❌ Announcement validation failed:",
        validation.error.errors,
      );
      return createErrorResponse(
        `Validation failed: ${validation.error.errors
          .map((e) => e.message)
          .join(", ")}`,
        400,
      );
    }

    const announcementData = validation.data;

    // Validate target audience
    if (!announcementData?.targetAudience?.includeAll) {
      const hasTargets =
        (announcementData.targetAudience.roles &&
          announcementData.targetAudience.roles.length > 0) ||
        (announcementData.targetAudience.propertyIds &&
          announcementData.targetAudience.propertyIds.length > 0) ||
        (announcementData.targetAudience.userIds &&
          announcementData.targetAudience.userIds.length > 0) ||
        (announcementData.targetAudience.tenantIds &&
          announcementData.targetAudience.tenantIds.length > 0);

      if (!hasTargets) {
        return createErrorResponse(
          "Target audience must be specified or includeAll must be true",
          400,
        );
      }
    }

    // Create the announcement
    const announcement = await messagingService.createAnnouncement(
      announcementData,
      user.id,
    );

    return createSuccessResponse(
      announcement,
      "Announcement created successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// Helper functions for announcement management
// ============================================================================

export async function getAnnouncementsForUser(
  userId: string,
  userRole: UserRole,
  propertyIds: string[] = [],
  limit: number = 10,
) {
  try {
    const targetCriteria = {
      roles: [userRole],
      propertyIds,
      userId,
    };

    const announcements =
      await Announcement.getActiveAnnouncements(targetCriteria);

    return {
      success: true,
      announcements: announcements.slice(0, limit),
    };
  } catch (error) {
    console.error("Failed to get announcements for user:", error);
    return {
      success: false,
      announcements: [],
    };
  }
}

export async function markAnnouncementAsViewed(
  announcementId: string,
  userId: string,
  ipAddress?: string,
) {
  try {
    const announcement = await Announcement.findById(announcementId);
    if (!announcement) {
      return { success: false, error: "Announcement not found" };
    }

    await announcement.addView(userId, ipAddress);

    return { success: true };
  } catch (error) {
    console.error("Failed to mark announcement as viewed:", error);
    return { success: false, error: "Failed to update view" };
  }
}

export async function addAnnouncementReaction(
  announcementId: string,
  userId: string,
  reactionType: "like" | "love" | "helpful" | "important",
) {
  try {
    const announcement = await Announcement.findById(announcementId);
    if (!announcement) {
      return { success: false, error: "Announcement not found" };
    }

    await announcement.addReaction(userId, reactionType);

    return { success: true };
  } catch (error) {
    console.error("Failed to add announcement reaction:", error);
    return { success: false, error: "Failed to add reaction" };
  }
}

export async function removeAnnouncementReaction(
  announcementId: string,
  userId: string,
) {
  try {
    const announcement = await Announcement.findById(announcementId);
    if (!announcement) {
      return { success: false, error: "Announcement not found" };
    }

    await announcement.removeReaction(userId);

    return { success: true };
  } catch (error) {
    console.error("Failed to remove announcement reaction:", error);
    return { success: false, error: "Failed to remove reaction" };
  }
}

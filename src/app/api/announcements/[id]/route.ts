/**
 * PropertyPro - Announcement Detail API
 * Provides detailed announcement data, view tracking, and reactions
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Announcement } from "@/models";
import {
  AuthenticatedAccessUser,
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  isValidObjectId,
  parseRequestBody,
  withPermissionAndDB,
} from "@/lib/api-utils";
import {
  addAnnouncementReaction,
  markAnnouncementAsViewed,
  removeAnnouncementReaction,
} from "../route";
import {
  buildAnnouncementVisibilityFilter,
  mergeInboxFilters,
} from "@/lib/inbox-visibility";

const POPULATE_FIELDS = [
  { path: "createdBy", select: "firstName lastName email" },
  { path: "targetAudience.propertyIds", select: "name address" },
];

function extractClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim();
  }
  return request.headers.get("x-real-ip") ?? undefined;
}

async function loadAnnouncement(
  id: string,
  user: AuthenticatedAccessUser,
  tenantProfile?: any
) {
  const visibilityFilter = await buildAnnouncementVisibilityFilter(
    user,
    tenantProfile,
    { activeOnly: !user.isCompanyStaff }
  );
  const document = await Announcement.findOne(
    mergeInboxFilters({ _id: id }, visibilityFilter)
  ).populate(POPULATE_FIELDS);

  if (!document) {
    return null;
  }

  const announcementObject = document.toObject({ virtuals: true });
  const userReaction = document.reactions.find(
    (reaction: any) => reaction?.userId?.toString() === user.id
  )?.type;
  const userHasViewed = document.views.some(
    (view: any) => view?.userId?.toString() === user.id
  );

  return {
    ...announcementObject,
    id: document._id.toString(),
    userReaction: userReaction ?? null,
    userHasViewed,
  };
}

export const GET = withPermissionAndDB("profile_management")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    {
      params,
      tenantProfile,
    }: { params: Promise<{ id: string }>; tenantProfile?: any }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid announcement ID", 400);
      }

      const url = new URL(request.url);
      const trackView = url.searchParams.get("trackView") !== "false";

      let announcement = await loadAnnouncement(id, user, tenantProfile);
      if (!announcement) {
        return createErrorResponse("Announcement not found", 404);
      }

      if (trackView) {
        const ipAddress = extractClientIp(request);
        await markAnnouncementAsViewed(id, user.id, ipAddress);
        announcement = await loadAnnouncement(id, user, tenantProfile);
      }

      return createSuccessResponse(
        { announcement },
        "Announcement retrieved successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

export const POST = withPermissionAndDB("profile_management")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    {
      params,
      tenantProfile,
    }: { params: Promise<{ id: string }>; tenantProfile?: any }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid announcement ID", 400);
      }

      const { success, data, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error ?? "Invalid request body", 400);
      }

      const action = data?.action ?? "reaction";
      const visibleAnnouncement = await loadAnnouncement(
        id,
        user,
        tenantProfile
      );
      if (!visibleAnnouncement) {
        return createErrorResponse("Announcement not found", 404);
      }

      switch (action) {
        case "reaction": {
          const reactionType = data?.reactionType;
          if (
            !["like", "love", "helpful", "important"].includes(reactionType)
          ) {
            return createErrorResponse("Invalid reaction type", 400);
          }

          const result = await addAnnouncementReaction(
            id,
            user.id,
            reactionType
          );
          if (!result.success) {
            return createErrorResponse(
              result.error || "Failed to record reaction",
              400
            );
          }
          break;
        }
        case "markViewed": {
          const ipAddress = extractClientIp(request);
          const result = await markAnnouncementAsViewed(id, user.id, ipAddress);
          if (!result.success) {
            return createErrorResponse(
              result.error || "Failed to update view",
              400
            );
          }
          break;
        }
        default:
          return createErrorResponse("Unsupported action", 400);
      }

      const announcement = await loadAnnouncement(id, user, tenantProfile);
      if (!announcement) {
        return createErrorResponse("Announcement not found", 404);
      }

      return createSuccessResponse(
        { announcement },
        action === "reaction"
          ? "Reaction updated successfully"
          : "Announcement marked as viewed"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

export const PUT = withPermissionAndDB("company_settings")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid announcement ID", 400);
      }

      const { success, data, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error ?? "Invalid request body", 400);
      }

      const action = data?.action ?? "update";

      const doc = await Announcement.findById(id);
      if (!doc) {
        return createErrorResponse("Announcement not found", 404);
      }

      switch (action) {
        case "update": {
          if (data.title) doc.title = data.title;
          if (data.content) doc.content = data.content;
          if (data.priority) doc.priority = data.priority;
          if (data.type) doc.type = data.type;
          if (data.targetAudience) doc.targetAudience = data.targetAudience;
          if (data.scheduledFor !== undefined)
            doc.scheduledFor = data.scheduledFor
              ? new Date(data.scheduledFor)
              : undefined;
          if (data.expiresAt !== undefined)
            doc.expiresAt = data.expiresAt
              ? new Date(data.expiresAt)
              : undefined;
          if (typeof data.isSticky === "boolean") doc.isSticky = data.isSticky;
          if (typeof data.allowComments === "boolean")
            doc.allowComments = data.allowComments;
          doc.updatedBy = user.id;
          await doc.save();
          break;
        }
        case "archive": {
          doc.status = "archived";
          doc.updatedBy = user.id;
          await doc.save();
          break;
        }
        case "publish": {
          doc.status = "published";
          doc.publishedAt = new Date();
          doc.updatedBy = user.id;
          await doc.save();
          break;
        }
        case "softDelete": {
          doc.deletedAt = new Date();
          doc.updatedBy = user.id;
          await doc.save();
          break;
        }
        default:
          return createErrorResponse("Unsupported action", 400);
      }

      const announcement = await loadAnnouncement(id, user);

      return createSuccessResponse(
        { announcement },
        `Announcement ${action === "softDelete" ? "deleted" : action === "archive" ? "archived" : "updated"} successfully`
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

export const DELETE = withPermissionAndDB("profile_management")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    {
      params,
      tenantProfile,
    }: { params: Promise<{ id: string }>; tenantProfile?: any }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid announcement ID", 400);
      }

      const url = new URL(request.url);
      const action = url.searchParams.get("action") ?? "reaction";
      const visibleAnnouncement = await loadAnnouncement(
        id,
        user,
        tenantProfile
      );
      if (!visibleAnnouncement) {
        return createErrorResponse("Announcement not found", 404);
      }

      switch (action) {
        case "reaction": {
          const result = await removeAnnouncementReaction(id, user.id);
          if (!result.success) {
            return createErrorResponse(
              result.error || "Failed to remove reaction",
              400
            );
          }
          break;
        }
        default:
          return createErrorResponse("Unsupported action", 400);
      }

      const announcement = await loadAnnouncement(id, user, tenantProfile);
      if (!announcement) {
        return createErrorResponse("Announcement not found", 404);
      }

      return createSuccessResponse(
        { announcement },
        "Reaction removed successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

import { NextRequest } from "next/server";
import { Types } from "mongoose";
import {
  withPermissionAndDB,
  createErrorResponse,
  createSuccessResponse,
} from "@/lib/api-utils";
import { User } from "@/models";
import { resolveAccessProfile } from "@/lib/server-permissions";
import { getAllowedMessagingUserIds } from "@/lib/messaging-access";

const ALLOWED_ROLES = ["admin", "super_admin", "manager", "tenant"];

export const GET = withPermissionAndDB("profile_management")(
  async (user, request: NextRequest) => {
    try {
      const access = await resolveAccessProfile(user.role);
      const params = new URL(request.url).searchParams;
      const search = params.get("search")?.trim() ?? "";
      const limit = Math.min(
        Math.max(Number.parseInt(params.get("limit") ?? "50", 10) || 50, 1),
        200
      );

      const currentUserId = String(user.id);
      const allowedIds = (await getAllowedMessagingUserIds({
        ...access,
        id: currentUserId,
      })).filter((id) => id !== currentUserId && Types.ObjectId.isValid(id));

      const filter: Record<string, any> = {
        _id: { $in: allowedIds.map((id) => new Types.ObjectId(id)) },
        role: { $in: ALLOWED_ROLES },
        isActive: true,
        deletedAt: null,
      };

      if (search) {
        filter.$or = [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ];
      }

      const users = await User.find(filter)
        .select("firstName lastName email phone role avatar isActive")
        .sort({ role: 1, firstName: 1, lastName: 1 })
        .limit(limit)
        .lean();

      const formatted = users.map((entry: any) => ({
        id: String(entry._id),
        firstName: entry.firstName,
        lastName: entry.lastName,
        email: entry.email,
        phone: entry.phone ?? null,
        role: entry.role,
        avatar: entry.avatar ?? null,
        isActive: entry.isActive,
      }));

      return createSuccessResponse({ users: formatted, total: formatted.length });
    } catch (error) {
      console.error("Messaging contacts error:", error);
      return createErrorResponse(
        "Impossible de charger les contacts autorisés. Réessayez dans quelques instants.",
        500
      );
    }
  }
);

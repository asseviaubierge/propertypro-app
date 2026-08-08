import { NextRequest } from "next/server";
import { User } from "@/models";
import {
  AuthenticatedAccessUser,
  createErrorResponse,
  createSuccessResponse,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { resolveAccessProfile } from "@/lib/server-permissions";

const MAINTENANCE_ROLE_NAMES = new Set([
  "maintenance_staff",
  "maintenance staff",
  "technician",
  "technicien",
]);

/**
 * GET /api/maintenance/staff
 *
 * Dedicated endpoint used by the maintenance request form.
 * It deliberately avoids the broader /api/users authorization rules.
 */
export const GET = withPermissionAndDB("maintenance_view")(
  async (_user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const activeOnly = searchParams.get("isActive") !== "false";

      const candidates = await User.find({
        deletedAt: null,
        ...(activeOnly ? { isActive: true } : {}),
      })
        .select("_id firstName lastName email phone role isActive avatar")
        .sort({ firstName: 1, lastName: 1 })
        .lean();

      const staff = [];

      for (const candidate of candidates) {
        const normalizedRole = String(candidate.role || "")
          .trim()
          .toLowerCase();
        const access = await resolveAccessProfile(candidate.role || "tenant");

        // Explicit technician aliases are preferred. Custom company roles are
        // also accepted when their permissions include maintenance management.
        const isMaintenanceStaff =
          MAINTENANCE_ROLE_NAMES.has(normalizedRole) ||
          (access.isCompanyStaff &&
            (access.permissions.includes("maintenance_management") ||
              access.permissions.includes("maintenance_update")));

        if (!isMaintenanceStaff) {
          continue;
        }

        staff.push({
          _id: String(candidate._id),
          firstName: candidate.firstName || "",
          lastName: candidate.lastName || "",
          email: candidate.email || "",
          phone: candidate.phone || "",
          role: candidate.role || "",
          isActive: candidate.isActive !== false,
          avatar: candidate.avatar || null,
        });
      }

      return createSuccessResponse({ staff });
    } catch (error) {
      console.error("GET /api/maintenance/staff error:", error);
      return createErrorResponse(
        "Impossible de charger les techniciens de maintenance",
        500
      );
    }
  }
);

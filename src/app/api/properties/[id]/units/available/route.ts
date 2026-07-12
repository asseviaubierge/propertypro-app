/**
 * PropertyPro - Available Units API Route
 * Get available units for a specific property
 */

import { NextRequest } from "next/server";
import { Property } from "@/models";
import { UserRole } from "@/types";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
  isValidObjectId,
} from "@/lib/api-utils";

// ============================================================================
// GET /api/properties/[id]/units/available - Get available units for property
// ============================================================================

export const GET = withPermissionAndDB("property_view")(
  async (
    user,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid property ID", 400);
      }

      // Find the property
      const property = await Property.findById(id);
      if (!property) {
        return createErrorResponse("Property not found", 404);
      }

      // Filter available units - handle both lowercase and uppercase status values
      const availableUnits = property.units.filter(
        (unit: any) => unit.status?.toLowerCase() === "available"
      );

      return createSuccessResponse(
        availableUnits,
        "Available units retrieved successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

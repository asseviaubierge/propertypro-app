/**
 * PropertyPro - Migration: Cleanup Deprecated Property Fields
 * Removes bedrooms, bathrooms, squareFootage, rentAmount, securityDeposit
 * from property root level (these fields now exist only in units array)
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Property } from "@/models";
import {
  createSuccessResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";

// ============================================================================
// POST /api/admin/migrate/cleanup-property-fields - Remove deprecated fields
// ============================================================================

export const POST = withPermissionAndDB("system_settings")(
  async (user, request: NextRequest) => {
    try {
      // Fields to remove from property root level
      const fieldsToRemove = {
        bedrooms: "",
        bathrooms: "",
        squareFootage: "",
        rentAmount: "",
        securityDeposit: "",
      };

      // Use $unset to remove these fields from all property documents
      const result = await Property.collection.updateMany(
        {}, // Match all documents
        {
          $unset: fieldsToRemove,
        }
      );

      return createSuccessResponse(
        {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          fieldsRemoved: Object.keys(fieldsToRemove),
        },
        `Successfully cleaned up ${result.modifiedCount} properties. Removed deprecated fields from property root level.`
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// GET /api/admin/migrate/cleanup-property-fields - Preview affected documents
// ============================================================================

export const GET = withPermissionAndDB("system_settings")(
  async (user, request: NextRequest) => {
    try {
      // Count documents that have any of the deprecated fields
      const deprecatedFieldsQuery = {
        $or: [
          { bedrooms: { $exists: true } },
          { bathrooms: { $exists: true } },
          { squareFootage: { $exists: true } },
          { rentAmount: { $exists: true } },
          { securityDeposit: { $exists: true } },
        ],
      };

      const affectedCount = await Property.collection.countDocuments(
        deprecatedFieldsQuery
      );

      // Get sample of affected documents
      const sampleDocuments = await Property.collection
        .find(deprecatedFieldsQuery)
        .project({
          _id: 1,
          name: 1,
          bedrooms: 1,
          bathrooms: 1,
          squareFootage: 1,
          rentAmount: 1,
          securityDeposit: 1,
        })
        .limit(5)
        .toArray();

      return createSuccessResponse(
        {
          affectedCount,
          sampleDocuments,
          message:
            affectedCount > 0
              ? `Found ${affectedCount} properties with deprecated fields at root level. Use POST to clean them up.`
              : "No properties with deprecated fields found. Database is already clean.",
        },
        "Migration preview completed"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

/**
 * PropertyPro - Tenant Documents API
 * API endpoints for tenant document management
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Document } from "@/models";
import { UserRole } from "@/types";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
  parsePaginationParams,
} from "@/lib/api-utils";

// ============================================================================
// GET /api/tenant/documents - Get tenant's documents
// ============================================================================

export const GET = withPermissionAndDB("document_access")(
  async (user, request: NextRequest, context?: { tenantProfile?: any }) => {
    try {
      const { searchParams } = new URL(request.url);

      // Parse pagination parameters
      const { page, limit } = parsePaginationParams(searchParams);

      // Get filters
      const type = searchParams.get("type");
      const status = searchParams.get("status");
      const category = searchParams.get("category");
      const search = searchParams.get("search");

      const tenant = context?.tenantProfile;
      if (!tenant) {
        return createErrorResponse("Tenant profile unavailable", 500);
      }

      // Build query
      let query: any = {
        $or: [
          { uploadedBy: user.id },
          { tenantId: tenant._id },
          { sharedWith: user.id },
        ],
      };

      if (type && type !== "all") {
        query.type = type;
      }

      if (status && status !== "all") {
        query.status = status;
      }

      if (category && category !== "all") {
        query.category = category;
      }

      if (search) {
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { name: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
            { tags: { $in: [new RegExp(search, "i")] } },
          ],
        });
      }

      // Get documents with pagination
      const documents = await Document.find(query)
        .populate("uploadedBy", "firstName lastName")
        .sort({ uploadedAt: -1, createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit);

      const totalDocuments = await Document.countDocuments(query);
      const totalPages = Math.ceil(totalDocuments / limit);

      return createSuccessResponse({
        documents,
        pagination: {
          page,
          limit,
          total: totalDocuments,
          pages: totalPages,
        },
      });
    } catch (error) {
      return handleApiError(error, "Failed to fetch documents");
    }
  }
);

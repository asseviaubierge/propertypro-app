/**
 * PropertyPro - Lease Documents API
 * API endpoint for managing lease documents
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Document, Lease } from "@/models";
import { UserRole } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withAccessAndDB,
  withPermissionAndDB,
  isValidObjectId,
} from "@/lib/api-utils";
import {
  LEASE_DOCUMENT_READ_ACCESS,
  canManageLeaseDocuments,
  isLeaseTenantUser,
} from "@/lib/lease-access";

// ============================================================================
// GET /api/leases/[id]/documents - Get all documents for a lease
// ============================================================================

export const GET = withAccessAndDB(LEASE_DOCUMENT_READ_ACCESS)(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid lease ID", 400);
      }

      // Find the lease
      const lease = await Lease.findById(id);
      if (!lease) {
        return createErrorResponse("Bail introuvable", 404);
      }

      // Check permissions - tenants can only access their own lease documents
      if (user.isTenant && !isLeaseTenantUser(user, lease)) {
        return createErrorResponse("Access denied", 403);
      }

      // Get query parameters
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const type = url.searchParams.get("type");
      const category = url.searchParams.get("category");
      const search = url.searchParams.get("search");

      // Build query
      const query: any = {
        leaseId: lease._id,
        deletedAt: null,
      };

      if (type) {
        query.type = type;
      }

      if (category) {
        query.category = category;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { tags: { $in: [new RegExp(search, "i")] } },
        ];
      }

      // Get total count
      const total = await Document.countDocuments(query);

      // Get documents with pagination
      const documents = await Document.find(query)
        .populate("uploadedBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      // Calculate pagination info
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return createSuccessResponse({
        documents,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
        lease: {
          id: lease._id,
          documentsCount: total,
        },
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// POST /api/leases/[id]/documents - Add document URL to lease
// ============================================================================

export const POST = withPermissionAndDB([
  "document_management",
  "lease_edit",
  "lease_management",
])(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid lease ID", 400);
      }

      const body = await request.json();
      const {
        documentUrl,
        name,
        description,
        type = "lease",
        category = "lease",
      } = body;

      if (!documentUrl) {
        return createErrorResponse("Document URL is required", 400);
      }

      // Find the lease
      const lease = await Lease.findById(id);
      if (!lease) {
        return createErrorResponse("Bail introuvable", 404);
      }

      if (!canManageLeaseDocuments(user)) {
        return createErrorResponse("Insufficient permissions", 403);
      }

      // Check if document URL already exists
      if (lease.documents.includes(documentUrl)) {
        return createErrorResponse("Document URL already exists", 400);
      }

      // Add document URL to lease
      lease.documents.push(documentUrl);
      await lease.save();

      // Create document record if additional info provided
      let document = null;
      if (name || description) {
        document = new Document({
          name: name || "Lease Document",
          description: description || "Document for lease",
          type,
          category,
          fileUrl: documentUrl,
          fileSize: 0, // Unknown for external URLs
          mimeType: "application/octet-stream", // Unknown for external URLs
          uploadedBy: user.id,
          leaseId: lease._id,
          propertyId: lease.propertyId,
          tenantId: lease.tenantId,
          status: "active",
          isRequired: false,
        });

        await document.save();
        await document.populate("uploadedBy", "firstName lastName");
      }

      return createSuccessResponse({
        message: "Document added successfully",
        documentUrl,
        document,
        lease: {
          id: lease._id,
          documents: lease.documents,
        },
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
);

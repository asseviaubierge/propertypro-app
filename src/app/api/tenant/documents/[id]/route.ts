/**
 * PropertyPro - Individual Document API Routes
 * Operations for individual documents
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
  parseRequestBody,
  isValidObjectId,
} from "@/lib/api-utils";
import { deleteFromR2 } from "@/lib/r2-server";

// ============================================================================
// GET /api/tenant/documents/[id] - Get a specific document
// ============================================================================

export const GET = withPermissionAndDB("document_access")(
  async (
    user,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
    context?: { tenantProfile?: any }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid document ID", 400);
      }

      const tenant = context?.tenantProfile;
      if (!tenant) {
        return createErrorResponse("Tenant profile unavailable", 500);
      }

      // Find the document
      const document = await Document.findById(id)
        .populate("uploadedBy", "firstName lastName email")
        .populate("tenantId", "userId");

      if (!document) {
        return createErrorResponse("Document not found", 404);
      }

      // Check permissions - user must be the uploader, tenant, or have shared access
      const canAccess =
        document.uploadedBy._id.toString() === user.id ||
        document.tenantId?._id.toString() === tenant._id.toString() ||
        document.sharedWith?.includes(user.id);

      if (!canAccess) {
        return createErrorResponse("Access denied", 403);
      }

      return createSuccessResponse({ document });
    } catch (error) {
      return handleApiError(error, "Failed to fetch document");
    }
  }
);

// ============================================================================
// PUT /api/tenant/documents/[id] - Update document metadata
// ============================================================================

export const PUT = withPermissionAndDB("document_access")(
  async (
    user,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
    context?: { tenantProfile?: any }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid document ID", 400);
      }

      const { success, data: body } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse("Invalid request body", 400);
      }

      const { name, description, type, category, tags } = body;

      const tenant = context?.tenantProfile;
      if (!tenant) {
        return createErrorResponse("Tenant profile unavailable", 500);
      }

      // Find the document
      const document = await Document.findById(id);
      if (!document) {
        return createErrorResponse("Document not found", 404);
      }

      // Check permissions - only uploader can update
      if (document.uploadedBy.toString() !== user.id) {
        return createErrorResponse(
          "Only the uploader can update this document",
          403
        );
      }

      // Update document metadata
      if (name) document.name = name;
      if (description !== undefined) document.description = description;
      if (type) document.type = type;
      if (category) document.category = category;
      if (tags) {
        document.tags = Array.isArray(tags)
          ? tags
          : tags
              .split(",")
              .map((tag: string) => tag.trim())
              .filter((tag: string) => tag.length > 0);
      }

      await document.save();

      // Populate and return updated document
      await document.populate("uploadedBy", "firstName lastName email");

      return createSuccessResponse(
        { document },
        "Document updated successfully"
      );
    } catch (error) {
      return handleApiError(error, "Failed to update document");
    }
  }
);

// ============================================================================
// DELETE /api/tenant/documents/[id] - Delete a document
// ============================================================================

export const DELETE = withPermissionAndDB("document_access")(
  async (
    user,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
    context?: { tenantProfile?: any }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid document ID", 400);
      }

      const tenant = context?.tenantProfile;
      if (!tenant) {
        return createErrorResponse("Tenant profile unavailable", 500);
      }

      // Find the document
      const document = await Document.findById(id);
      if (!document) {
        return createErrorResponse("Document not found", 404);
      }

      // Check permissions - only uploader can delete
      if (document.uploadedBy.toString() !== user.id) {
        return createErrorResponse(
          "Only the uploader can delete this document",
          403
        );
      }

      // Delete from R2 if it exists
      let warningMessage: string | null = null;
      if (document.r2ObjectKey) {
        try {
          const deleted = await deleteFromR2(document.r2ObjectKey);
          if (!deleted) {
            warningMessage = "Failed to delete file from R2 storage";
          }
        } catch (r2Error) {
          warningMessage =
            r2Error instanceof Error
              ? r2Error.message
              : "Remote asset deletion failed";
          // Continue with database deletion even if R2 fails
        }
      }

      // Soft delete the document
      document.deletedAt = new Date();
      await document.save();

      const response = createSuccessResponse(
        null,
        warningMessage
          ? "Document deleted successfully with remote cleanup warning"
          : "Document deleted successfully"
      );
      if (warningMessage) {
        response.headers.set("x-propertypro-warning", warningMessage);
      }
      return response;
    } catch (error) {
      return handleApiError(error, "Failed to delete document");
    }
  }
);

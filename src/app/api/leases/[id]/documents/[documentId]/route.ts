/**
 * PropertyPro - Lease Document Management API
 * API endpoint for managing individual lease documents
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
import { deleteFromR2 } from "@/lib/r2-server";
import {
  LEASE_DOCUMENT_READ_ACCESS,
  canManageLeaseDocuments,
  isLeaseTenantUser,
} from "@/lib/lease-access";

// ============================================================================
// DELETE /api/leases/[id]/documents/[documentId] - Delete a lease document
// ============================================================================

export const DELETE = withPermissionAndDB([
  "document_management",
  "lease_edit",
  "lease_management",
])(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string; documentId: string }> }
  ) => {
    try {
      const { id, documentId } = await params;

      if (!isValidObjectId(id) || !isValidObjectId(documentId)) {
        return createErrorResponse("Invalid lease ID or document ID", 400);
      }

      // Find the lease
      const lease = await Lease.findById(id);
      if (!lease) {
        return createErrorResponse("Bail introuvable", 404);
      }

      if (!canManageLeaseDocuments(user)) {
        return createErrorResponse("Insufficient permissions", 403);
      }

      // Find the document
      const document = await Document.findById(documentId);
      if (!document) {
        return createErrorResponse("Document not found", 404);
      }

      // Verify document belongs to this lease
      if (document.leaseId?.toString() !== lease._id.toString()) {
        return createErrorResponse(
          "Document does not belong to this lease",
          400
        );
      }

      // Delete from R2 if it has an object key
      if (document.r2ObjectKey) {
        try {
          await deleteFromR2(document.r2ObjectKey);
        } catch (r2Error) {
          // Continue with database deletion even if R2 fails
          console.error("Failed to delete from R2:", r2Error);
        }
      }

      // Remove document URL from lease documents array
      lease.documents = lease.documents.filter(
        (url) => url !== document.fileUrl
      );
      await lease.save();

      // Soft delete the document
      document.deletedAt = new Date();
      await document.save();

      return createSuccessResponse({
        message: "Document deleted successfully",
        documentId: document._id,
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

// ============================================================================
// GET /api/leases/[id]/documents/[documentId] - Get a specific lease document
// ============================================================================

export const GET = withAccessAndDB(LEASE_DOCUMENT_READ_ACCESS)(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string; documentId: string }> }
  ) => {
    try {
      const { id, documentId } = await params;

      if (!isValidObjectId(id) || !isValidObjectId(documentId)) {
        return createErrorResponse("Invalid lease ID or document ID", 400);
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

      // Find the document
      const document = await Document.findById(documentId)
        .populate("uploadedBy", "firstName lastName")
        .populate("leaseId", "startDate endDate")
        .populate("propertyId", "name address")
        .populate("tenantId", "userId");

      if (!document) {
        return createErrorResponse("Document not found", 404);
      }

      // Verify document belongs to this lease
      if (document.leaseId?._id.toString() !== lease._id.toString()) {
        return createErrorResponse(
          "Document does not belong to this lease",
          400
        );
      }

      // Update download count and last downloaded date
      document.downloadCount += 1;
      document.lastDownloadedAt = new Date();
      await document.save();

      return createSuccessResponse({
        document,
        lease: {
          id: lease._id,
          startDate: lease.startDate,
          endDate: lease.endDate,
        },
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
);

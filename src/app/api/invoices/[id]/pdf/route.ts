/**
 * PropertyPro - Secure professional invoice PDF download
 */

import { NextRequest, NextResponse } from "next/server";
import { Invoice, User } from "@/models";
import { UserRole } from "@/types";
import {
  AuthenticatedAccessUser,
  createErrorResponse,
  handleApiError,
  isValidObjectId,
  withAccessAndDB,
} from "@/lib/api-utils";
import { canAccessInvoice } from "@/lib/invoice-access";
import { generateInvoicePdfBuffer } from "@/lib/services/invoice-pdf.service";

const INVOICE_PDF_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: ["financial_management", "financial_reports"],
  match: "any" as const,
};

function safeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

export const GET = withAccessAndDB(INVOICE_PDF_ACCESS)(
  async (
    user: AuthenticatedAccessUser,
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid invoice ID", 400);
      }

      const invoice = await Invoice.findOne({
        _id: id,
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      })
        .populate("tenantId", "firstName lastName email phone address city")
        .populate({
          path: "propertyId",
          select: "name address type unit ownerId managerId",
          populate: {
            path: "ownerId",
            select:
              "firstName lastName email phone address city website businessName businessLogo accountType cip ifu rccm",
          },
        })
        .populate("leaseId", "startDate endDate status propertyId")
        .lean();

      if (!invoice) return createErrorResponse("Invoice not found", 404);

      const issuerId = (invoice as any)?.metadata?.createdByUserId;
      const managerId = (invoice as any)?.propertyId?.managerId;
      const issuer = issuerId
        ? await User.findById(issuerId)
            .select("firstName lastName email phone address city website businessName businessLogo accountType cip ifu rccm role")
            .lean()
        : managerId
          ? await User.findById(managerId)
              .select("firstName lastName email phone address city website businessName businessLogo accountType cip ifu rccm role")
              .lean()
          : null;
      (invoice as any).issuer = issuer;

      if (!(await canAccessInvoice(user, invoice))) {
        return createErrorResponse("Access denied", 403);
      }

      const pdfBuffer = await generateInvoicePdfBuffer(invoice as any);
      const invoiceNumber = safeFilename(
        String((invoice as any).invoiceNumber || id)
      );

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="facture-${invoiceNumber}.pdf"`,
          "Content-Length": String(pdfBuffer.length),
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
);

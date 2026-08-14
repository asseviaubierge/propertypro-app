/**
 * PropertyPro - Secure professional invoice PDF download
 */

import { NextRequest, NextResponse } from "next/server";
import { Invoice } from "@/models";
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
import { resolveInvoiceIssuer } from "@/lib/invoice/issuer-resolver";

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
        return createErrorResponse("Identifiant de facture invalide", 400);
      }

      const invoice = await Invoice.findOne({
        _id: id,
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      })
        .populate("tenantId", "firstName lastName email phone address city")
        .populate({
          path: "propertyId",
          select: "name address type unit ownerId managerId units",
          populate: {
            path: "ownerId",
            select:
              "firstName lastName email phone address city website businessName businessLogo accountType cip ifu rccm",
          },
        })
        .populate("leaseId", "startDate endDate status propertyId unitId terms")
        .lean();

      if (!invoice) return createErrorResponse("Facture introuvable", 404);

      const issuer = await resolveInvoiceIssuer(invoice, user);
      (invoice as any).issuer = issuer;

      const property = (invoice as any)?.propertyId;
      const unitId = (invoice as any)?.unitId || (invoice as any)?.leaseId?.unitId;
      const units = Array.isArray(property?.units) ? property.units : [];
      (invoice as any).unit = unitId
        ? units.find((candidate: any) => String(candidate?._id) === String(unitId)) || null
        : null;

      if (!(await canAccessInvoice(user, invoice))) {
        return createErrorResponse("Accès refusé", 403);
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

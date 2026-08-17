import { NextRequest } from "next/server";
import { Payment, Tenant } from "@/models";
import { PaymentStatus, UserRole } from "@/types";
import {
  AuthenticatedAccessUser,
  createErrorResponse,
  isValidObjectId,
  withAccessAndDB,
} from "@/lib/api-utils";
import { canAccessProperty } from "@/lib/property-scope";
import { generateReceiptPdfBuffer } from "@/lib/services/receipt-pdf.service";

const RECEIPT_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: ["payment_processing", "financial_management", "financial_reports"],
  match: "any" as const,
};

function referenceId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "_id" in value) {
    return referenceId((value as { _id?: unknown })._id);
  }
  return String(value);
}

export const GET = withAccessAndDB(RECEIPT_ACCESS)(
  async (
    user: AuthenticatedAccessUser,
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return createErrorResponse("Identifiant de paiement invalide", 400);
    }

    const payment = await Payment.findById(id)
      .populate({
        path: "propertyId",
        select: "name address ownerId managerId",
        populate: {
          path: "ownerId",
          select: "firstName lastName email phone accountType businessName businessLogo cip ifu rccm",
        },
      })
      .populate("tenantId", "firstName lastName email phone")
      .populate("leaseId", "startDate endDate status")
      .lean();

    if (!payment) return createErrorResponse("Paiement introuvable", 404);
    if (payment.status !== PaymentStatus.PAID) {
      return createErrorResponse(
        "Le reçu est disponible uniquement pour un paiement encaissé",
        400
      );
    }

    if (!user.isAdmin) {
      if (user.isTenant) {
        const profile = await Tenant.findOne({ userId: user.id, deletedAt: null })
          .select("_id")
          .lean();
        const allowedTenantIds = new Set(
          [String(user.id), profile?._id ? String(profile._id) : ""].filter(Boolean)
        );
        if (!allowedTenantIds.has(referenceId(payment.tenantId))) {
          return createErrorResponse("Accès refusé à ce reçu", 403);
        }
      } else {
        const propertyId = referenceId(payment.propertyId);
        if (!propertyId || !(await canAccessProperty(user, propertyId))) {
          return createErrorResponse("Accès refusé à ce reçu", 403);
        }
      }
    }

    const pdfBuffer = await generateReceiptPdfBuffer(payment as any);
    const receiptNumber = String(payment._id).slice(-8).toUpperCase();

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="recu-${receiptNumber}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
);

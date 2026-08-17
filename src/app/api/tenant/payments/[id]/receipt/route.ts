/**
 * PropertyPro - Payment Receipt API
 * API endpoint for generating and downloading payment receipts
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Payment } from "@/models";
import { UserRole, PaymentStatus } from "@/types";
import {
  createErrorResponse,
  withPermissionAndDB,
  isValidObjectId,
} from "@/lib/api-utils";
import { generateReceiptPdfBuffer } from "@/lib/services/receipt-pdf.service";

// ============================================================================
// GET /api/tenant/payments/[id]/receipt - Download payment receipt
// ============================================================================

export const GET = withPermissionAndDB("payment_portal")(
  async (
    user: any,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Identifiant de paiement invalide", 400);
      }

      // Find the payment and verify it belongs to this tenant
      const payment = await Payment.findOne({
        _id: id,
        tenantId: user.id,
      })
        .populate({
  path: "propertyId",
  select: "name address ownerId",
  populate: {
    path: "ownerId",
    select:
      "firstName lastName email phone accountType businessName businessLogo cip ifu rccm",
  },
})
        .populate({
          path: "tenantId",
          select: "firstName lastName email",
        });

      if (!payment) {
        return createErrorResponse("Paiement introuvable", 404);
      }

      // Only allow receipt download for completed payments
      if (payment.status !== PaymentStatus.PAID) {
        return createErrorResponse(
          "Le reçu est disponible uniquement pour un paiement encaissé",
          400
        );
      }

      // Generate PDF receipt using shared service
      const pdfBuffer = await generateReceiptPdfBuffer(payment as any);

      // Return the PDF as a blob
      return new Response(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="receipt-${id}.pdf"`,
        },
      });
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : "Impossible de générer le reçu",
        500
      );
    }
  }
);

import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { Invoice } from "@/models";
import { InvoiceStatus } from "@/types";
import { canAccessInvoice } from "@/lib/invoice-access";
import {
  AuthenticatedAccessUser,
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";

const ALLOWED_OPERATIONS = new Set([
  "mark_paid",
  "update_status",
  "add_late_fees",
  "send_reminders",
  "generate_pdfs",
  "delete",
]);

export const POST = withPermissionAndDB("financial_management")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const body = await request.json();
      const operation = String(body?.operation || "");
      const invoiceIds = Array.isArray(body?.invoiceIds)
        ? [...new Set(body.invoiceIds.map(String))]
        : [];
      if (!ALLOWED_OPERATIONS.has(operation)) {
        return createErrorResponse("Opération groupée invalide", 400);
      }
      if (!invoiceIds.length || invoiceIds.some((id) => !Types.ObjectId.isValid(id))) {
        return createErrorResponse("Sélection de factures invalide", 400);
      }

      const invoices: any[] = await Invoice.find({
        _id: { $in: invoiceIds },
        deletedAt: null,
      });
      const accessible: any[] = [];
      for (const invoice of invoices) {
        if (await canAccessInvoice(user, invoice)) accessible.push(invoice);
      }
      if (accessible.length !== invoiceIds.length) {
        return createErrorResponse("Certaines factures sont hors de votre périmètre", 403);
      }

      const results: any[] = [];
      for (const invoice of accessible) {
        if (operation === "mark_paid") {
          invoice.amountPaid = invoice.totalAmount;
          invoice.balanceRemaining = 0;
          invoice.status = InvoiceStatus.PAID;
          await invoice.save();
          results.push({ id: String(invoice._id), status: invoice.status });
        } else if (operation === "update_status") {
          const status = String(body?.data?.status || "");
          if (!Object.values(InvoiceStatus).includes(status as InvoiceStatus)) {
            return createErrorResponse("Statut de facture invalide", 400);
          }
          invoice.status = status;
          await invoice.save();
          results.push({ id: String(invoice._id), status });
        } else if (operation === "add_late_fees") {
          const amount = Number(body?.data?.amount || 0);
          if (!(amount > 0)) return createErrorResponse("Montant de pénalité invalide", 400);
          await invoice.addLateFee(amount);
          results.push({ id: String(invoice._id), lateFeeAmount: invoice.lateFeeAmount });
        } else if (operation === "delete") {
          invoice.deletedAt = new Date();
          invoice.status = InvoiceStatus.CANCELLED;
          await invoice.save();
          results.push({ id: String(invoice._id), deleted: true });
        } else if (operation === "generate_pdfs") {
          results.push({ id: String(invoice._id), url: `/api/invoices/${invoice._id}/pdf` });
        } else if (operation === "send_reminders") {
          // Le centre de notifications peut consommer cette liste pour l'envoi.
          results.push({ id: String(invoice._id), reminderQueued: true });
        }
      }

      return createSuccessResponse(
        { operation, processed: results.length, results },
        "Opération groupée terminée",
      );
    } catch (error) {
      return handleApiError(error, "Échec de l’opération groupée");
    }
  },
);

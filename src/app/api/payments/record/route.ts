import { NextRequest } from "next/server";
import { Types } from "mongoose";
import {
  AuthenticatedAccessUser,
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  withAccessAndDB,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { UserRole } from "@/types";
import { canAccessTenant } from "@/lib/tenant-scope";
import { paymentInvoiceLinkingService } from "@/lib/services/payment-invoice-linking.service";

const READ_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: ["payment_processing", "financial_management", "payment_history"],
  match: "any" as const,
};

export const GET = withAccessAndDB(READ_ACCESS)(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const params = new URL(request.url).searchParams;
      const tenantId = params.get("tenantId") || (user.isTenant ? String(user.id) : "");
      const leaseId = params.get("leaseId") || undefined;
      const amount = Number(params.get("amount") || 0);
      if (!tenantId || !Types.ObjectId.isValid(tenantId)) return createErrorResponse("Locataire invalide", 400);
      if (!(await canAccessTenant(user, tenantId))) return createErrorResponse("Accès refusé à ce locataire", 403);

      const currentAllocation = await paymentInvoiceLinkingService.getPaymentAllocation(tenantId, leaseId);
      let paymentPreview: any = null;
      if (amount > 0) {
        let remaining = amount;
        const applications = currentAllocation.invoices.map((invoice) => {
          const amountToApply = Math.min(remaining, invoice.balanceRemaining);
          remaining -= amountToApply;
          return {
            invoiceId: invoice.invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            dueDate: invoice.dueDate,
            currentBalance: invoice.balanceRemaining,
            amountToApply,
            newBalance: Math.max(0, invoice.balanceRemaining - amountToApply),
            willBePaid: invoice.balanceRemaining - amountToApply <= 0,
          };
        }).filter((item) => item.amountToApply > 0);
        paymentPreview = {
          paymentAmount: amount,
          totalApplied: amount - remaining,
          remainingAmount: remaining,
          applications,
        };
      }
      return createSuccessResponse({ currentAllocation, paymentPreview }, "Affectation du paiement calculée");
    } catch (error) {
      return handleApiError(error, "Impossible de calculer l’affectation du paiement");
    }
  },
);

export const POST = withPermissionAndDB(["payment_processing", "financial_management"])(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const body = await request.json();
      if (!body?.tenantId || !Types.ObjectId.isValid(String(body.tenantId))) return createErrorResponse("Locataire invalide", 400);
      if (!(await canAccessTenant(user, String(body.tenantId)))) return createErrorResponse("Accès refusé à ce locataire", 403);
      const amount = Number(body.amount || 0);
      if (!(amount > 0)) return createErrorResponse("Le montant doit être supérieur à zéro", 400);
      const result = await paymentInvoiceLinkingService.recordManualPayment({
        tenantId: String(body.tenantId),
        leaseId: body.leaseId ? String(body.leaseId) : undefined,
        amount,
        paymentMethod: String(body.paymentMethod || "other"),
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
        notes: body.notes ? String(body.notes) : undefined,
        specificInvoiceId: body.specificInvoiceId ? String(body.specificInvoiceId) : undefined,
      });
      if (!result.success) return createErrorResponse(result.errors.join(", ") || "Échec de l’enregistrement du paiement", 400);
      const currentAllocation = await paymentInvoiceLinkingService.getPaymentAllocation(String(body.tenantId), body.leaseId);
      return createSuccessResponse({
        paymentId: result.paymentId,
        invoiceApplications: result.applicationsApplied,
        tenantBalance: currentAllocation,
        remainingPaymentAmount: result.remainingPaymentAmount,
      }, "Paiement enregistré");
    } catch (error) {
      return handleApiError(error, "Impossible d’enregistrer le paiement");
    }
  },
);

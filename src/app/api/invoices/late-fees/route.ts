import { NextRequest } from "next/server";
import { Invoice } from "@/models";
import { InvoiceStatus } from "@/types";
import { getScopedPropertyIds } from "@/lib/property-scope";
import { automatedLateFeeService } from "@/lib/services/automated-late-fee.service";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";

export const POST = withPermissionAndDB("financial_management")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const body = await request.json().catch(() => ({}));
      const dryRun = Boolean(body?.dryRun);
      const propertyIds = await getScopedPropertyIds(user);
      const query: Record<string, any> = {
        deletedAt: null,
        dueDate: { $lt: new Date() },
        balanceRemaining: { $gt: 0 },
        status: { $in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] },
      };
      if (propertyIds !== null) query.propertyId = { $in: propertyIds };
      const invoices: any[] = await Invoice.find(query).lean();
      const applications: any[] = [];
      const errors: string[] = [];
      let totalFeeAmount = 0;
      for (const invoice of invoices) {
        try {
          const rules = invoice.leaseId
            ? await automatedLateFeeService.getLateFeeRulesForLease(String(invoice.leaseId))
            : [];
          if (!rules.length) continue;
          const application = await automatedLateFeeService.processInvoiceLateFee(invoice, rules, dryRun);
          if (application) {
            applications.push(application);
            totalFeeAmount += Number(application.lateFeeAmount || 0);
          }
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }
      return createSuccessResponse({
        totalProcessed: invoices.length,
        feesApplied: applications.length,
        totalFeeAmount,
        applications,
        errors,
        dryRun,
      }, dryRun ? "Simulation des pénalités terminée" : "Pénalités de retard traitées");
    } catch (error) {
      return handleApiError(error, "Impossible de traiter les pénalités de retard");
    }
  },
);

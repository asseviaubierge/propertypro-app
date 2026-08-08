import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { canAccessTenant } from "@/lib/tenant-scope";
import { tenantLedgerService } from "@/lib/services/tenant-ledger.service";
import { UserRole } from "@/types";
import { AuthenticatedAccessUser, createErrorResponse, createSuccessResponse, handleApiError, withAccessAndDB } from "@/lib/api-utils";

const ACCESS = { roles: [UserRole.TENANT], permissions: ["financial_management", "financial_reports", "payment_history"], match: "any" as const };

export const GET = withAccessAndDB(ACCESS)(async (user: AuthenticatedAccessUser, request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return createErrorResponse("Locataire invalide", 400);
    if (!(await canAccessTenant(user, id))) return createErrorResponse("Accès refusé", 403);
    const query = new URL(request.url).searchParams;
    const report = await tenantLedgerService.generateTenantLedger(id, {
      leaseId: query.get("leaseId") || undefined,
      startDate: query.get("startDate") ? new Date(query.get("startDate")!) : undefined,
      endDate: query.get("endDate") ? new Date(query.get("endDate")!) : undefined,
      page: Math.max(1, Number(query.get("page") || 1)),
      limit: Math.min(200, Math.max(1, Number(query.get("limit") || 100))),
    });
    return createSuccessResponse(report, "Grand livre du locataire récupéré", { ...report.pagination, totalPages: report.pagination.pages });
  } catch (error) { return handleApiError(error, "Impossible de charger le grand livre du locataire"); }
});

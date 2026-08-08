import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { Invoice, Lease } from "@/models";
import { canAccessLease, LEASE_MANAGE_ACCESS } from "@/lib/lease-access";
import {
  AuthenticatedAccessUser,
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  withAccessAndDB,
} from "@/lib/api-utils";

export const POST = withAccessAndDB(LEASE_MANAGE_ACCESS)(
  async (user: AuthenticatedAccessUser, request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      if (!Types.ObjectId.isValid(id)) return createErrorResponse("Bail invalide", 400);
      const lease: any = await Lease.findById(id);
      if (!lease) return createErrorResponse("Bail introuvable", 404);
      if (!(await canAccessLease(user, lease))) return createErrorResponse("Accès refusé", 403);
      const body = await request.json().catch(() => ({}));
      const count = Math.min(24, Math.max(1, Number(body?.count || 1)));
      const firstDueDate = body?.dueDate ? new Date(body.dueDate) : new Date();
      if (Number.isNaN(firstDueDate.getTime())) return createErrorResponse("Date d’échéance invalide", 400);
      const created: any[] = [];
      for (let index = 0; index < count; index += 1) {
        const dueDate = new Date(firstDueDate);
        dueDate.setMonth(dueDate.getMonth() + index);
        const exists = await Invoice.exists({ leaseId: lease._id, dueDate, deletedAt: null });
        if (exists) continue;
        const invoice = await (Invoice as any).createFromLease(lease._id, dueDate);
        created.push(invoice);
      }
      return createSuccessResponse({ invoices: created, created: created.length }, "Factures du bail générées");
    } catch (error) {
      return handleApiError(error, "Impossible de générer les factures du bail");
    }
  },
);

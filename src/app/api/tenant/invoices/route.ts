/**
 * PropertyPro - Tenant Invoices API
 * API endpoint for tenants to view their invoices
 */

import { NextRequest } from "next/server";
import { Invoice } from "@/models";
import { UserRole } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";

// GET /api/tenant/invoices - Get tenant's invoices
export const GET = withPermissionAndDB("payment_history", {
  roles: [UserRole.TENANT],
})(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "12");
      const status = searchParams.get("status");
      const sortBy = searchParams.get("sortBy") || "dueDate";
      const sortOrder = searchParams.get("sortOrder") || "desc";

      const query: any = {
        tenantId: user.id,
        deletedAt: null,
      };

      if (status && status !== "all") {
        query.status = status;
      }

      const skip = (page - 1) * limit;
      const sort: any = {};
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;

      const [invoices, total, summarySource] = await Promise.all([
        Invoice.find(query)
          .populate("propertyId", "name address")
          .populate("leaseId", "startDate endDate")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Invoice.countDocuments(query),
        Invoice.find(query)
          .select("status totalAmount amountPaid balanceRemaining")
          .lean(),
      ]);

      const pages = Math.ceil(total / limit);
      const hasNext = page < pages;
      const hasPrev = page > 1;

      const now = new Date();
      const enrichedInvoices = invoices.map((invoice) => {
        let daysOverdue = undefined;
        if (invoice.status === "overdue" && invoice.dueDate) {
          const diffTime = now.getTime() - new Date(invoice.dueDate).getTime();
          daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        return {
          ...invoice,
          daysOverdue,
        };
      });

      const summary = {
        total: total,
        totalAmount: summarySource.reduce(
          (sum, inv) => sum + (inv.totalAmount || 0),
          0
        ),
        amountPaid: summarySource.reduce(
          (sum, inv) => sum + (inv.amountPaid || 0),
          0
        ),
        balanceRemaining: summarySource.reduce(
          (sum, inv) => sum + (inv.balanceRemaining || 0),
          0
        ),
        byStatus: {
          scheduled: summarySource.filter((inv) => inv.status === "scheduled")
            .length,
          issued: summarySource.filter((inv) => inv.status === "issued").length,
          partial: summarySource.filter((inv) => inv.status === "partial").length,
          paid: summarySource.filter((inv) => inv.status === "paid").length,
          overdue: summarySource.filter((inv) => inv.status === "overdue").length,
          cancelled: summarySource.filter((inv) => inv.status === "cancelled")
            .length,
        },
      };

      return createSuccessResponse(
        {
          invoices: enrichedInvoices,
          pagination: {
            page,
            limit,
            total,
            pages,
            hasNext,
            hasPrev,
          },
          summary,
        },
        "Invoices retrieved successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

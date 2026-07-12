/**
 * PropertyPro - Tenant Payments API
 * API endpoints for tenant payment management
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Payment } from "@/models";
import { UserRole, PaymentStatus } from "@/types";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
  parsePaginationParams,
} from "@/lib/api-utils";
import { tenantPaymentFilterSchema, validateSchema } from "@/lib/validations";
import { Types } from "mongoose";

// ============================================================================
// GET /api/tenant/payments - Get tenant's payments
// ============================================================================

export const GET = withPermissionAndDB("payment_portal")(
  async (user, request: NextRequest, context?: { tenantProfile?: any }) => {
    try {
      const { searchParams } = new URL(request.url);

      // Parse pagination parameters
      const { page, limit } = parsePaginationParams(searchParams);

      // Get filters
      const status = searchParams.get("status");
      const type = searchParams.get("type");
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");

      const tenant = context?.tenantProfile;
      if (!tenant) {
        return createErrorResponse("Tenant profile unavailable", 500);
      }

      // Build query
      const possibleTenantIds = [tenant._id];
      if (Types.ObjectId.isValid(user.id)) {
        possibleTenantIds.push(new Types.ObjectId(user.id));
      }

      let query: any = { tenantId: { $in: possibleTenantIds } };

      if (status && status !== "all") {
        // Handle multiple statuses separated by comma
        const statusArray = status.split(",").map((s) => s.trim());
        if (statusArray.length > 1) {
          query.status = { $in: statusArray };
        } else {
          query.status = status;
        }
      }

      if (type && type !== "all") {
        query.type = type;
      }

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      // Get payments with pagination and populate related data
      const payments = await Payment.find(query)
        .populate({
          path: "propertyId",
          select: "name address type",
        })
        .populate({
          path: "leaseId",
          select: "terms startDate endDate",
        })
        .populate({
          path: "invoiceId",
          select:
            "invoiceNumber issueDate dueDate status subtotal taxAmount totalAmount amountPaid balanceRemaining notes lineItems propertyId tenantId",
          populate: [
            { path: "propertyId", select: "name address" },
            { path: "tenantId", select: "firstName lastName email" },
          ],
        })
        .sort({ dueDate: -1, createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean({ virtuals: true });

      const plainPayments = payments.map((payment) =>
        JSON.parse(JSON.stringify(payment))
      );

      const totalPayments = await Payment.countDocuments(query);
      const totalPages = Math.ceil(totalPayments / limit);

      return createSuccessResponse({
        payments: plainPayments,
        pagination: {
          page,
          limit,
          total: totalPayments,
          pages: totalPages,
        },
      });
    } catch (error) {
      return handleApiError(error, "Failed to fetch payments");
    }
  }
);

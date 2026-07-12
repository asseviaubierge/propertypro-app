/**
 * PropertyPro - Tenant Receipts API
 * Handles fetching and managing payment receipts for tenants
 */

import { NextRequest } from "next/server";
import { PaymentReceipt } from "@/models";
import { Payment } from "@/models";
import { UserRole } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse as createApiSuccessResponse,
  createErrorResponse as createApiErrorResponse,
  withPermissionAndDB,
} from "@/lib/api-utils";

// ============================================================================
// GET - Fetch tenant's payment receipts
// ============================================================================

export const GET = withPermissionAndDB("payment_history")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "12");
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");

      const paymentQuery: any = { tenantId: user.id };

      if (startDate || endDate) {
        paymentQuery.paidDate = {};
        if (startDate) {
          paymentQuery.paidDate.$gte = new Date(startDate);
        }
        if (endDate) {
          paymentQuery.paidDate.$lte = new Date(endDate);
        }
      }

      const payments = await Payment.find(paymentQuery, "_id").lean();
      const paymentIds = payments.map((payment) => payment._id);
      const receiptQuery: any = { paymentId: { $in: paymentIds } };
      const skip = (page - 1) * limit;

      const receipts = await PaymentReceipt.find(receiptQuery)
        .populate({
          path: "paymentId",
          select: "amount type dueDate paidDate propertyId",
          populate: {
            path: "propertyId",
            select: "name address",
          },
        })
        .sort({ generatedDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await PaymentReceipt.countDocuments(receiptQuery);
      const totalPages = Math.ceil(total / limit);

      return createApiSuccessResponse<{
        receipts: typeof receipts;
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>(
        {
          receipts,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        },
        "Receipts fetched successfully"
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch receipts";

      return createApiErrorResponse(errorMessage, 500, errorMessage);
    }
  }
);

// ============================================================================
// POST - Generate a new receipt (typically used by system after payment)
// ============================================================================

export const POST = withPermissionAndDB([
  "payment_processing",
  "financial_management",
])(
  async (_user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const body = await request.json();
      const { paymentId, emailSent = false } = body;

      if (!paymentId) {
        return createApiErrorResponse(
          "Payment ID is required",
          400,
          "Payment ID is required"
        );
      }

      const payment = await Payment.findById(paymentId)
        .populate("propertyId", "name address")
        .populate("tenantId", "name email");

      if (!payment) {
        return createApiErrorResponse(
          "Payment not found",
          404,
          "Payment not found"
        );
      }

      const existingReceipt = await PaymentReceipt.findOne({ paymentId });
      if (existingReceipt) {
        return createApiErrorResponse(
          "Receipt already exists for this payment",
          409,
          "Receipt already exists for this payment"
        );
      }

      const receiptNumber = await generateReceiptNumber();

      const receipt = new PaymentReceipt({
        paymentId,
        receiptNumber,
        generatedDate: new Date(),
        emailSent,
        downloadUrl: `/api/tenant/receipts/${paymentId}/download`,
      });

      await receipt.save();

      await receipt.populate({
        path: "paymentId",
        select: "amount type dueDate paidDate propertyId tenantId",
        populate: [
          { path: "propertyId", select: "name address" },
          { path: "tenantId", select: "name email" },
        ],
      });

      return createApiSuccessResponse<typeof receipt>(
        receipt,
        "Receipt generated successfully"
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to generate receipt";

      return createApiErrorResponse(errorMessage, 500, errorMessage);
    }
  }
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function generateReceiptNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  // Find the last receipt for this month
  const lastReceipt = await PaymentReceipt.findOne({
    receiptNumber: { $regex: `^${year}${month}` },
  })
    .sort({ receiptNumber: -1 })
    .lean();

  let sequence = 1;
  if (lastReceipt) {
    const lastSequence = parseInt(lastReceipt.receiptNumber.slice(-4));
    sequence = lastSequence + 1;
  }

  return `${year}${month}${String(sequence).padStart(4, "0")}`;
}

/**
 * PropertyPro - Payments API Routes
 * CRUD operations for payment management
 */

import { NextRequest } from "next/server";
import { Payment } from "@/models";
import { UserRole, PaymentStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  parseRequestBody,
  withAccessAndDB,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { buildPaymentScopeQuery } from "@/lib/payment-access";
import { canAccessProperty } from "@/lib/property-scope";

const PAYMENT_READ_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: ["payment_processing", "financial_management", "financial_reports"],
  match: "any" as const,
};

// GET /api/payments - Get all payments with pagination and filtering
export const GET = withAccessAndDB(PAYMENT_READ_ACCESS)(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get("page") || "1");
      const limit = Math.min(parseInt(searchParams.get("limit") || "12"), 100);
      const status = searchParams.get("status");
      const type = searchParams.get("type");
      const propertyId = searchParams.get("propertyId");
      const tenantId = searchParams.get("tenantId");
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      const search = (searchParams.get("search") || "").trim();
      const paymentMethod = searchParams.get("paymentMethod");

      let query: Record<string, unknown> = await buildPaymentScopeQuery(user);

      if (status && status !== "all") {
        if (status === PaymentStatus.OVERDUE) {
          query.status = {
            $in: [
              PaymentStatus.OVERDUE,
              PaymentStatus.PENDING,
              PaymentStatus.FAILED,
              PaymentStatus.PARTIAL,
            ],
          };
        } else {
          query.status = status;
        }
      }

      if (type) {
        query.type = type;
      }
      if (propertyId && !user.isTenant) {
        if (!(await canAccessProperty(user, propertyId))) {
          return createErrorResponse("Access denied for this property", 403);
        }
        query.propertyId = propertyId;
      }
      if (tenantId && !user.isTenant) {
        query.tenantId = tenantId;
      }
      if (paymentMethod && paymentMethod !== "all") {
        query.paymentMethod = paymentMethod;
      }

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          (query.createdAt as Record<string, Date>).$gte = new Date(startDate);
        }
        if (endDate) {
          (query.createdAt as Record<string, Date>).$lte = new Date(endDate);
        }
      }

      const skip = (page - 1) * limit;
      let payments: any[] = [];
      let total = 0;

      if (search) {
        const pipeline: any[] = [
          { $match: query },
          {
            $lookup: {
              from: "users",
              localField: "tenantId",
              foreignField: "_id",
              as: "tenantId",
            },
          },
          { $unwind: { path: "$tenantId", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "properties",
              localField: "propertyId",
              foreignField: "_id",
              as: "propertyId",
            },
          },
          { $unwind: { path: "$propertyId", preserveNullAndEmptyArrays: true } },
          {
            $match: {
              $or: [
                { "tenantId.firstName": { $regex: search, $options: "i" } },
                { "tenantId.lastName": { $regex: search, $options: "i" } },
                { "tenantId.email": { $regex: search, $options: "i" } },
                { "propertyId.name": { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { notes: { $regex: search, $options: "i" } },
              ],
            },
          },
          { $sort: { createdAt: -1 } },
          {
            $facet: {
              data: [{ $skip: skip }, { $limit: limit }],
              metadata: [{ $count: "total" }],
            },
          },
          { $unwind: { path: "$metadata", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              payments: "$data",
              total: { $ifNull: ["$metadata.total", 0] },
            },
          },
        ];

        const agg = await Payment.aggregate(pipeline);
        payments = agg[0]?.payments || [];
        total = agg[0]?.total || 0;
      } else {
        const [docs, count] = await Promise.all([
          Payment.find(query)
            .populate("propertyId", "name address")
            .populate("tenantId", "firstName lastName email phone")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
          Payment.countDocuments(query),
        ]);
        payments = docs;
        total = count;
      }

      return createSuccessResponse(payments, "Payments retrieved successfully", {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// POST /api/payments - Create a new payment
export const POST = withPermissionAndDB([
  "payment_processing",
  "financial_management",
])(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      if (!body.tenantId || !body.propertyId || !body.amount || !body.type) {
        return createErrorResponse("Missing required fields", 400);
      }

      if (body.amount <= 0 || body.amount > 100000) {
        return createErrorResponse(
          "Amount must be between $0.01 and $100,000",
          400
        );
      }

      if (!(await canAccessProperty(user, body.propertyId))) {
        return createErrorResponse(
          "You can only create payments for properties you own or manage",
          403
        );
      }

      const payment = new Payment({
        ...body,
        createdBy: user.id,
        status: PaymentStatus.PENDING,
      });

      await payment.save();
      await payment.populate("propertyId", "name address");
      await payment.populate("tenantId", "firstName lastName email phone");

      return createSuccessResponse(payment, "Payment created successfully");
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// PUT /api/payments - Bulk update payments
export const PUT = withPermissionAndDB([
  "payment_processing",
  "financial_management",
])(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      const { paymentIds, updates } = body;

      if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
        return createErrorResponse("Payment IDs are required", 400);
      }

      if (!updates || typeof updates !== "object") {
        return createErrorResponse("Updates object is required", 400);
      }

      const scopedBulkQuery = await buildPaymentScopeQuery(user, {
        _id: { $in: paymentIds },
      });

      const result = await Payment.updateMany(
        scopedBulkQuery,
        { $set: { ...updates, updatedBy: user.id, updatedAt: new Date() } }
      );

      return createSuccessResponse(
        {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
        },
        `${result.modifiedCount} payments updated successfully`
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// DELETE /api/payments - Bulk delete payments
export const DELETE = withPermissionAndDB(
  ["payment_processing", "bulk_operations"],
  { requireAllPermissions: true }
)(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      if (!user.isAdmin) {
        return createErrorResponse("Insufficient permissions", 403);
      }

      const { searchParams } = new URL(request.url);
      const paymentIds = searchParams.get("ids")?.split(",");

      if (!paymentIds || paymentIds.length === 0) {
        return createErrorResponse("Payment IDs are required", 400);
      }

      const scopedBulkQuery = await buildPaymentScopeQuery(user, {
        _id: { $in: paymentIds },
      });

      const result = await Payment.updateMany(
        scopedBulkQuery,
        {
          $set: {
            status: PaymentStatus.CANCELLED,
            deletedBy: user.id,
            deletedAt: new Date(),
          },
        }
      );

      return createSuccessResponse(
        {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
        },
        `${result.modifiedCount} payments deleted successfully`
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

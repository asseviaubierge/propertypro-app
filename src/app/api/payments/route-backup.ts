/**
 * PropertyPro - Payments API Routes
 * CRUD operations for payment management with Stripe integration
 */

import { NextRequest } from "next/server";
import { Payment, Tenant, Property, Lease } from "@/models";
import { UserRole, PaymentType, PaymentStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
  parsePaginationParams,
  paginateQuery,
  parseRequestBody,
} from "@/lib/api-utils";
import {
  paymentSchema,
  paymentFilterSchema,
  validateSchema,
} from "@/lib/validations";

// ============================================================================
// GET /api/payments - Get all payments with pagination and filtering
// ============================================================================

export const GET = withPermissionAndDB("payment_processing")(
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

      // Build query based on user role and filters
      let query: any = {};

      // Role-based filtering
      switch (user.role) {
        case UserRole.TENANT:
          query.tenantId = user.id;
          break;
        case UserRole.MANAGER:
          // Owners can see payments for their properties
          const ownedProperties = await Property.find({
            ownerId: user.id,
          }).select("_id");
          query.propertyId = { $in: ownedProperties.map((p) => p._id) };
          break;
        case UserRole.MANAGER:
          // Property managers can see payments for managed properties
          const managedProperties = await Property.find({
            managerId: user.id,
          }).select("_id");
          query.propertyId = { $in: managedProperties.map((p) => p._id) };
          break;
        case UserRole.ADMIN:
          // Super admins can see all payments
          break;
      }

      // Apply additional filters
      if (status) query.status = status;
      if (type) query.type = type;
      if (propertyId && !user.isTenant)
        query.propertyId = propertyId;
      if (tenantId && !user.isTenant) query.tenantId = tenantId;

      // Date range filter
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Fetch payments with population
      const payments = await Payment.find(query)
        .populate("propertyId", "name address")
        .populate("tenantId", "firstName lastName email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Get total count for pagination
      const total = await Payment.countDocuments(query);
      const totalPages = Math.ceil(total / limit);

      return createSuccessResponse(
        payments,
        "Payments retrieved successfully",
        {
          page,
          limit,
          total,
          totalPages,
        }
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// POST /api/payments - Create a new payment
// ============================================================================

export const POST = withPermissionAndDB("payment_processing")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const body = await request.json();
      const {
        success,
        data: validatedData,
        error,
      } = validateRequestBody(body, paymentSchema);

      if (!success) {
        return createErrorResponse(error!, 400);
      }

      // Create the payment
      const payment = new Payment({
        ...validatedData,
        createdBy: user.id,
        status: PaymentStatus.PENDING,
      });

      await payment.save();

      // Populate the response
      await payment.populate("propertyId", "name address");
      await payment.populate("tenantId", "firstName lastName email");

      return createSuccessResponse(
        payment,
        "Payment created successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PUT /api/payments - Bulk update payments (admin only)
// ============================================================================

export const PUT = withPermissionAndDB("payment_processing")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const body = await request.json();
      const { paymentIds, updates } = body;

      if (
        !paymentIds ||
        !Array.isArray(paymentIds) ||
        paymentIds.length === 0
      ) {
        return createErrorResponse("Payment IDs are required", 400);
      }

      if (!updates || typeof updates !== "object") {
        return createErrorResponse("Updates object is required", 400);
      }

      // Update payments
      const result = await Payment.updateMany(
        { _id: { $in: paymentIds } },
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

// ============================================================================
// DELETE /api/payments - Bulk delete payments (admin only)
// ============================================================================

export const DELETE = withPermissionAndDB("financial_management")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const paymentIds = searchParams.get("ids")?.split(",");

      if (!paymentIds || paymentIds.length === 0) {
        return createErrorResponse("Payment IDs are required", 400);
      }

      // Delete payments (soft delete by updating status)
      const result = await Payment.updateMany(
        { _id: { $in: paymentIds } },
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

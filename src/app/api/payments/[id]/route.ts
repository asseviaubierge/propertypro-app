/**
 * PropertyPro - Individual Payment API Routes
 * CRUD operations for individual payments with Stripe integration
 */

import { NextRequest } from "next/server";
import { Payment } from "@/models";
import { UserRole, PaymentStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withAccessAndDB,
  withPermissionAndDB,
  parseRequestBody,
  isValidObjectId,
} from "@/lib/api-utils";
import { paymentSchema, validateSchema } from "@/lib/validations";

const PAYMENT_READ_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: ["payment_processing", "financial_management", "financial_reports"],
  match: "any" as const,
};

const PAYMENT_WRITE_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: ["payment_processing", "financial_management"],
  match: "any" as const,
};

const resolveId = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (record._id) {
      return resolveId(record._id);
    }

    if (record.id) {
      return resolveId(record.id);
    }

    if (typeof record.toString === "function") {
      const str = record.toString();
      return str === "[object Object]" ? null : str;
    }
  }

  if (typeof value === "function") {
    return null;
  }

  try {
    return String(value);
  } catch {
    return null;
  }
};

// ============================================================================
// GET /api/payments/[id] - Get a specific payment
// ============================================================================

export const GET = withAccessAndDB(PAYMENT_READ_ACCESS)(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid payment ID", 400);
      }

      const payment = await Payment.findById(id)
        .populate("tenantId", "firstName lastName email phone")
        .populate("propertyId", "name address type ownerId managerId")
        .populate("leaseId", "startDate endDate status")
        .lean();

      if (!payment) {
        return createErrorResponse("Payment not found", 404);
      }

      if (user.isTenant) {
        const tenantId = resolveId(payment.tenantId);
        if (!tenantId || tenantId !== user.id) {
          return createErrorResponse("You can only view your own payments", 403);
        }
      }

      return createSuccessResponse(payment, "Payment retrieved successfully");
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PUT /api/payments/[id] - Update a specific payment
// ============================================================================

export const PUT = withPermissionAndDB([
  "payment_processing",
  "financial_management",
])(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid payment ID", 400);
      }

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      const payment = await Payment.findById(id);
      if (!payment) {
        return createErrorResponse("Payment not found", 404);
      }

      if (payment.status === PaymentStatus.PAID) {
        return createErrorResponse("Cannot update completed payment", 400);
      }

      const updateSchema = paymentSchema.partial();
      const validation = validateSchema(updateSchema, body);
      if (!validation.success) {
        return createErrorResponse(validation.errors.join(", "), 400);
      }

      const updateData = validation.data;
      delete updateData.tenantId;
      delete updateData.propertyId;
      delete (updateData as Record<string, unknown>).stripePaymentIntentId;

      Object.assign(payment, updateData);
      await payment.save();

      await payment.populate([
        { path: "tenantId", select: "firstName lastName email phone" },
        { path: "propertyId", select: "name address type" },
        { path: "leaseId", select: "startDate endDate status" },
      ]);

      return createSuccessResponse(payment, "Payment updated successfully");
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// DELETE /api/payments/[id] - Delete a specific payment
// ============================================================================

export const DELETE = withPermissionAndDB([
  "payment_processing",
  "financial_management",
])(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid payment ID", 400);
      }

      const payment = await Payment.findById(id);
      if (!payment) {
        return createErrorResponse("Payment not found", 404);
      }

      if (payment.status === PaymentStatus.PAID) {
        return createErrorResponse(
          "Cannot delete completed payment. Please refund it first.",
          409
        );
      }

      payment.deletedAt = new Date();
      await payment.save();

      return createSuccessResponse(
        { id: payment._id },
        "Payment deleted successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PATCH /api/payments/[id] - Partial update (status change, etc.)
// ============================================================================

export const PATCH = withAccessAndDB(PAYMENT_WRITE_ACCESS)(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid payment ID", 400);
      }

      const { success, data: body, error } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse(error!, 400);
      }

      const payment = await Payment.findById(id);
      if (!payment) {
        return createErrorResponse("Payment not found", 404);
      }

      if (user.isTenant && !payment.tenantId.equals(user.id)) {
        return createErrorResponse("You can only modify your own payments", 403);
      }

      const { action, ...data } = body;

      switch (action) {
        case "markAsPaid":
          if (user.isTenant) {
            return createErrorResponse("Tenants cannot mark payments as paid", 403);
          }
          payment.status = PaymentStatus.PAID;
          payment.paidDate = data.paidDate
            ? new Date(data.paidDate)
            : new Date();
          break;

        case "markAsFailed":
          if (user.isTenant) {
            return createErrorResponse(
              "Tenants cannot mark payments as failed",
              403
            );
          }
          payment.status = PaymentStatus.FAILED;
          break;

        case "processPayment":
          payment.status = PaymentStatus.PENDING;
          if ((data as Record<string, unknown>).stripePaymentIntentId) {
            (payment as any).stripePaymentIntentId = (
              data as Record<string, unknown>
            ).stripePaymentIntentId;
          }
          break;

        case "refund":
          if (user.isTenant) {
            return createErrorResponse("Tenants cannot refund payments", 403);
          }
          if (payment.status !== PaymentStatus.PAID) {
            return createErrorResponse(
              "Can only refund completed payments",
              400
            );
          }
          payment.status = PaymentStatus.REFUNDED;
          break;

        case "updateAmount":
          if (user.isTenant) {
            return createErrorResponse(
              "Tenants cannot update payment amounts",
              403
            );
          }
          if (payment.status === PaymentStatus.PAID) {
            return createErrorResponse(
              "Cannot update amount of completed payment",
              400
            );
          }
          if (!data.amount || data.amount <= 0) {
            return createErrorResponse("Valid amount is required", 400);
          }
          payment.amount = data.amount;
          break;

        case "updateDueDate":
          if (user.isTenant) {
            return createErrorResponse("Tenants cannot update due dates", 403);
          }
          if (!data.dueDate) {
            return createErrorResponse("Due date is required", 400);
          }
          payment.dueDate = new Date(data.dueDate);
          break;

        case "addNote":
          if (!data.description) {
            return createErrorResponse("Description is required", 400);
          }
          payment.description = data.description;
          break;

        default:
          return createErrorResponse("Invalid action", 400);
      }

      await payment.save();

      return createSuccessResponse(
        payment,
        `Payment ${action} completed successfully`
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

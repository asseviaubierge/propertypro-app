/**
 * PropertyPro - Security Deposit Detail API
 * Individual deposit operations: get, update, deductions, refund
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { SecurityDeposit } from "@/models";
import { UserRole, SecurityDepositStatus, DeductionCategory } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";

// ============================================================================
// GET /api/security-deposits/[id] - Get deposit details
// ============================================================================
export const GET = withPermissionAndDB("financial_management")(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
  context: any
) => {
  try {
    const { id } = await context.params;

    const deposit = await SecurityDeposit.findOne({
      _id: id,
      deletedAt: null,
    })
      .populate("tenantId", "firstName lastName email phone")
      .populate("propertyId", "name address")
      .populate("leaseId", "startDate endDate status terms")
      .populate("collectedPaymentId", "amount paidDate paymentMethod")
      .populate("refundPaymentId", "amount paidDate paymentMethod");

    if (!deposit) {
      return createErrorResponse("Security deposit not found", 404);
    }

    // Tenant can only view their own
    if (
      user.isTenant &&
      deposit.tenantId._id.toString() !== user.id
    ) {
      return createErrorResponse("Access denied", 403);
    }

    return createSuccessResponse(deposit);
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// PUT /api/security-deposits/[id] - Update deposit (status, notes, deductions)
// ============================================================================
export const PUT = withPermissionAndDB("financial_management")(
  async (_user: any, request: NextRequest, context: any) => {
    try {
      const { id } = await context.params;
      const body = await request.json();
      const { action } = body;

      const deposit = await SecurityDeposit.findOne({
        _id: id,
        deletedAt: null,
      });
      if (!deposit) {
        return createErrorResponse("Security deposit not found", 404);
      }

      switch (action) {
        case "collect": {
          if (deposit.status !== SecurityDepositStatus.PENDING) {
            return createErrorResponse(
              "Deposit can only be collected when pending",
              400
            );
          }
          deposit.status = SecurityDepositStatus.COLLECTED;
          deposit.collectedDate = new Date();
          if (body.paymentId) deposit.collectedPaymentId = body.paymentId;
          if (body.notes) deposit.notes = body.notes;
          await deposit.save();
          break;
        }

        case "add-deduction": {
          if (deposit.status !== SecurityDepositStatus.COLLECTED) {
            return createErrorResponse(
              "Deductions can only be added to collected deposits",
              400
            );
          }
          const { category, description, amount, photos } = body;
          if (
            !category ||
            !description ||
            !amount ||
            !Object.values(DeductionCategory).includes(category)
          ) {
            return createErrorResponse(
              "Valid category, description, and amount are required",
              400
            );
          }
          const totalDeductions =
            deposit.deductions.reduce(
              (sum: number, d: any) => sum + d.amount,
              0
            ) + amount;
          if (totalDeductions > deposit.amount) {
            return createErrorResponse(
              "Total deductions cannot exceed deposit amount",
              400
            );
          }
          deposit.deductions.push({
            category,
            description,
            amount,
            photos: photos || [],
            createdAt: new Date(),
          });
          await deposit.save();
          break;
        }

        case "remove-deduction": {
          const { deductionId } = body;
          if (!deductionId) {
            return createErrorResponse("Deduction ID is required", 400);
          }
          deposit.deductions = deposit.deductions.filter(
            (d: any) => d._id.toString() !== deductionId
          );
          await deposit.save();
          break;
        }

        case "refund": {
          if (deposit.status !== SecurityDepositStatus.COLLECTED) {
            return createErrorResponse(
              "Only collected deposits can be refunded",
              400
            );
          }
          const { refundMethod, refundNotes, refundPaymentId } = body;
          if (!refundMethod) {
            return createErrorResponse("Refund method is required", 400);
          }

          const totalDed = deposit.deductions.reduce(
            (sum: number, d: any) => sum + d.amount,
            0
          );
          const refundAmount = deposit.amount - totalDed;

          if (refundAmount <= 0) {
            deposit.status = SecurityDepositStatus.FORFEITED;
            deposit.refundAmount = 0;
          } else if (totalDed > 0) {
            deposit.status = SecurityDepositStatus.PARTIALLY_REFUNDED;
            deposit.refundAmount = refundAmount;
          } else {
            deposit.status = SecurityDepositStatus.FULLY_REFUNDED;
            deposit.refundAmount = refundAmount;
          }

          deposit.refundDate = new Date();
          deposit.refundMethod = refundMethod;
          if (refundNotes) deposit.refundNotes = refundNotes;
          if (refundPaymentId) deposit.refundPaymentId = refundPaymentId;
          await deposit.save();
          break;
        }

        case "update-notes": {
          if (body.notes !== undefined) deposit.notes = body.notes;
          await deposit.save();
          break;
        }

        default:
          return createErrorResponse(
            "Invalid action. Use: collect, add-deduction, remove-deduction, refund, update-notes",
            400
          );
      }

      const updated = await SecurityDeposit.findById(id)
        .populate("tenantId", "firstName lastName email")
        .populate("propertyId", "name")
        .lean();

      return createSuccessResponse(updated, `Deposit ${action} successful`);
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// DELETE /api/security-deposits/[id] - Soft delete deposit
// ============================================================================
export const DELETE = withPermissionAndDB("financial_management")(
  async (_user: any, _request: NextRequest, context: any) => {
    try {
      const { id } = await context.params;

      const deposit = await SecurityDeposit.findOne({
        _id: id,
        deletedAt: null,
      });
      if (!deposit) {
        return createErrorResponse("Security deposit not found", 404);
      }

      deposit.deletedAt = new Date();
      await deposit.save();

      return createSuccessResponse(null, "Security deposit deleted");
    } catch (error) {
      return handleApiError(error);
    }
  }
);

/**
 * PropertyPro - Security Deposits API
 * CRUD endpoints for security deposit tracking
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { SecurityDeposit, Lease } from "@/models";
import { UserRole, SecurityDepositStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { Types } from "mongoose";

// ============================================================================
// GET /api/security-deposits - List security deposits
// ============================================================================
export const GET = withPermissionAndDB("financial_management")(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const propertyId = searchParams.get("propertyId");
    const leaseId = searchParams.get("leaseId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const filter: any = { deletedAt: null };

    // Tenant can only see their own deposits
    if (user.isTenant) {
      filter.tenantId = new Types.ObjectId(user.id);
    } else if (tenantId) {
      filter.tenantId = new Types.ObjectId(tenantId);
    }

    if (propertyId) filter.propertyId = new Types.ObjectId(propertyId);
    if (leaseId) filter.leaseId = new Types.ObjectId(leaseId);
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [deposits, total] = await Promise.all([
      SecurityDeposit.find(filter)
        .populate("tenantId", "firstName lastName email")
        .populate("propertyId", "name")
        .populate("leaseId", "startDate endDate status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SecurityDeposit.countDocuments(filter),
    ]);

    // Summary stats
    const summaryPipeline = [
      { $match: filter },
      {
        $group: {
          _id: null,
          totalDeposits: { $sum: "$amount" },
          totalHeld: {
            $sum: {
              $cond: [
                { $eq: ["$status", SecurityDepositStatus.COLLECTED] },
                "$amount",
                0,
              ],
            },
          },
          totalRefunded: {
            $sum: { $ifNull: ["$refundAmount", 0] },
          },
          pendingCount: {
            $sum: {
              $cond: [
                { $eq: ["$status", SecurityDepositStatus.PENDING] },
                1,
                0,
              ],
            },
          },
          heldCount: {
            $sum: {
              $cond: [
                { $eq: ["$status", SecurityDepositStatus.COLLECTED] },
                1,
                0,
              ],
            },
          },
        },
      },
    ];
    const [summary] = await SecurityDeposit.aggregate(summaryPipeline);

    return createSuccessResponse(
      {
        deposits,
        summary: summary || {
          totalDeposits: 0,
          totalHeld: 0,
          totalRefunded: 0,
          pendingCount: 0,
          heldCount: 0,
        },
      },
      undefined,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// POST /api/security-deposits - Create a security deposit record
// ============================================================================
export const POST = withPermissionAndDB("financial_management")(
  async (_user: any, request: NextRequest) => {
    try {
      const body = await request.json();
      const { leaseId, amount, notes } = body;

      if (!leaseId || !amount) {
        return createErrorResponse("Lease ID and amount are required", 400);
      }

      // Get lease details
      const lease = await Lease.findById(leaseId);
      if (!lease) {
        return createErrorResponse("Bail introuvable", 404);
      }

      // Check for existing deposit on this lease
      const existing = await SecurityDeposit.findOne({
        leaseId: lease._id,
        deletedAt: null,
      });
      if (existing) {
        return createErrorResponse(
          "A security deposit already exists for this lease",
          409
        );
      }

      const deposit = new SecurityDeposit({
        leaseId: lease._id,
        tenantId: lease.tenantId,
        propertyId: lease.propertyId,
        unitId: lease.unitId,
        amount,
        status: SecurityDepositStatus.PENDING,
        notes,
      });

      await deposit.save();

      const populated = await SecurityDeposit.findById(deposit._id)
        .populate("tenantId", "firstName lastName email")
        .populate("propertyId", "name")
        .lean();

      return createSuccessResponse(populated, "Security deposit created");
    } catch (error) {
      return handleApiError(error);
    }
  }
);

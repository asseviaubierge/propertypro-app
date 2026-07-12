/**
 * PropertyPro - Tenant Payment Summary API
 * API endpoint for tenant payment summary and statistics
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Payment } from "@/models";
import { UserRole, PaymentStatus } from "@/types";
import { Types } from "mongoose";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";

// ============================================================================
// GET /api/tenant/payments/summary - Get tenant payment summary
// ============================================================================

export const GET = withPermissionAndDB("payment_portal")(
  async (user, request: NextRequest, context?: { tenantProfile?: any }) => {
    try {
      const tenant = context?.tenantProfile;
      if (!tenant) {
        return createErrorResponse("Tenant profile unavailable", 500);
      }

      // Get current year date range
      const currentYear = new Date().getFullYear();
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear, 11, 31);

      const possibleTenantIds = [tenant._id];
      if (Types.ObjectId.isValid(user.id)) {
        possibleTenantIds.push(new Types.ObjectId(user.id));
      }

      const tenantMatchQuery = { tenantId: { $in: possibleTenantIds } };

      const paidStatusValues = [PaymentStatus.PAID];

      const overdueStatusValues = [
        PaymentStatus.OVERDUE,
        PaymentStatus.OVERDUE,
        PaymentStatus.OVERDUE,
        PaymentStatus.OVERDUE,
      ];

      const pendingStatusValues = [
        PaymentStatus.PENDING,
        PaymentStatus.PENDING,
        PaymentStatus.PENDING,
        ...overdueStatusValues,
      ];

      const isPaid = (status: string | undefined | null) =>
        status ? paidStatusValues.includes(status as PaymentStatus) : false;

      const isPending = (status: string | undefined | null) =>
        status ? pendingStatusValues.includes(status as PaymentStatus) : false;

      const isOverdue = (status: string | undefined | null) =>
        status ? overdueStatusValues.includes(status as PaymentStatus) : false;

      // Get all payments for this tenant
      const allPayments = await Payment.find(tenantMatchQuery);

      // Get payments for current year
      const yearPayments = await Payment.find({
        ...tenantMatchQuery,
        createdAt: { $gte: yearStart, $lte: yearEnd },
      });

      // Calculate total paid this year
      const totalPaid = yearPayments
        .filter((payment) => isPaid(payment.status))
        .reduce((sum, payment) => sum + payment.amount, 0);

      // Calculate total outstanding
      const totalOutstanding = yearPayments
        .filter((payment) => isPending(payment.status))
        .reduce((sum, payment) => sum + payment.amount, 0);

      // Find next payment due
      const nextPayment = await Payment.findOne({
        ...tenantMatchQuery,
        status: { $in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] },
        dueDate: { $gte: new Date() },
      }).sort({ dueDate: 1 });

      let nextPaymentDue = null;
      if (nextPayment) {
        const today = new Date();
        const dueDate = new Date(nextPayment.dueDate);
        const daysUntilDue = Math.ceil(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        nextPaymentDue = {
          amount: nextPayment.amount,
          dueDate: nextPayment.dueDate,
          daysUntilDue,
        };
      }

      // Calculate on-time payment rate
      const paidPayments = allPayments.filter((payment) =>
        isPaid(payment.status)
      );
      const onTimePayments = paidPayments.filter((payment) => {
        if (!payment.paidDate) return false;
        const paidDate = new Date(payment.paidDate);
        const dueDate = new Date(payment.dueDate);
        return paidDate <= dueDate;
      });

      const onTimePaymentRate =
        paidPayments.length > 0
          ? (onTimePayments.length / paidPayments.length) * 100
          : 0;

      // Calculate monthly statistics
      const currentMonth = new Date().getMonth();
      const monthStart = new Date(currentYear, currentMonth, 1);

      const monthlyPayments = yearPayments.filter(
        (payment) => new Date(payment.createdAt) >= monthStart
      );

      const paymentsThisMonth = monthlyPayments.filter((payment) =>
        isPaid(payment.status)
      ).length;

      // Calculate average payment amount
      const averagePaymentAmount =
        allPayments.length > 0
          ? allPayments.reduce((sum, payment) => sum + payment.amount, 0) /
            allPayments.length
          : 0;

      // Get payment trends for last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const recentPayments = allPayments.filter(
        (payment) =>
          isPaid(payment.status) &&
          payment.paidDate &&
          new Date(payment.paidDate) >= sixMonthsAgo
      );

      // Group by month
      const monthlyTotals = new Map();
      recentPayments.forEach((payment) => {
        const paidDate = new Date(payment.paidDate!);
        const monthKey = `${paidDate.getFullYear()}-${String(
          paidDate.getMonth() + 1
        ).padStart(2, "0")}`;

        if (!monthlyTotals.has(monthKey)) {
          monthlyTotals.set(monthKey, { month: monthKey, total: 0, count: 0 });
        }

        const monthData = monthlyTotals.get(monthKey);
        monthData.total += payment.amount;
        monthData.count += 1;
      });

      const paymentTrends = Array.from(monthlyTotals.values()).sort((a, b) =>
        a.month.localeCompare(b.month)
      );

      const monthlyAverage =
        paymentTrends.length > 0
          ? paymentTrends.reduce((sum, month) => sum + month.total, 0) /
            paymentTrends.length
          : 0;

      // Calculate average payment time (days after due date)
      const paymentTimes = paidPayments
        .filter((payment) => payment.paidDate)
        .map((payment) => {
          const paidDate = new Date(payment.paidDate!);
          const dueDate = new Date(payment.dueDate);
          return Math.ceil(
            (paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
          );
        });

      const averagePaymentTime =
        paymentTimes.length > 0
          ? paymentTimes.reduce((sum, days) => sum + days, 0) /
            paymentTimes.length
          : 0;

      // Get payment trends (last 12 months)
      const monthlyTrends = [];
      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date();
        monthStart.setMonth(monthStart.getMonth() - i, 1);
        monthStart.setHours(0, 0, 0, 0);

        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);

        const monthPayments = await Payment.find({
          ...tenantMatchQuery,
          status: { $in: paidStatusValues },
          paidDate: { $gte: monthStart, $lte: monthEnd },
        });

        const monthTotal = monthPayments.reduce(
          (sum, payment) => sum + payment.amount,
          0
        );

        monthlyTrends.push({
          month: monthStart.toISOString().substring(0, 7), // YYYY-MM format
          amount: monthTotal,
          count: monthPayments.length,
        });
      }

      // Get payment type breakdown
      const paymentTypes = await Payment.aggregate([
        {
          $match: {
            tenantId: { $in: possibleTenantIds },
            status: { $in: paidStatusValues },
          },
        },
        {
          $group: {
            _id: "$type",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]);

      const summary = {
        totalPaid,
        totalPending: yearPayments
          .filter((payment) => payment.status === PaymentStatus.PENDING)
          .reduce((sum, payment) => sum + payment.amount, 0),
        totalOverdue: yearPayments
          .filter((payment) => payment.status === PaymentStatus.OVERDUE)
          .reduce((sum, payment) => sum + payment.amount, 0),
        totalOutstanding,
        paymentsThisMonth,
        paymentsThisYear: yearPayments.filter((payment) =>
          isPaid(payment.status)
        ).length,
        averagePaymentAmount,
        onTimePaymentRate,
        nextPaymentDue,
        averagePaymentTime,
        paymentTrends: {
          last6Months: paymentTrends,
          monthlyAverage,
        },
        monthlyTrends, // Keep for backward compatibility
        paymentTypes,
        statistics: {
          totalPayments: allPayments.length,
          paidPayments: paidPayments.length,
          pendingPayments: allPayments.filter((p) => isPending(p.status))
            .length,
          overduePayments: allPayments.filter((p) => isOverdue(p.status))
            .length,
        },
      };

      return createSuccessResponse(summary);
    } catch (error) {
      return handleApiError(error, "Failed to fetch payment summary");
    }
  }
);

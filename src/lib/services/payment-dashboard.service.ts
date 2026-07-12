/**
 * PropertyPro - Enhanced Payment Dashboard Service
 * Real-world metrics including collection rates, aging reports, and payment behavior analytics
 */

import { PaymentStatus, IPayment, ILease } from "@/types";
import { Payment, Lease } from "@/models";
import mongoose from "mongoose";
import { formatCurrency } from "@/lib/utils/formatting";

export interface CollectionMetrics {
  currentMonth: {
    collected: number;
    expected: number;
    collectionRate: number;
    outstanding: number;
  };
  previousMonth: {
    collected: number;
    expected: number;
    collectionRate: number;
  };
  yearToDate: {
    collected: number;
    expected: number;
    collectionRate: number;
  };
  averageDaysToPayment: number;
  totalPortfolioCollected: number;
}

export interface AgingReport {
  current: { count: number; amount: number }; // 0-30 days
  early: { count: number; amount: number }; // 31-60 days
  serious: { count: number; amount: number }; // 61-90 days
  critical: { count: number; amount: number }; // 90+ days
  totalOverdue: { count: number; amount: number };
}

export interface PaymentBehaviorAnalytics {
  onTimePayments: number;
  latePayments: number;
  averageLateDays: number;
  repeatOffenders: Array<{
    tenantId: string;
    tenantName: string;
    latePaymentCount: number;
    averageLateDays: number;
  }>;
  paymentMethodPreferences: Record<string, number>;
  seasonalTrends: Array<{
    month: string;
    collectionRate: number;
    averageDays: number;
  }>;
}

export interface CashFlowProjection {
  nextMonth: {
    expected: number;
    projected: number;
    confidence: number;
  };
  next3Months: {
    expected: number;
    projected: number;
    confidence: number;
  };
  riskFactors: string[];
  opportunities: string[];
}

export interface DashboardMetrics {
  collectionMetrics: CollectionMetrics;
  agingReport: AgingReport;
  paymentBehavior: PaymentBehaviorAnalytics;
  cashFlowProjection: CashFlowProjection;
  kpis: {
    collectionRate: number;
    averageDaysLate: number;
    lateFeeRevenue: number;
    vacancyImpact: number;
  };
  alerts: Array<{
    type: "warning" | "error" | "info";
    message: string;
    priority: number;
  }>;
}

export class PaymentDashboardService {
  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(filters?: {
    propertyId?: string;
    managerId?: string;
    dateRange?: { start: Date; end: Date };
  }): Promise<DashboardMetrics> {
    const [
      collectionMetrics,
      agingReport,
      paymentBehavior,
      cashFlowProjection,
    ] = await Promise.all([
      this.getCollectionMetrics(filters),
      this.getAgingReport(filters),
      this.getPaymentBehaviorAnalytics(filters),
      this.getCashFlowProjection(filters),
    ]);

    const kpis = {
      collectionRate: collectionMetrics.currentMonth.collectionRate,
      averageDaysLate: paymentBehavior.averageLateDays,
      lateFeeRevenue: await this.getLateFeeRevenue(filters),
      vacancyImpact: await this.getVacancyImpact(filters),
    };

    const alerts = await this.generateAlerts(
      collectionMetrics,
      agingReport,
      paymentBehavior
    );

    return {
      collectionMetrics,
      agingReport,
      paymentBehavior,
      cashFlowProjection,
      kpis,
      alerts,
    };
  }

  /**
   * Calculate collection metrics
   */
  async getCollectionMetrics(filters?: any): Promise<CollectionMetrics> {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const matchStage = this.buildMatchStage(filters);

    // Current month metrics
    const currentMonthData = await Payment.aggregate([
      {
        $match: {
          ...matchStage,
          dueDate: { $gte: currentMonthStart, $lte: now },
          type: "rent",
        },
      },
      {
        $group: {
          _id: null,
          totalExpected: { $sum: "$amount" },
          totalCollected: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    [PaymentStatus.PAID],
                  ],
                },
                "$amount",
                0,
              ],
            },
          },
          totalOutstanding: {
            $sum: {
              $cond: [
                {
                  $nin: [
                    "$status",
                    [PaymentStatus.PAID],
                  ],
                },
                "$amount",
                0,
              ],
            },
          },
        },
      },
    ]);

    // Previous month metrics
    const previousMonthData = await Payment.aggregate([
      {
        $match: {
          ...matchStage,
          dueDate: { $gte: previousMonthStart, $lte: previousMonthEnd },
          type: "rent",
        },
      },
      {
        $group: {
          _id: null,
          totalExpected: { $sum: "$amount" },
          totalCollected: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    [PaymentStatus.PAID],
                  ],
                },
                "$amount",
                0,
              ],
            },
          },
        },
      },
    ]);

    // Year to date metrics
    const ytdData = await Payment.aggregate([
      {
        $match: {
          ...matchStage,
          dueDate: { $gte: yearStart, $lte: now },
          type: "rent",
        },
      },
      {
        $group: {
          _id: null,
          totalExpected: { $sum: "$amount" },
          totalCollected: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    [PaymentStatus.PAID],
                  ],
                },
                "$amount",
                0,
              ],
            },
          },
        },
      },
    ]);

    // Average days to payment
    const avgDaysData = await Payment.aggregate([
      {
        $match: {
          ...matchStage,
          status: { $in: [PaymentStatus.PAID] },
          paidDate: { $exists: true },
          dueDate: { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $addFields: {
          daysToPayment: {
            $divide: [
              { $subtract: ["$paidDate", "$dueDate"] },
              1000 * 60 * 60 * 24,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          averageDays: { $avg: "$daysToPayment" },
        },
      },
    ]);

    const current = currentMonthData[0] || {
      totalExpected: 0,
      totalCollected: 0,
      totalOutstanding: 0,
    };
    const previous = previousMonthData[0] || {
      totalExpected: 0,
      totalCollected: 0,
    };
    const ytd = ytdData[0] || { totalExpected: 0, totalCollected: 0 };
    const avgDays = avgDaysData[0]?.averageDays || 0;

    return {
      currentMonth: {
        collected: current.totalCollected,
        expected: current.totalExpected,
        collectionRate:
          current.totalExpected > 0
            ? (current.totalCollected / current.totalExpected) * 100
            : 0,
        outstanding: current.totalOutstanding,
      },
      previousMonth: {
        collected: previous.totalCollected,
        expected: previous.totalExpected,
        collectionRate:
          previous.totalExpected > 0
            ? (previous.totalCollected / previous.totalExpected) * 100
            : 0,
      },
      yearToDate: {
        collected: ytd.totalCollected,
        expected: ytd.totalExpected,
        collectionRate:
          ytd.totalExpected > 0
            ? (ytd.totalCollected / ytd.totalExpected) * 100
            : 0,
      },
      averageDaysToPayment: Math.round(avgDays * 10) / 10,
      totalPortfolioCollected: ytd.totalCollected,
    };
  }

  /**
   * Generate aging report
   */
  async getAgingReport(filters?: any): Promise<AgingReport> {
    const now = new Date();
    const matchStage = this.buildMatchStage(filters);

    const agingData = await Payment.aggregate([
      {
        $match: {
          ...matchStage,
          status: {
            $nin: [
              PaymentStatus.PAID,
              PaymentStatus.PAID,
              PaymentStatus.CANCELLED,
            ],
          },
          dueDate: { $lt: now },
        },
      },
      {
        $addFields: {
          daysOverdue: {
            $divide: [{ $subtract: [now, "$dueDate"] }, 1000 * 60 * 60 * 24],
          },
        },
      },
      {
        $addFields: {
          agingCategory: {
            $switch: {
              branches: [
                { case: { $lte: ["$daysOverdue", 30] }, then: "current" },
                { case: { $lte: ["$daysOverdue", 60] }, then: "early" },
                { case: { $lte: ["$daysOverdue", 90] }, then: "serious" },
              ],
              default: "critical",
            },
          },
        },
      },
      {
        $group: {
          _id: "$agingCategory",
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
    ]);

    const aging = {
      current: { count: 0, amount: 0 },
      early: { count: 0, amount: 0 },
      serious: { count: 0, amount: 0 },
      critical: { count: 0, amount: 0 },
      totalOverdue: { count: 0, amount: 0 },
    };

    agingData.forEach((item) => {
      aging[item._id as keyof typeof aging] = {
        count: item.count,
        amount: item.amount,
      };
      aging.totalOverdue.count += item.count;
      aging.totalOverdue.amount += item.amount;
    });

    return aging;
  }

  /**
   * Analyze payment behavior patterns
   */
  async getPaymentBehaviorAnalytics(
    filters?: any
  ): Promise<PaymentBehaviorAnalytics> {
    const matchStage = this.buildMatchStage(filters);
    const last90Days = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // On-time vs late payments
    const paymentTimingData = await Payment.aggregate([
      {
        $match: {
          ...matchStage,
          status: { $in: [PaymentStatus.PAID] },
          paidDate: { $exists: true },
          dueDate: { $gte: last90Days },
        },
      },
      {
        $addFields: {
          daysLate: {
            $max: [
              0,
              {
                $divide: [
                  { $subtract: ["$paidDate", "$dueDate"] },
                  1000 * 60 * 60 * 24,
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          onTimePayments: {
            $sum: { $cond: [{ $lte: ["$daysLate", 0] }, 1, 0] },
          },
          latePayments: {
            $sum: { $cond: [{ $gt: ["$daysLate", 0] }, 1, 0] },
          },
          averageLateDays: { $avg: "$daysLate" },
        },
      },
    ]);

    // Repeat offenders analysis
    const repeatOffendersData = await Payment.aggregate([
      {
        $match: {
          ...matchStage,
          status: { $in: [PaymentStatus.PAID] },
          paidDate: { $exists: true },
          dueDate: { $gte: last90Days },
        },
      },
      {
        $addFields: {
          daysLate: {
            $max: [
              0,
              {
                $divide: [
                  { $subtract: ["$paidDate", "$dueDate"] },
                  1000 * 60 * 60 * 24,
                ],
              },
            ],
          },
        },
      },
      {
        $match: { daysLate: { $gt: 5 } },
      },
      {
        $group: {
          _id: "$tenantId",
          latePaymentCount: { $sum: 1 },
          averageLateDays: { $avg: "$daysLate" },
        },
      },
      {
        $match: { latePaymentCount: { $gte: 2 } },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "tenant",
        },
      },
      {
        $addFields: {
          tenantName: {
            $concat: [
              { $arrayElemAt: ["$tenant.firstName", 0] },
              " ",
              { $arrayElemAt: ["$tenant.lastName", 0] },
            ],
          },
        },
      },
      {
        $sort: { latePaymentCount: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    const timing = paymentTimingData[0] || {
      onTimePayments: 0,
      latePayments: 0,
      averageLateDays: 0,
    };

    return {
      onTimePayments: timing.onTimePayments,
      latePayments: timing.latePayments,
      averageLateDays: Math.round(timing.averageLateDays * 10) / 10,
      repeatOffenders: repeatOffendersData.map((item) => ({
        tenantId: item._id.toString(),
        tenantName: item.tenantName || "Unknown",
        latePaymentCount: item.latePaymentCount,
        averageLateDays: Math.round(item.averageLateDays * 10) / 10,
      })),
      paymentMethodPreferences: await this.getPaymentMethodPreferences(filters),
      seasonalTrends: await this.getSeasonalTrends(filters),
    };
  }

  /**
   * Generate cash flow projections
   */
  async getCashFlowProjection(filters?: any): Promise<CashFlowProjection> {
    // This is a simplified projection - in reality, you'd use more sophisticated algorithms
    const collectionMetrics = await this.getCollectionMetrics(filters);
    const avgCollectionRate = collectionMetrics.currentMonth.collectionRate;

    // Get upcoming payments
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const next3Months = new Date(now.getFullYear(), now.getMonth() + 3, 1);

    const upcomingPayments = await Payment.aggregate([
      {
        $match: {
          ...this.buildMatchStage(filters),
          dueDate: { $gte: now, $lt: next3Months },
          type: "rent",
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$dueDate" },
            year: { $year: "$dueDate" },
          },
          totalExpected: { $sum: "$amount" },
        },
      },
    ]);

    const nextMonthExpected = upcomingPayments
      .filter((p) => p._id.month === nextMonth.getMonth() + 1)
      .reduce((sum, p) => sum + p.totalExpected, 0);

    const next3MonthsExpected = upcomingPayments.reduce(
      (sum, p) => sum + p.totalExpected,
      0
    );

    return {
      nextMonth: {
        expected: nextMonthExpected,
        projected: nextMonthExpected * (avgCollectionRate / 100),
        confidence:
          avgCollectionRate > 90 ? 0.95 : avgCollectionRate > 80 ? 0.85 : 0.75,
      },
      next3Months: {
        expected: next3MonthsExpected,
        projected: next3MonthsExpected * (avgCollectionRate / 100),
        confidence:
          avgCollectionRate > 90 ? 0.9 : avgCollectionRate > 80 ? 0.8 : 0.7,
      },
      riskFactors: await this.identifyRiskFactors(filters),
      opportunities: await this.identifyOpportunities(filters),
    };
  }

  /**
   * Helper methods
   */
  private buildMatchStage(filters?: any): any {
    const match: any = { deletedAt: null };

    if (filters?.propertyId) {
      match.propertyId = new mongoose.Types.ObjectId(filters.propertyId);
    }

    if (filters?.dateRange) {
      match.dueDate = {
        $gte: filters.dateRange.start,
        $lte: filters.dateRange.end,
      };
    }

    return match;
  }

  private async getLateFeeRevenue(filters?: any): Promise<number> {
    const result = await Payment.aggregate([
      {
        $match: {
          ...this.buildMatchStage(filters),
          type: "late_fee",
          status: { $in: [PaymentStatus.PAID] },
        },
      },
      {
        $group: {
          _id: null,
          totalLateFees: { $sum: "$amount" },
        },
      },
    ]);

    return result[0]?.totalLateFees || 0;
  }

  private async getVacancyImpact(filters?: any): Promise<number> {
    // Calculate lost rent due to vacancies
    // This is a simplified calculation
    return 0; // TODO: Implement vacancy impact calculation
  }

  private async getPaymentMethodPreferences(
    filters?: any
  ): Promise<Record<string, number>> {
    const result = await Payment.aggregate([
      {
        $match: {
          ...this.buildMatchStage(filters),
          status: { $in: [PaymentStatus.PAID] },
          paymentMethod: { $exists: true },
        },
      },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
        },
      },
    ]);

    const preferences: Record<string, number> = {};
    result.forEach((item) => {
      preferences[item._id] = item.count;
    });

    return preferences;
  }

  private async getSeasonalTrends(
    filters?: any
  ): Promise<
    Array<{ month: string; collectionRate: number; averageDays: number }>
  > {
    // TODO: Implement seasonal trends analysis
    return [];
  }

  private async generateAlerts(
    collectionMetrics: CollectionMetrics,
    agingReport: AgingReport,
    paymentBehavior: PaymentBehaviorAnalytics
  ): Promise<
    Array<{
      type: "warning" | "error" | "info";
      message: string;
      priority: number;
    }>
  > {
    const alerts: Array<{
      type: "warning" | "error" | "info";
      message: string;
      priority: number;
    }> = [];

    // Collection rate alerts
    if (collectionMetrics.currentMonth.collectionRate < 80) {
      alerts.push({
        type: "error",
        message: `Collection rate is critically low at ${collectionMetrics.currentMonth.collectionRate.toFixed(
          1
        )}%`,
        priority: 1,
      });
    } else if (collectionMetrics.currentMonth.collectionRate < 90) {
      alerts.push({
        type: "warning",
        message: `Collection rate is below target at ${collectionMetrics.currentMonth.collectionRate.toFixed(
          1
        )}%`,
        priority: 2,
      });
    }

    // Aging alerts
    if (agingReport.critical.amount > 0) {
      alerts.push({
        type: "error",
        message: `${formatCurrency(
          agingReport.critical.amount
        )} in critical overdue payments (90+ days)`,
        priority: 1,
      });
    }

    // Repeat offender alerts
    if (paymentBehavior.repeatOffenders.length > 0) {
      alerts.push({
        type: "warning",
        message: `${paymentBehavior.repeatOffenders.length} tenants with multiple late payments`,
        priority: 3,
      });
    }

    return alerts.sort((a, b) => a.priority - b.priority);
  }

  private async identifyRiskFactors(filters?: any): Promise<string[]> {
    // TODO: Implement risk factor identification
    return [];
  }

  private async identifyOpportunities(filters?: any): Promise<string[]> {
    // TODO: Implement opportunity identification
    return [];
  }
}

export const paymentDashboardService = new PaymentDashboardService();

/**
 * PropertyPro - Payment Analytics & Reporting Service
 * Comprehensive reporting system with KPIs, cash flow projections, and tenant payment behavior tracking
 */

import { PaymentStatus, PaymentType, IPayment, ILease } from "@/types";
import { Payment, Lease, User, Property } from "@/models";
import mongoose from "mongoose";

export interface PaymentKPIs {
  collectionRate: number;
  averageDaysLate: number;
  lateFeeRevenue: number;
  vacancyImpact: number;
  onTimePaymentRate: number;
  totalRevenue: number;
  outstandingAmount: number;
  averagePaymentAmount: number;
}

export interface CashFlowProjection {
  period: string;
  expectedIncome: number;
  projectedIncome: number;
  actualIncome: number;
  variance: number;
  confidenceLevel: number;
  riskFactors: string[];
}

export interface TenantPaymentBehavior {
  tenantId: string;
  tenantName: string;
  totalPayments: number;
  onTimePayments: number;
  latePayments: number;
  averageDaysLate: number;
  totalLateFees: number;
  paymentReliabilityScore: number;
  riskLevel: "low" | "medium" | "high";
  trends: {
    improving: boolean;
    declining: boolean;
    stable: boolean;
  };
}

export interface PropertyPerformance {
  propertyId: string;
  propertyName: string;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  collectionRate: number;
  averageRent: number;
  totalRevenue: number;
  outstandingAmount: number;
  lateFeeRevenue: number;
  performanceGrade: "A" | "B" | "C" | "D" | "F";
}

export interface PaymentTrends {
  monthly: Array<{
    month: string;
    year: number;
    totalPayments: number;
    totalAmount: number;
    collectionRate: number;
    averageDaysLate: number;
  }>;
  seasonal: Array<{
    quarter: string;
    collectionRate: number;
    averageAmount: number;
    trends: string[];
  }>;
  yearly: Array<{
    year: number;
    totalRevenue: number;
    collectionRate: number;
    growth: number;
  }>;
}

export interface AnalyticsReport {
  reportId: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  kpis: PaymentKPIs;
  cashFlowProjections: CashFlowProjection[];
  tenantBehavior: TenantPaymentBehavior[];
  propertyPerformance: PropertyPerformance[];
  paymentTrends: PaymentTrends;
  insights: string[];
  recommendations: string[];
}

export class PaymentAnalyticsService {
  /**
   * Generate comprehensive analytics report
   */
  async generateAnalyticsReport(
    startDate: Date,
    endDate: Date,
    filters?: {
      propertyId?: string;
      managerId?: string;
      tenantId?: string;
    }
  ): Promise<AnalyticsReport> {
    const reportId = new mongoose.Types.ObjectId().toString();

    const [
      kpis,
      cashFlowProjections,
      tenantBehavior,
      propertyPerformance,
      paymentTrends,
    ] = await Promise.all([
      this.calculateKPIs(startDate, endDate, filters),
      this.generateCashFlowProjections(startDate, endDate, filters),
      this.analyzeTenantPaymentBehavior(startDate, endDate, filters),
      this.analyzePropertyPerformance(startDate, endDate, filters),
      this.analyzePaymentTrends(startDate, endDate, filters),
    ]);

    const insights = this.generateInsights(
      kpis,
      tenantBehavior,
      propertyPerformance,
      paymentTrends
    );
    const recommendations = this.generateRecommendations(
      kpis,
      tenantBehavior,
      propertyPerformance
    );

    return {
      reportId,
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      kpis,
      cashFlowProjections,
      tenantBehavior,
      propertyPerformance,
      paymentTrends,
      insights,
      recommendations,
    };
  }

  /**
   * Calculate key performance indicators
   */
  async calculateKPIs(
    startDate: Date,
    endDate: Date,
    filters?: any
  ): Promise<PaymentKPIs> {
    const matchStage = this.buildMatchStage(startDate, endDate, filters);

    const kpiData = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          paidAmount: {
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
          outstandingAmount: {
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
          lateFeeRevenue: {
            $sum: {
              $cond: [{ $eq: ["$type", PaymentType.LATE_FEE] }, "$amount", 0],
            },
          },
          onTimePayments: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $in: [
                        "$status",
                        [PaymentStatus.PAID],
                      ],
                    },
                    { $lte: ["$paidDate", "$dueDate"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          latePayments: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $in: [
                        "$status",
                        [PaymentStatus.PAID],
                      ],
                    },
                    { $gt: ["$paidDate", "$dueDate"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          totalDaysLate: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $in: [
                        "$status",
                        [PaymentStatus.PAID],
                      ],
                    },
                    { $gt: ["$paidDate", "$dueDate"] },
                  ],
                },
                {
                  $divide: [
                    { $subtract: ["$paidDate", "$dueDate"] },
                    1000 * 60 * 60 * 24,
                  ],
                },
                0,
              ],
            },
          },
        },
      },
    ]);

    const data = kpiData[0] || {};
    const paidPayments = (data.onTimePayments || 0) + (data.latePayments || 0);

    return {
      collectionRate:
        data.totalAmount > 0 ? (data.paidAmount / data.totalAmount) * 100 : 0,
      averageDaysLate:
        data.latePayments > 0 ? data.totalDaysLate / data.latePayments : 0,
      lateFeeRevenue: data.lateFeeRevenue || 0,
      vacancyImpact: await this.calculateVacancyImpact(
        startDate,
        endDate,
        filters
      ),
      onTimePaymentRate:
        paidPayments > 0 ? (data.onTimePayments / paidPayments) * 100 : 0,
      totalRevenue: data.paidAmount || 0,
      outstandingAmount: data.outstandingAmount || 0,
      averagePaymentAmount:
        data.totalPayments > 0 ? data.totalAmount / data.totalPayments : 0,
    };
  }

  /**
   * Generate cash flow projections
   */
  async generateCashFlowProjections(
    startDate: Date,
    endDate: Date,
    filters?: any
  ): Promise<CashFlowProjection[]> {
    const projections: CashFlowProjection[] = [];
    const now = new Date();

    // Generate projections for next 6 months
    for (let i = 0; i < 6; i++) {
      const projectionDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthEnd = new Date(
        projectionDate.getFullYear(),
        projectionDate.getMonth() + 1,
        0
      );

      const matchStage = {
        ...this.buildMatchStage(projectionDate, monthEnd, filters),
        type: PaymentType.RENT,
      };

      const monthlyData = await Payment.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            expectedIncome: { $sum: "$amount" },
            actualIncome: {
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

      const data = monthlyData[0] || { expectedIncome: 0, actualIncome: 0 };
      const historicalCollectionRate = await this.getHistoricalCollectionRate(
        filters
      );
      const projectedIncome =
        data.expectedIncome * (historicalCollectionRate / 100);

      projections.push({
        period: projectionDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
        }),
        expectedIncome: data.expectedIncome,
        projectedIncome,
        actualIncome: projectionDate <= now ? data.actualIncome : 0,
        variance:
          projectionDate <= now ? data.actualIncome - projectedIncome : 0,
        confidenceLevel: this.calculateConfidenceLevel(
          historicalCollectionRate
        ),
        riskFactors: await this.identifyRiskFactors(projectionDate, filters),
      });
    }

    return projections;
  }

  /**
   * Analyze tenant payment behavior
   */
  async analyzeTenantPaymentBehavior(
    startDate: Date,
    endDate: Date,
    filters?: any
  ): Promise<TenantPaymentBehavior[]> {
    const matchStage = this.buildMatchStage(startDate, endDate, filters);

    const tenantData = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$tenantId",
          totalPayments: { $sum: 1 },
          onTimePayments: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $in: [
                        "$status",
                        [PaymentStatus.PAID],
                      ],
                    },
                    { $lte: ["$paidDate", "$dueDate"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          latePayments: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $in: [
                        "$status",
                        [PaymentStatus.PAID],
                      ],
                    },
                    { $gt: ["$paidDate", "$dueDate"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          totalDaysLate: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $in: [
                        "$status",
                        [PaymentStatus.PAID],
                      ],
                    },
                    { $gt: ["$paidDate", "$dueDate"] },
                  ],
                },
                {
                  $divide: [
                    { $subtract: ["$paidDate", "$dueDate"] },
                    1000 * 60 * 60 * 24,
                  ],
                },
                0,
              ],
            },
          },
          totalLateFees: {
            $sum: {
              $cond: [{ $eq: ["$type", PaymentType.LATE_FEE] }, "$amount", 0],
            },
          },
        },
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
    ]);

    return tenantData.map((data) => {
      const averageDaysLate =
        data.latePayments > 0 ? data.totalDaysLate / data.latePayments : 0;
      const onTimeRate =
        data.totalPayments > 0
          ? (data.onTimePayments / data.totalPayments) * 100
          : 0;
      const paymentReliabilityScore = this.calculateReliabilityScore(
        onTimeRate,
        averageDaysLate,
        data.totalLateFees
      );

      return {
        tenantId: data._id.toString(),
        tenantName: data.tenantName || "Unknown",
        totalPayments: data.totalPayments,
        onTimePayments: data.onTimePayments,
        latePayments: data.latePayments,
        averageDaysLate: Math.round(averageDaysLate * 10) / 10,
        totalLateFees: data.totalLateFees,
        paymentReliabilityScore,
        riskLevel: this.determineRiskLevel(paymentReliabilityScore),
        trends: {
          improving: false, // TODO: Implement trend analysis
          declining: false,
          stable: true,
        },
      };
    });
  }

  /**
   * Analyze property performance
   */
  async analyzePropertyPerformance(
    startDate: Date,
    endDate: Date,
    filters?: any
  ): Promise<PropertyPerformance[]> {
    const matchStage = this.buildMatchStage(startDate, endDate, filters);

    const propertyData = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$propertyId",
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          paidAmount: {
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
          outstandingAmount: {
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
          lateFeeRevenue: {
            $sum: {
              $cond: [{ $eq: ["$type", PaymentType.LATE_FEE] }, "$amount", 0],
            },
          },
        },
      },
      {
        $lookup: {
          from: "properties",
          localField: "_id",
          foreignField: "_id",
          as: "property",
        },
      },
    ]);

    return propertyData.map((data) => {
      const property = data.property[0] || {};
      const collectionRate =
        data.totalAmount > 0 ? (data.paidAmount / data.totalAmount) * 100 : 0;
      const averageRent =
        data.totalPayments > 0 ? data.totalAmount / data.totalPayments : 0;

      return {
        propertyId: data._id.toString(),
        propertyName: property.name || "Unknown Property",
        totalUnits: property.totalUnits || 0,
        occupiedUnits: property.occupiedUnits || 0,
        occupancyRate:
          property.totalUnits > 0
            ? (property.occupiedUnits / property.totalUnits) * 100
            : 0,
        collectionRate,
        averageRent,
        totalRevenue: data.paidAmount,
        outstandingAmount: data.outstandingAmount,
        lateFeeRevenue: data.lateFeeRevenue,
        performanceGrade: this.calculatePerformanceGrade(
          collectionRate,
          property.occupancyRate || 0
        ),
      };
    });
  }

  /**
   * Analyze payment trends
   */
  async analyzePaymentTrends(
    startDate: Date,
    endDate: Date,
    filters?: any
  ): Promise<PaymentTrends> {
    // Monthly trends
    const monthlyTrends = await Payment.aggregate([
      { $match: this.buildMatchStage(startDate, endDate, filters) },
      {
        $group: {
          _id: {
            year: { $year: "$dueDate" },
            month: { $month: "$dueDate" },
          },
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          paidAmount: {
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
          totalDaysLate: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $in: [
                        "$status",
                        [PaymentStatus.PAID],
                      ],
                    },
                    { $gt: ["$paidDate", "$dueDate"] },
                  ],
                },
                {
                  $divide: [
                    { $subtract: ["$paidDate", "$dueDate"] },
                    1000 * 60 * 60 * 24,
                  ],
                },
                0,
              ],
            },
          },
          latePayments: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $in: [
                        "$status",
                        [PaymentStatus.PAID],
                      ],
                    },
                    { $gt: ["$paidDate", "$dueDate"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const monthly = monthlyTrends.map((trend) => ({
      month: new Date(trend._id.year, trend._id.month - 1).toLocaleDateString(
        "en-US",
        { month: "long" }
      ),
      year: trend._id.year,
      totalPayments: trend.totalPayments,
      totalAmount: trend.totalAmount,
      collectionRate:
        trend.totalAmount > 0
          ? (trend.paidAmount / trend.totalAmount) * 100
          : 0,
      averageDaysLate:
        trend.latePayments > 0 ? trend.totalDaysLate / trend.latePayments : 0,
    }));

    return {
      monthly,
      seasonal: [], // TODO: Implement seasonal analysis
      yearly: [], // TODO: Implement yearly analysis
    };
  }

  /**
   * Helper methods
   */
  private buildMatchStage(startDate: Date, endDate: Date, filters?: any): any {
    const match: any = {
      dueDate: { $gte: startDate, $lte: endDate },
      deletedAt: null,
    };

    if (filters?.propertyId) {
      match.propertyId = new mongoose.Types.ObjectId(filters.propertyId);
    }
    if (filters?.tenantId) {
      match.tenantId = new mongoose.Types.ObjectId(filters.tenantId);
    }

    return match;
  }

  private async calculateVacancyImpact(
    startDate: Date,
    endDate: Date,
    filters?: any
  ): Promise<number> {
    // TODO: Implement vacancy impact calculation
    return 0;
  }

  private async getHistoricalCollectionRate(filters?: any): Promise<number> {
    // TODO: Implement historical collection rate calculation
    return 85; // Default 85% collection rate
  }

  private calculateConfidenceLevel(collectionRate: number): number {
    if (collectionRate >= 95) return 0.95;
    if (collectionRate >= 90) return 0.9;
    if (collectionRate >= 85) return 0.85;
    if (collectionRate >= 80) return 0.8;
    return 0.75;
  }

  private async identifyRiskFactors(
    date: Date,
    filters?: any
  ): Promise<string[]> {
    // TODO: Implement risk factor identification
    return [];
  }

  private calculateReliabilityScore(
    onTimeRate: number,
    avgDaysLate: number,
    lateFees: number
  ): number {
    let score = onTimeRate;
    score -= avgDaysLate * 2; // Penalty for late payments
    score -= (lateFees / 100) * 5; // Penalty for late fees
    return Math.max(0, Math.min(100, score));
  }

  private determineRiskLevel(score: number): "low" | "medium" | "high" {
    if (score >= 80) return "low";
    if (score >= 60) return "medium";
    return "high";
  }

  private calculatePerformanceGrade(
    collectionRate: number,
    occupancyRate: number
  ): "A" | "B" | "C" | "D" | "F" {
    const combinedScore = (collectionRate + occupancyRate) / 2;
    if (combinedScore >= 90) return "A";
    if (combinedScore >= 80) return "B";
    if (combinedScore >= 70) return "C";
    if (combinedScore >= 60) return "D";
    return "F";
  }

  private generateInsights(
    kpis: PaymentKPIs,
    tenantBehavior: TenantPaymentBehavior[],
    propertyPerformance: PropertyPerformance[],
    trends: PaymentTrends
  ): string[] {
    const insights: string[] = [];

    if (kpis.collectionRate < 85) {
      insights.push(
        `Collection rate of ${kpis.collectionRate.toFixed(
          1
        )}% is below industry standard of 85%`
      );
    }

    const highRiskTenants = tenantBehavior.filter(
      (t) => t.riskLevel === "high"
    ).length;
    if (highRiskTenants > 0) {
      insights.push(
        `${highRiskTenants} tenants identified as high-risk for payment issues`
      );
    }

    if (kpis.lateFeeRevenue > kpis.totalRevenue * 0.05) {
      insights.push(
        "Late fee revenue exceeds 5% of total revenue, indicating payment timing issues"
      );
    }

    return insights;
  }

  private generateRecommendations(
    kpis: PaymentKPIs,
    tenantBehavior: TenantPaymentBehavior[],
    propertyPerformance: PropertyPerformance[]
  ): string[] {
    const recommendations: string[] = [];

    if (kpis.collectionRate < 90) {
      recommendations.push(
        "Implement automated payment reminders to improve collection rates"
      );
    }

    if (kpis.averageDaysLate > 7) {
      recommendations.push(
        "Consider reducing grace period or increasing late fee penalties"
      );
    }

    const poorPerformingProperties = propertyPerformance.filter(
      (p) => p.performanceGrade === "D" || p.performanceGrade === "F"
    );
    if (poorPerformingProperties.length > 0) {
      recommendations.push(
        `Focus on improving management of ${poorPerformingProperties.length} underperforming properties`
      );
    }

    return recommendations;
  }
}

export const paymentAnalyticsService = new PaymentAnalyticsService();

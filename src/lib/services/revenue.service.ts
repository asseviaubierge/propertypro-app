/**
 * PropertyPro - Revenue Service
 * Read-only aggregation of income from Payments and Invoices
 */

import { Types } from "mongoose";
import { Payment, Invoice } from "@/models";
import { PaymentStatus, PaymentType, InvoiceStatus } from "@/types";

export interface RevenueSummary {
  totalRevenue: number;
  totalCollected: number;
  totalOutstanding: number;
  monthToDate: number;
  yearToDate: number;
  collectionRate: number;
  count: number;
}

export interface RevenueByCategory {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface RevenueByProperty {
  propertyId: string;
  propertyName: string;
  revenue: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
}

export interface MonthlyRevenue {
  year: number;
  month: number;
  revenue: number;
  collected: number;
  count: number;
}

export class RevenueService {
  /**
   * Get revenue summary stats
   */
  async getRevenueSummary(propertyId?: string): Promise<RevenueSummary> {
    const baseMatch: any = {};
    if (propertyId) {
      baseMatch.propertyId = new Types.ObjectId(propertyId);
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const completedStatuses = [PaymentStatus.PAID];
    const outstandingStatuses = [
      PaymentStatus.PENDING,
      PaymentStatus.OVERDUE,
      PaymentStatus.PARTIAL,
    ];

    const [collected, outstanding, mtd, ytd, totalCount] = await Promise.all([
      Payment.aggregate([
        { $match: { ...baseMatch, status: { $in: completedStatuses } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        { $match: { ...baseMatch, status: { $in: outstandingStatuses } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        {
          $match: {
            ...baseMatch,
            status: { $in: completedStatuses },
            paidDate: { $gte: startOfMonth },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        {
          $match: {
            ...baseMatch,
            status: { $in: completedStatuses },
            paidDate: { $gte: startOfYear },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.countDocuments(baseMatch),
    ]);

    const totalCollected = collected[0]?.total || 0;
    const totalOutstanding = outstanding[0]?.total || 0;
    const totalRevenue = totalCollected + totalOutstanding;
    const collectionRate =
      totalRevenue > 0 ? (totalCollected / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCollected,
      totalOutstanding,
      monthToDate: mtd[0]?.total || 0,
      yearToDate: ytd[0]?.total || 0,
      collectionRate: Math.round(collectionRate * 100) / 100,
      count: totalCount,
    };
  }

  /**
   * Get revenue breakdown by category (rent, late fee, deposit, etc.)
   */
  async getRevenueByCategory(
    startDate?: Date,
    endDate?: Date,
    propertyId?: string
  ): Promise<RevenueByCategory[]> {
    const match: any = {
      status: { $in: [PaymentStatus.PAID] },
    };
    if (propertyId) match.propertyId = new Types.ObjectId(propertyId);
    if (startDate || endDate) {
      match.paidDate = {};
      if (startDate) match.paidDate.$gte = startDate;
      if (endDate) match.paidDate.$lte = endDate;
    }

    const result = await Payment.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$type",
          amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { amount: -1 } },
    ]);

    const totalAmount = result.reduce((sum, r) => sum + r.amount, 0);

    return result.map((r) => ({
      category: r._id,
      amount: r.amount,
      count: r.count,
      percentage:
        totalAmount > 0
          ? Math.round((r.amount / totalAmount) * 10000) / 100
          : 0,
    }));
  }

  /**
   * Get revenue by property
   */
  async getRevenueByProperty(
    startDate?: Date,
    endDate?: Date
  ): Promise<RevenueByProperty[]> {
    const completedStatuses = [PaymentStatus.PAID];
    const outstandingStatuses = [
      PaymentStatus.PENDING,
      PaymentStatus.OVERDUE,
      PaymentStatus.OVERDUE,
      PaymentStatus.OVERDUE,
    ];

    const dateMatch: any = {};
    if (startDate || endDate) {
      dateMatch.createdAt = {};
      if (startDate) dateMatch.createdAt.$gte = startDate;
      if (endDate) dateMatch.createdAt.$lte = endDate;
    }

    const result = await Payment.aggregate([
      { $match: { ...dateMatch, propertyId: { $exists: true } } },
      {
        $lookup: {
          from: "properties",
          localField: "propertyId",
          foreignField: "_id",
          as: "property",
        },
      },
      { $unwind: "$property" },
      {
        $group: {
          _id: "$propertyId",
          propertyName: { $first: "$property.name" },
          revenue: { $sum: "$amount" },
          collected: {
            $sum: {
              $cond: [
                { $in: ["$status", completedStatuses] },
                "$amount",
                0,
              ],
            },
          },
          outstanding: {
            $sum: {
              $cond: [
                { $in: ["$status", outstandingStatuses] },
                "$amount",
                0,
              ],
            },
          },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    return result.map((r) => ({
      propertyId: r._id.toString(),
      propertyName: r.propertyName,
      revenue: r.revenue,
      collected: r.collected,
      outstanding: r.outstanding,
      collectionRate:
        r.revenue > 0
          ? Math.round((r.collected / r.revenue) * 10000) / 100
          : 0,
    }));
  }

  /**
   * Get monthly revenue trends
   */
  async getMonthlyRevenue(
    months: number = 12,
    propertyId?: string
  ): Promise<MonthlyRevenue[]> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const match: any = { createdAt: { $gte: startDate } };
    if (propertyId) match.propertyId = new Types.ObjectId(propertyId);

    const completedStatuses = [PaymentStatus.PAID];

    return Payment.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          revenue: { $sum: "$amount" },
          collected: {
            $sum: {
              $cond: [
                { $in: ["$status", completedStatuses] },
                "$amount",
                0,
              ],
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          revenue: 1,
          collected: 1,
          count: 1,
        },
      },
    ]);
  }
}

export const revenueService = new RevenueService();

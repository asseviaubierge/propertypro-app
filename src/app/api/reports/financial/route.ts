/**
 * PropertyPro - Financial Reports API
 * Income & Expense Summary, Rent Roll, Collections
 */

import { NextRequest } from "next/server";
import { Payment, Property, Lease, Expense } from "@/models";
import {
  PaymentStatus,
  PaymentType,
  ExpenseStatus,
  LeaseStatus,
} from "@/types";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const GET = withPermissionAndDB("financial_reports")(
  async (_user: any, request: NextRequest) => {
    try {
      const { searchParams } = request.nextUrl;
      const reportType = searchParams.get("type") || "income-expense";
      const startParam = searchParams.get("startDate");
      const endParam = searchParams.get("endDate");
      const startDate = startParam
        ? new Date(startParam)
        : new Date(new Date().getFullYear(), 0, 1);
      const endDate = endParam ? new Date(endParam) : new Date();
      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        return createErrorResponse("Invalid date range provided", 400);
      }
      const propertyId = searchParams.get("propertyId");

      switch (reportType) {
        case "income-expense":
          return await generateIncomeExpenseReport(
            startDate,
            endDate,
            propertyId
          );
        case "rent-roll":
          return await generateRentRollReport(propertyId);
        case "collections":
          return await generateCollectionsReport(
            startDate,
            endDate,
            propertyId
          );
        default:
          return createErrorResponse(
            "Invalid report type. Valid types: income-expense, rent-roll, collections",
            400
          );
      }
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// INCOME & EXPENSE SUMMARY REPORT
// ============================================================================

async function generateIncomeExpenseReport(
  startDate: Date,
  endDate: Date,
  propertyId: string | null
) {
  const paymentMatch: any = {
    deletedAt: null,
    status: PaymentStatus.PAID,
    $or: [
      { paidDate: { $gte: startDate, $lte: endDate } },
      {
        paidDate: null,
        dueDate: { $gte: startDate, $lte: endDate },
      },
    ],
  };

  const expenseMatch: any = {
    deletedAt: null,
    status: { $in: [ExpenseStatus.PAID, ExpenseStatus.APPROVED] },
    date: { $gte: startDate, $lte: endDate },
  };

  if (propertyId) {
    paymentMatch.propertyId = propertyId;
    expenseMatch.propertyId = propertyId;
  }

  // Run income and expense aggregations in parallel
  const [incomeByCategory, incomeByProperty, monthlyIncome, expenseByCategory, expenseByProperty, monthlyExpenses] =
    await Promise.all([
      // Income grouped by payment type
      Payment.aggregate([
        { $match: paymentMatch },
        {
          $group: {
            _id: "$type",
            amount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { amount: -1 } },
      ]),

      // Income grouped by property
      Payment.aggregate([
        { $match: paymentMatch },
        {
          $lookup: {
            from: "properties",
            localField: "propertyId",
            foreignField: "_id",
            as: "property",
          },
        },
        { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$propertyId",
            propertyName: { $first: { $ifNull: ["$property.name", "Unassigned"] } },
            amount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { amount: -1 } },
      ]),

      // Monthly income trend
      Payment.aggregate([
        { $match: paymentMatch },
        {
          $group: {
            _id: {
              year: { $year: { $ifNull: ["$paidDate", "$dueDate"] } },
              month: { $month: { $ifNull: ["$paidDate", "$dueDate"] } },
            },
            amount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      // Expenses grouped by category
      Expense.aggregate([
        { $match: expenseMatch },
        {
          $group: {
            _id: "$category",
            amount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { amount: -1 } },
      ]),

      // Expenses grouped by property
      Expense.aggregate([
        { $match: expenseMatch },
        {
          $lookup: {
            from: "properties",
            localField: "propertyId",
            foreignField: "_id",
            as: "property",
          },
        },
        { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$propertyId",
            propertyName: { $first: { $ifNull: ["$property.name", "Unassigned"] } },
            amount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { amount: -1 } },
      ]),

      // Monthly expense trend
      Expense.aggregate([
        { $match: expenseMatch },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
            },
            amount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

  const totalIncome = incomeByCategory.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenseByCategory.reduce((s, r) => s + r.amount, 0);
  const netIncome = totalIncome - totalExpenses;

  // Build unified monthly trend
  const incomeMap = new Map<string, number>();
  for (const m of monthlyIncome) {
    incomeMap.set(`${m._id.year}-${m._id.month}`, m.amount);
  }
  const expenseMap = new Map<string, number>();
  for (const m of monthlyExpenses) {
    expenseMap.set(`${m._id.year}-${m._id.month}`, m.amount);
  }

  const monthlyTrend: Array<{
    month: string;
    year: number;
    income: number;
    expenses: number;
    net: number;
  }> = [];

  // Generate all months in range
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (cursor <= endDate) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}`;
    const income = incomeMap.get(key) || 0;
    const expenses = expenseMap.get(key) || 0;
    monthlyTrend.push({
      month: MONTH_LABELS[cursor.getMonth()],
      year: cursor.getFullYear(),
      income,
      expenses,
      net: income - expenses,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return createSuccessResponse(
    {
      summary: {
        totalIncome,
        totalExpenses,
        netIncome,
        profitMargin:
          totalIncome > 0
            ? Math.round((netIncome / totalIncome) * 10000) / 100
            : 0,
      },
      incomeByCategory,
      incomeByProperty,
      expenseByCategory,
      expenseByProperty,
      monthlyTrend,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    },
    "Income & expense report generated successfully"
  );
}

// ============================================================================
// RENT ROLL REPORT
// ============================================================================

async function generateRentRollReport(propertyId: string | null) {
  const leaseMatch: any = {
    status: LeaseStatus.ACTIVE,
    deletedAt: null,
  };

  if (propertyId) {
    leaseMatch.propertyId = propertyId;
  }

  const rentRoll = await Lease.aggregate([
    { $match: leaseMatch },
    {
      $lookup: {
        from: "properties",
        localField: "propertyId",
        foreignField: "_id",
        as: "property",
      },
    },
    { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "users",
        localField: "tenantId",
        foreignField: "_id",
        as: "tenant",
      },
    },
    { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        propertyId: 1,
        propertyName: { $ifNull: ["$property.name", "Unknown"] },
        unitId: 1,
        tenantName: {
          $concat: [
            { $ifNull: ["$tenant.firstName", ""] },
            " ",
            { $ifNull: ["$tenant.lastName", ""] },
          ],
        },
        tenantEmail: "$tenant.email",
        startDate: 1,
        endDate: 1,
        rentAmount: "$terms.rentAmount",
        securityDeposit: "$terms.securityDeposit",
        paymentFrequency: "$terms.paymentFrequency",
        status: 1,
      },
    },
    { $sort: { propertyName: 1, unitId: 1 } },
  ]);

  const totals = rentRoll.reduce(
    (acc, lease) => ({
      totalUnits: acc.totalUnits + 1,
      totalMonthlyRent: acc.totalMonthlyRent + (lease.rentAmount || 0),
      totalDeposits: acc.totalDeposits + (lease.securityDeposit || 0),
    }),
    { totalUnits: 0, totalMonthlyRent: 0, totalDeposits: 0 }
  );

  return createSuccessResponse(
    {
      rentRoll,
      totals: {
        ...totals,
        annualizedRent: totals.totalMonthlyRent * 12,
      },
      generatedAt: new Date().toISOString(),
    },
    "Rent roll report generated successfully"
  );
}

// ============================================================================
// COLLECTIONS REPORT
// ============================================================================

async function generateCollectionsReport(
  startDate: Date,
  endDate: Date,
  propertyId: string | null
) {
  const baseMatch: any = {
    deletedAt: null,
    dueDate: { $gte: startDate, $lte: endDate },
  };

  if (propertyId) {
    baseMatch.propertyId = propertyId;
  }

  const [collectionsByProperty, overdueAging, collectionSummary] =
    await Promise.all([
      // Collection rates by property
      Payment.aggregate([
        { $match: baseMatch },
        {
          $lookup: {
            from: "properties",
            localField: "propertyId",
            foreignField: "_id",
            as: "property",
          },
        },
        { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$propertyId",
            propertyName: {
              $first: { $ifNull: ["$property.name", "Unassigned"] },
            },
            totalDue: { $sum: "$amount" },
            collected: {
              $sum: {
                $cond: [
                  { $eq: ["$status", PaymentStatus.PAID] },
                  "$amount",
                  0,
                ],
              },
            },
            collectedCount: {
              $sum: {
                $cond: [{ $eq: ["$status", PaymentStatus.PAID] }, 1, 0],
              },
            },
            overdueAmount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$status", PaymentStatus.PAID] },
                      { $lt: ["$dueDate", new Date()] },
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
            totalCount: { $sum: 1 },
          },
        },
        {
          $addFields: {
            collectionRate: {
              $cond: [
                { $gt: ["$totalDue", 0] },
                {
                  $round: [
                    {
                      $multiply: [
                        { $divide: ["$collected", "$totalDue"] },
                        100,
                      ],
                    },
                    1,
                  ],
                },
                0,
              ],
            },
          },
        },
        { $sort: { collectionRate: -1 } },
      ]),

      // Overdue aging buckets
      Payment.aggregate([
        {
          $match: {
            ...baseMatch,
            status: {
              $in: [
                PaymentStatus.PENDING,
                PaymentStatus.OVERDUE,
                PaymentStatus.FAILED,
              ],
            },
            dueDate: { $lt: new Date() },
          },
        },
        {
          $addFields: {
            daysOverdue: {
              $divide: [
                { $subtract: [new Date(), "$dueDate"] },
                86400000, // ms in a day
              ],
            },
          },
        },
        {
          $bucket: {
            groupBy: "$daysOverdue",
            boundaries: [0, 30, 60, 90, 180, Infinity],
            default: "180+",
            output: {
              count: { $sum: 1 },
              totalAmount: { $sum: "$amount" },
            },
          },
        },
      ]),

      // Overall collection summary
      Payment.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalDue: { $sum: "$amount" },
            collected: {
              $sum: {
                $cond: [
                  { $eq: ["$status", PaymentStatus.PAID] },
                  "$amount",
                  0,
                ],
              },
            },
            pending: {
              $sum: {
                $cond: [
                  { $eq: ["$status", PaymentStatus.PENDING] },
                  "$amount",
                  0,
                ],
              },
            },
            overdue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$status", PaymentStatus.PAID] },
                      { $lt: ["$dueDate", new Date()] },
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
            totalCount: { $sum: 1 },
            paidCount: {
              $sum: {
                $cond: [{ $eq: ["$status", PaymentStatus.PAID] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

  const summary = collectionSummary[0] || {
    totalDue: 0,
    collected: 0,
    pending: 0,
    overdue: 0,
    totalCount: 0,
    paidCount: 0,
  };

  // Map aging bucket boundaries to labels
  const agingLabels: Record<string, string> = {
    "0": "0-30 days",
    "30": "30-60 days",
    "60": "60-90 days",
    "90": "90-180 days",
    "180": "180+ days",
    "180+": "180+ days",
  };

  const overdueAgingFormatted = overdueAging.map((bucket) => ({
    range: agingLabels[String(bucket._id)] || `${bucket._id}+ days`,
    count: bucket.count,
    amount: bucket.totalAmount,
  }));

  return createSuccessResponse(
    {
      summary: {
        ...summary,
        collectionRate:
          summary.totalDue > 0
            ? Math.round((summary.collected / summary.totalDue) * 10000) / 100
            : 0,
      },
      collectionsByProperty,
      overdueAging: overdueAgingFormatted,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    },
    "Collections report generated successfully"
  );
}

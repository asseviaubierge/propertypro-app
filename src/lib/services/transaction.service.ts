/**
 * PropertyPro - Unified Transaction Service
 * Aggregates data from Payment, Invoice, Expense collections
 * using MongoDB aggregation pipelines for performance
 */

import { Types } from "mongoose";
import { Payment } from "@/models";
import {
  PaymentStatus,
  PaymentType,
  InvoiceStatus,
  TransactionType,
  ExpenseStatus,
} from "@/types";
import type { IUnifiedTransaction, ITransactionSummary } from "@/types";

export interface TransactionQueryParams {
  page: number;
  limit: number;
  search?: string;
  type?: TransactionType;
  category?: string;
  propertyId?: string;
  tenantId?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  bankOnly?: boolean;
}

export interface TransactionListResult {
  transactions: IUnifiedTransaction[];
  summary: ITransactionSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function getPaymentDescription(payment: any): string {
  const typeLabels: Record<string, string> = {
    [PaymentType.RENT]: "Rent Payment",
    [PaymentType.SECURITY_DEPOSIT]: "Security Deposit",
    [PaymentType.LATE_FEE]: "Late Fee",
    [PaymentType.PET_DEPOSIT]: "Pet Deposit",
    [PaymentType.UTILITY]: "Utility Payment",
    [PaymentType.MAINTENANCE]: "Maintenance Payment",
    [PaymentType.INVOICE]: "Invoice Payment",
    [PaymentType.OTHER]: "Other Payment",
  };
  return typeLabels[payment.type] || "Payment";
}

export class TransactionService {
  /**
   * Build MongoDB match stage from query params for payments
   */
  private buildPaymentMatch(params: TransactionQueryParams): any {
    const match: any = { deletedAt: null };
    if (params.propertyId)
      match.propertyId = new Types.ObjectId(params.propertyId);
    if (params.tenantId)
      match.tenantId = new Types.ObjectId(params.tenantId);
    if (params.bankOnly) {
      match.status = PaymentStatus.PAID;
    }
    if (params.startDate || params.endDate) {
      const dateField = params.bankOnly ? "paidDate" : "createdAt";
      match[dateField] = {};
      if (params.startDate) match[dateField].$gte = new Date(params.startDate);
      if (params.endDate) match[dateField].$lte = new Date(params.endDate);
    }
    return match;
  }

  /**
   * Build MongoDB match stage for invoices
   */
  private buildInvoiceMatch(params: TransactionQueryParams): any {
    const match: any = { deletedAt: null };
    if (params.propertyId)
      match.propertyId = new Types.ObjectId(params.propertyId);
    if (params.tenantId)
      match.tenantId = new Types.ObjectId(params.tenantId);
    if (params.startDate || params.endDate) {
      match.createdAt = {};
      if (params.startDate) match.createdAt.$gte = new Date(params.startDate);
      if (params.endDate) match.createdAt.$lte = new Date(params.endDate);
    }
    return match;
  }

  /**
   * Build MongoDB match stage for expenses
   */
  private buildExpenseMatch(params: TransactionQueryParams): any {
    const match: any = { deletedAt: null };
    if (params.propertyId)
      match.propertyId = new Types.ObjectId(params.propertyId);
    if (params.bankOnly) {
      match.status = ExpenseStatus.PAID;
    }
    if (params.startDate || params.endDate) {
      match.date = {};
      if (params.startDate) match.date.$gte = new Date(params.startDate);
      if (params.endDate) match.date.$lte = new Date(params.endDate);
    }
    return match;
  }

  /**
   * Get unified transactions using MongoDB aggregation pipeline
   */
  async getUnifiedTransactions(
    params: TransactionQueryParams
  ): Promise<TransactionListResult> {
    const {
      page = 1,
      limit = 12,
      search,
      type,
      category,
      sortBy = "date",
      sortOrder = "desc",
      bankOnly = false,
    } = params;

    const isIncomeOnly = type === TransactionType.INCOME;
    const isExpenseOnly = type === TransactionType.EXPENSE;
    const skip = (page - 1) * limit;

    // Tenant-scoped views should never expose global property expenses.
    if (isExpenseOnly && params.tenantId) {
      return {
        transactions: [],
        summary: {
          totalIncome: 0,
          totalExpenses: 0,
          netAmount: 0,
          outstanding: 0,
          transactionCount: 0,
        },
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    // Build the unified aggregation pipeline using $unionWith
    const pipeline: any[] = [];

    // Start with payments (unless expense-only)
    if (!isExpenseOnly) {
      pipeline.push(
        { $match: this.buildPaymentMatch(params) },
        {
          $lookup: {
            from: "users",
            localField: "tenantId",
            foreignField: "_id",
            as: "_tenant",
            pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }],
          },
        },
        {
          $lookup: {
            from: "properties",
            localField: "propertyId",
            foreignField: "_id",
            as: "_property",
            pipeline: [{ $project: { name: 1 } }],
          },
        },
        {
          $project: {
            _txDate: bankOnly
              ? { $ifNull: ["$paidDate", "$createdAt"] }
              : { $ifNull: ["$paidDate", { $ifNull: ["$dueDate", "$createdAt"] }] },
            _txType: "income",
            _txCategory: { $ifNull: ["$type", "rent"] },
            _txDescription: { $ifNull: ["$type", "Payment"] },
            _txReference: {
              $ifNull: [
                "$stripePaymentIntentId",
                { $concat: ["PAY-", { $substr: [{ $toString: "$_id" }, 18, 6] }] },
              ],
            },
            _txAmount: { $ifNull: ["$amount", 0] },
            _txStatus: "$status",
            _txSourceType: "payment",
            _txSourceId: { $toString: "$_id" },
            _tenant: { $arrayElemAt: ["$_tenant", 0] },
            _property: { $arrayElemAt: ["$_property", 0] },
          },
        }
      );
    }

    // Union with invoices (unless expense-only)
    if (!isExpenseOnly && !bankOnly) {
      const invoiceStages = [
        { $match: this.buildInvoiceMatch(params) },
        {
          $lookup: {
            from: "users",
            localField: "tenantId",
            foreignField: "_id",
            as: "_tenant",
            pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }],
          },
        },
        {
          $lookup: {
            from: "properties",
            localField: "propertyId",
            foreignField: "_id",
            as: "_property",
            pipeline: [{ $project: { name: 1 } }],
          },
        },
        {
          $project: {
            _txDate: { $ifNull: ["$issueDate", "$createdAt"] },
            _txType: "income",
            _txCategory: {
              $ifNull: [{ $arrayElemAt: ["$lineItems.type", 0] }, "rent"],
            },
            _txDescription: {
              $concat: [
                "Invoice ",
                { $ifNull: ["$invoiceNumber", { $concat: ["INV-", { $substr: [{ $toString: "$_id" }, 18, 6] }] }] },
              ],
            },
            _txReference: {
              $ifNull: [
                "$invoiceNumber",
                { $concat: ["INV-", { $substr: [{ $toString: "$_id" }, 18, 6] }] },
              ],
            },
            _txAmount: { $ifNull: ["$totalAmount", 0] },
            _txStatus: "$status",
            _txSourceType: "invoice",
            _txSourceId: { $toString: "$_id" },
            _tenant: { $arrayElemAt: ["$_tenant", 0] },
            _property: { $arrayElemAt: ["$_property", 0] },
          },
        },
      ];

      if (pipeline.length > 0) {
        pipeline.push({ $unionWith: { coll: "invoices", pipeline: invoiceStages } });
      }
    }

    // Union with expenses (unless income-only, or tenant filter)
    if (!isIncomeOnly && !params.tenantId) {
      const expenseStages = [
        { $match: this.buildExpenseMatch(params) },
        {
          $lookup: {
            from: "properties",
            localField: "propertyId",
            foreignField: "_id",
            as: "_property",
            pipeline: [{ $project: { name: 1 } }],
          },
        },
        {
          $project: {
            _txDate: { $ifNull: ["$date", "$createdAt"] },
            _txType: "expense",
            _txCategory: { $ifNull: ["$category", "other"] },
            _txDescription: { $ifNull: ["$description", "Expense"] },
            _txReference: {
              $ifNull: [
                "$expenseNumber",
                { $concat: ["EXP-", { $substr: [{ $toString: "$_id" }, 18, 6] }] },
              ],
            },
            _txAmount: { $ifNull: ["$amount", 0] },
            _txStatus: "$status",
            _txSourceType: "expense",
            _txSourceId: { $toString: "$_id" },
            _tenant: null,
            _property: { $arrayElemAt: ["$_property", 0] },
          },
        },
      ];

      if (pipeline.length > 0) {
        pipeline.push({ $unionWith: { coll: "expenses", pipeline: expenseStages } });
      }
    }

    // If expense-only, start from expenses collection instead
    if (isExpenseOnly) {
      pipeline.length = 0;
      pipeline.push(
        { $match: this.buildExpenseMatch(params) },
        {
          $lookup: {
            from: "properties",
            localField: "propertyId",
            foreignField: "_id",
            as: "_property",
            pipeline: [{ $project: { name: 1 } }],
          },
        },
        {
          $project: {
            _txDate: { $ifNull: ["$date", "$createdAt"] },
            _txType: "expense",
            _txCategory: { $ifNull: ["$category", "other"] },
            _txDescription: { $ifNull: ["$description", "Expense"] },
            _txReference: {
              $ifNull: [
                "$expenseNumber",
                { $concat: ["EXP-", { $substr: [{ $toString: "$_id" }, 18, 6] }] },
              ],
            },
            _txAmount: { $ifNull: ["$amount", 0] },
            _txStatus: "$status",
            _txSourceType: "expense",
            _txSourceId: { $toString: "$_id" },
            _tenant: null,
            _property: { $arrayElemAt: ["$_property", 0] },
          },
        }
      );
    }

    // Apply text search filter
    if (search) {
      const searchRegex = new RegExp(search, "i");
      pipeline.push({
        $match: {
          $or: [
            { _txDescription: searchRegex },
            { _txReference: searchRegex },
            { _txCategory: searchRegex },
            { "_tenant.firstName": searchRegex },
            { "_tenant.lastName": searchRegex },
            { "_property.name": searchRegex },
          ],
        },
      });
    }

    // Apply category filter
    if (category) {
      pipeline.push({ $match: { _txCategory: category } });
    }

    // Apply type filter
    if (type) {
      pipeline.push({ $match: { _txType: type } });
    }

    // Use $facet to get paginated data + summary + total count in one query
    const sortField = sortBy === "amount" ? "_txAmount" : "_txDate";
    const sortDir = sortOrder === "asc" ? 1 : -1;

    const incomeSummaryCondition = bankOnly
      ? { $eq: ["$_txSourceType", "payment"] }
      : {
          $or: [
            {
              $and: [
                { $eq: ["$_txSourceType", "payment"] },
                { $eq: ["$_txStatus", PaymentStatus.PAID] },
              ],
            },
            {
              $and: [
                { $eq: ["$_txSourceType", "invoice"] },
                { $eq: ["$_txStatus", InvoiceStatus.PAID] },
              ],
            },
          ],
        };

    const expenseSummaryCondition = bankOnly
      ? { $eq: ["$_txSourceType", "expense"] }
      : {
          $and: [
            { $eq: ["$_txSourceType", "expense"] },
            { $eq: ["$_txStatus", ExpenseStatus.PAID] },
          ],
        };

    const outstandingSummaryAccumulator = bankOnly
      ? { $sum: 0 }
      : {
          $sum: {
            $cond: [
              {
                $or: [
                  {
                    $and: [
                      { $eq: ["$_txSourceType", "payment"] },
                      { $in: ["$_txStatus", [PaymentStatus.PENDING, PaymentStatus.OVERDUE]] },
                    ],
                  },
                  {
                    $and: [
                      { $eq: ["$_txSourceType", "invoice"] },
                      {
                        $in: [
                          "$_txStatus",
                          [InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIAL],
                        ],
                      },
                    ],
                  },
                  {
                    $and: [
                      { $eq: ["$_txSourceType", "expense"] },
                      { $in: ["$_txStatus", [ExpenseStatus.PENDING, ExpenseStatus.APPROVED]] },
                    ],
                  },
                ],
              },
              "$_txAmount",
              0,
            ],
          },
        };

    pipeline.push({
      $facet: {
        transactions: [
          { $sort: { [sortField]: sortDir } },
          { $skip: skip },
          { $limit: limit },
        ],
        summary: [
          {
            $group: {
              _id: null,
              totalIncome: {
                $sum: {
                  $cond: [
                    incomeSummaryCondition,
                    "$_txAmount",
                    0,
                  ],
                },
              },
              totalExpenses: {
                $sum: {
                  $cond: [
                    expenseSummaryCondition,
                    "$_txAmount",
                    0,
                  ],
                },
              },
              outstanding: outstandingSummaryAccumulator,
              transactionCount: { $sum: 1 },
            },
          },
        ],
      },
    });

    // Execute aggregation - starts from payments collection (or expenses if expense-only)
    const startModel = isExpenseOnly
      ? (await import("@/models")).Expense
      : Payment;
    const [result] = await startModel.aggregate(pipeline);

    const transactions: IUnifiedTransaction[] = (
      result?.transactions || []
    ).map((t: any) => ({
      id: t._txSourceId,
      date: t._txDate,
      type: t._txType,
      category: t._txCategory,
      description:
        t._txSourceType === "payment"
          ? getPaymentDescription({ type: t._txCategory })
          : t._txDescription,
      reference: t._txReference,
      amount: t._txAmount,
      status: t._txStatus,
      sourceType: t._txSourceType,
      sourceId: t._txSourceId,
      tenantId: t._tenant
        ? {
            _id: t._tenant._id?.toString(),
            firstName: t._tenant.firstName || "",
            lastName: t._tenant.lastName || "",
            email: t._tenant.email,
          }
        : undefined,
      propertyId: t._property
        ? {
            _id: t._property._id?.toString(),
            name: t._property.name || "",
          }
        : undefined,
    }));

    const summaryData = result?.summary?.[0];
    const total = summaryData?.transactionCount || 0;
    const summary: ITransactionSummary = {
      totalIncome: summaryData?.totalIncome || 0,
      totalExpenses: summaryData?.totalExpenses || 0,
      netAmount:
        (summaryData?.totalIncome || 0) - (summaryData?.totalExpenses || 0),
      outstanding: summaryData?.outstanding || 0,
      transactionCount: total,
    };

    return {
      transactions,
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get transactions for a specific tenant
   */
  async getTenantTransactions(
    tenantId: string,
    params: Omit<TransactionQueryParams, "tenantId">
  ): Promise<TransactionListResult> {
    return this.getUnifiedTransactions({
      ...params,
      tenantId,
    });
  }
}

// Export singleton instance
export const transactionService = new TransactionService();

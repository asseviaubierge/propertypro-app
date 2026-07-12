/**
 * PropertyPro - Expense Service
 * CRUD and analytics for expense tracking
 */

import { Types } from "mongoose";
import { Expense } from "@/models";
import { ExpenseStatus, ExpenseCategory } from "@/types";

export interface ExpenseQueryParams {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  status?: string;
  propertyId?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ExpenseSummary {
  totalExpenses: number;
  totalPaid: number;
  totalPending: number;
  monthToDate: number;
  yearToDate: number;
  topCategory: string;
  count: number;
}

export class ExpenseService {
  /**
   * List expenses with filters and pagination
   */
  async listExpenses(params: ExpenseQueryParams) {
    const {
      page = 1,
      limit = 12,
      search,
      category,
      status,
      propertyId,
      startDate,
      endDate,
      sortBy = "date",
      sortOrder = "desc",
    } = params;

    const query: any = {};

    if (category && category !== "all") {
      query.category = category;
    }
    if (status && status !== "all") {
      query.status = status;
    }
    if (propertyId) {
      query.propertyId = new Types.ObjectId(propertyId);
    }
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: "i" } },
        { expenseNumber: { $regex: search, $options: "i" } },
        { referenceNumber: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    const sortObj: any = {};
    sortObj[sortBy === "date" ? "date" : sortBy] = sortOrder === "asc" ? 1 : -1;

    const skip = (page - 1) * limit;

    const [expenses, total] = await Promise.all([
      Expense.find(query)
        .populate("propertyId", "name address")
        .populate("createdBy", "firstName lastName")
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
      Expense.countDocuments(query),
    ]);

    return {
      expenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get expense summary stats
   */
  async getExpenseSummary(propertyId?: string): Promise<ExpenseSummary> {
    const baseQuery: any = {};
    if (propertyId) {
      baseQuery.propertyId = new Types.ObjectId(propertyId);
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [allExpenses, mtdExpenses, ytdExpenses, categoryAgg] =
      await Promise.all([
        Expense.aggregate([
          { $match: baseQuery },
          {
            $group: {
              _id: "$status",
              total: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
        ]),
        Expense.aggregate([
          { $match: { ...baseQuery, date: { $gte: startOfMonth } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Expense.aggregate([
          { $match: { ...baseQuery, date: { $gte: startOfYear } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Expense.aggregate([
          { $match: baseQuery },
          {
            $group: {
              _id: "$category",
              total: { $sum: "$amount" },
            },
          },
          { $sort: { total: -1 } },
          { $limit: 1 },
        ]),
      ]);

    let totalExpenses = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let count = 0;

    for (const group of allExpenses) {
      const amount = group.total || 0;
      totalExpenses += amount;
      count += group.count || 0;
      if (group._id === ExpenseStatus.PAID) {
        totalPaid += amount;
      } else if (
        group._id === ExpenseStatus.PENDING ||
        group._id === ExpenseStatus.APPROVED
      ) {
        totalPending += amount;
      }
    }

    return {
      totalExpenses,
      totalPaid,
      totalPending,
      monthToDate: mtdExpenses[0]?.total || 0,
      yearToDate: ytdExpenses[0]?.total || 0,
      topCategory: categoryAgg[0]?._id || "none",
      count,
    };
  }

  /**
   * Create a new expense
   */
  async createExpense(data: any) {
    const expense = new Expense(data);
    await expense.save();
    await expense.populate("propertyId", "name address");
    return expense;
  }

  /**
   * Get a single expense by ID
   */
  async getExpense(id: string) {
    return Expense.findById(id)
      .populate("propertyId", "name address")
      .populate("createdBy", "firstName lastName")
      .lean();
  }

  /**
   * Update an expense
   */
  async updateExpense(id: string, data: any) {
    const expense = await Expense.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    })
      .populate("propertyId", "name address")
      .lean();
    return expense;
  }

  /**
   * Soft delete an expense
   */
  async deleteExpense(id: string) {
    return Expense.findByIdAndUpdate(id, {
      deletedAt: new Date(),
      status: ExpenseStatus.CANCELLED,
    });
  }

  /**
   * Get expenses grouped by category (for charts)
   */
  async getExpensesByCategory(
    startDate?: Date,
    endDate?: Date,
    propertyId?: string,
  ) {
    const match: any = {};
    if (propertyId) match.propertyId = new Types.ObjectId(propertyId);
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = startDate;
      if (endDate) match.date.$lte = endDate;
    }

    return Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);
  }

  /**
   * Get monthly expense trends
   */
  async getMonthlyTrends(months: number = 12, propertyId?: string) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const match: any = { date: { $gte: startDate } };
    if (propertyId) match.propertyId = new Types.ObjectId(propertyId);

    return Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);
  }
}

export const expenseService = new ExpenseService();

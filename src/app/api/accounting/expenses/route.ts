import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { Expense } from "@/models";
import {
  AuthenticatedAccessUser,
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { getScopedPropertyIds, canAccessProperty } from "@/lib/property-scope";

export const dynamic = "force-dynamic";

export const GET = withPermissionAndDB("financial_management")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const params = new URL(request.url).searchParams;
      const page = Math.max(1, Number(params.get("page") || 1));
      const limit = Math.min(100, Math.max(1, Number(params.get("limit") || 12)));
      const query: Record<string, any> = { deletedAt: null };
      const propertyIds = await getScopedPropertyIds(user);
      if (propertyIds !== null) query.propertyId = { $in: propertyIds };

      const propertyId = params.get("propertyId");
      if (propertyId) {
        if (!Types.ObjectId.isValid(propertyId)) return createErrorResponse("Identifiant de propriété invalide", 400);
        if (!user.isAdmin && !(await canAccessProperty(user, propertyId))) return createErrorResponse("Accès refusé à cette propriété", 403);
        query.propertyId = new Types.ObjectId(propertyId);
      }
      const category = params.get("category");
      const status = params.get("status");
      const search = params.get("search")?.trim();
      if (category && category !== "all") query.category = category;
      if (status && status !== "all") query.status = status;
      if (search) query.$or = [
        { description: { $regex: search, $options: "i" } },
        { expenseNumber: { $regex: search, $options: "i" } },
        { referenceNumber: { $regex: search, $options: "i" } },
      ];

      const skip = (page - 1) * limit;
      const [expenses, total, summaryRows] = await Promise.all([
        Expense.find(query).populate("propertyId", "name address").populate("createdBy", "firstName lastName").sort({ date: -1 }).skip(skip).limit(limit).lean(),
        Expense.countDocuments(query),
        Expense.aggregate([
          { $match: query },
          { $group: { _id: "$status", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        ]),
      ]);
      const summary = { totalExpenses: 0, totalPaid: 0, totalPending: 0, monthToDate: 0, yearToDate: 0, topCategory: "none", count: total };
      for (const row of summaryRows as any[]) {
        summary.totalExpenses += Number(row.total || 0);
        if (row._id === "paid") summary.totalPaid += Number(row.total || 0);
        if (["pending", "approved"].includes(row._id)) summary.totalPending += Number(row.total || 0);
      }
      const totalPages = Math.max(1, Math.ceil(total / limit));
      return createSuccessResponse({ expenses, summary }, "Dépenses récupérées", { page, limit, total, totalPages });
    } catch (error) {
      return handleApiError(error, "Impossible de charger les dépenses");
    }
  },
);

export const POST = withPermissionAndDB("financial_management")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const body = await request.json();
      if (body.propertyId && (!Types.ObjectId.isValid(body.propertyId) || (!user.isAdmin && !(await canAccessProperty(user, body.propertyId))))) {
        return createErrorResponse("Accès refusé à cette propriété", 403);
      }
      const expense = await Expense.create({ ...body, createdBy: user.id, deletedAt: null });
      await expense.populate("propertyId", "name address");
      return createSuccessResponse(expense, "Dépense créée");
    } catch (error) {
      return handleApiError(error, "Impossible de créer la dépense");
    }
  },
);

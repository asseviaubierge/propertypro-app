import { NextRequest } from "next/server";
import { Invoice } from "@/models";
import { AuthenticatedAccessUser, createSuccessResponse, handleApiError, withPermissionAndDB } from "@/lib/api-utils";
import { getScopedPropertyIds } from "@/lib/property-scope";

export const dynamic = "force-dynamic";

export const GET = withPermissionAndDB("financial_reports")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const months = Math.min(36, Math.max(1, Number(new URL(request.url).searchParams.get("months") || 12)));
      const propertyIds = await getScopedPropertyIds(user);
      const match: Record<string, any> = { deletedAt: null };
      if (propertyIds !== null) match.propertyId = { $in: propertyIds };
      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
      const [totals, byCategoryRaw, byPropertyRaw, monthlyRaw] = await Promise.all([
        Invoice.aggregate([{ $match: match }, { $group: { _id: null, revenue: { $sum: "$totalAmount" }, collected: { $sum: "$amountPaid" }, outstanding: { $sum: "$balanceRemaining" }, count: { $sum: 1 } } }]),
        Invoice.aggregate([{ $match: match }, { $group: { _id: "$category", amount: { $sum: "$totalAmount" }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }]),
        Invoice.aggregate([{ $match: match }, { $group: { _id: "$propertyId", revenue: { $sum: "$totalAmount" }, collected: { $sum: "$amountPaid" }, outstanding: { $sum: "$balanceRemaining" } } }, { $lookup: { from: "properties", localField: "_id", foreignField: "_id", as: "property" } }, { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } }]),
        Invoice.aggregate([{ $match: { ...match, issueDate: { $gte: startMonth } } }, { $group: { _id: { year: { $year: "$issueDate" }, month: { $month: "$issueDate" } }, revenue: { $sum: "$totalAmount" }, collected: { $sum: "$amountPaid" }, count: { $sum: 1 } } }, { $sort: { "_id.year": 1, "_id.month": 1 } }]),
      ]);
      const t: any = totals[0] || { revenue: 0, collected: 0, outstanding: 0, count: 0 };
      const totalRevenue = Number(t.revenue || 0), totalCollected = Number(t.collected || 0);
      const summary = { totalRevenue, totalCollected, totalOutstanding: Number(t.outstanding || 0), monthToDate: 0, yearToDate: 0, collectionRate: totalRevenue > 0 ? (totalCollected / totalRevenue) * 100 : 0, count: Number(t.count || 0) };
      const byCategory = (byCategoryRaw as any[]).map((r) => ({ category: r._id || "other", amount: Number(r.amount || 0), count: Number(r.count || 0), percentage: totalRevenue > 0 ? (Number(r.amount || 0) / totalRevenue) * 100 : 0 }));
      const byProperty = (byPropertyRaw as any[]).map((r) => ({ propertyId: String(r._id || ""), propertyName: r.property?.name || "Bien inconnu", revenue: Number(r.revenue || 0), collected: Number(r.collected || 0), outstanding: Number(r.outstanding || 0), collectionRate: Number(r.revenue || 0) > 0 ? (Number(r.collected || 0) / Number(r.revenue || 0)) * 100 : 0 }));
      const monthlyTrends = (monthlyRaw as any[]).map((r) => ({ year: r._id.year, month: r._id.month, revenue: Number(r.revenue || 0), collected: Number(r.collected || 0), count: Number(r.count || 0) }));
      return createSuccessResponse({ summary, byCategory, byProperty, monthlyTrends }, "Revenus récupérés");
    } catch (error) { return handleApiError(error, "Impossible de charger les revenus"); }
  },
);

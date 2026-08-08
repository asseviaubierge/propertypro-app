import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { Expense } from "@/models";
import { AuthenticatedAccessUser, createErrorResponse, createSuccessResponse, handleApiError, withPermissionAndDB } from "@/lib/api-utils";
import { canAccessProperty } from "@/lib/property-scope";

async function loadAccessible(user: AuthenticatedAccessUser, id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  const expense: any = await Expense.findOne({ _id: id, deletedAt: null }).populate("propertyId", "name address ownerId managerId").populate("createdBy", "firstName lastName");
  if (!expense) return null;
  const propertyId = expense.propertyId?._id ?? expense.propertyId;
  if (!user.isAdmin && propertyId && !(await canAccessProperty(user, String(propertyId)))) return false;
  return expense;
}

export const GET = withPermissionAndDB("financial_management")(async (user: AuthenticatedAccessUser, _request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const expense = await loadAccessible(user, id);
    if (expense === false) return createErrorResponse("Accès refusé", 403);
    if (!expense) return createErrorResponse("Dépense introuvable", 404);
    return createSuccessResponse(expense, "Dépense récupérée");
  } catch (error) { return handleApiError(error); }
});

export const PUT = withPermissionAndDB("financial_management")(async (user: AuthenticatedAccessUser, request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const current: any = await loadAccessible(user, id);
    if (current === false) return createErrorResponse("Accès refusé", 403);
    if (!current) return createErrorResponse("Dépense introuvable", 404);
    const body = await request.json();
    if (body.propertyId && (!Types.ObjectId.isValid(body.propertyId) || (!user.isAdmin && !(await canAccessProperty(user, body.propertyId))))) return createErrorResponse("Accès refusé à cette propriété", 403);
    const updated = await Expense.findByIdAndUpdate(id, body, { new: true, runValidators: true }).populate("propertyId", "name address");
    return createSuccessResponse(updated, "Dépense mise à jour");
  } catch (error) { return handleApiError(error); }
});

export const DELETE = withPermissionAndDB("financial_management")(async (user: AuthenticatedAccessUser, _request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const current: any = await loadAccessible(user, id);
    if (current === false) return createErrorResponse("Accès refusé", 403);
    if (!current) return createErrorResponse("Dépense introuvable", 404);
    await Expense.findByIdAndUpdate(id, { deletedAt: new Date(), status: "cancelled" });
    return createSuccessResponse({ id }, "Dépense supprimée");
  } catch (error) { return handleApiError(error); }
});

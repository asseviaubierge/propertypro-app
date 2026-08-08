import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { AuthenticatedAccessUser, createErrorResponse, createSuccessResponse, handleApiError, withPermissionAndDB } from "@/lib/api-utils";

const collection = () => mongoose.connection.collection("user_feedback");

export const GET = withPermissionAndDB("profile_management")(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const action = new URL(request.url).searchParams.get("action") || "list";
    const base = user.isAdmin ? {} : { userId: new mongoose.Types.ObjectId(user.id) };
    if (action === "summary") {
      const rows = await collection().aggregate([
        { $match: base },
        { $group: { _id: "$rating", count: { $sum: 1 } } },
      ]).toArray();
      const total = rows.reduce((sum, row) => sum + Number(row.count || 0), 0);
      const weighted = rows.reduce((sum, row) => sum + Number(row._id || 0) * Number(row.count || 0), 0);
      return createSuccessResponse({ total, averageRating: total ? weighted / total : 0, ratings: rows }, "Résumé des avis récupéré");
    }
    const items = await collection().find(base).sort({ createdAt: -1 }).limit(100).toArray();
    return createSuccessResponse({ feedback: items }, "Avis récupérés");
  } catch (error) { return handleApiError(error, "Impossible de charger les avis"); }
});

export const POST = withPermissionAndDB("profile_management")(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const body = await request.json();
    const rating = Number(body?.rating || 0);
    const comment = String(body?.comment || body?.message || "").trim();
    if (rating < 1 || rating > 5) return createErrorResponse("La note doit être comprise entre 1 et 5", 400);
    if (!comment) return createErrorResponse("Le commentaire est requis", 400);
    const document = {
      userId: new mongoose.Types.ObjectId(user.id),
      rating,
      comment: comment.slice(0, 2000),
      category: body?.category ? String(body.category).slice(0, 100) : "general",
      page: body?.page ? String(body.page).slice(0, 300) : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await collection().insertOne(document);
    return createSuccessResponse({ ...document, _id: result.insertedId }, "Merci pour votre avis");
  } catch (error) { return handleApiError(error, "Impossible d’enregistrer votre avis"); }
});

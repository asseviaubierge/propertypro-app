import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { Payment } from "@/models";
import { UserRole, PaymentStatus } from "@/types";
import { createPaymentIntent } from "@/lib/stripe";
import { canAccessPayment } from "@/lib/payment-access";
import {
  AuthenticatedAccessUser,
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  withAccessAndDB,
} from "@/lib/api-utils";

const ACCESS = {
  roles: [UserRole.TENANT],
  permissions: ["payment_processing", "financial_management", "payment_portal"],
  match: "any" as const,
};

export const POST = withAccessAndDB(ACCESS)(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const body = await request.json();
    const paymentId = String(body?.paymentId || "");
    if (!Types.ObjectId.isValid(paymentId)) return createErrorResponse("Paiement invalide", 400);
    const payment: any = await Payment.findById(paymentId).populate("tenantId", "firstName lastName email");
    if (!payment) return createErrorResponse("Paiement introuvable", 404);
    if (!(await canAccessPayment(user, payment))) return createErrorResponse("Accès refusé", 403);
    if (payment.status === PaymentStatus.PAID || Number(payment.amountPaid || 0) >= Number(payment.amount || 0)) {
      return createSuccessResponse({ alreadyCompleted: true, paymentIntentId: payment.stripePaymentIntentId || null }, "Ce paiement est déjà réglé");
    }
    const tenant = payment.tenantId;
    if (!tenant?.email) return createErrorResponse("L’adresse e-mail du locataire est manquante", 400);
    const remaining = Math.max(0, Number(payment.amount || 0) - Number(payment.amountPaid || 0));
    const intent = await createPaymentIntent({
      amount: remaining,
      currency: "xof",
      paymentId,
      tenantEmail: tenant.email,
      description: payment.description || `Paiement Gestion E-IMMO`,
      metadata: { tenantId: String(tenant._id || tenant), propertyId: String(payment.propertyId || "") },
    });
    return createSuccessResponse({ clientSecret: intent.client_secret, paymentIntentId: intent.id, amount: remaining }, "Paiement initialisé");
  } catch (error) {
    return handleApiError(error, "Impossible d’initialiser le paiement");
  }
});

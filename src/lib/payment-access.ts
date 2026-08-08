import { Types } from "mongoose";
import { canAccessProperty, applyPropertyScope, ScopeUser } from "@/lib/property-scope";

export interface PaymentScopeDocument {
  tenantId?: unknown;
  propertyId?: unknown;
}

export function resolveDocumentId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record._id) return resolveDocumentId(record._id);
    if (record.id) return resolveDocumentId(record.id);
  }
  try {
    const result = String(value);
    return result === "[object Object]" ? null : result;
  } catch {
    return null;
  }
}

export async function buildPaymentScopeQuery(
  user: ScopeUser,
  query: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  if (user.isAdmin) return query;
  if (user.isTenant) return { ...query, tenantId: user.id };
  return applyPropertyScope(user, query);
}

export async function canAccessPayment(
  user: ScopeUser,
  payment: PaymentScopeDocument | null | undefined
): Promise<boolean> {
  if (!user?.id || !payment) return false;
  if (user.isAdmin) return true;

  if (user.isTenant) {
    return resolveDocumentId(payment.tenantId) === user.id;
  }

  const propertyId = resolveDocumentId(payment.propertyId);
  return propertyId ? canAccessProperty(user, propertyId) : false;
}

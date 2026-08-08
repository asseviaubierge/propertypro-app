import { Types } from "mongoose";
import {
  applyPropertyScope,
  canAccessProperty,
  ScopeUser,
} from "@/lib/property-scope";

export interface InvoiceScopeDocument {
  tenantId?: unknown;
  propertyId?: unknown;
}

export function resolveInvoiceReferenceId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record._id) return resolveInvoiceReferenceId(record._id);
    if (record.id) return resolveInvoiceReferenceId(record.id);
  }
  try {
    const result = String(value);
    return result === "[object Object]" ? null : result;
  } catch {
    return null;
  }
}

export async function buildInvoiceScopeQuery(
  user: ScopeUser,
  query: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  if (user.isAdmin) return query;
  if (user.isTenant) return { ...query, tenantId: user.id };
  return applyPropertyScope(user, query);
}

export async function canAccessInvoice(
  user: ScopeUser,
  invoice: InvoiceScopeDocument | null | undefined
): Promise<boolean> {
  if (!user?.id || !invoice) return false;
  if (user.isAdmin) return true;

  if (user.isTenant) {
    return resolveInvoiceReferenceId(invoice.tenantId) === user.id;
  }

  const propertyId = resolveInvoiceReferenceId(invoice.propertyId);
  return propertyId ? canAccessProperty(user, propertyId) : false;
}

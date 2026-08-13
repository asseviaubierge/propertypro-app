import { User } from "@/models";

export interface InvoiceIssuerIdentity {
  _id?: unknown;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  accountType?: string;
  role?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  website?: string;
  businessLogo?: string;
  cip?: string;
  ifu?: string;
  rccm?: string;
}

function referenceId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record._id) return referenceId(record._id);
    if (record.id) return referenceId(record.id);
  }
  try {
    const text = String(value);
    return text && text !== "[object Object]" ? text : null;
  } catch {
    return null;
  }
}

export async function resolveInvoiceIssuer(
  invoice: any,
  requestingUser?: { id?: string; isAdmin?: boolean; isTenant?: boolean } | null,
): Promise<InvoiceIssuerIdentity | null> {
  const property = invoice?.propertyId || {};
  const createdByUserId = invoice?.metadata?.createdByUserId;
  const propertyManagerId = property?.managerId;
  const propertyOwnerId = property?.ownerId;

  // Historical invoices sometimes do not have metadata.createdByUserId.
  // In that case prefer the manager explicitly assigned to the property, then
  // the owner. As a final compatibility fallback, the currently authenticated
  // manager can represent invoices inside their own scoped portfolio.
  const currentManagerId =
    requestingUser?.id && !requestingUser.isAdmin && !requestingUser.isTenant
      ? requestingUser.id
      : null;

  const candidates = [
    createdByUserId,
    propertyManagerId,
    currentManagerId,
    propertyOwnerId,
  ];

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const id = referenceId(candidate);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    try {
      const issuer = await User.findById(id)
        .select(
          "firstName lastName businessName accountType role email phone address city website businessLogo cip ifu rccm",
        )
        .lean();
      if (issuer) return issuer as InvoiceIssuerIdentity;
    } catch {
      // Old records can contain invalid/deleted references; continue to fallback.
    }
  }

  return null;
}

export function issuerDisplayName(issuer: InvoiceIssuerIdentity | null | undefined): string {
  if (!issuer) return "GESTION E-IMMO";
  const fullName = `${issuer.firstName || ""} ${issuer.lastName || ""}`.trim();
  const role = String(issuer.role || issuer.accountType || "").toLowerCase();

  if (["manager", "property_manager", "owner", "direct_owner"].includes(role)) {
    return fullName || issuer.businessName?.trim() || "GESTION E-IMMO";
  }

  if (role === "agency") {
    return issuer.businessName?.trim() || fullName || "GESTION E-IMMO";
  }

  return fullName || issuer.businessName?.trim() || "GESTION E-IMMO";
}

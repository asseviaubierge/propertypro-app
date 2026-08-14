import type { InvoiceCompanyInfo } from "@/lib/invoice/invoice-shared";

export interface InvoiceIssuerData {
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

export function invoiceIssuerCompanyInfo(
  issuer: InvoiceIssuerData | null | undefined,
): Partial<InvoiceCompanyInfo> | undefined {
  if (!issuer) return undefined;

  const fullName = `${issuer.firstName || ""} ${issuer.lastName || ""}`.trim();
  const role = String(issuer.role || issuer.accountType || "").toLowerCase();
  const displayName =
    role === "agency"
      ? issuer.businessName?.trim() || fullName
      : fullName || issuer.businessName?.trim();
  const roleLabel =
    role === "manager" || role === "property_manager"
      ? "Gestionnaire"
      : role === "owner" || role === "direct_owner"
        ? "Propriétaire direct"
        : role === "agency"
          ? "Agence immobilière"
          : role === "tenant"
            ? "Locataire"
            : role === "admin" || role === "super_admin" || role === "e_immo"
              ? "Gestion E-IMMO"
              : "";

  return {
    name: displayName || "Émetteur",
    legalName:
      issuer.businessName && issuer.businessName !== displayName
        ? issuer.businessName
        : undefined,
    address: [issuer.address, issuer.city].filter(Boolean).join(", "),
    phone: issuer.phone || "",
    email: issuer.email || "",
    website: issuer.website || "",
    // Le favicon E-IMMO n'est jamais le logo d'un compte émetteur tiers.
    logo: issuer.businessLogo || undefined,
    accountType: issuer.accountType || issuer.role || "",
    roleLabel,
    platformName: "E-IMMO",
    cip: issuer.cip || "",
    ifu: issuer.ifu || "",
    rccm: issuer.rccm || "",
  };
}

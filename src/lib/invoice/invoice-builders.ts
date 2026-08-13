import { LeaseResponse } from "@/lib/services/lease.service";
import {
  InvoiceLineItemInfo,
  InvoiceCompanyInfo,
  NormalizedInvoice,
  normalizeInvoiceForPrint,
  NormalizeInvoiceOptions,
  DEFAULT_INVOICE_NOTES,
} from "@/lib/invoice/invoice-shared";

export interface LeaseInvoiceLineItemInput
  extends Partial<InvoiceLineItemInfo> {
  description: string;
  amount: number;
  type?: string;
}



function leaseIssuerCompanyInfo(
  lease: LeaseResponse,
  fallback?: Partial<InvoiceCompanyInfo>,
): Partial<InvoiceCompanyInfo> | undefined {
  const property: any = (lease as any)?.propertyId || {};
  const issuer: any =
    (property?.managerId && typeof property.managerId === "object" ? property.managerId : null) ||
    (property?.ownerId && typeof property.ownerId === "object" ? property.ownerId : null);

  if (!issuer) return fallback;

  const fullName = `${issuer.firstName || ""} ${issuer.lastName || ""}`.trim();
  const role = String(issuer.role || issuer.accountType || "").toLowerCase();
  const isAgency = role === "agency";
  const displayName = isAgency
    ? issuer.businessName || fullName
    : fullName || issuer.businessName;

  const roleLabel =
    ["manager", "property_manager"].includes(role)
      ? "Gestionnaire"
      : ["owner", "direct_owner"].includes(role)
        ? "Propriétaire direct"
        : role === "agency"
          ? "Agence immobilière"
          : ["admin", "super_admin", "e_immo"].includes(role)
            ? "Gestion E-IMMO"
            : "";

  return {
    ...(fallback || {}),
    name: displayName || fallback?.name || "GESTION E-IMMO",
    legalName:
      issuer.businessName && issuer.businessName !== displayName
        ? issuer.businessName
        : fullName && fullName !== displayName
          ? fullName
          : undefined,
    address: [issuer.address, issuer.city].filter(Boolean).join(", ") || fallback?.address || "",
    phone: issuer.phone || fallback?.phone || "",
    email: issuer.email || fallback?.email || "",
    website: issuer.website || fallback?.website,
    logo: issuer.businessLogo || fallback?.logo,
    accountType: issuer.accountType || issuer.role,
    roleLabel,
    cip: issuer.cip,
    ifu: issuer.ifu,
    rccm: issuer.rccm,
    platformName: "E-IMMO",
  } as Partial<InvoiceCompanyInfo>;
}

export interface LeaseInvoiceBuildOptions {
  invoiceNumber?: string;
  issueDate?: Date;
  dueDate?: Date;
  status?: string;
  companyInfo?: Partial<InvoiceCompanyInfo>;
  notes?: string;
  amountPaid?: number;
  taxAmount?: number;
  additionalLineItems?: LeaseInvoiceLineItemInput[];
  overrides?: Partial<NormalizeInvoiceOptions>;
}

function buildDefaultLineItems(
  lease: LeaseResponse
): InvoiceLineItemInfo[] {
  const items: InvoiceLineItemInfo[] = [];

  if (lease.terms?.rentAmount) {
    items.push({
      description: `Loyer mensuel - ${lease.propertyId?.name || "Bien"}`,
      quantity: 1,
      unitPrice: lease.terms.rentAmount,
      total: lease.terms.rentAmount,
      amount: lease.terms.rentAmount,
      type: "rent",
    });
  }

  if (lease.terms?.securityDeposit) {
    items.push({
      description: "Dépôt de garantie",
      quantity: 1,
      unitPrice: lease.terms.securityDeposit,
      total: lease.terms.securityDeposit,
      amount: lease.terms.securityDeposit,
      type: "security_deposit",
    });
  }

  if (lease.terms?.petDeposit) {
    items.push({
      description: "Dépôt pour animal",
      quantity: 1,
      unitPrice: lease.terms.petDeposit,
      total: lease.terms.petDeposit,
      amount: lease.terms.petDeposit,
      type: "pet_deposit",
    });
  }

  return items;
}

function mergeLineItems(
  baseItems: InvoiceLineItemInfo[],
  additionalItems?: LeaseInvoiceLineItemInput[]
): InvoiceLineItemInfo[] {
  if (!additionalItems || additionalItems.length === 0) {
    return baseItems;
  }

  const extras = additionalItems.map((item) => {
    const quantity = item.quantity ?? 1;
    const unitPrice =
      item.unitPrice ??
      (quantity && quantity > 0 ? item.amount / quantity : item.amount);
    const total = item.amount ?? unitPrice * quantity;
    return {
      description: item.description,
      quantity,
      unitPrice,
      total,
      amount: total,
      type: item.type,
    } as InvoiceLineItemInfo;
  });

  return [...baseItems, ...extras];
}

export function buildPrintableInvoiceFromLease(
  lease: LeaseResponse,
  options: LeaseInvoiceBuildOptions = {}
): NormalizedInvoice {
  const {
    invoiceNumber,
    issueDate,
    dueDate,
    status = "issued",
    companyInfo,
    notes,
    amountPaid = 0,
    taxAmount = 0,
    additionalLineItems,
    overrides,
  } = options;

  const leaseIdString =
    typeof lease._id === "string"
      ? lease._id
      : typeof lease._id === "object" && lease._id !== null
      ? (lease._id as { toString?: () => string }).toString?.() ?? ""
      : "";

  const generatedInvoiceNumber =
    invoiceNumber ||
    `INV-${leaseIdString.slice(-8).toUpperCase() || "LEASE"}-${new Date().getFullYear()}`;

  const calculatedIssueDate = issueDate || new Date();
  const calculatedDueDate =
    dueDate ||
    new Date(
      calculatedIssueDate.getTime() + 30 * 24 * 60 * 60 * 1000
    );

  const lineItems = mergeLineItems(
    buildDefaultLineItems(lease),
    additionalLineItems
  );

  const subtotal = lineItems.reduce((acc, item) => acc + (item.total || 0), 0);
  const totalAmount = subtotal + taxAmount;
  const balanceRemaining = Math.max(totalAmount - amountPaid, 0);

  const tenantInfo = (lease as any).tenantId || {};
  const propertyInfo = lease.propertyId || {};

  const resolvedCompanyInfo = leaseIssuerCompanyInfo(lease, companyInfo);

  const rawInvoice = {
    invoiceNumber: generatedInvoiceNumber,
    issueDate: calculatedIssueDate,
    dueDate: calculatedDueDate,
    status,
    subtotal,
    taxAmount,
    totalAmount,
    amountPaid,
    balanceRemaining,
    notes: notes ?? DEFAULT_INVOICE_NOTES,
    companyInfo: resolvedCompanyInfo,
    tenantId: tenantInfo,
    propertyId: {
      ...propertyInfo,
      unit:
        (lease as any)?.unit?.unitNumber ||
        (lease as any)?.unit?.name ||
        ((lease as any)?.propertyId?.units || []).find(
          (candidate: any) => String(candidate?._id) === String((lease as any)?.unitId)
        )?.unitNumber ||
        "",
    },
    leaseId: {
      _id: lease._id,
      propertyId: propertyInfo,
      unitId: (lease as any).unitId,
      startDate: lease.startDate,
      endDate: lease.endDate,
      status: lease.status,
      terms: lease.terms,
    },
    lineItems,
  };

  return normalizeInvoiceForPrint(rawInvoice, {
    companyInfo: resolvedCompanyInfo,
    defaultNotes: notes,
    fallbackStatus: status,
    ...overrides,
  });
}

/**
 * PropertyPro - Invoice PDF Service
 * Shared helpers for generating invoice PDFs server-side
 */

import jsPDF from "jspdf";
import { IInvoice } from "@/types";
import { HydratedDocument } from "mongoose";
import { renderInvoicePdf } from "@/lib/invoice/pdf-renderer";
import { getCompanyInfoServer } from "@/lib/utils/company-info";
import { normalizeInvoiceForPrint } from "@/lib/invoice/invoice-shared";

export type InvoiceLike =
  | HydratedDocument<IInvoice>
  | (IInvoice & { tenantId?: any; propertyId?: any });

function ensureInvoiceObject(invoice: InvoiceLike): IInvoice & {
  tenantId?: any;
  propertyId?: any;
} {
  if (typeof (invoice as any).toObject === "function") {
    return (invoice as HydratedDocument<IInvoice>).toObject({
      flattenMaps: true,
      virtuals: true,
    }) as IInvoice & { tenantId?: any; propertyId?: any };
  }
  return invoice as IInvoice & { tenantId?: any; propertyId?: any };
}

export async function generateInvoicePdfBuffer(
  invoiceInput: InvoiceLike,
  currencyCodeOverride?: string
): Promise<Buffer> {
  const invoice = ensureInvoiceObject(invoiceInput);

  // Platform information is only a fallback. Each invoice primarily displays
  // the professional identity of the owner of the billed property.
  const defaultCompanyInfo = await getCompanyInfoServer();
  // Prefer the account that issued the invoice. Existing invoices fall back to
  // the property's owner, then the assigned manager, then the platform identity.
  const owner = (invoice as any).issuer || invoice.propertyId?.ownerId || invoice.propertyId?.managerId;
  const ownerFullName = owner
    ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim()
    : "";
  const ownerAddress = [owner?.address, owner?.city].filter(Boolean).join(", ");

  const companyInfo = owner
    ? {
        ...(defaultCompanyInfo ?? {}),
        name:
          ownerFullName ||
          owner.businessName?.trim() ||
          defaultCompanyInfo?.name ||
          "Propriétaire du bien",
        legalName: owner.businessName?.trim() || undefined,
        address: ownerAddress || "Adresse non renseignée",
        phone: owner.phone || "",
        email: owner.email || "",
        website: owner.website || "",
        logo: owner.businessLogo || defaultCompanyInfo?.logo,
        accountType: owner.accountType || owner.role,
        roleLabel:
          owner.role === "manager" || owner.role === "property_manager"
            ? "Gestionnaire"
            : owner.role === "tenant"
              ? "Locataire"
              : owner.role === "admin" || owner.role === "super_admin"
                ? "Gestion E-IMMO"
                : undefined,
        platformName: "E-IMMO",
        cip: owner.cip,
        ifu: owner.ifu,
        rccm: owner.rccm,
      }
    : defaultCompanyInfo;

  // Gestion E-IMMO operates in Benin. Invoice documents are always rendered
  // in CFA francs regardless of legacy invoice/system currency values.
  const currencyCode = "XOF";

  if ((invoice as any).unit && (invoice as any).propertyId && typeof (invoice as any).propertyId === "object") {
    (invoice as any).propertyId = {
      ...(invoice as any).propertyId,
      unit: (invoice as any).unit.unitNumber || (invoice as any).unit.name || "",
    };
  }

  const normalized = normalizeInvoiceForPrint(invoice, { companyInfo: companyInfo ?? undefined, currencyCode });

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  await renderInvoicePdf(pdf, normalized);

  return Buffer.from(pdf.output("arraybuffer"));
}

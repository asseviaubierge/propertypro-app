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
import { invoiceIssuerCompanyInfo } from "@/lib/invoice/issuer-company-info";

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
  _currencyCodeOverride?: string
): Promise<Buffer> {
  const invoice = ensureInvoiceObject(invoiceInput);

  // L'identité de la plateforme n'est qu'un repli. La facture affiche d'abord
  // le compte qui l'a réellement émise.
  const defaultCompanyInfo = await getCompanyInfoServer();
  // Prefer the account that issued the invoice. Existing invoices fall back to
  // the property's owner, then the assigned manager, then the platform identity.
  const issuer = (invoice as any).issuer || invoice.propertyId?.ownerId || invoice.propertyId?.managerId;
  const companyInfo = issuer
    ? invoiceIssuerCompanyInfo(issuer)
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

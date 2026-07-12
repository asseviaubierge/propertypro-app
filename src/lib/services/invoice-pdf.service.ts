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

  // Fetch company info from display settings
  const companyInfo = await getCompanyInfoServer();
  let currencyCode: string | undefined = currencyCodeOverride;
  try {
    if (!currencyCode) {
      const { default: SystemSettingsNew } = await import("@/models/SystemSettingsNew");
      const systemSettings = await SystemSettingsNew.findOne().lean();
      currencyCode = systemSettings?.payment?.currency || undefined;
    }
  } catch {
    currencyCode = undefined;
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

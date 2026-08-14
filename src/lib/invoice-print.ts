/**
 * PropertyPro - Invoice Print Utilities
 * Shared helpers to render and print invoice HTML on the client
 */

import {
  InvoiceAddress,
  InvoiceCompanyInfo,
  InvoiceLineItemInfo,
  InvoicePartyInfo,
  InvoicePropertyInfo,
  NormalizeInvoiceOptions,
  NormalizedInvoice,
  normalizeInvoiceForPrint,
} from "@/lib/invoice/invoice-shared";
import {
  deriveCompanyInitials,
  fetchLogoAsDataUrl,
} from "@/lib/invoice/logo-utils";
import { localizationService } from "@/lib/services/localization.service";

export type PrintableInvoiceAddress = InvoiceAddress;
export type PrintableInvoiceLineItem = InvoiceLineItemInfo;
export type PrintableInvoiceParty = InvoicePartyInfo;
export type PrintableInvoiceProperty = InvoicePropertyInfo;
export type PrintableInvoice = NormalizedInvoice;

function isApproximatelyZero(value: number): boolean {
  return Math.abs(value) < 1e-6;
}

function formatCurrency(amount: number = 0): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const normalizedAmount = isApproximatelyZero(safeAmount) ? 0 : safeAmount;
  const activeCurrencyCode = localizationService.getCurrentCurrency() || "XOF";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: activeCurrencyCode,
      maximumFractionDigits: activeCurrencyCode === "XOF" ? 0 : 2,
    }).format(normalizedAmount);
  } catch {
    const currency = localizationService.getCurrency(activeCurrencyCode);
    const decimals = currency?.decimals ?? 0;
    const formattedAmount = normalizedAmount.toFixed(decimals);
    return currency?.symbolPosition === "after"
      ? `${formattedAmount} ${currency.symbol}`
      : `${currency?.symbol ?? "FCFA"}${formattedAmount}`;
  }
}

function formatInvoiceType(type?: string): string {
  const key = String(type || "").toLowerCase();
  const labels: Record<string, string> = {
    rent: "Loyer",
    security_deposit: "Dépôt de garantie",
    pet_deposit: "Dépôt animal",
    late_fee: "Frais de retard",
    maintenance: "Maintenance",
    utility: "Charges",
    other: "Autre",
  };
  return labels[key] || String(type || "").replace(/_/g, " ");
}

function formatAccountType(company: InvoiceCompanyInfo): string {
  const key = String(company.accountType || company.roleLabel || "").toLowerCase();
  if (["manager", "property_manager"].includes(key)) return "Gestionnaire";
  if (["owner", "direct_owner"].includes(key)) return "Propriétaire direct";
  if (key === "agency") return "Agence immobilière";
  if (["admin", "super_admin", "e_immo", "gestion e-immo"].includes(key)) return "Gestion E-IMMO";
  return String(company.roleLabel || company.accountType || "");
}

function formatAddress(address?: PrintableInvoiceAddress | string): string {
  if (!address) return "N/A";
  if (typeof address === "string") return address;
  const { street = "", city = "", state = "", zipCode = "" } = address;
  if (!street && !city && !state && !zipCode) return "N/A";
  return `${street}${street ? ", " : ""}${city}${
    city ? ", " : ""
  }${state} ${zipCode}`.trim();
}

function ensurePrintableInvoice(
  invoice: PrintableInvoice | unknown,
  options?: NormalizeInvoiceOptions
): NormalizedInvoice {
  if (
    invoice &&
    typeof invoice === "object" &&
    (invoice as NormalizedInvoice).statusMeta &&
    (invoice as NormalizedInvoice).totals
  ) {
    if (options?.companyInfo) {
      return normalizeInvoiceForPrint(invoice, options);
    }

    return invoice as NormalizedInvoice;
  }

  return normalizeInvoiceForPrint(invoice, options);
}

/**
 * Resolve the company logo to an inline base64 data URL.
 *
 * The branding logo comes from settings as either a relative path
 * (e.g. "/favicon.ico") or a cross-origin URL (R2 storage). Neither renders
 * reliably in the two export contexts:
 *   - Print preview opens a blank window (about:blank base), so relative paths
 *     don't resolve and the window prints before a network image finishes loading.
 *   - html2canvas drops cross-origin <img> elements that aren't CORS-enabled.
 * Inlining the logo as a data URL makes it render synchronously in both cases.
 * Falls back to the original logo value if it can't be fetched.
 */
export async function resolveInvoiceLogo(
  invoice: PrintableInvoice | unknown,
  options?: NormalizeInvoiceOptions
): Promise<NormalizedInvoice> {
  const normalized = ensurePrintableInvoice(invoice, options);
  const logo =
    typeof normalized.companyInfo.logo === "string"
      ? normalized.companyInfo.logo.trim()
      : "";

  if (!logo || logo.startsWith("data:")) {
    return normalized;
  }

  // Cross-origin (R2) logos can't be fetched directly from the browser (CORS)
  // and are dropped by html2canvas, so route absolute URLs through our
  // same-origin proxy before converting to a data URL. Relative/same-origin
  // paths (e.g. "/favicon.ico") are fetched as-is.
  const fetchTarget = /^https?:\/\//i.test(logo)
    ? `/api/branding/logo?src=${encodeURIComponent(logo)}`
    : logo;

  try {
    const { dataUrl } = await fetchLogoAsDataUrl(fetchTarget);
    if (dataUrl) {
      return {
        ...normalized,
        companyInfo: { ...normalized.companyInfo, logo: dataUrl },
      };
    }
  } catch {
    // Best effort: keep the original logo URL as a fallback.
  }

  return normalized;
}

// Generates an invoice HTML body (no <html> wrapper) using the existing lease invoice design
export function generateInvoiceHTML(
  invoice: PrintableInvoice | unknown,
  companyInfo?: Partial<InvoiceCompanyInfo>
): string {
  const normalized = ensurePrintableInvoice(invoice, { companyInfo });

  const issue = normalized.issueDate;
  const due = normalized.dueDate;
  const tenantName = normalized.tenant
    ? `${normalized.tenant.firstName || ""} ${
        normalized.tenant.lastName || ""
      }`.trim() ||
      normalized.tenant.name ||
      "Locataire"
    : "Locataire";

  const property =
    normalized.property ||
    normalized.leaseId?.propertyId ||
    ({ name: "Bien" } as InvoicePropertyInfo);

  const {
    totals: {
      subtotal,
      taxAmount,
      discountAmount,
      shippingAmount,
      adjustmentsAmount,
      total: totalAmount,
      amountPaid,
      balanceDue,
    },
  } = normalized;

  const company = normalized.companyInfo;
  const companyInitials = deriveCompanyInitials(company.name);
  const rawLogo = typeof company.logo === "string" ? company.logo.trim() : "";
  const hasLogo = rawLogo.length > 0;
  const safeLogoUrl = rawLogo.replace(/"/g, "%22");
  const safeCompanyAlt = (company.name || "Entreprise").replace(/"/g, "&quot;");
  const logoContainerStyle = hasLogo
    ? "width:40px; height:40px; border-radius:6px; display:flex; align-items:center; justify-content:center; margin-bottom:16px; overflow:hidden; background-color:#ffffff;"
    : "width:40px; height:40px; background-color:#10b981; border-radius:6px; display:flex; align-items:center; justify-content:center; margin-bottom:16px; overflow:hidden;";
  const logoMarkup = hasLogo
    ? `<img src="${safeLogoUrl}" alt="${safeCompanyAlt}" style="width:100%; height:100%; object-fit:contain;" crossorigin="anonymous" />`
    : `<span style="color:white; font-weight:bold; font-size:16px; font-family: Arial, sans-serif;">${companyInitials}</span>`;

  const statusBadge = `<div style=\"background-color:${normalized.statusMeta.badgeBackground}; color:${normalized.statusMeta.badgeColor}; padding:7px 14px; border-radius:4px; font-size:13px; font-weight:600; line-height:1; display:inline-block; text-align:center; vertical-align:middle; margin-bottom:8px;\">${normalized.statusMeta.label}</div>`;

  const lineItems: InvoiceLineItemInfo[] = normalized.lineItems;

  const lineItemsRows =
    lineItems.length > 0
      ? lineItems
          .map((item, idx) => {
            const qty = item.quantity ?? 1;
            const unit = item.unitPrice ?? 0;
            const totalLine = item.total ?? item.amount ?? qty * unit;
            return `
        <tr>
          <td style=\"padding:12px 16px; font-size:13px; color:#111827; \">${
            idx + 1
          }</td>
          <td style=\"padding:12px 16px; \">
            <div style=\"font-size:13px; font-weight:600; color:#111827; margin-bottom:2px;\">${
              item.description
            }</div>
            <div style=\"font-size:12px; color:#6b7280;\">${formatInvoiceType(item.type)}</div>
          </td>
          <td style=\"padding:12px 16px; text-align:right; font-size:13px; color:#111827; \">${qty}</td>
          <td style=\"padding:12px 16px; text-align:right; font-size:13px; color:#111827; \">${formatCurrency(
            Number(unit)
          )}</td>
          <td style=\"padding:12px 16px; text-align:right; font-size:13px; color:#111827; \">${formatCurrency(
            Number(totalLine)
          )}</td>
        </tr>`;
          })
          .join("\n")
      : `<tr>
          <td colspan=\"5\" style=\"padding:16px; text-align:center; font-size:13px; color:#6b7280; \">Aucune ligne de facture</td>
        </tr>`;

  return `
      <!-- Header -->
      <div style=\"display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px;\">
        <div>
          <div style=\"${logoContainerStyle}\">
            ${logoMarkup}
          </div>
          <h1 style=\"font-size:20px; font-weight:bold; color:#111827; margin:0 0 4px 0; line-height:1.2;\">${
            company.name
          }</h1>
          <div style=\"color:#6b7280; font-size:13px; line-height:1.4; margin-bottom:16px;\">
            <p style=\"margin:1px 0;\">${company.address}</p>
            ${company.phone ? `<p style="margin:1px 0;">${company.phone}</p>` : ""}
            ${company.email ? `<p style="margin:1px 0;">${company.email}</p>` : ""}
            ${company.cip ? `<p style="margin:1px 0;">CIP : ${company.cip}</p>` : ""}
            ${company.ifu ? `<p style="margin:1px 0;">IFU : ${company.ifu}</p>` : ""}
            ${company.rccm ? `<p style="margin:1px 0;">RCCM : ${company.rccm}</p>` : ""}
            <p style=\"margin:1px 0;\">${company.email}</p>
            ${
              company.website
                ? `<p style="margin:1px 0;">${company.website}</p>`
                : ""
            }
          </div>
          <div><span style=\"color:#6b7280; font-size:13px;\">${
            normalized.statusMeta.label
          }</span></div>
        </div>
        <div style=\"text-align:right;\">
          ${statusBadge}
          <p style=\"margin:0 0 12px 0; font-size:13px; color:#6b7280; font-weight:500;\">${
            normalized.invoiceNumber
          }</p>
          <div style=\"font-size:13px; color:#6b7280; text-align:right;\">
            <p style=\"margin:2px 0; font-weight:500;\">Date d’émission : ${issue.toLocaleDateString(
              "fr-FR",
              { year: "numeric", month: "long", day: "numeric" }
            )}</p>
            <p style=\"margin:2px 0; font-weight:500;\">Date d’échéance : ${due.toLocaleDateString(
              "fr-FR",
              { year: "numeric", month: "long", day: "numeric" }
            )}</p>
          </div>
        </div>
      </div>

      <!-- Invoice From/To -->
      <div style=\"display:grid; grid-template-columns:1fr 1fr; gap:48px; margin-bottom:32px;\">
        <div>
          <h3 style=\"font-weight:600; color:#111827; margin-bottom:8px; font-size:14px; margin:0 0 8px 0;\">Facturé par</h3>
          <div style=\"color:#374151; font-size:13px; line-height:1.4;\">
            <p style=\"font-weight:600; margin:1px 0; color:#111827;\">${
              company.name
            }</p>
            ${company.legalName && company.legalName !== company.name ? `<p style="margin:1px 0;">${company.legalName}</p>` : ""}
            ${formatAccountType(company) ? `<p style="margin:1px 0;">${formatAccountType(company)}</p>` : ""}
            <p style=\"margin:1px 0; font-weight:600; color:#dc2626;\">Plateforme : E-IMMO</p>
            <p style=\"margin:1px 0;\">${company.address}</p>
            ${company.phone ? `<p style="margin:1px 0;">${company.phone}</p>` : ""}
            ${company.email ? `<p style="margin:1px 0;">${company.email}</p>` : ""}
            ${company.cip ? `<p style="margin:1px 0;">CIP : ${company.cip}</p>` : ""}
            ${company.ifu ? `<p style="margin:1px 0;">IFU : ${company.ifu}</p>` : ""}
            ${company.rccm ? `<p style="margin:1px 0;">RCCM : ${company.rccm}</p>` : ""}
          </div>
        </div>
        <div>
          <h3 style=\"font-weight:600; color:#111827; margin-bottom:8px; font-size:14px; margin:0 0 8px 0;\">Facturé à</h3>
          <div style=\"color:#374151; font-size:13px; line-height:1.4;\">
            <p style=\"font-weight:600; margin:1px 0; color:#111827;\">${
              tenantName || "N/A"
            }</p>
            <p style=\"margin:1px 0;\">${formatAddress(property?.address)}</p>
            ${normalized.tenantId?.phone ? `<p style="margin:1px 0;">${normalized.tenantId.phone}</p>` : ""}
            ${property?.name ? `<p style="margin:5px 0 1px 0; font-weight:600;">${property.name}</p>` : ""}
            ${(property as any)?.unit ? `<p style="margin:1px 0;">Unité : ${(property as any).unit}</p>` : ""}
            ${
              normalized.tenantId?.email
                ? `<p style="margin:1px 0;">${normalized.tenantId.email}</p>`
                : ""
            }
          </div>
        </div>
      </div>

      <!-- Items -->
      <div style=\"margin-bottom:32px;\">
        <table style=\"width:100%; border-collapse:collapse; \">
          <thead>
            <tr>
              <th style=\"padding:12px 16px; background:#f9fafb; font-weight:600; color:#111827; font-size:13px; text-align:left; \">#</th>
              <th style=\"padding:12px 16px; background:#f9fafb; font-weight:600; color:#111827; font-size:13px; text-align:left; \">Description</th>
              <th style=\"padding:12px 16px; background:#f9fafb; font-weight:600; color:#111827; font-size:13px; text-align:right; \">Qté</th>
              <th style=\"padding:12px 16px; background:#f9fafb; font-weight:600; color:#111827; font-size:13px; text-align:right; \">Prix unitaire</th>
              <th style=\"padding:12px 16px; background:#f9fafb; font-weight:600; color:#111827; font-size:13px; text-align:right;\">Total</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsRows}
          </tbody>
        </table>
      </div>

      <!-- Totals -->
      <div style=\"display:flex; justify-content:flex-end; margin-bottom:48px;\">
        <div style=\"width:280px;\">
          <div style=\"display:flex; flex-direction:column; gap:6px;\">
            <div style=\"display:flex; justify-content:space-between; font-size:13px; padding-bottom:4px;\">
              <span style=\"color:#6b7280;\">Sous-total</span>
              <span style=\"color:#111827;\">${formatCurrency(subtotal)}</span>
            </div>
            <div style=\"display:flex; justify-content:space-between; font-size:13px; padding-bottom:4px;\">
              <span style=\"color:#6b7280;\">Frais</span>
              <span style=\"color:#111827;\">${formatCurrency(
                shippingAmount
              )}</span>
            </div>
            <div style=\"display:flex; justify-content:space-between; font-size:13px; padding-bottom:4px;\">
              <span style=\"color:#6b7280;\">Remise</span>
              <span style=\"color:#111827;\">${formatCurrency(
                discountAmount === 0 ? 0 : -Math.abs(discountAmount)
              )}</span>
            </div>
            ${
              adjustmentsAmount !== 0
                ? `<div style="display:flex; justify-content:space-between; font-size:13px; padding-bottom:4px;">
                    <span style="color:#6b7280;">Ajustements</span>
                    <span style="color:#111827;">${formatCurrency(
                      adjustmentsAmount
                    )}</span>
                  </div>`
                : ""
            }
            <div style=\"display:flex; justify-content:space-between; font-size:13px; padding-bottom:8px;\">
              <span style=\"color:#6b7280;\">Taxes</span>
              <span style=\"color:#111827;\">${formatCurrency(taxAmount)}</span>
            </div>
            <div style=\"padding-top:12px; margin-top:4px;\">
              <div style=\"display:flex; justify-content:space-between;\">
                <span style=\"font-size:16px; font-weight:700; color:#111827;\">Total</span>
                <span style=\"font-size:16px; font-weight:700; color:#111827;\">${formatCurrency(
                  totalAmount
                )}</span>
              </div>
            </div>
            <div style=\"display:flex; justify-content:space-between; font-size:13px; padding-top:8px;\">
              <span style=\"color:#6b7280;\">Montant payé</span>
              <span style=\"color:#111827;\">${formatCurrency(
                amountPaid
              )}</span>
            </div>
            <div style=\"display:flex; justify-content:space-between; font-size:13px; padding-top:4px;\">
              <span style=\"color:#6b7280;\">Solde dû</span>
              <span style=\"color:#111827;\">${formatCurrency(
                balanceDue
              )}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div style=\"padding-top:24px; display:flex; justify-content:space-between; align-items:flex-start;\">
        <div>
          <h3 style=\"font-weight:600; color:#111827; margin-bottom:6px; font-size:14px; margin:0 0 6px 0;\">NOTES</h3>
          <p style=\"font-size:13px; color:#6b7280; max-width:320px; line-height:1.4; margin:0;\">${
            normalized.notes
          }</p>
        </div>
        <div style=\"text-align:right;\">
          <h3 style=\"font-weight:600; color:#111827; margin-bottom:6px; font-size:14px; margin:0 0 6px 0;\">Une question ?</h3>
          <p style=\"font-size:13px; color:#6b7280; margin:0;\">${
            company.email
          }</p>
        </div>
      </div>`;
}

export async function buildPrintableDocument(
  invoice: PrintableInvoice | unknown
): Promise<string> {
  const normalized = await resolveInvoiceLogo(invoice);
  const body = generateInvoiceHTML(normalized);
  return `<!DOCTYPE html>
  <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Facture ${normalized.invoiceNumber}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #111827; margin: 24px; }
        @page { size: A4; margin: 18mm; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      ${body}
      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() { window.close(); };
        };
      <\/script>
    </body>
  </html>`;
}

/**
 * Print invoice using HTML rendering
 * @deprecated This function uses HTML→Canvas→PDF approach which is slower.
 * Consider using printInvoiceDirect() for better performance and quality.
 * This function will be maintained for backward compatibility.
 */
export function printInvoice(invoice: PrintableInvoice | unknown): void {
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "printInvoice() is using HTML rendering. Consider using printInvoiceDirect() for better performance."
    );
  }
  // Open the window synchronously (inside the user gesture) to avoid popup
  // blocking, then fill it once the logo has resolved to a data URL.
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.open();
  w.document.write(
    `<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>Préparation de la facture…</title></head><body style="font-family:Arial,sans-serif;color:#6b7280;padding:24px;">Préparation de la facture…</body></html>`
  );
  w.document.close();

  void buildPrintableDocument(invoice)
    .then((html) => {
      if (w.closed) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
    })
    .catch((error) => {
      console.error("Failed to render invoice for printing:", error);
      if (!w.closed) w.close();
    });
}

/**
 * Download invoice as PDF using HTML→Canvas→PDF approach
 * @deprecated This function uses HTML→Canvas→PDF which is slower and lower quality.
 * Consider using downloadInvoiceAsPDFDirect() for better performance and quality.
 * This function will be maintained for backward compatibility.
 */
export async function downloadInvoiceAsPDF(
  invoice: PrintableInvoice | unknown
) {
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "downloadInvoiceAsPDF() uses HTML→Canvas→PDF. Consider using downloadInvoiceAsPDFDirect() for better quality."
    );
  }
  const normalized = await resolveInvoiceLogo(invoice);
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const temp = document.createElement("div");
  temp.style.position = "absolute";
  temp.style.left = "-10000px";
  temp.style.top = "0";
  temp.style.width = "794px"; // A4 width @96DPI
  temp.style.minHeight = "1123px"; // A4 height @96DPI
  temp.style.backgroundColor = "#fff";
  temp.style.padding = "32px";
  temp.innerHTML = generateInvoiceHTML(normalized);
  document.body.appendChild(temp);

  const canvas = await html2canvas(temp, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
    windowWidth: 794,
    windowHeight: 1123,
  });

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const imgData = canvas.toDataURL("image/png", 1.0);
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
  const fileName = `invoice-${(
    normalized.invoiceNumber ||
    normalized._id ||
    Date.now()
  ).toString()}.pdf`;
  pdf.save(fileName);

  document.body.removeChild(temp);
}

// ============================================================================
// NEW: Direct PDF Generation (Recommended)
// Uses shared pdf-renderer for consistent, high-quality output
// ============================================================================

/**
 * Download invoice as PDF using direct jsPDF rendering (RECOMMENDED)
 * This is faster and produces better quality PDFs than the HTML→Canvas approach
 * Uses the shared pdf-renderer for consistency with server-side PDFs
 */
export async function downloadInvoiceAsPDFDirect(
  invoice: PrintableInvoice | unknown,
  companyInfo?: Partial<InvoiceCompanyInfo>
): Promise<void> {
  try {
    const normalized = ensurePrintableInvoice(invoice, { companyInfo });
    const { default: jsPDF } = await import("jspdf");
    const { renderInvoicePdf } = await import("@/lib/invoice/pdf-renderer");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    await renderInvoicePdf(pdf, normalized, { includeNotes: true });

    const fileName = `invoice-${(
      normalized.invoiceNumber ||
      normalized._id ||
      Date.now()
    ).toString()}.pdf`;
    pdf.save(fileName);
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    throw new Error(
      `PDF generation failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Print invoice using direct jsPDF rendering (RECOMMENDED)
 * Opens a print dialog with the PDF generated using shared renderer
 * Provides consistent output with downloadInvoiceAsPDFDirect()
 */
export async function printInvoiceDirect(
  invoice: PrintableInvoice | unknown,
  companyInfo?: Partial<InvoiceCompanyInfo>
): Promise<void> {
  try {
    const normalized = ensurePrintableInvoice(invoice, { companyInfo });
    const { default: jsPDF } = await import("jspdf");
    const { renderInvoicePdf } = await import("@/lib/invoice/pdf-renderer");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    await renderInvoicePdf(pdf, normalized, { includeNotes: true });

    // Open PDF in new window for printing
    const pdfBlob = pdf.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(pdfUrl, "_blank");

    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
        // Clean up the blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
      };
    }
  } catch (error) {
    console.error("Failed to print invoice:", error);
    throw new Error(
      `Print failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

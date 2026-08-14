/**
 * PropertyPro - Invoice PDF Renderer
 * Professional invoice PDF rendering using jsPDF
 * Features: Modern design, proper typography, accurate data mapping
 */

import type jsPDF from "jspdf";
import {
  NormalizedInvoice,
  InvoiceLineItemInfo,
} from "@/lib/invoice/invoice-shared";
import {
  deriveCompanyInitials,
  fetchLogoAsDataUrl,
} from "@/lib/invoice/logo-utils";
import { formatCurrency } from "@/lib/utils/formatting";

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

/** Page layout constants (A4 in mm) */
const PAGE = {
  WIDTH: 210,
  HEIGHT: 297,
  MARGIN_LEFT: 14,
  MARGIN_RIGHT: 14,
  MARGIN_TOP: 12,
  MARGIN_BOTTOM: 12,
  CONTENT_WIDTH: 182, // WIDTH - MARGIN_LEFT - MARGIN_RIGHT
} as const;

/** Color palette - Professional grayscale with accent */
const COLORS = {
  // Text colors
  PRIMARY: [17, 24, 39] as [number, number, number], // Near black
  SECONDARY: [75, 85, 99] as [number, number, number], // Medium gray
  MUTED: [107, 114, 128] as [number, number, number], // Light gray
  // Background colors
  HEADER_BG: [249, 250, 251] as [number, number, number], // Very light gray
  BORDER: [229, 231, 235] as [number, number, number], // Border gray
  ACCENT: [16, 185, 129] as [number, number, number], // Emerald green
  WHITE: [255, 255, 255] as [number, number, number],
} as const;

/** Typography configuration */
const FONTS = {
  FAMILY: "helvetica", // Built-in jsPDF font
  SIZES: {
    TITLE: 24,
    HEADING: 14,
    SUBHEADING: 11,
    BODY: 10,
    SMALL: 9,
    TINY: 8,
  },
  LINE_HEIGHT: 1.4,
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface InvoicePdfRenderOptions {
  includeNotes?: boolean;
  includePaymentInstructions?: boolean;
}

interface RenderContext {
  pdf: jsPDF;
  y: number;
  pageNumber: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function isApproximatelyZero(value: number): boolean {
  return Math.abs(value) < 1e-6;
}

function formatDisplayCurrency(amount: number, currencyCode?: string): string {
  const normalized = isApproximatelyZero(amount) ? 0 : amount;
  return formatCurrency(normalized, "XOF", { maximumFractionDigits: 0 });
}

/** Set text color from RGB tuple */
function setTextColor(
  pdf: jsPDF,
  color: readonly [number, number, number]
): void {
  pdf.setTextColor(color[0], color[1], color[2]);
}

/** Set fill color from RGB tuple */
function setFillColor(
  pdf: jsPDF,
  color: readonly [number, number, number]
): void {
  pdf.setFillColor(color[0], color[1], color[2]);
}

/** Set draw color from RGB tuple */
function setDrawColor(
  pdf: jsPDF,
  color: readonly [number, number, number]
): void {
  pdf.setDrawColor(color[0], color[1], color[2]);
}

/** Check if we need a new page and add one if necessary */
function ensureSpace(ctx: RenderContext, requiredHeight: number): void {
  // Invoice PDFs in Gestion E-IMMO are intentionally single-page documents.
  // The renderer uses compact spacing; when space becomes tight, sections keep
  // flowing on the same page instead of creating a second, inconsistent sheet.
  const maxY = PAGE.HEIGHT - PAGE.MARGIN_BOTTOM - 8;
  if (ctx.y + requiredHeight > maxY) {
    ctx.y = Math.min(ctx.y, maxY - requiredHeight);
  }
}

/** Render a section header with optional underline */
function renderSectionHeader(
  ctx: RenderContext,
  title: string,
  options: { uppercase?: boolean; underline?: boolean } = {}
): void {
  const { uppercase = true, underline = false } = options;

  ctx.pdf.setFont(FONTS.FAMILY, "bold");
  ctx.pdf.setFontSize(FONTS.SIZES.SUBHEADING);
  setTextColor(ctx.pdf, COLORS.SECONDARY);

  const displayTitle = uppercase ? title.toUpperCase() : title;
  ctx.pdf.text(displayTitle, PAGE.MARGIN_LEFT, ctx.y);

  if (underline) {
    setDrawColor(ctx.pdf, COLORS.BORDER);
    ctx.pdf.setLineWidth(0.3);
    ctx.pdf.line(
      PAGE.MARGIN_LEFT,
      ctx.y + 2,
      PAGE.MARGIN_LEFT + PAGE.CONTENT_WIDTH,
      ctx.y + 2
    );
  }

  ctx.y += 4;
  ctx.pdf.setFont(FONTS.FAMILY, "normal");
}

/** Render party information (Invoice from / Invoice to) */
function renderPartySection(
  pdf: jsPDF,
  x: number,
  y: number,
  title: string,
  lines: string[],
  maxWidth: number = 75
): number {
  // Section title
  pdf.setFont(FONTS.FAMILY, "bold");
  pdf.setFontSize(FONTS.SIZES.SMALL);
  setTextColor(pdf, COLORS.SECONDARY);
  pdf.text(title.toUpperCase(), x, y);
  pdf.setFont(FONTS.FAMILY, "normal");

  // Content lines
  setTextColor(pdf, COLORS.PRIMARY);
  pdf.setFontSize(FONTS.SIZES.SMALL);

  let currentY = y + 6;
  const filteredLines = lines.filter(Boolean);

  filteredLines.forEach((line, index) => {
    // First line (name) is bold
    if (index === 0) {
      pdf.setFont(FONTS.FAMILY, "bold");
    } else {
      pdf.setFont(FONTS.FAMILY, "normal");
    }

    const wrappedLines = pdf.splitTextToSize(String(line), maxWidth);
    wrappedLines.forEach((wrappedLine: string) => {
      pdf.text(wrappedLine, x, currentY);
      currentY += 4.5;
    });
  });

  pdf.setFont(FONTS.FAMILY, "normal");
  return currentY;
}

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

/**
 * Render a professional invoice PDF
 * @param pdf - jsPDF instance to render to
 * @param normalized - Normalized invoice data
 * @param options - Rendering options
 * @returns The jsPDF instance with rendered content
 */
export async function renderInvoicePdf(
  pdf: jsPDF,
  normalized: NormalizedInvoice,
  options: InvoicePdfRenderOptions = {}
): Promise<jsPDF> {
  const { includeNotes = true } = options;

  // Initialize render context
  const ctx: RenderContext = {
    pdf,
    y: PAGE.MARGIN_TOP,
    pageNumber: 1,
  };

  // Set default font
  pdf.setFont(FONTS.FAMILY, "normal");

  // ========================================================================
  // HEADER SECTION
  // ========================================================================
  await renderHeader(ctx, normalized);

  // ========================================================================
  // PARTY SECTIONS (Invoice From / Invoice To)
  // ========================================================================
  renderPartySections(ctx, normalized);
  renderInvoiceReferences(ctx, normalized);

  // ========================================================================
  // LINE ITEMS TABLE
  // ========================================================================
  renderLineItemsTable(ctx, normalized);

  // ========================================================================
  // TOTALS SECTION
  // ========================================================================
  renderTotals(ctx, normalized);

  // ========================================================================
  // NOTES & FOOTER
  // ========================================================================
  if (includeNotes) {
    renderNotes(ctx, normalized);
  }

  renderFooter(ctx, normalized.companyInfo.name);

  return pdf;
}

// ============================================================================
// SECTION RENDERERS
// ============================================================================

/** Render the invoice header with logo and invoice meta */
async function renderHeader(
  ctx: RenderContext,
  normalized: NormalizedInvoice
): Promise<void> {
  const { pdf } = ctx;
  const company = normalized.companyInfo;
  const companyInitials = deriveCompanyInitials(company.name);
  const logoSize = 16;
  const logoX = PAGE.MARGIN_LEFT;
  const logoY = PAGE.MARGIN_TOP;

  // Try to render company logo
  let logoRendered = false;
  if (company.logo) {
    try {
      const logoData = await fetchLogoAsDataUrl(company.logo);
      if (logoData.dataUrl && logoData.format) {
        pdf.addImage(
          logoData.dataUrl,
          logoData.format,
          logoX,
          logoY,
          logoSize,
          logoSize,
          undefined,
          "FAST"
        );
        logoRendered = true;
      }
    } catch {
      // Le logo est facultatif : poursuivre avec les initiales de l'émetteur.
    }
  }

  // Fallback: Render initials in colored circle
  if (!logoRendered) {
    setFillColor(pdf, COLORS.ACCENT);
    pdf.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, "F");
    setTextColor(pdf, COLORS.WHITE);
    pdf.setFontSize(FONTS.SIZES.SUBHEADING);
    pdf.setFont(FONTS.FAMILY, "bold");
    pdf.text(companyInitials, logoX + logoSize / 2, logoY + logoSize / 2 + 2, {
      align: "center",
    });
    pdf.setFont(FONTS.FAMILY, "normal");
  }

  // Company name next to logo
  const companyTextX = logoX + logoSize + 8;
  pdf.setFont(FONTS.FAMILY, "bold");
  pdf.setFontSize(FONTS.SIZES.HEADING);
  setTextColor(pdf, COLORS.PRIMARY);
  pdf.text(company.name, companyTextX, logoY + 6);

  // Company contact info
  pdf.setFont(FONTS.FAMILY, "normal");
  pdf.setFontSize(FONTS.SIZES.SMALL);
  setTextColor(pdf, COLORS.MUTED);
  let companyInfoY = logoY + 12;
  if (company.address) {
    const addressLines = pdf.splitTextToSize(String(company.address), 82);
    addressLines.slice(0, 2).forEach((line: string) => {
      pdf.text(line, companyTextX, companyInfoY);
      companyInfoY += 4;
    });
  }
  const contactLine = [company.phone, company.email].filter(Boolean).join(" • ");
  if (contactLine) {
    pdf.text(contactLine, companyTextX, companyInfoY);
  }
  if (company.website) {
    companyInfoY += 4;
    pdf.text(company.website, companyTextX, companyInfoY);
  }

  // ========================================================================
  // RIGHT SIDE: INVOICE title and meta
  // ========================================================================
  const rightX = PAGE.WIDTH - PAGE.MARGIN_RIGHT;

  // "INVOICE" title
  pdf.setFont(FONTS.FAMILY, "bold");
  pdf.setFontSize(FONTS.SIZES.TITLE);
  setTextColor(pdf, COLORS.PRIMARY);
  pdf.text("FACTURE", rightX, logoY + 8, { align: "right" });

  // Invoice number (prominent)
  pdf.setFontSize(FONTS.SIZES.SUBHEADING);
  setTextColor(pdf, COLORS.ACCENT);
  const invoiceNumber = String(
    normalized.invoiceNumber || normalized._id || "INV-0001"
  );
  pdf.text(invoiceNumber, rightX, logoY + 16, { align: "right" });

  // Status badge
  const statusBadgeWidth = 28;
  const statusBadgeHeight = 7;
  const statusBadgeX = rightX - statusBadgeWidth;
  const statusBadgeY = logoY + 20;

  setFillColor(pdf, normalized.statusMeta.pdfFillColor);
  pdf.roundedRect(
    statusBadgeX,
    statusBadgeY,
    statusBadgeWidth,
    statusBadgeHeight,
    2,
    2,
    "F"
  );
  setTextColor(pdf, COLORS.WHITE);
  pdf.setFontSize(FONTS.SIZES.TINY);
  pdf.setFont(FONTS.FAMILY, "bold");
  pdf.text(
    normalized.statusMeta.label.toUpperCase(),
    statusBadgeX + statusBadgeWidth / 2,
    statusBadgeY + 5,
    { align: "center" }
  );
  pdf.setFont(FONTS.FAMILY, "normal");

  // Dates
  pdf.setFontSize(FONTS.SIZES.SMALL);
  setTextColor(pdf, COLORS.SECONDARY);
  const dateFormat: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  const issueDate = normalized.issueDate.toLocaleDateString(
    "fr-FR",
    dateFormat
  );
  const dueDate = normalized.dueDate.toLocaleDateString("fr-FR", dateFormat);

  let dateY = statusBadgeY + 14;
  pdf.text(`Date d'émission: ${issueDate}`, rightX, dateY, { align: "right" });
  dateY += 5;
  pdf.text(`Date d'échéance: ${dueDate}`, rightX, dateY, { align: "right" });

  // Update context y position
  ctx.y = Math.max(logoY + logoSize + 8, dateY + 5);
}

/** Render Invoice From and Invoice To sections */
function renderPartySections(
  ctx: RenderContext,
  normalized: NormalizedInvoice
): void {
  const { pdf } = ctx;
  const company = normalized.companyInfo;

  // Use proper tenant/property from normalized object
  const tenant = normalized.tenant || normalized.tenantId || {};
  const property = normalized.property || normalized.propertyId || {};

  const sectionY = ctx.y + 5;
  const leftX = PAGE.MARGIN_LEFT;
  const rightX = PAGE.WIDTH / 2 + 10;

  // Informations professionnelles de l'émetteur
const accountTypeLabel =
  company.accountType === "direct_owner"
    ? "Propriétaire direct"
    : company.accountType === "agency"
      ? "Agence immobilière"
      : company.accountType === "manager" || company.accountType === "property_manager"
        ? "Gestionnaire"
        : company.accountType === "e_immo" || company.accountType === "admin" || company.accountType === "super_admin"
          ? "Gestion E-IMMO"
          : String(company.roleLabel || "");

const fromLines = [
  company.name,
  [company.legalName && company.legalName !== company.name ? company.legalName : "", accountTypeLabel].filter(Boolean).join(" • "),
  "Plateforme : E-IMMO",
  [company.cip ? `CIP : ${company.cip}` : "", company.ifu ? `IFU : ${company.ifu}` : "", company.rccm ? `RCCM : ${company.rccm}` : ""].filter(Boolean).join(" • "),
  company.address,
  [company.phone, company.email].filter(Boolean).join(" • "),
].filter(Boolean) as string[];

  // Build "Invoice To" lines
  const toLines: string[] = [];

  // Tenant name
  const tenantName =
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    tenant.name ||
    "Locataire";
  toLines.push(tenantName);

  // Tenant contact
  const tenantContact = [tenant.phone, tenant.email].filter(Boolean).join(" • ");
  if (tenantContact) toLines.push(tenantContact);

  // Property info
  if (property.name) {
    toLines.push(""); // Spacer
    toLines.push(String(property.name));
  }

  // Property address
  if (property.address) {
    if (typeof property.address === "string") {
      toLines.push(property.address);
    } else {
      const addr = property.address;
      if (addr.street) toLines.push(addr.street);
      const cityStateZip = [addr.city, addr.state, addr.zipCode]
        .filter(Boolean)
        .join(", ");
      if (cityStateZip) toLines.push(cityStateZip);
    }
  }

  // Render both sections
  const fromEndY = renderPartySection(
    pdf,
    leftX,
    sectionY,
    "Émetteur",
    fromLines,
    75
  );
  const toEndY = renderPartySection(
    pdf,
    rightX,
    sectionY,
    "Facturé à",
    toLines,
    75
  );

  ctx.y = Math.max(fromEndY, toEndY) + 5;
}

function renderInvoiceReferences(
  ctx: RenderContext,
  normalized: NormalizedInvoice
): void {
  const { pdf } = ctx;
  const property = normalized.property || normalized.propertyId || {};
  const lease = normalized.leaseId || {};
  const parts: string[] = [];

  if (property.name) parts.push(`Bien : ${String(property.name)}`);
  if ((property as any).unit) parts.push(`Unité : ${String((property as any).unit)}`);
  if ((property as any).type) parts.push(`Type : ${String((property as any).type)}`);

  const startDate = (lease as any).startDate;
  const endDate = (lease as any).endDate;
  const format = (value: unknown) => {
    if (!value) return "";
    const date = new Date(value as any);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("fr-FR");
  };
  if (startDate || endDate) {
    parts.push(`Bail : ${format(startDate)}${startDate && endDate ? " au " : ""}${format(endDate)}`);
  }

  if (!parts.length) return;

  pdf.setFont(FONTS.FAMILY, "bold");
  pdf.setFontSize(FONTS.SIZES.TINY);
  setTextColor(pdf, COLORS.SECONDARY);
  pdf.text("RÉFÉRENCES", PAGE.MARGIN_LEFT, ctx.y);
  ctx.y += 4;

  pdf.setFont(FONTS.FAMILY, "normal");
  const lines = pdf.splitTextToSize(parts.join("   •   "), PAGE.CONTENT_WIDTH);
  lines.slice(0, 2).forEach((line: string) => {
    pdf.text(line, PAGE.MARGIN_LEFT, ctx.y);
    ctx.y += 4;
  });
  ctx.y += 3;
}

/** Render the line items table */
function renderLineItemsTable(
  ctx: RenderContext,
  normalized: NormalizedInvoice
): void {
  const { pdf } = ctx;
  const items = Array.isArray(normalized.lineItems)
    ? (normalized.lineItems as InvoiceLineItemInfo[])
    : [];

  const tableX = PAGE.MARGIN_LEFT;
  const tableWidth = PAGE.CONTENT_WIDTH;
  const headerHeight = 8;
  const rowHeight = items.length > 8 ? 5.5 : 7;

  // Column positions (relative to tableX)
  const cols = {
    num: { x: 0, width: 12 },
    desc: { x: 12, width: 80 },
    qty: { x: 92, width: 22 },
    unit: { x: 114, width: 28 },
    total: { x: 142, width: 28 },
  };

  // ========================================================================
  // TABLE HEADER
  // ========================================================================
  ensureSpace(ctx, headerHeight + rowHeight * Math.min(items.length, 3) + 20);

  // Header background
  setFillColor(pdf, COLORS.HEADER_BG);
  pdf.rect(tableX, ctx.y, tableWidth, headerHeight, "F");

  // Header text
  pdf.setFont(FONTS.FAMILY, "bold");
  pdf.setFontSize(FONTS.SIZES.SMALL);
  setTextColor(pdf, COLORS.PRIMARY);

  const headerY = ctx.y + 5.5;
  pdf.text("#", tableX + cols.num.x + 4, headerY);
  pdf.text("Description", tableX + cols.desc.x + 4, headerY);
  pdf.text("Qté", tableX + cols.qty.x + cols.qty.width / 2, headerY, {
    align: "center",
  });
  pdf.text("Prix unitaire", tableX + cols.unit.x + cols.unit.width - 2, headerY, {
    align: "right",
  });
  pdf.text("Total", tableX + cols.total.x + cols.total.width - 2, headerY, {
    align: "right",
  });

  ctx.y += headerHeight;

  // ========================================================================
  // TABLE ROWS
  // ========================================================================
  pdf.setFont(FONTS.FAMILY, "normal");
  pdf.setFontSize(items.length > 8 ? FONTS.SIZES.TINY : FONTS.SIZES.SMALL);

  if (items.length === 0) {
    // Empty state
    setTextColor(pdf, COLORS.MUTED);
    pdf.text("Aucun élément", tableX + tableWidth / 2, ctx.y + 6, {
      align: "center",
    });
    ctx.y += rowHeight + 4;
  } else {
    items.forEach((item, index) => {
      ensureSpace(ctx, rowHeight + 4);

      const qty = Number(item.quantity ?? 1) || 1;
      const unit = Number(item.unitPrice ?? 0);
      const total = Number(item.total ?? item.amount ?? qty * unit);

      const rowY = ctx.y + (rowHeight > 6 ? 5 : 4);
      setTextColor(pdf, COLORS.PRIMARY);

      // Row number
      pdf.text(String(index + 1), tableX + cols.num.x + 4, rowY);

      // Description (with truncation if needed)
      const description = String(item.description || "Article");
      const maxDescWidth = cols.desc.width - 8;
      const truncatedDesc =
        pdf.getTextWidth(description) > maxDescWidth
          ? description.slice(0, 40) + "..."
          : description;
      pdf.text(truncatedDesc, tableX + cols.desc.x + 4, rowY);

      // Quantity
      pdf.text(String(qty), tableX + cols.qty.x + cols.qty.width / 2, rowY, {
        align: "center",
      });

      // Unit price
      pdf.text(
        formatDisplayCurrency(unit, normalized.currencyCode),
        tableX + cols.unit.x + cols.unit.width - 2,
        rowY,
        { align: "right" }
      );

      // Total
      pdf.setFont(FONTS.FAMILY, "bold");
      pdf.text(
        formatDisplayCurrency(total, normalized.currencyCode),
        tableX + cols.total.x + cols.total.width - 2,
        rowY,
        { align: "right" }
      );
      pdf.setFont(FONTS.FAMILY, "normal");

      ctx.y += rowHeight;
    });
  }

  ctx.y += 8;
}

/** Render the totals section */
function renderTotals(ctx: RenderContext, normalized: NormalizedInvoice): void {
  const { pdf } = ctx;
  const {
    totals: {
      subtotal,
      taxAmount,
      discountAmount,
      shippingAmount,
      adjustmentsAmount,
      total,
      amountPaid,
      balanceDue,
    },
  } = normalized;

  ensureSpace(ctx, 45);

  // Totals box dimensions
  const boxWidth = 75;
  const boxX = PAGE.WIDTH - PAGE.MARGIN_RIGHT - boxWidth;
  const labelX = boxX + 5;
  const valueX = boxX + boxWidth - 5;
  const lineHeight = 5;

  // Start totals
  let y = ctx.y;

  pdf.setFontSize(FONTS.SIZES.SMALL);
  setTextColor(pdf, COLORS.SECONDARY);

  // Subtotal
  pdf.text("Sous-total", labelX, y);
  pdf.text(formatDisplayCurrency(subtotal, normalized.currencyCode), valueX, y, { align: "right" });
  y += lineHeight;

  // Only show non-zero additional charges
  if (!isApproximatelyZero(shippingAmount)) {
    pdf.text("Frais", labelX, y);
    pdf.text(formatDisplayCurrency(shippingAmount, normalized.currencyCode), valueX, y, {
      align: "right",
    });
    y += lineHeight;
  }

  if (!isApproximatelyZero(discountAmount)) {
    pdf.text("Remise", labelX, y);
    const discountDisplay = -Math.abs(discountAmount);
    pdf.text(formatDisplayCurrency(discountDisplay, normalized.currencyCode), valueX, y, {
      align: "right",
    });
    y += lineHeight;
  }

  if (!isApproximatelyZero(adjustmentsAmount)) {
    pdf.text("Ajustements", labelX, y);
    pdf.text(formatDisplayCurrency(adjustmentsAmount, normalized.currencyCode), valueX, y, {
      align: "right",
    });
    y += lineHeight;
  }

  if (!isApproximatelyZero(taxAmount)) {
    pdf.text("Taxes", labelX, y);
    pdf.text(formatDisplayCurrency(taxAmount, normalized.currencyCode), valueX, y, { align: "right" });
    y += lineHeight;
  }

  y += 4;

  // Grand Total (highlighted)
  pdf.setFont(FONTS.FAMILY, "bold");
  pdf.setFontSize(FONTS.SIZES.HEADING);
  setTextColor(pdf, COLORS.PRIMARY);
  pdf.text("Total", labelX, y);
  pdf.text(formatDisplayCurrency(total, normalized.currencyCode), valueX, y, { align: "right" });
  y += lineHeight + 4;

  // Amount Paid
  pdf.setFont(FONTS.FAMILY, "normal");
  pdf.setFontSize(FONTS.SIZES.SMALL);
  setTextColor(pdf, COLORS.SECONDARY);
  pdf.text("Montant payé", labelX, y);
  pdf.text(formatDisplayCurrency(amountPaid, normalized.currencyCode), valueX, y, { align: "right" });
  y += lineHeight + 2;

  // Balance Due (highlighted if non-zero)
  if (!isApproximatelyZero(balanceDue)) {
    // Background highlight for balance due
    setFillColor(pdf, COLORS.ACCENT);
    pdf.roundedRect(boxX, y - 4, boxWidth, 10, 2, 2, "F");

    setTextColor(pdf, COLORS.WHITE);
    pdf.setFont(FONTS.FAMILY, "bold");
    pdf.text("Solde dû", labelX, y + 2);
    pdf.text(formatDisplayCurrency(balanceDue, normalized.currencyCode), valueX, y + 2, {
      align: "right",
    });
    y += 14;
  } else {
    setTextColor(pdf, COLORS.ACCENT);
    pdf.setFont(FONTS.FAMILY, "bold");
    pdf.text("Solde dû", labelX, y);
    pdf.text(formatDisplayCurrency(0, normalized.currencyCode), valueX, y, { align: "right" });
    y += lineHeight;
  }

  ctx.y = y + 5;
}

/** Render notes section */
function renderNotes(ctx: RenderContext, normalized: NormalizedInvoice): void {
  const { pdf } = ctx;
  const company = normalized.companyInfo;

  // Keep notes on the same A4 page. Place them after totals while reserving footer space.
  const notesMinY = Math.min(Math.max(ctx.y + 2, 238), PAGE.HEIGHT - PAGE.MARGIN_BOTTOM - 34);
  ctx.y = notesMinY;

  // Separator line
  setDrawColor(pdf, COLORS.BORDER);
  pdf.setLineWidth(0.3);
  pdf.line(PAGE.MARGIN_LEFT, ctx.y, PAGE.WIDTH - PAGE.MARGIN_RIGHT, ctx.y);
  ctx.y += 8;

  // Notes section (left side)
  pdf.setFont(FONTS.FAMILY, "bold");
  pdf.setFontSize(FONTS.SIZES.BODY);
  setTextColor(pdf, COLORS.PRIMARY);
  pdf.text("NOTES", PAGE.MARGIN_LEFT, ctx.y);

  ctx.y += 5;
  pdf.setFont(FONTS.FAMILY, "normal");
  pdf.setFontSize(FONTS.SIZES.SMALL);
  setTextColor(pdf, COLORS.MUTED);

  // Wrap notes text
  const notesText = normalized.notes || "Merci pour votre confiance!";
  const wrappedNotes = pdf.splitTextToSize(notesText, 100).slice(0, 3);
  wrappedNotes.forEach((line: string) => {
    pdf.text(line, PAGE.MARGIN_LEFT, ctx.y);
    ctx.y += 4;
  });

  // Contact section (right side)
  const contactX = PAGE.WIDTH - PAGE.MARGIN_RIGHT - 60;
  const contactY = notesMinY + 8;

  pdf.setFont(FONTS.FAMILY, "bold");
  pdf.setFontSize(FONTS.SIZES.BODY);
  setTextColor(pdf, COLORS.PRIMARY);
  pdf.text("Une question ?", contactX, contactY);

  pdf.setFont(FONTS.FAMILY, "normal");
  pdf.setFontSize(FONTS.SIZES.SMALL);
  setTextColor(pdf, COLORS.MUTED);
  pdf.text(company.email, contactX, contactY + 5);
  if (company.phone) {
    pdf.text(company.phone, contactX, contactY + 10);
  }
}

/** Render footer */
function renderFooter(ctx: RenderContext, companyName?: string): void {
  const { pdf, pageNumber } = ctx;

  // Footer position
  const footerY = PAGE.HEIGHT - PAGE.MARGIN_BOTTOM + 5;

  pdf.setFont(FONTS.FAMILY, "normal");
  pdf.setFontSize(FONTS.SIZES.TINY);
  setTextColor(pdf, COLORS.MUTED);

  // Left side - generated message
  pdf.text(
    `Facture générée via E-IMMO pour ${companyName || "le compte émetteur"}`,
    PAGE.MARGIN_LEFT,
    footerY
  );

  // Right side - page number (if multi-page)
  if (pageNumber > 1 || ctx.y > PAGE.HEIGHT - 50) {
    pdf.text(`Page ${pageNumber}`, PAGE.WIDTH - PAGE.MARGIN_RIGHT, footerY, {
      align: "right",
    });
  }
}

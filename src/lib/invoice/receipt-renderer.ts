/**
 * PropertyPro - Receipt PDF Renderer
 * Shared receipt PDF rendering logic using jsPDF
 * Provides consistent receipt layout across the application
 */

import type jsPDF from "jspdf";
import {
  deriveCompanyInitials,
  fetchLogoAsDataUrl,
} from "@/lib/invoice/logo-utils";
import { formatCurrency } from "@/lib/utils/formatting";

export interface ReceiptCompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  logo?: string;
}

export interface ReceiptTenantInfo {
  name: string;
  email: string;
  address?: string;
}

export interface ReceiptPropertyInfo {
  name: string;
  address: string;
  owner?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    accountType?: string;
    businessName?: string;
    businessLogo?: string;
    cip?: string;
    ifu?: string;
    rccm?: string;
  };
}

export interface ReceiptInvoiceApplication {
  invoiceNumber: string;
  amountApplied: number;
}

export interface NormalizedReceipt {
  receiptNumber: string;
  paymentId: string;
  paymentDate: Date;
  paymentMethod: string;
  amount: number;
  description: string;
  invoiceApplications: ReceiptInvoiceApplication[];
  tenant: ReceiptTenantInfo;
  property: ReceiptPropertyInfo;
  company: ReceiptCompanyInfo;
}

export interface ReceiptPdfRenderOptions {
  includeFooter?: boolean;
}

/**
 * Render a professional payment receipt PDF
 * Uses consistent styling with invoice renderer
 */
export async function renderReceiptPdf(
  pdf: jsPDF,
  receipt: NormalizedReceipt,
  options: ReceiptPdfRenderOptions = {}
): Promise<jsPDF> {
  try {
    const includeFooter = options.includeFooter ?? true;

    // ========================================================================
    // COLORS - Professional color scheme
    // ========================================================================
    const primaryColor = [16, 185, 129] as [number, number, number]; // Green (matches invoice)
    const textColor = [17, 24, 39] as [number, number, number]; // Dark gray
    const grayColor = [107, 114, 128] as [number, number, number]; // Medium gray
    const lightGrayColor = [156, 163, 175] as [number, number, number]; // Light gray

    // ========================================================================
    // HEADER - Company Logo & Info
    // ========================================================================
    // Property owner / professional identity
const owner = receipt.property.owner;

const ownerFullName = owner
  ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim()
  : "";

const professionalName =
  owner?.businessName?.trim() ||
  ownerFullName ||
  receipt.company.name;

const professionalType =
  owner?.accountType === "direct_owner"
    ? "Propriétaire direct"
    : owner?.accountType === "agency"
      ? "Agence immobilière"
      : owner?.accountType === "e_immo"
        ? "E-IMMO"
        : "";
    const companyInitials = deriveCompanyInitials(professionalName);
    let logoRendered = false;

    if (receipt.company.logo) {
      const logoData = await fetchLogoAsDataUrl(receipt.company.logo);
      if (logoData.dataUrl && logoData.format) {
        try {
          pdf.addImage(
            logoData.dataUrl,
            logoData.format,
            15,
            15,
            20,
            20,
            undefined,
            "FAST"
          );
          logoRendered = true;
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("Failed to render company logo in receipt PDF", error);
          }
        }
      }
    }

    // Fallback to initials if logo not rendered
    if (!logoRendered) {
      pdf.setFillColor(...primaryColor);
      pdf.rect(15, 15, 20, 20, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text(companyInitials, 25, 26, { align: "center" });
      pdf.setFont("helvetica", "normal");
    }

    // Property owner / agency info (left side)
pdf.setTextColor(...textColor);
pdf.setFontSize(14);
pdf.setFont("helvetica", "bold");
pdf.text(professionalName, 38, 20);
pdf.setFont("helvetica", "normal");

pdf.setFontSize(9);
pdf.setTextColor(...grayColor);

let ownerInfoY = 26;

if (professionalType) {
  pdf.text(professionalType, 38, ownerInfoY);
  ownerInfoY += 5;
}

if (owner?.cip) {
  pdf.text(`CIP : ${owner.cip}`, 38, ownerInfoY);
  ownerInfoY += 5;
}

if (owner?.ifu) {
  pdf.text(`IFU : ${owner.ifu}`, 38, ownerInfoY);
  ownerInfoY += 5;
}

if (owner?.rccm) {
  pdf.text(`RCCM : ${owner.rccm}`, 38, ownerInfoY);
  ownerInfoY += 5;
}

if (owner?.phone) {
  pdf.text(owner.phone, 38, ownerInfoY);
  ownerInfoY += 5;
}

if (owner?.email) {
  pdf.text(owner.email, 38, ownerInfoY);
}

    // Receipt meta info (right side) - Better aligned
    pdf.setFontSize(9);
    pdf.setTextColor(...grayColor);
    const labelX = 130;
    const valueX = 195;

    pdf.text("Receipt Number:", labelX, 20);
    pdf.text("Payment Date:", labelX, 26);
    pdf.text("Payment Method:", labelX, 32);

    pdf.setTextColor(...textColor);
    pdf.setFont("helvetica", "bold");
    pdf.text(receipt.receiptNumber, valueX, 20, { align: "right" });
    pdf.text(receipt.paymentDate.toLocaleDateString(), valueX, 26, {
      align: "right",
    });
    pdf.text(receipt.paymentMethod, valueX, 32, { align: "right" });
    pdf.setFont("helvetica", "normal");

    // ========================================================================
    // RECEIPT TITLE - Centered and prominent
    // ========================================================================
    let y = 55;
    pdf.setTextColor(...textColor);
    pdf.setFontSize(22);
    pdf.setFont("helvetica", "bold");
    pdf.text("PAYMENT RECEIPT", 105, y, { align: "center" });
    pdf.setFont("helvetica", "normal");

    // Decorative line under title
    y += 5;
    pdf.setDrawColor(...primaryColor);
    pdf.setLineWidth(1);
    pdf.line(70, y, 140, y);

    // ========================================================================
    // TENANT SECTION - "Received From"
    // ========================================================================
    y += 12;
    pdf.setFontSize(10);
    pdf.setTextColor(...grayColor);
    pdf.setFont("helvetica", "bold");
    pdf.text("RECEIVED FROM", 15, y);
    pdf.setFont("helvetica", "normal");

    y += 6;
    pdf.setTextColor(...textColor);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(receipt.tenant.name, 15, y);
    pdf.setFont("helvetica", "normal");

    y += 5;
    pdf.setFontSize(9);
    pdf.setTextColor(...grayColor);
    pdf.text(receipt.tenant.email, 15, y);

    if (receipt.tenant.address) {
      y += 5;
      const addressLines = pdf.splitTextToSize(receipt.tenant.address, 85);
      pdf.text(addressLines, 15, y);
      y += addressLines.length * 5;
    }

    // ========================================================================
    // PROPERTY SECTION
    // ========================================================================
    y += 10;
    pdf.setFontSize(10);
    pdf.setTextColor(...grayColor);
    pdf.setFont("helvetica", "bold");
    pdf.text("PROPERTY", 15, y);
    pdf.setFont("helvetica", "normal");

    y += 6;
    pdf.setTextColor(...textColor);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(receipt.property.name, 15, y);
    pdf.setFont("helvetica", "normal");

    y += 5;
    pdf.setFontSize(9);
    pdf.setTextColor(...grayColor);
    const propertyAddressLines = pdf.splitTextToSize(
      receipt.property.address,
      85
    );
    pdf.text(propertyAddressLines, 15, y);
    y += propertyAddressLines.length * 5;

    // ========================================================================
    // PAYMENT DETAILS SECTION - Professional table layout
    // ========================================================================
    y += 15;
    pdf.setFontSize(12);
    pdf.setTextColor(...textColor);
    pdf.setFont("helvetica", "bold");
    pdf.text("PAYMENT DETAILS", 15, y);
    pdf.setFont("helvetica", "normal");

    // Table header with better styling
    y += 8;
    pdf.setFillColor(243, 244, 246); // Light gray background
    pdf.rect(15, y, 180, 10, "F");
    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.5);
    pdf.rect(15, y, 180, 10);

    pdf.setFontSize(9);
    pdf.setTextColor(...grayColor);
    pdf.setFont("helvetica", "bold");
    pdf.text("Description", 20, y + 6.5);
    pdf.text("Amount", 188, y + 6.5, { align: "right" });
    pdf.setFont("helvetica", "normal");

    // Table content with proper spacing
    y += 12;
    pdf.setTextColor(...textColor);
    pdf.setFontSize(9);

    if (receipt.invoiceApplications.length > 0) {
      // Show invoice applications
      receipt.invoiceApplications.forEach((app, index) => {
        pdf.text(`Payment for Invoice ${app.invoiceNumber}`, 20, y + 3);
        pdf.setFont("helvetica", "bold");
        pdf.text(formatCurrency(app.amountApplied), 188, y + 3, {
          align: "right",
        });
        pdf.setFont("helvetica", "normal");

        // Row separator (except for last row)
        if (index < receipt.invoiceApplications.length - 1) {
          pdf.setDrawColor(229, 231, 235);
          pdf.setLineWidth(0.3);
          pdf.line(15, y + 7, 195, y + 7);
        }
        y += 10;
      });
    } else {
      // Show general payment description
      const description = receipt.description || "Payment received";
      const descLines = pdf.splitTextToSize(description, 140);
      pdf.text(descLines, 20, y + 3);
      pdf.setFont("helvetica", "bold");
      pdf.text(formatCurrency(receipt.amount), 188, y + 3, {
        align: "right",
      });
      pdf.setFont("helvetica", "normal");
      y += 10;
    }

    // Total separator line
    y += 5;
    pdf.setDrawColor(...textColor);
    pdf.setLineWidth(0.8);
    pdf.line(15, y, 195, y);

    // Total amount - Emphasized
    y += 10;
    pdf.setFillColor(16, 185, 129); // Green background
    pdf.rect(15, y - 5, 180, 14, "F");

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255); // White text
    pdf.text("TOTAL PAID", 20, y + 3);
    pdf.setFontSize(14);
    pdf.text(formatCurrency(receipt.amount), 188, y + 3, { align: "right" });
    pdf.setFont("helvetica", "normal");

    // ========================================================================
    // FOOTER - Thank you message and generation info
    // ========================================================================
    if (includeFooter) {
      y += 25;

      // Thank you message
      pdf.setFontSize(11);
      pdf.setTextColor(...textColor);
      pdf.setFont("helvetica", "bold");
      pdf.text("Thank you for your payment!", 105, y, { align: "center" });
      pdf.setFont("helvetica", "normal");

      y += 8;
      pdf.setFontSize(9);
      pdf.setTextColor(...grayColor);
      pdf.text(
        "This receipt confirms your payment has been received and processed.",
        105,
        y,
        { align: "center" }
      );

      // Generation timestamp
      y += 15;
      pdf.setFontSize(8);
      pdf.setTextColor(...lightGrayColor);
      pdf.text(
        `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
        105,
        y,
        { align: "center" }
      );

      y += 4;
      pdf.text("PropertyPro Property Management System", 105, y, {
        align: "center",
      });
    }

    return pdf;
  } catch (error) {
    console.error("Receipt PDF rendering failed:", error);
    throw new Error(
      `Failed to render receipt PDF: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

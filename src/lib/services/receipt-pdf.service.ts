/**
 * PropertyPro - Receipt PDF Service
 * Server-side receipt PDF generation using shared renderer
 * Provides consistent receipt PDFs for API routes and email attachments
 */

import jsPDF from "jspdf";
import {
  NormalizedReceipt,
  renderReceiptPdf,
  ReceiptCompanyInfo,
} from "@/lib/invoice/receipt-renderer";
import { getCompanyInfoServer } from "@/lib/utils/company-info";
import { mergeReceiptCompanyWithDefaults } from "@/lib/invoice/company-info-defaults";

/**
 * Payment data interface for receipt generation
 * Accepts various payment data formats
 */
export interface ReceiptPaymentData {
  _id?: string | { toString: () => string };
  receiptNumber?: string;
  amount: number;
  paymentMethod?: string;
  paymentDate?: Date;
  paidDate?: Date;
  createdAt?: Date;
  description?: string;
  type?: string;
  tenantId?: {
    _id?: string | { toString: () => string };
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  propertyId?: {
  _id?: string | { toString: () => string };
  name?: string;
  address?: string | {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  ownerId?: {
    _id?: string | { toString: () => string };
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
};
  invoiceApplications?: Array<{
    invoiceNumber: string;
    amountApplied: number;
  }>;
}

/**
 * Options for receipt PDF generation
 */
export interface ReceiptPdfOptions {
  companyInfo?: Partial<ReceiptCompanyInfo>;
  includeFooter?: boolean;
}

/**
 * Generate receipt PDF buffer for server-side use
 * Returns a Buffer that can be used for API responses or email attachments
 */
export async function generateReceiptPdfBuffer(
  paymentData: ReceiptPaymentData,
  options: ReceiptPdfOptions = {}
): Promise<Buffer> {
  try {
    // Fetch company info from settings or use provided/defaults
    let companyInfo: ReceiptCompanyInfo;
    if (options.companyInfo) {
      companyInfo = mergeReceiptCompanyWithDefaults(options.companyInfo);
    } else {
      const serverCompanyInfo = await getCompanyInfoServer();
      companyInfo = mergeReceiptCompanyWithDefaults(serverCompanyInfo || undefined);
    }

    // Normalize payment data to receipt format
    const normalizedReceipt = normalizePaymentToReceipt(paymentData, companyInfo);

    // Create PDF instance
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Render receipt using shared renderer
    await renderReceiptPdf(pdf, normalizedReceipt, {
      includeFooter: options.includeFooter ?? true,
    });

    // Convert to buffer
    const pdfArrayBuffer = pdf.output("arraybuffer");
    return Buffer.from(pdfArrayBuffer);
  } catch (error) {
    console.error("Failed to generate receipt PDF buffer:", error);
    throw new Error(
      `Receipt PDF generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Normalize payment data to NormalizedReceipt format
 */
function normalizePaymentToReceipt(
  payment: ReceiptPaymentData,
  companyInfo: ReceiptCompanyInfo
): NormalizedReceipt {
  // Generate receipt number
  const paymentId = typeof payment._id === "string"
    ? payment._id
    : payment._id?.toString() || "";
  const receiptNumber = payment.receiptNumber ||
    `RCP-${paymentId.slice(-8).toUpperCase()}`;

  // Get payment date
  const paymentDate = payment.paymentDate ||
    payment.paidDate ||
    payment.createdAt ||
    new Date();

  // Get tenant info
  const tenantFirstName = payment.tenantId?.firstName || "";
  const tenantLastName = payment.tenantId?.lastName || "";
  const tenantName = `${tenantFirstName} ${tenantLastName}`.trim() || "Locataire non renseigné";
  const tenantEmail = payment.tenantId?.email || "";

  // Get property info
  const propertyName = payment.propertyId?.name || "Propriété non renseignée";
  let propertyAddress = "";
  if (typeof payment.propertyId?.address === "string") {
    propertyAddress = payment.propertyId.address;
  } else if (payment.propertyId?.address) {
    const addr = payment.propertyId.address;
    const parts = [addr.street, addr.city, addr.state, addr.zipCode].filter(Boolean);
    propertyAddress = parts.join(", ") || "Adresse non renseignée";
  } else {
    propertyAddress = "Adresse non renseignée";
  }

  // Get description
  const description = payment.description ||
    (payment.type
      ? `Paiement : ${payment.type.replace(/_/g, " ")}`
      : "Paiement encaissé");

  return {
    receiptNumber,
    paymentId,
    paymentDate,
    paymentMethod: payment.paymentMethod || "Non renseigné",
    amount: payment.amount,
    description,
    invoiceApplications: payment.invoiceApplications || [],
    tenant: {
      name: tenantName,
      email: tenantEmail,
    },
    property: {
  name: propertyName,
  address: propertyAddress,
  owner: payment.propertyId?.ownerId
    ? {
        firstName: payment.propertyId.ownerId.firstName,
        lastName: payment.propertyId.ownerId.lastName,
        email: payment.propertyId.ownerId.email,
        phone: payment.propertyId.ownerId.phone,
        accountType: payment.propertyId.ownerId.accountType,
        businessName: payment.propertyId.ownerId.businessName,
        businessLogo: payment.propertyId.ownerId.businessLogo,
        cip: payment.propertyId.ownerId.cip,
        ifu: payment.propertyId.ownerId.ifu,
        rccm: payment.propertyId.ownerId.rccm,
      }
    : undefined,
},
    company: companyInfo,
  };
}

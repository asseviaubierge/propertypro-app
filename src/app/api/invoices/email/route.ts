/**
 * PropertyPro - Invoice Email API Route
 * Send lease invoice PDFs via email
 */

import { NextRequest } from "next/server";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
  parseRequestBody,
  isValidObjectId,
} from "@/lib/api-utils";
import { EmailService } from "@/lib/email-service";
import { Lease } from "@/models";
import { buildInvoiceEmailHtml } from "@/lib/templates/invoice-email-template";
import { generateInvoicePdfBuffer } from "@/lib/services/invoice-pdf.service";
import { Invoice } from "@/models";
import { getCompanyInfoServer } from "@/lib/utils/company-info";
import { buildPrintableInvoiceFromLease } from "@/lib/invoice/invoice-builders";
import { resolveInvoiceIssuer } from "@/lib/invoice/issuer-resolver";
import { formatCurrency } from "@/lib/utils/formatting";

// ============================================================================
// POST /api/invoices/email - Send invoice PDF via email
// ============================================================================

export const POST = withPermissionAndDB("financial_management")(async (user: any, request: NextRequest) => {
  try {
    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error!, 400);
    }

    const { leaseId, invoiceId, to, subject, message, invoiceNumber } = body;

    if (!to || !subject || !message) {
      return createErrorResponse(
        "Missing required fields: to, subject, message",
        400
      );
    }

    if (!leaseId && !invoiceId) {
      return createErrorResponse(
        "Either leaseId or invoiceId is required",
        400
      );
    }

    // Validate lease ID
    if (leaseId && !isValidObjectId(leaseId)) {
      return createErrorResponse("Invalid lease ID", 400);
    }

    if (invoiceId && !isValidObjectId(invoiceId)) {
      return createErrorResponse("Invalid invoice ID", 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return createErrorResponse("Invalid email address", 400);
    }

    // Find the lease to verify it exists and get additional context
    const lease = leaseId
      ? await Lease.findById(leaseId)
          .populate("tenantId", "firstName lastName email")
          .populate("propertyId", "name address")
      : null;

    if (leaseId && !lease) {
      return createErrorResponse("Lease not found", 404);
    }

    let invoice = null;

    if (invoiceId) {
      invoice = await Invoice.findById(invoiceId)
        .populate("tenantId", "firstName lastName email")
        .populate("propertyId", "name address ownerId managerId units");

      if (!invoice) {
        return createErrorResponse("Invoice not found", 404);
      }
    } else if (leaseId) {
      invoice = await Invoice.findOne({ leaseId })
        .sort({ issueDate: -1 })
        .populate("tenantId", "firstName lastName email")
        .populate("propertyId", "name address ownerId managerId units");
    }

    // Initialize email service
    const emailService = new EmailService();

    // Generate PDF using the email service
    let pdfBuffer: Buffer;
    let fileName = `invoice_${Date.now()}.pdf`;
    let printable: any | null = null;

    // Fetch company info from display settings
    const companyInfo = await getCompanyInfoServer();

    // Resolve currency from current user's Display Settings (fallback to system)
    let currencyCode = "USD";
    try {
      const { default: DisplaySettings } = await import(
        "@/models/DisplaySettings"
      );
      const ds = await (DisplaySettings as any).findByUserId?.(user.id);
      if (ds?.currency) {
        currencyCode = ds.currency;
      } else {
        const { default: SystemSettingsNew } = await import(
          "@/models/SystemSettingsNew"
        );
        const systemSettings = await (SystemSettingsNew as any).getSettings?.();
        currencyCode = systemSettings?.payment?.currency || currencyCode;
      }
    } catch {}

    if (invoice) {
      const invoiceObject =
        typeof (invoice as any).toObject === "function"
          ? (invoice as any).toObject({ flattenMaps: true, virtuals: true })
          : invoice;
      (invoiceObject as any).issuer = await resolveInvoiceIssuer(invoiceObject, user);

      pdfBuffer = await generateInvoicePdfBuffer(
        invoiceObject as any,
        currencyCode
      );
      fileName = `${invoice.invoiceNumber || invoice._id}.pdf`;
    } else {
      // Build invoice from lease data using shared builder
      const invoiceData = buildPrintableInvoiceFromLease(lease as any, {
        invoiceNumber,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        companyInfo: companyInfo || undefined,
      });
      printable = invoiceData;

      // Generate PDF using shared service (same as invoice path)
      pdfBuffer = await generateInvoicePdfBuffer(
        invoiceData as any,
        currencyCode
      );
      fileName = `${invoiceNumber || `invoice_${Date.now()}`}.pdf`;
    }

    // Prepare email content
    const tenantName = invoice?.tenantId
      ? `${invoice.tenantId.firstName || ""} ${
          invoice.tenantId.lastName || ""
        }`.trim() ||
        invoice.tenantId.email ||
        "Tenant"
      : lease?.tenantId
      ? `${lease.tenantId.firstName} ${lease.tenantId.lastName}`
      : "Tenant";

    const propertyName =
      invoice?.propertyId?.name || lease?.propertyId?.name || "Property";

    // currencyCode already resolved above

    // Compute amount due and due date where available for richer email content
    let amountDue: number | undefined = undefined;
    let dueDate: Date | undefined = undefined;
    if (invoice) {
      amountDue = Number(
        invoice.balanceRemaining ?? invoice.totalAmount ?? invoice.subtotal ?? 0
      );
      dueDate = invoice.dueDate ? new Date(invoice.dueDate) : undefined;
    } else if (printable) {
      amountDue = Number(
        printable.balanceRemaining ??
          printable.totalAmount ??
          printable.subtotal ??
          0
      );
      dueDate = printable.dueDate ? new Date(printable.dueDate) : undefined;
    }

    // Add formatted amount to the message body if not already present
    const formattedAmount =
      typeof amountDue === "number"
        ? formatCurrency(amountDue, currencyCode)
        : undefined;
    const dueDateText = dueDate
      ? ` due on ${dueDate.toLocaleDateString()}`
      : "";
    const enhancedMessage =
      formattedAmount && message && !message.includes(formattedAmount)
        ? `${message}\n\nTotal due: ${formattedAmount}${dueDateText}`
        : message;

    const emailContent = buildInvoiceEmailHtml({
      message: enhancedMessage,
      propertyName,
      tenantName,
      invoiceNumber,
      amountDue,
      dueDate,
      currencyCode,
    });

    // Send email with PDF attachment
    const emailSent = await emailService.sendEmailWithAttachments(
      to,
      {
        subject,
        html: emailContent,
        text: message, // Fallback text version
      },
      [
        {
          filename: fileName,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ]
    );

    if (emailSent) {
      return createSuccessResponse(
        {
          message: "Invoice email sent successfully",
          to,
          subject,
          fileName,
          leaseId,
          invoiceId,
          sentAt: new Date().toISOString(),
        },
        "Invoice emailed successfully"
      );
    } else {
      return createErrorResponse("Failed to send email", 500);
    }
  } catch (error) {
    console.error("Failed to send invoice email:", error);
    return handleApiError(error, "Failed to send invoice email");
  }
});

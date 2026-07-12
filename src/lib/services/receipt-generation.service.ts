/**
 * PropertyPro - Receipt Generation Service
 * Service for automatically generating and emailing payment receipts
 */

import { Types } from "mongoose";
import { Payment, PaymentReceipt, Invoice } from "@/models";
import jsPDF from "jspdf";
import { formatCurrency } from "@/lib/utils/formatting";

export interface ReceiptData {
  receiptNumber: string;
  paymentId: string;
  tenantId: string;
  propertyId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: Date;
  description: string;
  invoiceApplications: Array<{
    invoiceNumber: string;
    amountApplied: number;
  }>;
  tenant: {
    name: string;
    email: string;
    address?: string;
  };
  property: {
    name: string;
    address: string;
  };
  company: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
  };
}

export interface ReceiptGenerationResult {
  success: boolean;
  receiptId?: string;
  receiptNumber?: string;
  pdfPath?: string;
  emailSent?: boolean;
  error?: string;
}

export class ReceiptGenerationService {
  private defaultCompanyInfo = {
    name: "PropertyPro Management",
    address: "123 Property Management St, City, State 12345",
    phone: "(555) 123-4567",
    email: "support@PropertyPro.com",
    website: "www.PropertyPro.com",
  };

  /**
   * Generate receipt for a payment
   */
  async generateReceiptForPayment(
    paymentId: string,
    autoEmail: boolean = true
  ): Promise<ReceiptGenerationResult> {
    try {
      // Get payment details with populated references
      const payment = await Payment.findById(paymentId)
        .populate("tenantId", "firstName lastName email")
        .populate("propertyId", "name address")
        .populate("leaseId", "terms");

      if (!payment) {
        return {
          success: false,
          error: "Payment not found",
        };
      }

      // Get invoice applications for this payment
      const invoiceApplications = await this.getInvoiceApplications(paymentId);

      // Prepare receipt data
      const receiptData = await this.prepareReceiptData(
        payment,
        invoiceApplications
      );

      // Generate PDF receipt
      const pdfResult = await this.generateReceiptPDF(receiptData);
      if (!pdfResult.success) {
        return {
          success: false,
          error: pdfResult.error,
        };
      }

      // Save receipt record
      const receiptRecord = await this.saveReceiptRecord(
        receiptData,
        pdfResult.pdfPath!
      );

      // Send email if requested
      let emailSent = false;
      if (autoEmail && receiptData.tenant.email) {
        try {
          await this.emailReceipt(receiptData, pdfResult.pdfPath!);
          emailSent = true;

          // Update receipt record
          await PaymentReceipt.findByIdAndUpdate(receiptRecord._id, {
            emailSent: true,
            emailSentDate: new Date(),
          });
        } catch (error) {
          console.error("Failed to email receipt:", error);
        }
      }

      return {
        success: true,
        receiptId: receiptRecord._id.toString(),
        receiptNumber: receiptData.receiptNumber,
        pdfPath: pdfResult.pdfPath,
        emailSent,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate receipt: ${error}`,
      };
    }
  }

  /**
   * Prepare receipt data from payment information
   */
  private async prepareReceiptData(
    payment: any,
    invoiceApplications: any[]
  ): Promise<ReceiptData> {
    const receiptNumber = this.generateReceiptNumber(payment._id);

    return {
      receiptNumber,
      paymentId: payment._id.toString(),
      tenantId: payment.tenantId._id.toString(),
      propertyId: payment.propertyId._id.toString(),
      amount: payment.amount,
      paymentMethod: payment.paymentMethod || "Unknown",
      paymentDate: payment.paidDate || payment.createdAt,
      description: payment.description || `Payment for ${payment.type}`,
      invoiceApplications,
      tenant: {
        name: `${payment.tenantId.firstName} ${payment.tenantId.lastName}`,
        email: payment.tenantId.email,
      },
      property: {
        name: payment.propertyId.name,
        address: payment.propertyId.address,
      },
      company: this.defaultCompanyInfo,
    };
  }

  /**
   * Get invoice applications for a payment
   */
  private async getInvoiceApplications(paymentId: string) {
    const invoices = await Invoice.find({
      paymentIds: new Types.ObjectId(paymentId),
    }).select("invoiceNumber");

    // This is simplified - in reality you'd track exact amounts applied to each invoice
    return invoices.map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber,
      amountApplied: 0, // Would need to be calculated from payment history
    }));
  }

  /**
   * Generate receipt PDF
   */
  private async generateReceiptPDF(receiptData: ReceiptData): Promise<{
    success: boolean;
    pdfPath?: string;
    error?: string;
  }> {
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Header
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("PAYMENT RECEIPT", 105, 30, { align: "center" });

      // Company Info
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(receiptData.company.name, 20, 50);
      pdf.text(receiptData.company.address, 20, 58);
      pdf.text(receiptData.company.phone, 20, 66);
      pdf.text(receiptData.company.email, 20, 74);

      // Receipt Info
      pdf.setFont("helvetica", "bold");
      pdf.text("Receipt Number:", 120, 50);
      pdf.text("Payment Date:", 120, 58);
      pdf.text("Payment Method:", 120, 66);

      pdf.setFont("helvetica", "normal");
      pdf.text(receiptData.receiptNumber, 160, 50);
      pdf.text(receiptData.paymentDate.toLocaleDateString(), 160, 58);
      pdf.text(receiptData.paymentMethod, 160, 66);

      // Tenant Info
      pdf.setFont("helvetica", "bold");
      pdf.text("RECEIVED FROM:", 20, 95);
      pdf.setFont("helvetica", "normal");
      pdf.text(receiptData.tenant.name, 20, 103);
      pdf.text(receiptData.tenant.email, 20, 111);

      // Property Info
      pdf.setFont("helvetica", "bold");
      pdf.text("PROPERTY:", 20, 125);
      pdf.setFont("helvetica", "normal");
      pdf.text(receiptData.property.name, 20, 133);
      pdf.text(receiptData.property.address, 20, 141);

      // Payment Details
      pdf.setFont("helvetica", "bold");
      pdf.text("PAYMENT DETAILS:", 20, 160);

      // Table header
      pdf.setFont("helvetica", "bold");
      pdf.text("Description", 20, 175);
      pdf.text("Amount", 150, 175);

      // Table content
      pdf.setFont("helvetica", "normal");
      let yPos = 185;

      if (receiptData.invoiceApplications.length > 0) {
        receiptData.invoiceApplications.forEach((app) => {
          pdf.text(`Payment for ${app.invoiceNumber}`, 20, yPos);
          pdf.text(formatCurrency(app.amountApplied), 150, yPos);
          yPos += 8;
        });
      } else {
        pdf.text(receiptData.description, 20, yPos);
        pdf.text(formatCurrency(receiptData.amount), 150, yPos);
        yPos += 8;
      }

      // Total
      pdf.line(20, yPos + 5, 190, yPos + 5);
      pdf.setFont("helvetica", "bold");
      pdf.text("TOTAL PAID:", 20, yPos + 15);
      pdf.text(formatCurrency(receiptData.amount), 150, yPos + 15);

      // Footer
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text("Thank you for your payment!", 105, yPos + 40, {
        align: "center",
      });
      pdf.text(
        `Generated on ${new Date().toLocaleDateString()}`,
        105,
        yPos + 50,
        { align: "center" }
      );

      // Generate file path
      const fileName = `receipt_${receiptData.receiptNumber.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}.pdf`;
      const pdfPath = `/receipts/${fileName}`;

      // In a real implementation, you would save the PDF to file system or cloud storage
      // For now, we'll just return the path
      return {
        success: true,
        pdfPath,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate PDF: ${error}`,
      };
    }
  }

  /**
   * Save receipt record to database
   */
  private async saveReceiptRecord(receiptData: ReceiptData, pdfPath: string) {
    const receipt = new PaymentReceipt({
      paymentId: new Types.ObjectId(receiptData.paymentId),
      tenantId: new Types.ObjectId(receiptData.tenantId),
      propertyId: new Types.ObjectId(receiptData.propertyId),
      receiptNumber: receiptData.receiptNumber,
      amount: receiptData.amount,
      paymentMethod: receiptData.paymentMethod,
      paidDate: receiptData.paymentDate,
      description: receiptData.description,
      receiptData: {
        tenantName: receiptData.tenant.name,
        propertyAddress: receiptData.property.address,
        paymentDetails: {
          amount: receiptData.amount,
          type: "payment",
          dueDate: receiptData.paymentDate,
          paidDate: receiptData.paymentDate,
        },
        companyInfo: receiptData.company,
      },
      pdfPath,
      emailSent: false,
    });

    return await receipt.save();
  }

  /**
   * Email receipt to tenant
   */
  private async emailReceipt(
    receiptData: ReceiptData,
    pdfPath: string
  ): Promise<void> {
    // This would integrate with your email service

    // TODO: Implement actual email sending
    // const emailService = new EmailService();
    // await emailService.sendReceiptEmail({
    //   to: receiptData.tenant.email,
    //   subject: `Payment Receipt - ${receiptData.receiptNumber}`,
    //   receiptData,
    //   pdfAttachment: pdfPath,
    // });
  }

  /**
   * Generate unique receipt number
   */
  private generateReceiptNumber(paymentId: Types.ObjectId): string {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const paymentIdShort = paymentId.toString().slice(-6).toUpperCase();
    return `RCP-${year}${month}-${paymentIdShort}`;
  }

  /**
   * Bulk generate receipts for multiple payments
   */
  async bulkGenerateReceipts(
    paymentIds: string[],
    autoEmail: boolean = true
  ): Promise<{
    successful: number;
    failed: number;
    results: ReceiptGenerationResult[];
  }> {
    const results: ReceiptGenerationResult[] = [];
    let successful = 0;
    let failed = 0;

    for (const paymentId of paymentIds) {
      try {
        const result = await this.generateReceiptForPayment(
          paymentId,
          autoEmail
        );
        results.push(result);

        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        results.push({
          success: false,
          error: `Failed to process payment ${paymentId}: ${error}`,
        });
        failed++;
      }
    }

    return {
      successful,
      failed,
      results,
    };
  }
}

export const receiptGenerationService = new ReceiptGenerationService();

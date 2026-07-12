/**
 * PropertyPro - Auto Invoice Generation Service
 * Service for automatically generating invoices from lease terms
 */

import { HydratedDocument } from "mongoose";
import { Invoice, Lease } from "@/models";
import { InvoiceStatus, InvoiceType, ILease, IInvoice } from "@/types";
import { connectDB } from "@/lib/db";
import { EmailService } from "@/lib/email-service";
import { buildInvoiceEmailHtml } from "@/lib/templates/invoice-email-template";
import { generateInvoicePdfBuffer } from "@/lib/services/invoice-pdf.service";
import { formatCurrency } from "@/lib/utils/formatting";

export interface InvoiceGenerationConfig {
  generateOnLeaseCreation: boolean;
  generateMonthlyRent: boolean;
  generateSecurityDeposit: boolean;
  advanceMonths: number;
  gracePeriodDays: number;
  autoIssue: boolean;
  autoEmail: boolean;
}

export interface GenerationResult {
  success: boolean;
  invoicesGenerated: number;
  invoiceIds: string[];
  errors: string[];
  emailsSent: number;
}

export class AutoInvoiceGenerationService {
  private defaultConfig: InvoiceGenerationConfig = {
    generateOnLeaseCreation: true,
    generateMonthlyRent: true,
    generateSecurityDeposit: true,
    advanceMonths: 0,
    gracePeriodDays: 5,
    autoIssue: false,
    autoEmail: false,
  };

  /**
   * Generate invoices for a new lease
   */
  async generateInvoicesForLease(
    leaseId: string,
    config: Partial<InvoiceGenerationConfig> = {}
  ): Promise<GenerationResult> {
    const finalConfig = { ...this.defaultConfig, ...config };

    const result: GenerationResult = {
      success: false,
      invoicesGenerated: 0,
      invoiceIds: [],
      errors: [],
      emailsSent: 0,
    };

    try {
      // Connect to database
      await connectDB();

      // Get lease details

      const lease = await Lease.findById(leaseId).populate(
        "tenantId propertyId"
      );

      if (!lease) {
        throw new Error("Lease not found");
      }

      const generatedInvoices: HydratedDocument<IInvoice>[] = [];

      // Generate security deposit invoice if needed

      if (
        finalConfig.generateSecurityDeposit &&
        lease.terms.securityDeposit > 0
      ) {
        try {
          const securityDepositInvoice =
            await this.generateSecurityDepositInvoice(lease);

          generatedInvoices.push(securityDepositInvoice);
          result.invoiceIds.push(securityDepositInvoice._id.toString());
          result.invoicesGenerated++;
        } catch (error) {
          result.errors.push(`Security deposit invoice: ${error}`);
        }
      } else {
      }

      // Generate monthly rent invoices

      if (finalConfig.generateMonthlyRent) {
        try {
          const rentInvoices = await this.generateMonthlyRentInvoices(
            lease,
            finalConfig
          );

          generatedInvoices.push(...rentInvoices);
          result.invoiceIds.push(
            ...rentInvoices.map((inv) => inv._id.toString())
          );
          result.invoicesGenerated += rentInvoices.length;
        } catch (error) {
          result.errors.push(`Monthly rent invoices: ${error}`);
        }
      } else {
      }

      if (generatedInvoices.length > 0 && finalConfig.autoEmail) {
        try {
          const { sent, failures } = await this.emailGeneratedInvoices(
            lease,
            generatedInvoices
          );
          result.emailsSent += sent;
          if (failures.length > 0) {
            result.errors.push(...failures);
          }
        } catch (error) {
          console.error("❌ Failed to auto-email invoices:", error);
          result.errors.push(
            `Auto-email invoices failed: ${
              error instanceof Error ? error.message : error
            }`
          );
        }
      }

      result.success = result.invoicesGenerated > 0;

      return result;
    } catch (error) {
      console.error("❌ Invoice generation failed:", error);
      result.errors.push(`General error: ${error}`);
      return result;
    }
  }

  /**
   * Generate security deposit invoice
   */
  private async generateSecurityDepositInvoice(
    lease: ILease
  ): Promise<HydratedDocument<IInvoice>> {
    const dueDate = new Date(lease.startDate);
    dueDate.setDate(dueDate.getDate() - 7); // Due 7 days before move-in

    // Issue date should be before due date
    const issueDate = new Date(dueDate);
    issueDate.setDate(issueDate.getDate() - 7); // Issue 7 days before due date

    // Generate unique invoice number
    const invoiceNumber = this.generateInvoiceNumber("SD");

    const invoice = new Invoice({
      invoiceNumber,
      tenantId: lease.tenantId,
      propertyId: lease.propertyId,
      leaseId: lease._id,
      unitId: lease.unitId,
      issueDate,
      dueDate,
      status: InvoiceStatus.ISSUED,
      subtotal: lease.terms.securityDeposit,
      totalAmount: lease.terms.securityDeposit,
      balanceRemaining: lease.terms.securityDeposit,
      gracePeriodEnd: new Date(dueDate.getTime() + 5 * 24 * 60 * 60 * 1000),
      lineItems: [
        {
          description: "Security Deposit",
          amount: lease.terms.securityDeposit,
          type: InvoiceType.SECURITY_DEPOSIT,
          quantity: 1,
          unitPrice: lease.terms.securityDeposit,
        },
      ],
    });

    return await invoice.save();
  }

  private async emailGeneratedInvoices(
    lease: HydratedDocument<ILease>,
    invoices: HydratedDocument<IInvoice>[]
  ): Promise<{ sent: number; failures: string[] }> {
    const failures: string[] = [];
    const leaseData =
      typeof lease.toObject === "function" ? lease.toObject() : (lease as any);

    const tenant = (leaseData.tenantId as any) || null;
    const property = (leaseData.propertyId as any) || null;

    if (!tenant || !tenant.email) {
      failures.push(
        "Tenant email not available for automatic invoice delivery"
      );
      return { sent: 0, failures };
    }

    const tenantName =
      [tenant.firstName, tenant.lastName].filter(Boolean).join(" ").trim() ||
      "Tenant";
    const propertyName = property?.name || "Property";
    const emailService = new EmailService();

    // Resolve currency from Display Settings (admin)
    let currencyCode = "USD";
    try {
      const { default: DisplaySettings } = await import(
        "@/models/DisplaySettings"
      );
      const { default: User } = await import("@/models/User");
      const { UserRole } = await import("@/types");

      const admin = await User.findOne({ role: UserRole.ADMIN, isActive: true })
        .select("_id")
        .lean();
      if (admin?._id) {
        const ds = await DisplaySettings.findByUserId(admin._id.toString());
        if (ds?.currency) {
          currencyCode = ds.currency;
        }
      }
    } catch (err) {
      // Fallback silently to default USD
    }

    let sent = 0;

    for (const invoice of invoices) {
      try {
        const populatedInvoice = await Invoice.findById(invoice._id)
          .populate("tenantId", "firstName lastName email")
          .populate("propertyId", "name address")
          .lean();

        if (!populatedInvoice) {
          throw new Error("Invoice not found for email generation");
        }

        const invoiceData = populatedInvoice as IInvoice & {
          tenantId?: any;
          propertyId?: any;
        };

        const pdfBuffer = await generateInvoicePdfBuffer(invoiceData);

        const amountDue = Number(
          invoiceData.balanceRemaining ??
            invoiceData.totalAmount ??
            invoiceData.subtotal ??
            0
        );
        const dueDate = invoiceData.dueDate
          ? new Date(invoiceData.dueDate)
          : undefined;
        const formattedAmount = formatCurrency(amountDue, currencyCode);
        const dueDateText = dueDate
          ? ` due on ${dueDate.toLocaleDateString()}`
          : "";

        const plainMessage = `Hello ${tenantName},\n\nPlease find your invoice ${
          invoiceData.invoiceNumber || invoiceData._id
        } attached. The total due is ${formattedAmount}${dueDateText}.\n\nYou can view and pay this invoice through your PropertyPro tenant portal.\n\nThank you.`;

        const emailHtml = buildInvoiceEmailHtml({
          message: plainMessage,
          propertyName,
          tenantName,
          invoiceNumber: invoiceData.invoiceNumber,
          amountDue,
          dueDate,
          currencyCode,
        });

        const emailSent = await emailService.sendEmailWithAttachments(
          tenant.email,
          {
            subject: `Invoice ${
              invoiceData.invoiceNumber || invoiceData._id
            } - ${propertyName}`,
            html: emailHtml,
            text: plainMessage,
          },
          [
            {
              filename: `${invoiceData.invoiceNumber || "lease-invoice"}.pdf`,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ]
        );

        if (!emailSent) {
          throw new Error("Email service returned false");
        }

        sent += 1;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const identifier = invoice.invoiceNumber || invoice._id.toString();
        const failureMessage = `Failed to email invoice ${identifier}: ${errorMessage}`;
        console.error(`❌ ${failureMessage}`);
        failures.push(failureMessage);
      }
    }

    return { sent, failures };
  }

  /**
   * Generate monthly rent invoices for the lease duration
   */
  private async generateMonthlyRentInvoices(
    lease: ILease,
    config: InvoiceGenerationConfig
  ): Promise<HydratedDocument<IInvoice>[]> {
    const invoices: HydratedDocument<IInvoice>[] = [];
    const startDate = new Date(lease.startDate);
    const endDate = new Date(lease.endDate);

    // Get rent due day from lease config or default to 1st
    const rentDueDay = lease.terms.paymentConfig?.rentDueDay || 1;

    let currentDate = new Date(startDate);
    currentDate.setDate(rentDueDay);

    // If the due day is before the lease start, move to next month
    if (currentDate < startDate) {
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Generate invoices for each month
    while (currentDate <= endDate) {
      try {
        const invoice = await this.generateMonthlyRentInvoice(
          lease,
          currentDate,
          config
        );
        invoices.push(invoice);
      } catch (error) {
        console.error(`Failed to generate invoice for ${currentDate}:`, error);
      }

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return invoices;
  }

  /**
   * Generate a single monthly rent invoice
   */
  private async generateMonthlyRentInvoice(
    lease: ILease,
    dueDate: Date,
    config: InvoiceGenerationConfig
  ): Promise<HydratedDocument<IInvoice>> {
    const issueDate = new Date(dueDate);
    issueDate.setDate(issueDate.getDate() - 7); // Issue 7 days before due

    // Check if this is the first month and needs proration
    const isFirstMonth =
      dueDate.getMonth() === new Date(lease.startDate).getMonth() &&
      dueDate.getFullYear() === new Date(lease.startDate).getFullYear();

    let rentAmount = lease.terms.rentAmount;
    let description = "Monthly Rent";

    if (isFirstMonth && lease.terms.paymentConfig?.prorationEnabled) {
      const proratedAmount = this.calculateProratedRent(lease, dueDate);
      rentAmount = proratedAmount;
      description = "Monthly Rent (Prorated)";
    }

    // Generate unique invoice number
    const invoiceNumber = this.generateInvoiceNumber("RENT");

    const invoice = new Invoice({
      invoiceNumber,
      tenantId: lease.tenantId,
      propertyId: lease.propertyId,
      leaseId: lease._id,
      unitId: lease.unitId,
      issueDate: config.autoIssue ? issueDate : new Date(),
      dueDate,
      status: config.autoIssue ? InvoiceStatus.ISSUED : InvoiceStatus.SCHEDULED,
      subtotal: rentAmount,
      totalAmount: rentAmount,
      balanceRemaining: rentAmount,
      gracePeriodEnd: new Date(
        dueDate.getTime() + config.gracePeriodDays * 24 * 60 * 60 * 1000
      ),
      lineItems: [
        {
          description,
          amount: rentAmount,
          type: InvoiceType.RENT,
          quantity: 1,
          unitPrice: rentAmount,
          dueDate,
        },
      ],
    });

    return await invoice.save();
  }

  /**
   * Calculate prorated rent for partial month
   */
  private calculateProratedRent(lease: ILease, dueDate: Date): number {
    const moveInDate = new Date(lease.startDate);
    const monthStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1);
    const monthEnd = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0);

    const daysInMonth = monthEnd.getDate();
    const daysOccupied = daysInMonth - moveInDate.getDate() + 1;

    const dailyRate = lease.terms.rentAmount / daysInMonth;
    const proratedAmount = dailyRate * daysOccupied;

    // Round based on lease configuration
    const roundingMethod = lease.terms.paymentConfig?.roundingMethod || "round";

    switch (roundingMethod) {
      case "floor":
        return Math.floor(proratedAmount);
      case "ceil":
        return Math.ceil(proratedAmount);
      default:
        return Math.round(proratedAmount * 100) / 100;
    }
  }

  /**
   * Generate advance payment invoices
   */
  async generateAdvancePaymentInvoices(
    leaseId: string,
    months: number
  ): Promise<GenerationResult> {
    const result: GenerationResult = {
      success: false,
      invoicesGenerated: 0,
      invoiceIds: [],
      errors: [],
      emailsSent: 0,
    };

    try {
      const lease = await Lease.findById(leaseId).populate(
        "tenantId propertyId"
      );
      if (!lease) {
        throw new Error("Lease not found");
      }

      const dueDate = new Date(lease.startDate);
      dueDate.setDate(dueDate.getDate() - 7); // Due 7 days before move-in

      for (let i = 0; i < months; i++) {
        try {
          const invoice = new Invoice({
            tenantId: lease.tenantId,
            propertyId: lease.propertyId,
            leaseId: lease._id,
            unitId: lease.unitId,
            issueDate: new Date(),
            dueDate,
            status: InvoiceStatus.ISSUED,
            subtotal: lease.terms.rentAmount,
            totalAmount: lease.terms.rentAmount,
            balanceRemaining: lease.terms.rentAmount,
            gracePeriodEnd: new Date(
              dueDate.getTime() + 5 * 24 * 60 * 60 * 1000
            ),
            lineItems: [
              {
                description: `Advance Rent Payment - Month ${i + 1}`,
                amount: lease.terms.rentAmount,
                type: InvoiceType.RENT,
                quantity: 1,
                unitPrice: lease.terms.rentAmount,
              },
            ],
          });

          const savedInvoice = await invoice.save();
          result.invoiceIds.push(savedInvoice._id.toString());
          result.invoicesGenerated++;
        } catch (error) {
          result.errors.push(`Advance payment ${i + 1}: ${error}`);
        }
      }

      result.success = result.invoicesGenerated > 0;
      return result;
    } catch (error) {
      result.errors.push(`General error: ${error}`);
      return result;
    }
  }

  /**
   * Update invoice statuses based on current date
   */
  async updateInvoiceStatuses(): Promise<void> {
    const now = new Date();

    // Update scheduled invoices to issued if issue date has passed
    await Invoice.updateMany(
      {
        status: InvoiceStatus.SCHEDULED,
        issueDate: { $lte: now },
      },
      {
        $set: { status: InvoiceStatus.ISSUED },
      }
    );

    // Update issued/partial invoices to overdue if due date has passed
    await Invoice.updateMany(
      {
        status: { $in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] },
        dueDate: { $lt: now },
        balanceRemaining: { $gt: 0 },
      },
      {
        $set: { status: InvoiceStatus.OVERDUE },
      }
    );
  }

  /**
   * Generate a unique invoice number
   */
  private generateInvoiceNumber(prefix: string = "INV"): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const timestamp = now.getTime().toString().slice(-6); // Last 6 digits of timestamp

    return `${prefix}-${year}${month}${day}-${timestamp}`;
  }
}

export const autoInvoiceGenerationService = new AutoInvoiceGenerationService();

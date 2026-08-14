/**
 * PropertyPro - Lease Payment Synchronization Service
 * Comprehensive service for synchronizing payment status, processing, and invoice management
 */

import { IPayment, ILease, PaymentStatus, LeaseStatus } from "@/types";
import { Payment, Lease } from "@/models";
import { paymentService } from "./payment.service";
import { paymentStatusService } from "./payment-status.service";
import {
  generateLeaseInvoicePDF,
  emailInvoicePDF,
} from "@/lib/invoice-pdf-generator";
import { leasePaymentSynchronizer } from "./lease-payment-synchronizer.service";
import mongoose, { Types } from "mongoose";
import { formatCurrency } from "@/lib/utils/formatting";

export interface PaymentSyncOptions {
  autoGenerateInvoices?: boolean;
  autoEmailInvoices?: boolean;
  updateLeaseStatus?: boolean;
  notifyTenant?: boolean;
  createRecurringPayments?: boolean;
}

export interface PaymentSyncResult {
  success: boolean;
  paymentsCreated: number;
  invoicesGenerated: number;
  emailsSent: number;
  leaseStatusUpdated: boolean;
  errors: string[];
  warnings: string[];
}

export interface InvoiceGenerationConfig {
  generateOnPaymentCreation: boolean;
  generateOnPaymentDue: boolean;
  generateOnPaymentOverdue: boolean;
  autoEmailToTenant: boolean;
  includePaymentInstructions: boolean;
  reminderSchedule: number[]; // Days before due date to send reminders
}

class LeasePaymentSyncService {
  private defaultSyncOptions: PaymentSyncOptions = {
    autoGenerateInvoices: true,
    autoEmailInvoices: true,
    updateLeaseStatus: true,
    notifyTenant: true,
    createRecurringPayments: true,
  };

  private defaultInvoiceConfig: InvoiceGenerationConfig = {
    generateOnPaymentCreation: true,
    generateOnPaymentDue: false,
    generateOnPaymentOverdue: true,
    autoEmailToTenant: true,
    includePaymentInstructions: true,
    reminderSchedule: [7, 3, 1], // 7, 3, and 1 days before due date
  };

  /**
   * Comprehensive lease payment setup with full synchronization
   */
  async setupLeasePaymentSystem(
    leaseId: string,
    options: Partial<PaymentSyncOptions> = {}
  ): Promise<PaymentSyncResult> {
    const syncOptions = { ...this.defaultSyncOptions, ...options };
    const result: PaymentSyncResult = {
      success: false,
      paymentsCreated: 0,
      invoicesGenerated: 0,
      emailsSent: 0,
      leaseStatusUpdated: false,
      errors: [],
      warnings: [],
    };

    try {
      // 1. Fetch lease with all required data
      const lease = await this.getLeaseWithDetails(leaseId);
      if (!lease) {
        throw new Error("Bail introuvable");
      }

      // 2. Create payment schedule if enabled
      if (syncOptions.createRecurringPayments) {
        const payments = await this.createPaymentSchedule(lease);
        result.paymentsCreated = payments.length;
      }

      // 3. Generate initial invoices if enabled
      if (syncOptions.autoGenerateInvoices) {
        const invoiceResult = await this.generateInitialInvoices(lease);
        result.invoicesGenerated = invoiceResult.generated;
        result.emailsSent = invoiceResult.emailsSent;
      }

      // 4. Update lease status if needed
      if (syncOptions.updateLeaseStatus) {
        const statusUpdated = await this.updateLeaseStatusBasedOnPayments(
          lease
        );
        result.leaseStatusUpdated = statusUpdated;
      }

      // 5. Set up payment monitoring and automation
      await this.setupPaymentMonitoring(lease, syncOptions);

      result.success = true;
      return result;
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : "Unknown error"
      );
      return result;
    }
  }

  /**
   * Handle payment status changes and trigger appropriate actions
   */
  async handlePaymentStatusChange(
    paymentId: string,
    oldStatus: PaymentStatus,
    newStatus: PaymentStatus,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const payment = await Payment.findById(paymentId)
        .populate("leaseId")
        .populate("tenantId");

      if (!payment) {
        throw new Error("Payment not found");
      }

      // Update payment status using the payment status service
      await paymentStatusService.updatePaymentStatus(
        paymentId,
        newStatus,
        metadata
      );

      // Handle specific status transitions
      switch (newStatus) {
        case PaymentStatus.PAID:
          await this.handlePaymentCompleted(payment);
          break;
        case PaymentStatus.OVERDUE:
          await this.handlePaymentOverdue(payment);
          break;
        case PaymentStatus.FAILED:
          await this.handlePaymentFailed(payment);
          break;
        case PaymentStatus.REFUNDED:
          await this.handlePaymentRefunded(payment);
          break;
      }

      // Update lease status based on payment changes
      if (payment.leaseId) {
        await this.updateLeaseStatusBasedOnPayments(payment.leaseId);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate and sync invoices for a lease
   */
  async generateAndSyncInvoices(
    leaseId: string,
    config: Partial<InvoiceGenerationConfig> = {}
  ): Promise<{ generated: number; emailsSent: number; errors: string[] }> {
    const invoiceConfig = { ...this.defaultInvoiceConfig, ...config };
    const result = { generated: 0, emailsSent: 0, errors: [] };

    try {
      const lease = await this.getLeaseWithDetails(leaseId);
      if (!lease) {
        throw new Error("Bail introuvable");
      }

      // Get all payments for this lease
      const payments = await Payment.find({
        leaseId: new Types.ObjectId(leaseId),
      });

      for (const payment of payments) {
        try {
          // Determine if invoice should be generated based on config and payment status
          const shouldGenerate = this.shouldGenerateInvoice(
            payment,
            invoiceConfig
          );

          if (shouldGenerate) {
            // Generate invoice
            const invoiceResult = await generateLeaseInvoicePDF({
              lease: lease as any,
              invoiceNumber: `INV-${payment._id
                .toString()
                .slice(-8)
                .toUpperCase()}`,
              issueDate: new Date(),
              dueDate: payment.dueDate,
              includeTerms: true,
              includeNotes: true,
            });

            if (invoiceResult.success) {
              result.generated++;

              // Email invoice if configured
              if (invoiceConfig.autoEmailToTenant && lease.tenantId?.email) {
                const emailResult = await emailInvoicePDF({
                  to: lease.tenantId.email,
                  leaseId: leaseId,
                  invoiceNumber: `INV-${payment._id
                    .toString()
                    .slice(-8)
                    .toUpperCase()}`,
                  subject: `Invoice for ${
                    lease.propertyId?.name || "Bien"
                  } - Payment Due`,
                  message: this.generateInvoiceEmailMessage(
                    lease,
                    payment,
                    invoiceConfig
                  ),
                });

                if (emailResult.success) {
                  result.emailsSent++;
                }
              }

              // Link invoice to payment
              await this.linkInvoiceToPayment(
                payment._id.toString(),
                invoiceResult
              );
            }
          }
        } catch (error) {
          result.errors.push(
            `Failed to process payment ${payment._id}: ${error}`
          );
        }
      }

      return result;
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : "Unknown error"
      );
      return result;
    }
  }

  /**
   * Real-time payment processing with immediate synchronization using transactions
   */
  async processPaymentWithSync(
    paymentId: string,
    paymentData: {
      amount: number;
      paymentMethod: string;
      transactionId?: string;
      notes?: string;
    }
  ): Promise<{
    payment: IPayment;
    invoiceGenerated: boolean;
    leaseUpdated: boolean;
  }> {
    // Use the new centralized synchronizer with atomic transactions
    const result = await leasePaymentSynchronizer.processPaymentWithSync(
      paymentId,
      paymentData
    );

    // Generate receipt/confirmation invoice
    const invoiceGenerated = await this.generatePaymentConfirmationInvoice(
      result.payment
    );

    // Trigger next payment in sequence if this was a recurring payment
    if (
      result.payment.isRecurring &&
      result.payment.status === PaymentStatus.PAID
    ) {
      await this.triggerNextRecurringPayment(result.payment);
    }

    return {
      payment: result.payment,
      invoiceGenerated,
      leaseUpdated: result.syncResult.leaseUpdated,
    };
  }

  // Private helper methods
  private async getLeaseWithDetails(leaseId: string): Promise<any> {
    return await Lease.findById(leaseId)
      .populate({
        path: "tenantId",
        populate: { path: "userId", select: "firstName lastName email phone" },
      })
      .populate("propertyId", "name address type");
  }

  private async createPaymentSchedule(lease: any): Promise<IPayment[]> {
    // Use existing payment scheduler service
    const { paymentSchedulerService } = await import(
      "./payment-scheduler.service"
    );
    return await paymentSchedulerService.setupLeasePaymentSchedule(
      lease._id.toString()
    );
  }

  private async generateInitialInvoices(
    lease: any
  ): Promise<{ generated: number; emailsSent: number }> {
    // Generate invoices for immediate payments (security deposit, first month rent, etc.)
    return await this.generateAndSyncInvoices(lease._id.toString());
  }

  private async updateLeaseStatusBasedOnPayments(lease: any): Promise<boolean> {
    try {
      const leaseId = typeof lease === "string" ? lease : lease._id.toString();
      const payments = await Payment.find({
        leaseId: new Types.ObjectId(leaseId),
      });

      // Calculate payment status summary
      const totalDue = payments.reduce((sum, p) => sum + p.amount, 0);
      const totalPaid = payments.reduce(
        (sum, p) => sum + (p.amountPaid || 0),
        0
      );
      const overduePayments = payments.filter(
        (p) =>
          p.status === PaymentStatus.OVERDUE ||
          (p.dueDate < new Date() && p.status === PaymentStatus.PENDING)
      );

      // Determine new lease status
      let newStatus = LeaseStatus.ACTIVE;
      if (overduePayments.length > 0) {
        newStatus = LeaseStatus.DELINQUENT;
      } else if (totalPaid >= totalDue) {
        newStatus = LeaseStatus.CURRENT;
      }

      // Update lease if status changed
      const currentLease = await Lease.findById(leaseId);
      if (currentLease?.status && currentLease.status !== newStatus) {
        await Lease.findByIdAndUpdate(leaseId, { status: newStatus });
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  private async setupPaymentMonitoring(
    lease: any,
    options: PaymentSyncOptions
  ): Promise<void> {
    // Set up automated monitoring for payment due dates, overdue payments, etc.
    // This would integrate with a job scheduler or cron system
  }

  private shouldGenerateInvoice(
    payment: IPayment,
    config: InvoiceGenerationConfig
  ): boolean {
    const now = new Date();
    const dueDate = new Date(payment.dueDate);
    const daysToDue = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (
      config.generateOnPaymentCreation &&
      payment.status === PaymentStatus.PENDING
    ) {
      return true;
    }

    if (
      config.generateOnPaymentDue &&
      daysToDue <= 0 &&
      payment.status === PaymentStatus.PENDING
    ) {
      return true;
    }

    if (
      config.generateOnPaymentOverdue &&
      payment.status === PaymentStatus.OVERDUE
    ) {
      return true;
    }

    return false;
  }

  private generateInvoiceEmailMessage(
    lease: any,
    payment: IPayment,
    config: InvoiceGenerationConfig
  ): string {
    let message = `Dear ${lease.tenantId?.firstName || "Locataire"},\n\n`;
    message += `Please find attached your invoice for ${
      lease.propertyId?.name || "your rental property"
    }.\n\n`;
    message += `Payment Details:\n`;
    message += `- Amount Due: ${formatCurrency(payment.amount)}\n`;
    message += `- Due Date: ${new Date(
      payment.dueDate
    ).toLocaleDateString()}\n`;
    message += `- Payment Type: ${payment.type}\n\n`;

    if (config.includePaymentInstructions) {
      message += `Payment Instructions:\n`;
      message += `You can make your payment online through our tenant portal or by the accepted payment methods listed in your lease agreement.\n\n`;
    }

    message += `Thank you for your prompt payment.\n\n`;
    message += `Best regards,\n`;
    message += `PropertyPro Management`;

    return message;
  }

  private async linkInvoiceToPayment(
    paymentId: string,
    invoiceResult: any
  ): Promise<void> {
    // Link the generated invoice to the payment record
    await Payment.findByIdAndUpdate(paymentId, {
      $push: {
        invoices: {
          invoiceId: invoiceResult.fileName,
          generatedAt: new Date(),
          fileUrl: invoiceResult.fileUrl,
        },
      },
    });
  }

  private async handlePaymentCompleted(payment: IPayment): Promise<void> {
    // Generate payment confirmation
    await this.generatePaymentConfirmationInvoice(payment);

    // Update lease status
    if (payment.leaseId) {
      await this.updateLeaseStatusBasedOnPayments(payment.leaseId);
    }
  }

  private async handlePaymentOverdue(payment: IPayment): Promise<void> {
    // Generate overdue notice
    // Send notification to tenant
    // Apply late fees if configured
  }

  private async handlePaymentFailed(payment: IPayment): Promise<void> {
    // Send failure notification
    // Revert any status changes
  }

  private async handlePaymentRefunded(payment: IPayment): Promise<void> {
    // Generate refund confirmation
    // Update accounting records
  }

  private async generatePaymentConfirmationInvoice(
    payment: IPayment
  ): Promise<boolean> {
    try {
      // Generate a payment confirmation/receipt
      return true;
    } catch {
      return false;
    }
  }

  private async triggerNextRecurringPayment(payment: IPayment): Promise<void> {
    // Create the next payment in the recurring series
    if (payment.schedule?.frequency && payment.schedule?.nextDueDate) {
      await paymentService.generateNextRecurringPayment(payment._id.toString());
    }
  }
}

export const leasePaymentSyncService = new LeasePaymentSyncService();

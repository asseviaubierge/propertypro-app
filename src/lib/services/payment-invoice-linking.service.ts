/**
 * PropertyPro - Payment-Invoice Linking Service
 * Service for linking payments to invoices with proper priority and partial payment support
 */

import { Types } from "mongoose";
import { Invoice, Payment } from "@/models";
import {
  InvoiceStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentType,
} from "@/types";

export interface PaymentApplication {
  invoiceId: string;
  amountApplied: number;
  remainingBalance: number;
  fullyPaid: boolean;
}

export interface PaymentLinkingResult {
  success: boolean;
  paymentId: string;
  totalAmountApplied: number;
  applicationsApplied: PaymentApplication[];
  remainingPaymentAmount: number;
  errors: string[];
}

export class PaymentInvoiceLinkingService {
  /**
   * Apply payment to invoices with oldest-first priority
   */
  async applyPaymentToInvoices(
    paymentId: string,
    tenantId: string,
    paymentAmount: number,
    leaseId?: string
  ): Promise<PaymentLinkingResult> {
    const result: PaymentLinkingResult = {
      success: false,
      paymentId,
      totalAmountApplied: 0,
      applicationsApplied: [],
      remainingPaymentAmount: paymentAmount,
      errors: [],
    };

    try {
      // Get all outstanding invoices for the tenant, ordered by due date (oldest first)
      const filter: any = {
        tenantId: new Types.ObjectId(tenantId),
        balanceRemaining: { $gt: 0 },
        status: {
          $in: [
            InvoiceStatus.ISSUED,
            InvoiceStatus.PARTIAL,
            InvoiceStatus.OVERDUE,
          ],
        },
      };

      if (leaseId) {
        filter.leaseId = new Types.ObjectId(leaseId);
      }

      const outstandingInvoices = await Invoice.find(filter)
        .sort({ dueDate: 1, createdAt: 1 }) // Oldest first
        .lean();

      if (outstandingInvoices.length === 0) {
        result.errors.push("No outstanding invoices found for this tenant");
        return result;
      }

      let remainingAmount = paymentAmount;

      // Apply payment to invoices in order
      for (const invoice of outstandingInvoices) {
        if (remainingAmount <= 0) break;

        const amountToApply = Math.min(
          remainingAmount,
          invoice.balanceRemaining
        );

        try {
          const application = await this.applyPaymentToSingleInvoice(
            paymentId,
            invoice._id.toString(),
            amountToApply
          );

          result.applicationsApplied.push(application);
          result.totalAmountApplied += amountToApply;
          remainingAmount -= amountToApply;
        } catch (error) {
          result.errors.push(
            `Failed to apply payment to invoice ${invoice.invoiceNumber}: ${error}`
          );
        }
      }

      result.remainingPaymentAmount = remainingAmount;
      result.success = result.totalAmountApplied > 0;

      // Update payment record with invoice links
      await this.updatePaymentRecord(paymentId, result.applicationsApplied);

      return result;
    } catch (error) {
      result.errors.push(`General error: ${error}`);
      return result;
    }
  }

  /**
   * Apply payment to a specific invoice
   */
  async applyPaymentToSingleInvoice(
    paymentId: string,
    invoiceId: string,
    amount: number
  ): Promise<PaymentApplication> {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found");
    }

    if (amount > invoice.balanceRemaining) {
      throw new Error("Payment amount exceeds invoice balance");
    }

    // Update invoice with payment
    await invoice.addPayment(new Types.ObjectId(paymentId), amount);

    // Track allocation on payment
    await Payment.findByIdAndUpdate(
      paymentId,
      {
        $push: {
          allocations: {
            invoiceId: new Types.ObjectId(invoiceId),
            amount,
          },
        },
      },
      { runValidators: true }
    );

    return {
      invoiceId,
      amountApplied: amount,
      remainingBalance: invoice.balanceRemaining - amount,
      fullyPaid: invoice.balanceRemaining - amount === 0,
    };
  }

  /**
   * Update payment record with invoice links
   */
  private async updatePaymentRecord(
    paymentId: string,
    applications: PaymentApplication[]
  ): Promise<void> {
    const invoiceIds = applications.map(
      (app) => new Types.ObjectId(app.invoiceId)
    );

    await Payment.findByIdAndUpdate(
      paymentId,
      {
        $set: {
          invoiceId: invoiceIds[0], // Primary invoice (for backward compatibility)
          status: PaymentStatus.PAID,
          paidDate: new Date(),
        },
        $push: {
          paymentHistory: {
            amount: applications.reduce(
              (sum, app) => sum + app.amountApplied,
              0
            ),
            paymentMethod: PaymentMethod.OTHER, // Unknown/manual system application
            paidDate: new Date(),
            notes: `Applied to ${applications.length} invoice(s)`,
          },
          allocations: {
            $each: applications.map((app) => ({
              invoiceId: new Types.ObjectId(app.invoiceId),
              amount: app.amountApplied,
            })),
          },
        },
      },
      { runValidators: true }
    );
  }

  /**
   * Get payment allocation for a tenant
   */
  async getPaymentAllocation(
    tenantId: string,
    leaseId?: string
  ): Promise<{
    totalOutstanding: number;
    invoices: Array<{
      invoiceId: string;
      invoiceNumber: string;
      dueDate: Date;
      totalAmount: number;
      amountPaid: number;
      balanceRemaining: number;
      status: string;
      daysOverdue: number;
    }>;
  }> {
    const filter: any = {
      tenantId: new Types.ObjectId(tenantId),
      balanceRemaining: { $gt: 0 },
    };

    if (leaseId) {
      filter.leaseId = new Types.ObjectId(leaseId);
    }

    const invoices = await Invoice.find(filter).sort({ dueDate: 1 }).lean();

    const now = new Date();
    const processedInvoices = invoices.map((invoice) => ({
      invoiceId: invoice._id.toString(),
      invoiceNumber: invoice.invoiceNumber,
      dueDate: invoice.dueDate,
      totalAmount: invoice.totalAmount,
      amountPaid: invoice.amountPaid,
      balanceRemaining: invoice.balanceRemaining,
      status: invoice.status,
      daysOverdue:
        invoice.dueDate < now
          ? Math.ceil(
              (now.getTime() - invoice.dueDate.getTime()) /
                (24 * 60 * 60 * 1000)
            )
          : 0,
    }));

    return {
      totalOutstanding: processedInvoices.reduce(
        (sum, inv) => sum + inv.balanceRemaining,
        0
      ),
      invoices: processedInvoices,
    };
  }

  /**
   * Record manual payment entry
   */
  async recordManualPayment(data: {
    tenantId: string;
    leaseId?: string;
    amount: number;
    paymentMethod: string;
    paymentDate: Date;
    notes?: string;
    specificInvoiceId?: string;
  }): Promise<PaymentLinkingResult> {
    try {
      // Derive propertyId/leaseId when possible
      let propertyId: Types.ObjectId | undefined = undefined;
      let leaseId: Types.ObjectId | undefined = undefined;
      if (data.leaseId) {
        leaseId = new Types.ObjectId(data.leaseId);
        propertyId = await this.getPropertyIdFromLease(data.leaseId);
      } else if (data.specificInvoiceId) {
        const inv = await Invoice.findById(data.specificInvoiceId).select(
          "propertyId leaseId"
        );
        if (inv) {
          propertyId = inv.propertyId as any;
          leaseId = inv.leaseId as any;
        }
      }
      if (!propertyId) {
        throw new Error(
          "propertyId could not be resolved. Provide leaseId or specificInvoiceId."
        );
      }

      // Create payment record
      const payment = new Payment({
        tenantId: new Types.ObjectId(data.tenantId),
        propertyId,
        leaseId,
        amount: data.amount,
        amountPaid: data.amount,
        type: PaymentType.RENT, // Default type, should be configurable
        status: PaymentStatus.PAID,
        paymentMethod: data.paymentMethod as any,
        dueDate: data.paymentDate,
        paidDate: data.paymentDate,
        notes: data.notes,
      });

      await payment.save();

      // Apply payment to invoices
      if (data.specificInvoiceId) {
        // Apply to specific invoice
        const application = await this.applyPaymentToSingleInvoice(
          payment._id.toString(),
          data.specificInvoiceId,
          data.amount
        );

        return {
          success: true,
          paymentId: payment._id.toString(),
          totalAmountApplied: data.amount,
          applicationsApplied: [application],
          remainingPaymentAmount: 0,
          errors: [],
        };
      } else {
        // Apply to oldest invoices first
        return await this.applyPaymentToInvoices(
          payment._id.toString(),
          data.tenantId,
          data.amount,
          data.leaseId
        );
      }
    } catch (error) {
      return {
        success: false,
        paymentId: "",
        totalAmountApplied: 0,
        applicationsApplied: [],
        remainingPaymentAmount: data.amount,
        errors: [`Failed to record payment: ${error}`],
      };
    }
  }

  /**
   * Reverse payment application (for refunds/corrections)
   */
  async reversePaymentApplication(paymentId: string): Promise<{
    success: boolean;
    reversedAmount: number;
    affectedInvoices: string[];
    errors: string[];
  }> {
    const result = {
      success: false,
      reversedAmount: 0,
      affectedInvoices: [] as string[],
      errors: [] as string[],
    };

    try {
      // Find payment
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        result.errors.push("Payment not found");
        return result;
      }

      // Find all invoices that received this payment
      const invoices = await Invoice.find({
        paymentIds: new Types.ObjectId(paymentId),
      });

      // Build allocation map
      const allocationMap = new Map<string, number>();
      if (payment.allocations && payment.allocations.length > 0) {
        for (const alloc of payment.allocations as any[]) {
          allocationMap.set(String(alloc.invoiceId), alloc.amount || 0);
        }
      }

      for (const invoice of invoices) {
        try {
          // Remove payment from invoice
          invoice.paymentIds = invoice.paymentIds.filter(
            (id) => id.toString() !== paymentId
          );

          // Use recorded allocation if available; else fall back to even split
          const recorded = allocationMap.get(invoice._id.toString());
          const paymentAmount =
            recorded !== undefined
              ? recorded
              : payment.amount / Math.max(1, invoices.length);
          invoice.amountPaid -= paymentAmount;
          invoice.balanceRemaining += paymentAmount;

          // Update status
          if (invoice.balanceRemaining === invoice.totalAmount) {
            invoice.status = InvoiceStatus.ISSUED;
          } else if (invoice.balanceRemaining > 0) {
            invoice.status = InvoiceStatus.PARTIAL;
          }

          await invoice.save();

          result.affectedInvoices.push(invoice._id.toString());
          result.reversedAmount += paymentAmount;
        } catch (error) {
          result.errors.push(
            `Failed to reverse payment for invoice ${invoice.invoiceNumber}: ${error}`
          );
        }
      }

      // Update payment status
      await Payment.findByIdAndUpdate(
        paymentId,
        {
          $set: {
            status: PaymentStatus.REFUNDED,
            notes: `${payment.notes || ""} [REVERSED]`,
          },
        },
        { runValidators: true }
      );

      result.success = result.affectedInvoices.length > 0;
      return result;
    } catch (error) {
      result.errors.push(`General error: ${error}`);
      return result;
    }
  }

  /**
   * Helper method to get property ID from lease
   */
  private async getPropertyIdFromLease(
    leaseId: string
  ): Promise<Types.ObjectId | undefined> {
    const Lease = require("@/models").Lease;
    const lease = await Lease.findById(leaseId).select("propertyId");
    return lease?.propertyId;
  }
}

export const paymentInvoiceLinkingService = new PaymentInvoiceLinkingService();

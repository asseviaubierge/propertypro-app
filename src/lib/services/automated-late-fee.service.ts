/**
 * PropertyPro - Automated Late Fee Service
 * Service for automatically applying late fees to overdue invoices
 */

import { Types } from "mongoose";
import { Invoice, Lease } from "@/models";
import { InvoiceStatus, InvoiceType } from "@/types";

export interface LateFeeRule {
  id: string;
  name: string;
  enabled: boolean;
  gracePeriodDays: number;
  feeType: "fixed" | "percentage" | "daily";
  feeAmount: number;
  maxFeeAmount?: number;
  compoundDaily: boolean;
  applyOnce: boolean;
  conditions: {
    minInvoiceAmount?: number;
    maxInvoiceAmount?: number;
    invoiceTypes?: InvoiceType[];
  };
}

export interface LateFeeApplication {
  invoiceId: string;
  invoiceNumber: string;
  tenantId: string;
  daysOverdue: number;
  originalAmount: number;
  lateFeeAmount: number;
  totalAmount: number;
  ruleApplied: string;
  appliedDate: Date;
}

export interface LateFeeProcessingResult {
  totalProcessed: number;
  feesApplied: number;
  totalFeeAmount: number;
  applications: LateFeeApplication[];
  errors: string[];
  summary: {
    byRule: Record<string, number>;
    byDaysOverdue: Record<string, number>;
  };
}

export class AutomatedLateFeeService {
  private defaultRules: LateFeeRule[] = [
    {
      id: "standard-late-fee",
      name: "Standard Late Fee",
      enabled: true,
      gracePeriodDays: 5,
      feeType: "fixed",
      feeAmount: 50,
      compoundDaily: false,
      applyOnce: true,
      conditions: {
        invoiceTypes: [InvoiceType.RENT],
      },
    },
    {
      id: "daily-late-fee",
      name: "Daily Late Fee",
      enabled: false,
      gracePeriodDays: 10,
      feeType: "daily",
      feeAmount: 5,
      maxFeeAmount: 200,
      compoundDaily: true,
      applyOnce: false,
      conditions: {
        invoiceTypes: [InvoiceType.RENT],
      },
    },
    {
      id: "percentage-late-fee",
      name: "Percentage Late Fee",
      enabled: false,
      gracePeriodDays: 5,
      feeType: "percentage",
      feeAmount: 5, // 5%
      maxFeeAmount: 500,
      compoundDaily: false,
      applyOnce: true,
      conditions: {
        invoiceTypes: [InvoiceType.RENT],
      },
    },
  ];

  /**
   * Process late fees for all eligible invoices
   */
  async processAllLateFees(
    customRules?: LateFeeRule[],
    dryRun: boolean = false
  ): Promise<LateFeeProcessingResult> {
    const rules = customRules || this.defaultRules;
    const enabledRules = rules.filter((rule) => rule.enabled);

    const result: LateFeeProcessingResult = {
      totalProcessed: 0,
      feesApplied: 0,
      totalFeeAmount: 0,
      applications: [],
      errors: [],
      summary: {
        byRule: {},
        byDaysOverdue: {},
      },
    };

    try {
      // Get all overdue invoices that haven't been fully paid
      const overdueInvoices = await this.getOverdueInvoices();
      result.totalProcessed = overdueInvoices.length;


      for (const invoice of overdueInvoices) {
        try {
          const application = await this.processInvoiceLateFee(
            invoice,
            enabledRules,
            dryRun
          );

          if (application) {
            result.applications.push(application);
            result.feesApplied++;
            result.totalFeeAmount += application.lateFeeAmount;

            // Update summary
            result.summary.byRule[application.ruleApplied] =
              (result.summary.byRule[application.ruleApplied] || 0) + 1;

            const daysKey = `${application.daysOverdue} days`;
            result.summary.byDaysOverdue[daysKey] =
              (result.summary.byDaysOverdue[daysKey] || 0) + 1;
          }
        } catch (error) {
          result.errors.push(
            `Failed to process invoice ${invoice.invoiceNumber}: ${error}`
          );
        }
      }

      return result;
    } catch (error) {
      result.errors.push(`General error: ${error}`);
      return result;
    }
  }

  /**
   * Process late fee for a specific invoice
   */
  async processInvoiceLateFee(
    invoice: any,
    rules: LateFeeRule[],
    dryRun: boolean = false
  ): Promise<LateFeeApplication | null> {
    const now = new Date();
    const daysOverdue = Math.ceil(
      (now.getTime() - invoice.dueDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Find applicable rule
    const applicableRule = this.findApplicableRule(invoice, rules, daysOverdue);
    if (!applicableRule) {
      return null;
    }

    // Check if still within grace period
    if (daysOverdue <= applicableRule.gracePeriodDays) {
      return null;
    }

    // Check if late fee already applied and rule is apply-once
    if (applicableRule.applyOnce && invoice.lateFeeAmount > 0) {
      return null;
    }

    // Calculate late fee
    const lateFeeAmount = this.calculateLateFee(
      invoice,
      applicableRule,
      daysOverdue
    );

    if (lateFeeAmount <= 0) {
      return null;
    }

    const application: LateFeeApplication = {
      invoiceId: invoice._id.toString(),
      invoiceNumber: invoice.invoiceNumber,
      tenantId: invoice.tenantId.toString(),
      daysOverdue,
      originalAmount: invoice.totalAmount - invoice.lateFeeAmount,
      lateFeeAmount,
      totalAmount: invoice.totalAmount + lateFeeAmount,
      ruleApplied: applicableRule.name,
      appliedDate: now,
    };

    // Apply late fee if not dry run
    if (!dryRun) {
      await this.applyLateFeeToInvoice(
        invoice._id,
        lateFeeAmount,
        applicableRule
      );

      // Send notification about late fee
      await this.sendLateFeeNotification(invoice, lateFeeAmount);
    }

    return application;
  }

  /**
   * Get all overdue invoices eligible for late fees
   */
  private async getOverdueInvoices() {
    const now = new Date();

    return await Invoice.find({
      status: {
        $in: [
          InvoiceStatus.ISSUED,
          InvoiceStatus.PARTIAL,
          InvoiceStatus.OVERDUE,
        ],
      },
      dueDate: { $lt: now },
      balanceRemaining: { $gt: 0 },
    })
      .populate("tenantId", "firstName lastName email")
      .populate("leaseId", "terms")
      .lean();
  }

  /**
   * Find applicable late fee rule for an invoice
   */
  private findApplicableRule(
    invoice: any,
    rules: LateFeeRule[],
    daysOverdue: number
  ): LateFeeRule | null {
    for (const rule of rules) {
      if (!rule.enabled) continue;

      // Check grace period
      if (daysOverdue <= rule.gracePeriodDays) continue;

      // Check invoice amount conditions
      if (
        rule.conditions.minInvoiceAmount &&
        invoice.totalAmount < rule.conditions.minInvoiceAmount
      )
        continue;

      if (
        rule.conditions.maxInvoiceAmount &&
        invoice.totalAmount > rule.conditions.maxInvoiceAmount
      )
        continue;

      // Check invoice type conditions
      if (
        rule.conditions.invoiceTypes &&
        rule.conditions.invoiceTypes.length > 0
      ) {
        const hasMatchingType = invoice.lineItems.some((item: any) =>
          rule.conditions.invoiceTypes!.includes(item.type)
        );
        if (!hasMatchingType) continue;
      }

      return rule;
    }

    return null;
  }

  /**
   * Calculate late fee amount based on rule
   */
  private calculateLateFee(
    invoice: any,
    rule: LateFeeRule,
    daysOverdue: number
  ): number {
    let lateFeeAmount = 0;
    const baseAmount = invoice.totalAmount - invoice.lateFeeAmount;

    switch (rule.feeType) {
      case "fixed":
        lateFeeAmount = rule.feeAmount;
        break;

      case "percentage":
        lateFeeAmount = (baseAmount * rule.feeAmount) / 100;
        break;

      case "daily":
        const daysToCharge = Math.max(0, daysOverdue - rule.gracePeriodDays);
        lateFeeAmount = rule.feeAmount * daysToCharge;

        if (rule.compoundDaily) {
          // Apply compound daily interest
          const dailyRate = rule.feeAmount / 100;
          lateFeeAmount =
            baseAmount * Math.pow(1 + dailyRate, daysToCharge) - baseAmount;
        }
        break;
    }

    // Apply maximum fee limit
    if (rule.maxFeeAmount && lateFeeAmount > rule.maxFeeAmount) {
      lateFeeAmount = rule.maxFeeAmount;
    }

    // Don't apply if already at or above max
    if (rule.maxFeeAmount && invoice.lateFeeAmount >= rule.maxFeeAmount) {
      return 0;
    }

    // For non-apply-once rules, only charge the additional amount
    if (!rule.applyOnce && invoice.lateFeeAmount > 0) {
      lateFeeAmount = Math.max(0, lateFeeAmount - invoice.lateFeeAmount);
    }

    return Math.round(lateFeeAmount * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Apply late fee to invoice
   */
  private async applyLateFeeToInvoice(
    invoiceId: Types.ObjectId,
    lateFeeAmount: number,
    rule: LateFeeRule
  ): Promise<void> {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found");
    }

    await invoice.addLateFee(lateFeeAmount);
  }

  /**
   * Send late fee notification
   */
  private async sendLateFeeNotification(
    invoice: any,
    lateFeeAmount: number
  ): Promise<void> {
    try {
      // This would integrate with your notification service

      // TODO: Implement actual email/SMS notification
      // await notificationService.sendLateFeeNotification({
      //   tenantEmail: invoice.tenantId.email,
      //   invoiceNumber: invoice.invoiceNumber,
      //   lateFeeAmount,
      //   newBalance: invoice.totalAmount + lateFeeAmount,
      // });
    } catch (error) {
      console.error("Failed to send late fee notification:", error);
    }
  }

  /**
   * Get late fee rules for a specific lease
   */
  async getLateFeeRulesForLease(leaseId: string): Promise<LateFeeRule[]> {
    try {
      const lease = await Lease.findById(leaseId);
      if (!lease) {
        return this.defaultRules;
      }

      // Check if lease has custom late fee configuration
      const leaseLateFeeConfig = lease.terms?.paymentConfig;
      if (leaseLateFeeConfig) {
        const customRule: LateFeeRule = {
          id: "lease-specific",
          name: "Lease Specific Late Fee",
          enabled: true,
          gracePeriodDays:
            leaseLateFeeConfig.lateFeeConfig?.gracePeriodDays || 5,
          feeType:
            leaseLateFeeConfig.lateFeeConfig?.feeType === "percentage"
              ? "percentage"
              : leaseLateFeeConfig.lateFeeConfig?.feeType === "daily"
              ? "daily"
              : "fixed",
          feeAmount: lease.terms.lateFee || 50,
          compoundDaily: false,
          applyOnce: true,
          conditions: {
            invoiceTypes: [InvoiceType.RENT],
          },
        };

        return [customRule];
      }

      return this.defaultRules;
    } catch (error) {
      console.error("Error getting late fee rules for lease:", error);
      return this.defaultRules;
    }
  }

  /**
   * Schedule automated late fee processing
   */
  async scheduleAutomatedProcessing(): Promise<void> {
    // This would be called by a cron job or scheduled task

    const result = await this.processAllLateFees();


    if (result.errors.length > 0) {
      console.error("Late fee processing errors:", result.errors);
    }
  }
}

export const automatedLateFeeService = new AutomatedLateFeeService();

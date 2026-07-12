/**
 * PropertyPro - Late Fee Automation Service
 * Automatic late fee calculation and application based on grace period and lease terms
 */

import {
  IPayment,
  ILease,
  PaymentType,
  PaymentStatus,
  ILateFeeConfig,
} from "@/types";
import { Payment, Lease } from "@/models";
import { paymentService } from "./payment.service";
import { paymentStatusService } from "./payment-status.service";
import { paymentCommunicationService } from "./payment-communication.service";
import mongoose from "mongoose";

export interface LateFeeRule {
  id: string;
  name: string;
  description: string;
  gracePeriodDays: number;
  feeStructure: {
    type: "fixed" | "percentage" | "tiered" | "daily";
    amount?: number;
    percentage?: number;
    maxAmount?: number;
    minAmount?: number;
    tiers?: Array<{
      daysOverdue: number;
      amount: number;
      percentage?: number;
    }>;
    dailyRate?: number;
    compoundDaily?: boolean;
  };
  applicablePaymentTypes: PaymentType[];
  conditions?: {
    minRentAmount?: number;
    maxRentAmount?: number;
    tenantType?: string[];
    propertyType?: string[];
  };
  enabled: boolean;
}

export interface LateFeeCalculation {
  paymentId: string;
  originalAmount: number;
  daysOverdue: number;
  gracePeriodDays: number;
  applicableRule: LateFeeRule;
  calculatedFee: number;
  breakdown: {
    baseFee: number;
    dailyFees: number;
    compoundFees: number;
    totalBeforeCap: number;
    capApplied: boolean;
    finalAmount: number;
  };
  effectiveDate: Date;
  reason: string;
}

export interface LateFeeApplication {
  paymentId: string;
  lateFeePaymentId: string;
  calculation: LateFeeCalculation;
  status: "applied" | "failed" | "reversed";
  appliedAt: Date;
  appliedBy: string;
  notes?: string;
}

export interface LateFeeProcessingResult {
  totalProcessed: number;
  feesApplied: number;
  totalFeeAmount: number;
  applications: LateFeeApplication[];
  errors: Array<{
    paymentId: string;
    error: string;
  }>;
  summary: {
    byRule: Record<string, { count: number; amount: number }>;
    byDaysOverdue: Record<string, { count: number; amount: number }>;
  };
}

export class LateFeeAutomationService {
  private defaultRules: LateFeeRule[] = [
    {
      id: "standard_rent_late_fee",
      name: "Standard Rent Late Fee",
      description:
        "Standard late fee for rent payments after 5-day grace period",
      gracePeriodDays: 5,
      feeStructure: {
        type: "fixed",
        amount: 50,
        maxAmount: 200,
      },
      applicablePaymentTypes: [PaymentType.RENT],
      enabled: true,
    },
    {
      id: "percentage_based_late_fee",
      name: "Percentage-Based Late Fee",
      description: "5% late fee with $25 minimum and $150 maximum",
      gracePeriodDays: 5,
      feeStructure: {
        type: "percentage",
        percentage: 5,
        minAmount: 25,
        maxAmount: 150,
      },
      applicablePaymentTypes: [PaymentType.RENT],
      enabled: false,
    },
    {
      id: "tiered_late_fee",
      name: "Tiered Late Fee Structure",
      description: "Escalating fees based on days overdue",
      gracePeriodDays: 3,
      feeStructure: {
        type: "tiered",
        tiers: [
          { daysOverdue: 5, amount: 25 },
          { daysOverdue: 10, amount: 50 },
          { daysOverdue: 15, amount: 75 },
          { daysOverdue: 30, amount: 100 },
        ],
      },
      applicablePaymentTypes: [PaymentType.RENT],
      enabled: false,
    },
    {
      id: "daily_compound_late_fee",
      name: "Daily Compounding Late Fee",
      description: "$5 per day after grace period with compounding",
      gracePeriodDays: 5,
      feeStructure: {
        type: "daily",
        dailyRate: 5,
        compoundDaily: true,
        maxAmount: 300,
      },
      applicablePaymentTypes: [PaymentType.RENT],
      enabled: false,
    },
  ];

  /**
   * Process late fees for all eligible payments
   */
  async processLateFees(
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
      // Get all payments eligible for late fees
      const eligiblePayments = await this.getEligiblePayments();
      result.totalProcessed = eligiblePayments.length;


      // Process each payment
      for (const payment of eligiblePayments) {
        try {
          const application = await this.processPaymentLateFee(
            payment,
            enabledRules,
            dryRun
          );

          if (application) {
            result.applications.push(application);
            result.feesApplied++;
            result.totalFeeAmount += application.calculation.calculatedFee;

            // Update summary
            const ruleId = application.calculation.applicableRule.id;
            const daysOverdue = application.calculation.daysOverdue.toString();

            if (!result.summary.byRule[ruleId]) {
              result.summary.byRule[ruleId] = { count: 0, amount: 0 };
            }
            if (!result.summary.byDaysOverdue[daysOverdue]) {
              result.summary.byDaysOverdue[daysOverdue] = {
                count: 0,
                amount: 0,
              };
            }

            result.summary.byRule[ruleId].count++;
            result.summary.byRule[ruleId].amount +=
              application.calculation.calculatedFee;
            result.summary.byDaysOverdue[daysOverdue].count++;
            result.summary.byDaysOverdue[daysOverdue].amount +=
              application.calculation.calculatedFee;
          }
        } catch (error) {
          result.errors.push({
            paymentId: payment._id.toString(),
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }


    } catch (error) {
      console.error("Error processing late fees:", error);
      throw error;
    }

    return result;
  }

  /**
   * Process late fee for a specific payment
   */
  async processPaymentLateFee(
    payment: any,
    rules: LateFeeRule[],
    dryRun: boolean = false
  ): Promise<LateFeeApplication | null> {
    // Check if late fee already applied
    if (payment.lateFeeApplied && payment.lateFeeApplied > 0) {
      return null;
    }

    // Calculate days overdue
    const daysOverdue = this.calculateDaysOverdue(payment.dueDate);

    // Find applicable rule
    const applicableRule = this.findApplicableRule(payment, rules, daysOverdue);
    if (!applicableRule) {
      return null;
    }

    // Check if still within grace period
    if (daysOverdue <= applicableRule.gracePeriodDays) {
      return null;
    }

    // Calculate late fee
    const calculation = this.calculateLateFee(
      payment,
      applicableRule,
      daysOverdue
    );

    if (calculation.calculatedFee <= 0) {
      return null;
    }

    // Apply late fee if not dry run
    let lateFeePaymentId = "";
    let status: "applied" | "failed" = "applied";

    if (!dryRun) {
      try {
        const lateFeePayment = await this.createLateFeePayment(
          payment,
          calculation
        );
        lateFeePaymentId = lateFeePayment._id.toString();

        // Update original payment
        await Payment.findByIdAndUpdate(payment._id, {
          lateFeeApplied: calculation.calculatedFee,
          lateFeeDate: new Date(),
        });

        // Send notification about late fee
        await this.sendLateFeeNotification(payment, calculation);
      } catch (error) {
        console.error("Error applying late fee:", error);
        status = "failed";
      }
    }

    return {
      paymentId: payment._id.toString(),
      lateFeePaymentId,
      calculation,
      status,
      appliedAt: new Date(),
      appliedBy: "system",
      notes: dryRun ? "Dry run - not actually applied" : undefined,
    };
  }

  /**
   * Calculate late fee based on rule and payment details
   */
  calculateLateFee(
    payment: any,
    rule: LateFeeRule,
    daysOverdue: number
  ): LateFeeCalculation {
    const daysAfterGrace = Math.max(0, daysOverdue - rule.gracePeriodDays);
    let calculatedFee = 0;
    let baseFee = 0;
    let dailyFees = 0;
    let compoundFees = 0;

    const breakdown = {
      baseFee: 0,
      dailyFees: 0,
      compoundFees: 0,
      totalBeforeCap: 0,
      capApplied: false,
      finalAmount: 0,
    };

    switch (rule.feeStructure.type) {
      case "fixed":
        baseFee = rule.feeStructure.amount || 0;
        calculatedFee = baseFee;
        break;

      case "percentage":
        baseFee = (payment.amount * (rule.feeStructure.percentage || 0)) / 100;
        calculatedFee = baseFee;
        break;

      case "tiered":
        const applicableTier = rule.feeStructure.tiers
          ?.filter((tier) => daysOverdue >= tier.daysOverdue)
          .sort((a, b) => b.daysOverdue - a.daysOverdue)[0];

        if (applicableTier) {
          if (applicableTier.amount) {
            baseFee = applicableTier.amount;
          } else if (applicableTier.percentage) {
            baseFee = (payment.amount * applicableTier.percentage) / 100;
          }
          calculatedFee = baseFee;
        }
        break;

      case "daily":
        const dailyRate = rule.feeStructure.dailyRate || 0;
        dailyFees = dailyRate * daysAfterGrace;

        if (rule.feeStructure.compoundDaily) {
          // Simple compound calculation: daily rate * days * (1 + compound factor)
          const compoundFactor = 0.1; // 10% compound factor
          compoundFees = dailyFees * compoundFactor;
        }

        calculatedFee = dailyFees + compoundFees;
        break;
    }

    // Apply minimum amount
    if (
      rule.feeStructure.minAmount &&
      calculatedFee < rule.feeStructure.minAmount
    ) {
      calculatedFee = rule.feeStructure.minAmount;
    }

    breakdown.baseFee = baseFee;
    breakdown.dailyFees = dailyFees;
    breakdown.compoundFees = compoundFees;
    breakdown.totalBeforeCap = calculatedFee;

    // Apply maximum amount cap
    if (
      rule.feeStructure.maxAmount &&
      calculatedFee > rule.feeStructure.maxAmount
    ) {
      calculatedFee = rule.feeStructure.maxAmount;
      breakdown.capApplied = true;
    }

    breakdown.finalAmount = calculatedFee;

    // Round to 2 decimal places
    calculatedFee = Math.round(calculatedFee * 100) / 100;

    return {
      paymentId: payment._id.toString(),
      originalAmount: payment.amount,
      daysOverdue,
      gracePeriodDays: rule.gracePeriodDays,
      applicableRule: rule,
      calculatedFee,
      breakdown,
      effectiveDate: new Date(),
      reason: `Late fee applied after ${daysOverdue} days overdue (${daysAfterGrace} days after ${rule.gracePeriodDays}-day grace period)`,
    };
  }

  /**
   * Find applicable late fee rule for a payment
   */
  private findApplicableRule(
    payment: any,
    rules: LateFeeRule[],
    daysOverdue: number
  ): LateFeeRule | null {
    for (const rule of rules) {
      // Check if rule applies to this payment type
      if (!rule.applicablePaymentTypes.includes(payment.type)) {
        continue;
      }

      // Check conditions if specified
      if (rule.conditions) {
        if (
          rule.conditions.minRentAmount &&
          payment.amount < rule.conditions.minRentAmount
        ) {
          continue;
        }
        if (
          rule.conditions.maxRentAmount &&
          payment.amount > rule.conditions.maxRentAmount
        ) {
          continue;
        }
        // Additional condition checks can be added here
      }

      // Rule is applicable
      return rule;
    }

    return null;
  }

  /**
   * Get payments eligible for late fee processing
   */
  private async getEligiblePayments(): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 1); // At least 1 day overdue

    return Payment.find({
      status: {
        $nin: [
          PaymentStatus.PAID,
          PaymentStatus.PAID,
          PaymentStatus.CANCELLED,
        ],
      },
      dueDate: { $lt: cutoffDate },
      $or: [
        { lateFeeApplied: { $exists: false } },
        { lateFeeApplied: 0 },
        { lateFeeApplied: null },
      ],
      deletedAt: null,
    }).populate([
      {
        path: "tenantId",
        populate: { path: "userId", select: "firstName lastName email phone" },
      },
      { path: "propertyId", select: "name address" },
      { path: "leaseId" },
    ]);
  }

  /**
   * Create late fee payment
   */
  private async createLateFeePayment(
    originalPayment: any,
    calculation: LateFeeCalculation
  ): Promise<any> {
    const lateFeePaymentData = {
      tenantId: originalPayment.tenantId._id.toString(),
      propertyId: originalPayment.propertyId._id.toString(),
      leaseId: originalPayment.leaseId?._id.toString(),
      amount: calculation.calculatedFee,
      type: PaymentType.LATE_FEE,
      dueDate: new Date(),
      description: `Late fee for payment ${originalPayment._id}`,
      notes: calculation.reason,
    };

    return await paymentService.createPayment(lateFeePaymentData);
  }

  /**
   * Send late fee notification
   */
  private async sendLateFeeNotification(
    payment: any,
    calculation: LateFeeCalculation
  ): Promise<void> {
    try {
      // This would integrate with the communication service
      // For now, just log the notification

      // TODO: Implement actual notification sending
      // await paymentCommunicationService.sendLateFeeNotification(payment, calculation);
    } catch (error) {
      console.error("Error sending late fee notification:", error);
    }
  }

  /**
   * Calculate days overdue
   */
  private calculateDaysOverdue(dueDate: Date): number {
    const now = new Date();
    const due = new Date(dueDate);
    const timeDiff = now.getTime() - due.getTime();
    return Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
  }

  /**
   * Reverse a late fee
   */
  async reverseLateFee(
    paymentId: string,
    reason: string,
    reversedBy: string
  ): Promise<{ success: boolean; message: string }> {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // Find the original payment
        const payment = await Payment.findById(paymentId).session(session);
        if (!payment) {
          throw new Error("Payment not found");
        }

        if (!payment.lateFeeApplied || payment.lateFeeApplied <= 0) {
          throw new Error("No late fee to reverse");
        }

        // Find and cancel the late fee payment
        const lateFeePayment = await Payment.findOne({
          type: PaymentType.LATE_FEE,
          notes: { $regex: paymentId },
          status: { $ne: PaymentStatus.CANCELLED },
        }).session(session);

        if (lateFeePayment) {
          lateFeePayment.status = PaymentStatus.CANCELLED;
          lateFeePayment.notes = `${lateFeePayment.notes}\nReversed: ${reason}`;
          await lateFeePayment.save({ session });
        }

        // Reset late fee on original payment
        payment.lateFeeApplied = 0;
        payment.lateFeeDate = undefined;
        payment.notes = `${payment.notes || ""}\nLate fee reversed: ${reason}`;
        await payment.save({ session });
      });

      return { success: true, message: "Late fee reversed successfully" };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to reverse late fee",
      };
    } finally {
      await session.endSession();
    }
  }

  /**
   * Get late fee rules
   */
  getLateFeeRules(): LateFeeRule[] {
    return this.defaultRules;
  }

  /**
   * Update late fee rules
   */
  updateLateFeeRules(rules: LateFeeRule[]): void {
    this.defaultRules = rules;
  }
}

export const lateFeeAutomationService = new LateFeeAutomationService();

/**
 * PropertyPro - Enhanced Payment Status Management Service
 * Handles payment status lifecycle with enhanced hierarchy and automated transitions
 */

import { PaymentStatus, IPayment, ILateFeeConfig } from "@/types";
import { Payment } from "@/models";
import { paymentService } from "./payment.service";
import mongoose from "mongoose";

export interface PaymentStatusConfig {
  gracePeriodDays: number;
  lateFeeThresholdDays: number;
  severelyOverdueThresholdDays: number;
  dueSoonThresholdDays: number;
  upcomingThresholdDays: number;
}

export interface StatusTransitionResult {
  payment: IPayment;
  statusChanged: boolean;
  previousStatus: PaymentStatus;
  newStatus: PaymentStatus;
  lateFeeApplied: boolean;
  lateFeeAmount: number;
  daysOverdue: number;
  daysUntilDue: number;
}

export interface StatusTransitionRule {
  from: PaymentStatus[];
  to: PaymentStatus;
  condition?: (payment: IPayment) => boolean;
  action?: (payment: IPayment) => Promise<void>;
}

export interface PaymentStatusUpdate {
  paymentId: string;
  newStatus: PaymentStatus;
  reason?: string;
  metadata?: Record<string, any>;
}

class PaymentStatusService {
  private defaultConfig: PaymentStatusConfig = {
    gracePeriodDays: 5,
    lateFeeThresholdDays: 5,
    severelyOverdueThresholdDays: 30,
    dueSoonThresholdDays: 7,
    upcomingThresholdDays: 7,
  };

  private statusTransitionRules: StatusTransitionRule[] = [
    // Enhanced status transitions with new hierarchy

    // Upcoming to Due Soon
    {
      from: [PaymentStatus.PENDING],
      to: PaymentStatus.PENDING,
      condition: (payment) =>
        this.getDaysUntilDue(payment.dueDate) <=
        this.defaultConfig.dueSoonThresholdDays,
    },

    // Due Soon to Due Today
    {
      from: [PaymentStatus.PENDING],
      to: PaymentStatus.PENDING,
      condition: (payment) => this.getDaysUntilDue(payment.dueDate) === 0,
    },

    // Due Today to Grace Period
    {
      from: [PaymentStatus.PENDING],
      to: PaymentStatus.OVERDUE,
      condition: (payment) =>
        this.getDaysOverdue(payment.dueDate) > 0 &&
        this.getDaysOverdue(payment.dueDate) <=
          this.defaultConfig.gracePeriodDays,
    },

    // Grace Period to Late
    {
      from: [PaymentStatus.OVERDUE],
      to: PaymentStatus.OVERDUE,
      condition: (payment) =>
        this.getDaysOverdue(payment.dueDate) >
        this.defaultConfig.gracePeriodDays,
      action: async (payment) => {
        await this.applyLateFees(payment);
      },
    },

    // Late to Severely Overdue
    {
      from: [PaymentStatus.OVERDUE],
      to: PaymentStatus.OVERDUE,
      condition: (payment) =>
        this.getDaysOverdue(payment.dueDate) >=
        this.defaultConfig.severelyOverdueThresholdDays,
    },

    // Legacy transitions
    // Pending to Processing
    {
      from: [PaymentStatus.PENDING],
      to: PaymentStatus.PENDING,
      condition: (payment) => !!payment.stripePaymentIntentId,
    },

    // Processing to Completed/Paid
    {
      from: [PaymentStatus.PENDING],
      to: PaymentStatus.PAID,
      action: async (payment) => {
        payment.paidDate = new Date();
        payment.amountPaid = payment.amount;
      },
    },

    // Any unpaid status to Paid
    {
      from: [
        PaymentStatus.PENDING,
        PaymentStatus.PENDING,
        PaymentStatus.PENDING,
        PaymentStatus.PENDING,
        PaymentStatus.OVERDUE,
        PaymentStatus.OVERDUE,
        PaymentStatus.OVERDUE,
        PaymentStatus.OVERDUE,
        PaymentStatus.PARTIAL,
      ],
      to: PaymentStatus.PAID,
      action: async (payment) => {
        payment.paidDate = new Date();
        payment.amountPaid = payment.amount;
      },
    },

    // Partial to Paid
    {
      from: [PaymentStatus.PARTIAL],
      to: PaymentStatus.PAID,
      condition: (payment) => (payment.amountPaid || 0) >= payment.amount,
      action: async (payment) => {
        payment.paidDate = new Date();
        payment.amountPaid = payment.amount;
      },
    },

    // Any status to Cancelled
    {
      from: [
        PaymentStatus.PENDING,
        PaymentStatus.PENDING,
        PaymentStatus.PENDING,
        PaymentStatus.PENDING,
        PaymentStatus.OVERDUE,
        PaymentStatus.OVERDUE,
        PaymentStatus.OVERDUE,
        PaymentStatus.PENDING,
        PaymentStatus.OVERDUE,
        PaymentStatus.PARTIAL,
      ],
      to: PaymentStatus.CANCELLED,
    },

    // Paid to Refunded
    {
      from: [PaymentStatus.PAID],
      to: PaymentStatus.REFUNDED,
      action: async (payment) => {
        payment.amountPaid = 0;
      },
    },

    // Failed back to appropriate status (for retry)
    {
      from: [PaymentStatus.FAILED],
      to: PaymentStatus.PENDING,
    },
  ];

  /**
   * Helper method to calculate days until due date
   */
  private getDaysUntilDue(
    dueDate: Date,
    currentDate: Date = new Date()
  ): number {
    const dueUtc = Date.UTC(
      dueDate.getUTCFullYear(),
      dueDate.getUTCMonth(),
      dueDate.getUTCDate()
    );
    const currUtc = Date.UTC(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth(),
      currentDate.getUTCDate()
    );
    const timeDiff = dueUtc - currUtc;
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    return daysDiff > 0 ? daysDiff : 0;
  }

  /**
   * Helper method to calculate days overdue
   */
  private getDaysOverdue(
    dueDate: Date,
    currentDate: Date = new Date()
  ): number {
    const dueUtc = Date.UTC(
      dueDate.getUTCFullYear(),
      dueDate.getUTCMonth(),
      dueDate.getUTCDate()
    );
    const currUtc = Date.UTC(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth(),
      currentDate.getUTCDate()
    );
    const timeDiff = currUtc - dueUtc;
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    return daysDiff > 0 ? daysDiff : 0;
  }

  /**
   * Calculate the appropriate payment status based on due date and current date
   */
  calculatePaymentStatus(
    dueDate: Date,
    currentDate: Date = new Date(),
    config: Partial<PaymentStatusConfig> = {}
  ): {
    status: PaymentStatus;
    daysOverdue: number;
    daysUntilDue: number;
  } {
    const finalConfig = { ...this.defaultConfig, ...config };
    const daysOverdue = this.getDaysOverdue(dueDate, currentDate);
    const daysUntilDue = this.getDaysUntilDue(dueDate, currentDate);

    let status: PaymentStatus;

    if (daysUntilDue > finalConfig.upcomingThresholdDays) {
      status = PaymentStatus.PENDING;
    } else if (
      daysUntilDue > 0 &&
      daysUntilDue <= finalConfig.dueSoonThresholdDays
    ) {
      status = PaymentStatus.PENDING;
    } else if (daysUntilDue === 0 && daysOverdue === 0) {
      status = PaymentStatus.PENDING;
    } else if (daysOverdue > 0 && daysOverdue <= finalConfig.gracePeriodDays) {
      status = PaymentStatus.OVERDUE;
    } else if (
      daysOverdue > finalConfig.gracePeriodDays &&
      daysOverdue < finalConfig.severelyOverdueThresholdDays
    ) {
      status = PaymentStatus.OVERDUE;
    } else if (daysOverdue >= finalConfig.severelyOverdueThresholdDays) {
      status = PaymentStatus.OVERDUE;
    } else {
      status = PaymentStatus.PENDING;
    }

    return { status, daysOverdue, daysUntilDue };
  }

  /**
   * Check if a status transition is valid
   */
  isValidTransition(
    currentStatus: PaymentStatus,
    newStatus: PaymentStatus,
    payment?: IPayment
  ): boolean {
    const rule = this.statusTransitionRules.find(
      (rule) => rule.from.includes(currentStatus) && rule.to === newStatus
    );

    if (!rule) {
      return false;
    }

    // Check condition if provided
    if (rule.condition && payment) {
      return rule.condition(payment);
    }

    return true;
  }

  /**
   * Update payment status with automatic late fee application and enhanced validation
   */
  async updatePaymentStatus(
    paymentId: string,
    newStatus?: PaymentStatus,
    config: Partial<PaymentStatusConfig> = {},
    session?: mongoose.ClientSession
  ): Promise<StatusTransitionResult> {
    const payment = await Payment.findById(paymentId).session(session || null);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    // Skip status update if payment is already completed/paid
    if (
      [
        PaymentStatus.PAID,
        PaymentStatus.PAID,
        PaymentStatus.CANCELLED,
        PaymentStatus.REFUNDED,
      ].includes(payment.status)
    ) {
      return {
        payment,
        statusChanged: false,
        previousStatus: payment.status,
        newStatus: payment.status,
        lateFeeApplied: false,
        lateFeeAmount: 0,
        daysOverdue: this.getDaysOverdue(payment.dueDate),
        daysUntilDue: this.getDaysUntilDue(payment.dueDate),
      };
    }

    const previousStatus = payment.status;

    // Calculate appropriate status if not provided
    const calculatedStatus =
      newStatus ||
      this.calculatePaymentStatus(payment.dueDate, new Date(), config).status;

    const { daysOverdue, daysUntilDue } = this.calculatePaymentStatus(
      payment.dueDate,
      new Date(),
      config
    );

    // Validate transition if status is being changed
    if (
      calculatedStatus !== previousStatus &&
      !this.isValidTransition(previousStatus, calculatedStatus, payment)
    ) {
      throw new Error(
        `Invalid status transition from ${previousStatus} to ${calculatedStatus}`
      );
    }

    // Calculate and apply late fee if applicable
    let lateFeeApplied = false;
    let lateFeeAmount = 0;

    if (daysOverdue > 0 && payment.lateFeeConfig && !payment.lateFeeDate) {
      lateFeeAmount = this.calculateLateFee(
        payment.amount,
        daysOverdue,
        payment.lateFeeConfig
      );

      if (lateFeeAmount > 0) {
        payment.lateFeeApplied = lateFeeAmount;
        payment.lateFeeDate = new Date();
        lateFeeApplied = true;
      }
    }

    // Find and execute transition rule
    const rule = this.statusTransitionRules.find(
      (rule) =>
        rule.from.includes(previousStatus) && rule.to === calculatedStatus
    );

    if (rule?.action) {
      await rule.action(payment);
    }

    // Update payment status
    const statusChanged = previousStatus !== calculatedStatus;
    if (statusChanged) {
      payment.status = calculatedStatus;
      payment.lastSyncedAt = new Date();
      payment.version += 1;
    }

    if (statusChanged || lateFeeApplied) {
      await payment.save({ session: session || null });

      // Log status change
      await this.logStatusChange(payment, previousStatus, calculatedStatus);
    }

    return {
      payment,
      statusChanged,
      previousStatus,
      newStatus: calculatedStatus,
      lateFeeApplied,
      lateFeeAmount,
      daysOverdue,
      daysUntilDue,
    };
  }

  /**
   * Calculate late fee based on configuration and days overdue
   */
  private calculateLateFee(
    baseAmount: number,
    daysOverdue: number,
    lateFeeConfig?: ILateFeeConfig
  ): number {
    if (
      !lateFeeConfig ||
      daysOverdue <=
        (lateFeeConfig.gracePeriodDays || this.defaultConfig.gracePeriodDays)
    ) {
      return 0;
    }

    let lateFee = 0;

    if (lateFeeConfig.flatFee && lateFeeConfig.flatFee > 0) {
      lateFee = lateFeeConfig.flatFee;
    }

    if (lateFeeConfig.percentageFee && lateFeeConfig.percentageFee > 0) {
      const percentageFee = (baseAmount * lateFeeConfig.percentageFee) / 100;
      lateFee = Math.max(lateFee, percentageFee);
    }

    // Apply daily late fee if configured
    if (lateFeeConfig.dailyLateFee && lateFeeConfig.dailyLateFee > 0) {
      const daysAfterGrace =
        daysOverdue -
        (lateFeeConfig.gracePeriodDays || this.defaultConfig.gracePeriodDays);
      lateFee += daysAfterGrace * lateFeeConfig.dailyLateFee;
    }

    // Apply maximum late fee cap if configured
    if (lateFeeConfig.maxLateFee && lateFeeConfig.maxLateFee > 0) {
      lateFee = Math.min(lateFee, lateFeeConfig.maxLateFee);
    }

    return Math.round(lateFee * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Process automated status transitions for all payments with enhanced status hierarchy
   */
  async processAutomatedTransitions(
    config: Partial<PaymentStatusConfig> = {}
  ): Promise<{
    totalProcessed: number;
    statusChanges: number;
    lateFeesApplied: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let totalProcessed = 0;
    let statusChanges = 0;
    let lateFeesApplied = 0;

    try {
      // Find payments that might need status updates (exclude final states)
      const paymentsToCheck = await Payment.find({
        status: {
          $nin: [
            PaymentStatus.PAID,
            PaymentStatus.PAID,
            PaymentStatus.CANCELLED,
            PaymentStatus.REFUNDED,
          ],
        },
        dueDate: { $exists: true },
        deletedAt: null,
      });

      // Process payments in batches using transactions
      const batchSize = 50;
      for (let i = 0; i < paymentsToCheck.length; i += batchSize) {
        const batch = paymentsToCheck.slice(i, i + batchSize);
        const session = await mongoose.startSession();

        try {
          await session.withTransaction(async () => {
            for (const payment of batch) {
              try {
                const result = await this.updatePaymentStatus(
                  payment._id.toString(),
                  undefined,
                  config,
                  session
                );

                totalProcessed++;
                if (result.statusChanged) statusChanges++;
                if (result.lateFeeApplied) lateFeesApplied++;
              } catch (error) {
                errors.push(
                  `Payment ${payment._id}: ${
                    error instanceof Error ? error.message : "Unknown error"
                  }`
                );
              }
            }
          });
        } finally {
          await session.endSession();
        }
      }
    } catch (error) {
      errors.push(
        `Failed to process automated transitions: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    return { totalProcessed, statusChanges, lateFeesApplied, errors };
  }

  /**
   * Batch update payment statuses for multiple payments
   */
  async batchUpdatePaymentStatuses(
    paymentIds: string[],
    config: Partial<PaymentStatusConfig> = {}
  ): Promise<StatusTransitionResult[]> {
    const results: StatusTransitionResult[] = [];

    // Use transaction for batch updates
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        for (const paymentId of paymentIds) {
          const result = await this.updatePaymentStatus(
            paymentId,
            undefined,
            config,
            session
          );
          results.push(result);
        }
      });
    } finally {
      await session.endSession();
    }

    return results;
  }

  /**
   * Get payments that need status updates based on enhanced hierarchy
   */
  async getPaymentsNeedingStatusUpdate(): Promise<IPayment[]> {
    return Payment.find({
      status: {
        $nin: [
          PaymentStatus.PAID,
          PaymentStatus.PAID,
          PaymentStatus.CANCELLED,
          PaymentStatus.REFUNDED,
        ],
      },
      dueDate: { $exists: true },
      deletedAt: null,
    }).populate("tenantId propertyId leaseId");
  }

  /**
   * Get enhanced payment status statistics with new hierarchy
   */
  async getEnhancedStatusStatistics(filters?: {
    propertyId?: string;
    tenantId?: string;
    leaseId?: string;
  }) {
    const matchStage: any = { deletedAt: null };

    if (filters?.propertyId) matchStage.propertyId = filters.propertyId;
    if (filters?.tenantId) matchStage.tenantId = filters.tenantId;
    if (filters?.leaseId) matchStage.leaseId = filters.leaseId;

    const stats = await Payment.aggregate([
      { $match: matchStage },
      {
        $addFields: {
          statusCategory: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$status", PaymentStatus.PENDING] },
                  then: "pending",
                },
                {
                  case: { $eq: ["$status", PaymentStatus.OVERDUE] },
                  then: "overdue",
                },
                {
                  case: { $eq: ["$status", PaymentStatus.PAID] },
                  then: "paid",
                },
                {
                  case: { $eq: ["$status", PaymentStatus.PARTIAL] },
                  then: "partial",
                },
                {
                  case: { $eq: ["$status", PaymentStatus.FAILED] },
                  then: "failed",
                },
              ],
              default: "other",
            },
          },
        },
      },
      {
        $group: {
          _id: {
            status: "$status",
            category: "$statusCategory",
          },
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          totalPaid: { $sum: "$amountPaid" },
          totalLateFees: { $sum: "$lateFeeApplied" },
        },
      },
      {
        $group: {
          _id: null,
          statusBreakdown: {
            $push: {
              status: "$_id.status",
              category: "$_id.category",
              count: "$count",
              totalAmount: "$totalAmount",
              totalPaid: "$totalPaid",
              totalLateFees: "$totalLateFees",
            },
          },
          totalPayments: { $sum: "$count" },
          grandTotalAmount: { $sum: "$totalAmount" },
          grandTotalPaid: { $sum: "$totalPaid" },
          grandTotalLateFees: { $sum: "$totalLateFees" },
        },
      },
    ]);

    return (
      stats[0] || {
        statusBreakdown: [],
        totalPayments: 0,
        grandTotalAmount: 0,
        grandTotalPaid: 0,
        grandTotalLateFees: 0,
      }
    );
  }

  /**
   * Apply late fees to overdue payments (enhanced version)
   */
  private async applyLateFees(payment: IPayment): Promise<void> {
    if (!payment.lateFeeConfig || payment.lateFeeApplied > 0) {
      return; // Late fees not configured or already applied
    }

    const daysOverdue = this.getDaysOverdue(payment.dueDate);
    const lateFeeAmount = this.calculateLateFee(
      payment.amount,
      daysOverdue,
      payment.lateFeeConfig
    );

    if (lateFeeAmount > 0) {
      payment.lateFeeApplied = lateFeeAmount;
      payment.lateFeeDate = new Date();

      // Create a separate late fee payment
      await paymentService.createPayment({
        tenantId: payment.tenantId.toString(),
        propertyId: payment.propertyId.toString(),
        leaseId: payment.leaseId?.toString(),
        amount: lateFeeAmount,
        type: "late_fee" as any,
        dueDate: new Date(),
        description: `Late fee for payment ${payment._id}`,
        notes: `Applied ${daysOverdue} days after due date`,
      });
    }
  }

  /**
   * Log status changes for audit trail (enhanced)
   */
  private async logStatusChange(
    payment: IPayment,
    fromStatus: PaymentStatus,
    toStatus: PaymentStatus,
    metadata?: Record<string, any>
  ): Promise<void> {
    const logData = {
      paymentId: payment._id,
      fromStatus,
      toStatus,
      timestamp: new Date(),
      daysOverdue: this.getDaysOverdue(payment.dueDate),
      daysUntilDue: this.getDaysUntilDue(payment.dueDate),
      amount: payment.amount,
      lateFeeApplied: payment.lateFeeApplied || 0,
      metadata,
    };


    // TODO: Implement dedicated audit log system
    // await AuditLog.create({
    //   entityType: 'Paiement',
    //   entityId: payment._id,
    //   action: 'status_change',
    //   fromValue: fromStatus,
    //   toValue: toStatus,
    //   metadata: logData,
    //   timestamp: new Date(),
    // });
  }

  /**
   * Get payment status statistics
   */
  async getStatusStatistics(filters?: {
    propertyId?: string;
    tenantId?: string;
    leaseId?: string;
  }) {
    const matchStage: any = { deletedAt: null };

    if (filters?.propertyId) matchStage.propertyId = filters.propertyId;
    if (filters?.tenantId) matchStage.tenantId = filters.tenantId;
    if (filters?.leaseId) matchStage.leaseId = filters.leaseId;

    const stats = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          totalPaid: { $sum: "$amountPaid" },
        },
      },
      {
        $group: {
          _id: null,
          statusBreakdown: {
            $push: {
              status: "$_id",
              count: "$count",
              totalAmount: "$totalAmount",
              totalPaid: "$totalPaid",
            },
          },
          totalPayments: { $sum: "$count" },
          grandTotalAmount: { $sum: "$totalAmount" },
          grandTotalPaid: { $sum: "$totalPaid" },
        },
      },
    ]);

    return (
      stats[0] || {
        statusBreakdown: [],
        totalPayments: 0,
        grandTotalAmount: 0,
        grandTotalPaid: 0,
      }
    );
  }

  /**
   * Get payments requiring attention (overdue, failed, etc.)
   */
  async getPaymentsRequiringAttention() {
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      overdue: await Payment.find({
        status: { $in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] },
        dueDate: { $lt: today },
        deletedAt: null,
      })
        .populate({
          path: "tenantId",
          populate: {
            path: "userId",
            select: "firstName lastName email",
          },
        })
        .populate("propertyId", "name address")
        .populate("leaseId", "startDate endDate status")
        .sort({ dueDate: 1 }),

      failed: await Payment.find({
        status: PaymentStatus.FAILED,
        updatedAt: { $gte: sevenDaysAgo },
        deletedAt: null,
      })
        .populate({
          path: "tenantId",
          populate: {
            path: "userId",
            select: "firstName lastName email",
          },
        })
        .populate("propertyId", "name address")
        .populate("leaseId", "startDate endDate status")
        .sort({ updatedAt: -1 }),

      partialPayments: await Payment.find({
        status: PaymentStatus.PARTIAL,
        deletedAt: null,
      })
        .populate({
          path: "tenantId",
          populate: {
            path: "userId",
            select: "firstName lastName email",
          },
        })
        .populate("propertyId", "name address")
        .populate("leaseId", "startDate endDate status")
        .sort({ dueDate: 1 }),
    };
  }
}

export const paymentStatusService = new PaymentStatusService();

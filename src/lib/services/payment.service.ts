/**
 * PropertyPro - Enhanced Payment Service
 * Comprehensive payment management with scheduling, status tracking, and lease integration
 */

import {
  IPayment,
  PaymentType,
  PaymentStatus,
  PaymentMethod,
  PaymentFrequency,
  IPaymentSchedule,
  ILateFeeConfig,
  ILeasePaymentConfig,
} from "@/types";
import { Payment, Lease, Tenant, Property } from "@/models";
import mongoose, { Types } from "mongoose";

export interface PaymentCreateData {
  tenantId: string;
  propertyId: string;
  leaseId?: string;
  amount: number;
  type: PaymentType;
  paymentMethod?: PaymentMethod;
  dueDate: Date;
  description?: string;
  notes?: string;
  schedule?: Partial<IPaymentSchedule>;
  lateFeeConfig?: Partial<ILateFeeConfig>;
}

export interface PaymentScheduleData {
  frequency: PaymentFrequency;
  startDate: Date;
  endDate?: Date;
  dayOfMonth?: number;
  dayOfWeek?: number;
  customInterval?: number;
}

export interface PaymentUpdateData {
  amount?: number;
  amountPaid?: number;
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paidDate?: Date;
  notes?: string;
}

export interface PaymentQueryParams {
  page?: number;
  limit?: number;
  tenantId?: string;
  propertyId?: string;
  leaseId?: string;
  status?: PaymentStatus;
  type?: PaymentType;
  startDate?: Date;
  endDate?: Date;
  overdue?: boolean;
  recurring?: boolean;
}

class PaymentService {
  /**
   * Create a new payment with transaction support
   */
  async createPayment(
    data: PaymentCreateData,
    options: { session?: any } = {}
  ): Promise<IPayment> {
    // Validate tenant, property, and lease
    await this.validatePaymentReferences(
      data.tenantId,
      data.propertyId,
      data.leaseId,
      options.session
    );

    const payment = new Payment({
      ...data,
      tenantId: new Types.ObjectId(data.tenantId),
      propertyId: new Types.ObjectId(data.propertyId),
      leaseId: data.leaseId ? new Types.ObjectId(data.leaseId) : undefined,
      isRecurring: !!data.schedule,
      paymentHistory: [],
      remindersSent: [],
      syncStatus: "synced",
      lastSyncedAt: new Date(),
      version: 0,
    });

    await payment.save({ session: options.session || null });
    return payment;
  }

  /**
   * Create recurring payments for a lease
   */
  async createLeasePayments(leaseId: string): Promise<IPayment[]> {
    const lease = await Lease.findById(leaseId)
      .populate({
        path: "tenantId",
        populate: {
          path: "userId",
          select: "firstName lastName email",
        },
      })
      .populate("propertyId");
    if (!lease) {
      throw new Error("Bail introuvable");
    }

    const payments: IPayment[] = [];
    const paymentConfig = lease.terms.paymentConfig;

    if (!paymentConfig?.autoCreatePayments) {
      return payments;
    }

    // Create security deposit payment
    if (lease.terms.securityDeposit > 0) {
      const securityDepositPayment = await this.createPayment({
        tenantId: lease.tenantId.toString(),
        propertyId: lease.propertyId.toString(),
        leaseId: leaseId,
        amount: lease.terms.securityDeposit,
        type: PaymentType.SECURITY_DEPOSIT,
        dueDate: new Date(lease.startDate),
        description: "Security deposit for lease",
      });
      payments.push(securityDepositPayment);
    }

    // Create pet deposit payment if applicable
    if (lease.terms.petDeposit && lease.terms.petDeposit > 0) {
      const petDepositPayment = await this.createPayment({
        tenantId: lease.tenantId.toString(),
        propertyId: lease.propertyId.toString(),
        leaseId: leaseId,
        amount: lease.terms.petDeposit,
        type: PaymentType.PET_DEPOSIT,
        dueDate: new Date(lease.startDate),
        description: "Pet deposit for lease",
      });
      payments.push(petDepositPayment);
    }

    // Create recurring rent payments
    const rentPayments = await this.createRecurringRentPayments(
      lease,
      paymentConfig
    );
    payments.push(...rentPayments);

    return payments;
  }

  /**
   * Create recurring rent payments for a lease
   */
  private async createRecurringRentPayments(
    lease: any,
    config: ILeasePaymentConfig
  ): Promise<IPayment[]> {
    const payments: IPayment[] = [];
    const startDate = new Date(lease.startDate);
    const endDate = new Date(lease.endDate);

    // Calculate first rent due date
    const firstRentDate = new Date(startDate);
    firstRentDate.setDate(config.rentDueDay);

    // If the rent due day has passed in the start month, move to next month
    if (firstRentDate < startDate) {
      firstRentDate.setMonth(firstRentDate.getMonth() + 1);
    }

    // Create monthly rent payments
    let currentDate = new Date(firstRentDate);
    let paymentNumber = 1;

    while (currentDate <= endDate) {
      let rentAmount = lease.terms.rentAmount;

      // Handle proration for first and last month
      if (config.prorationEnabled) {
        if (
          paymentNumber === 1 &&
          currentDate.getMonth() === startDate.getMonth()
        ) {
          // Prorate first month
          const daysInMonth = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1,
            0
          ).getDate();
          const daysFromStart = daysInMonth - startDate.getDate() + 1;
          rentAmount = (lease.terms.rentAmount / daysInMonth) * daysFromStart;
        }

        // Check if this is the last payment and needs proration
        const nextMonth = new Date(currentDate);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        if (
          nextMonth > endDate &&
          currentDate.getMonth() === endDate.getMonth()
        ) {
          const daysInMonth = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1,
            0
          ).getDate();
          const daysUntilEnd = endDate.getDate();
          rentAmount = (lease.terms.rentAmount / daysInMonth) * daysUntilEnd;
        }
      }

      const rentPayment = await this.createPayment({
        tenantId: lease.tenantId.toString(),
        propertyId: lease.propertyId.toString(),
        leaseId: lease._id.toString(),
        amount: Math.round(rentAmount * 100) / 100, // Round to 2 decimal places
        type: PaymentType.RENT,
        dueDate: new Date(currentDate),
        description: `Monthly rent - ${currentDate.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })}`,
        schedule: {
          frequency: PaymentFrequency.MONTHLY,
          startDate: firstRentDate,
          endDate: endDate,
          dayOfMonth: config.rentDueDay,
          isActive: true,
        },
        lateFeeConfig: config.lateFeeConfig,
      });

      payments.push(rentPayment);
      paymentNumber++;

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return payments;
  }

  /**
   * Update payment status and handle partial payments
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    updateData?: PaymentUpdateData
  ): Promise<IPayment> {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new Error("Payment not found");
    }

    const oldStatus = payment.status;
    payment.status = status;

    if (updateData) {
      Object.assign(payment, updateData);
    }

    // Handle status-specific logic
    switch (status) {
      case PaymentStatus.PAID:
        if (!payment.paidDate) {
          payment.paidDate = new Date();
        }
        if (!payment.amountPaid) {
          payment.amountPaid = payment.amount;
        }
        break;

      case PaymentStatus.PARTIAL:
        if (updateData?.amountPaid && updateData.amountPaid >= payment.amount) {
          payment.status = PaymentStatus.PAID;
          payment.amountPaid = payment.amount;
        }
        break;

      case PaymentStatus.OVERDUE:
        // Apply late fees if configured
        await this.applyLateFees(payment);
        break;
    }

    // Add to payment history if payment was made
    if (
      status === PaymentStatus.PAID ||
      status === PaymentStatus.PARTIAL
    ) {
      const paymentAmount = updateData?.amountPaid || payment.amount;
      payment.paymentHistory.push({
        amount: paymentAmount,
        paymentMethod: updateData?.paymentMethod || PaymentMethod.BANK_TRANSFER,
        paidDate: updateData?.paidDate || new Date(),
        transactionId: updateData?.notes || "",
        notes: updateData?.notes || "",
      });
    }

    await payment.save();
    return payment;
  }

  /**
   * Apply late fees to overdue payments
   */
  private async applyLateFees(payment: IPayment): Promise<void> {
    if (!payment.lateFeeConfig?.enabled || payment.lateFeeApplied > 0) {
      return; // Late fees not enabled or already applied
    }

    const config = payment.lateFeeConfig;
    const daysOverdue = Math.floor(
      (Date.now() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysOverdue <= config.gracePeriodDays) {
      return; // Still within grace period
    }

    let lateFee = 0;
    if (config.feeType === "fixed") {
      lateFee = config.feeAmount;
    } else {
      lateFee = (payment.amount * config.feeAmount) / 100;
      if (config.maxFeeAmount && lateFee > config.maxFeeAmount) {
        lateFee = config.maxFeeAmount;
      }
    }

    // Apply compound daily fee if configured
    if (config.compoundDaily && daysOverdue > config.gracePeriodDays) {
      const compoundDays = daysOverdue - config.gracePeriodDays;
      lateFee = lateFee * compoundDays;
    }

    payment.lateFeeApplied = Math.round(lateFee * 100) / 100;
    payment.lateFeeDate = new Date();
  }

  /**
   * Process payment notifications
   */
  async processPaymentNotifications(): Promise<void> {
    const overduePayments = await Payment.find({
      status: { $in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] },
      dueDate: { $lt: new Date() },
      deletedAt: null,
    });

    for (const payment of overduePayments) {
      await this.sendPaymentNotifications(payment);
    }
  }

  /**
   * Send payment notifications based on configuration
   */
  private async sendPaymentNotifications(payment: IPayment): Promise<void> {
    if (!payment.lateFeeConfig?.enabled) return;

    const daysOverdue = Math.floor(
      (Date.now() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const notificationDays = payment.lateFeeConfig.notificationDays || [
      3, 7, 14,
    ];

    for (const day of notificationDays) {
      if (daysOverdue === day) {
        // Check if notification already sent for this day
        const alreadySent = payment.remindersSent.some(
          (reminder) =>
            Math.floor(
              (Date.now() - reminder.sentDate.getTime()) / (1000 * 60 * 60 * 24)
            ) < 1 &&
            reminder.type ===
              (daysOverdue <= 7
                ? "reminder"
                : daysOverdue <= 14
                ? "overdue"
                : "final_notice")
        );

        if (!alreadySent) {
          // Send notification (integrate with notification service)
          payment.remindersSent.push({
            type:
              daysOverdue <= 7
                ? "reminder"
                : daysOverdue <= 14
                ? "overdue"
                : "final_notice",
            sentDate: new Date(),
            method: "email", // This should be configurable
          });

          await payment.save();
        }
      }
    }
  }

  /**
   * Validate payment references with session support
   */
  private async validatePaymentReferences(
    tenantId: string,
    propertyId: string,
    leaseId?: string,
    session?: any
  ): Promise<void> {
    // Note: Since we changed Payment model to reference User instead of Tenant,
    // we need to validate User with tenant role
    const User = mongoose.model("User");
    const tenant = await User.findOne({
      _id: tenantId,
      role: "tenant",
    }).session(session || null);

    if (!tenant) {
      throw new Error("Tenant not found or user does not have tenant role");
    }

    // Validate property
    const property = await Property.findById(propertyId).session(
      session || null
    );
    if (!property) {
      throw new Error("Property not found");
    }

    // Validate lease if provided
    if (leaseId) {
      const lease = await Lease.findById(leaseId).session(session || null);
      if (!lease) {
        throw new Error("Bail introuvable");
      }

      if (!lease.tenantId.equals(tenantId)) {
        throw new Error("Lease does not belong to the specified tenant");
      }

      if (!lease.propertyId.equals(propertyId)) {
        throw new Error("Lease does not belong to the specified property");
      }
    }
  }

  /**
   * Get payment analytics for a property or tenant
   */
  async getPaymentAnalytics(filters: {
    propertyId?: string;
    tenantId?: string;
    leaseId?: string;
  }): Promise<any> {
    const matchStage: any = { deletedAt: null };

    if (filters.propertyId)
      matchStage.propertyId = new Types.ObjectId(filters.propertyId);
    if (filters.tenantId)
      matchStage.tenantId = new Types.ObjectId(filters.tenantId);
    if (filters.leaseId)
      matchStage.leaseId = new Types.ObjectId(filters.leaseId);

    const analytics = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          totalPaid: { $sum: "$amountPaid" },
          pendingCount: {
            $sum: {
              $cond: [{ $eq: ["$status", PaymentStatus.PENDING] }, 1, 0],
            },
          },
          overdueCount: {
            $sum: {
              $cond: [{ $eq: ["$status", PaymentStatus.OVERDUE] }, 1, 0],
            },
          },
          completedCount: {
            $sum: {
              $cond: [{ $eq: ["$status", PaymentStatus.PAID] }, 1, 0],
            },
          },
          totalLateFees: { $sum: "$lateFeeApplied" },
        },
      },
    ]);

    return (
      analytics[0] || {
        totalPayments: 0,
        totalAmount: 0,
        totalPaid: 0,
        pendingCount: 0,
        overdueCount: 0,
        completedCount: 0,
        totalLateFees: 0,
      }
    );
  }

  /**
   * Get payments with advanced filtering and pagination
   */
  async getPayments(params: PaymentQueryParams = {}): Promise<any> {
    const {
      page = 1,
      limit = 10,
      tenantId,
      propertyId,
      leaseId,
      status,
      type,
      startDate,
      endDate,
      overdue,
      recurring,
    } = params;

    const query: any = { deletedAt: null };

    // Apply filters
    if (tenantId) query.tenantId = new Types.ObjectId(tenantId);
    if (propertyId) query.propertyId = new Types.ObjectId(propertyId);
    if (leaseId) query.leaseId = new Types.ObjectId(leaseId);
    if (status) query.status = status;
    if (type) query.type = type;
    if (recurring !== undefined) query.isRecurring = recurring;

    // Date range filter
    if (startDate || endDate) {
      query.dueDate = {};
      if (startDate) query.dueDate.$gte = startDate;
      if (endDate) query.dueDate.$lte = endDate;
    }

    // Overdue filter
    if (overdue) {
      query.status = { $in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] };
      query.dueDate = { $lt: new Date() };
    }

    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate({
          path: "tenantId",
          populate: {
            path: "userId",
            select: "firstName lastName email",
          },
        })
        .populate("propertyId", "name address")
        .populate("leaseId", "startDate endDate status")
        .sort({ dueDate: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments(query),
    ]);

    return {
      data: payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Process a payment (record payment made) with transaction support
   */
  async processPayment(
    paymentId: string,
    paymentData: {
      amount: number;
      paymentMethod: PaymentMethod;
      transactionId?: string;
      notes?: string;
    },
    options: { session?: any } = {}
  ): Promise<IPayment> {
    const payment = await Payment.findById(paymentId).session(
      options.session || null
    );
    if (!payment) {
      throw new Error("Payment not found");
    }

    // Optimistic locking check
    const currentVersion = payment.version || 0;

    const totalPaid = (payment.amountPaid || 0) + paymentData.amount;

    // Validate payment amount
    if (totalPaid > payment.amount) {
      throw new Error("Payment amount exceeds total due");
    }

    let newStatus: PaymentStatus;
    if (totalPaid >= payment.amount) {
      newStatus = PaymentStatus.PAID;
    } else {
      newStatus = PaymentStatus.PARTIAL;
    }

    // Update with optimistic locking
    const updatedPayment = await Payment.findOneAndUpdate(
      {
        _id: paymentId,
        version: currentVersion,
        deletedAt: null,
      },
      {
        $set: {
          status: newStatus,
          amountPaid: totalPaid,
          paymentMethod: paymentData.paymentMethod,
          paidDate: new Date(),
          notes: paymentData.notes
            ? payment.notes
              ? `${payment.notes}\n${paymentData.notes}`
              : paymentData.notes
            : payment.notes,
          syncStatus: "pending",
          lastSyncedAt: new Date(),
        },
        $inc: { version: 1 },
        $push: {
          paymentHistory: {
            amount: paymentData.amount,
            paymentMethod: paymentData.paymentMethod,
            paidDate: new Date(),
            transactionId: paymentData.transactionId || "",
            notes: paymentData.notes || "",
          },
        },
      },
      {
        new: true,
        session: options.session || null,
      }
    );

    if (!updatedPayment) {
      throw new Error(
        "Payment update failed - possible concurrent modification"
      );
    }

    return updatedPayment;
  }

  /**
   * Generate next payment in a recurring series
   */
  async generateNextRecurringPayment(
    parentPaymentId: string
  ): Promise<IPayment | null> {
    const parentPayment = await Payment.findById(parentPaymentId);
    if (
      !parentPayment ||
      !parentPayment.schedule ||
      !parentPayment.schedule.isActive
    ) {
      return null;
    }

    const schedule = parentPayment.schedule;
    const nextDueDate = this.calculateNextDueDate(schedule);

    if (!nextDueDate || (schedule.endDate && nextDueDate > schedule.endDate)) {
      return null; // No more payments to generate
    }

    const nextPayment = await this.createPayment({
      tenantId: parentPayment.tenantId.toString(),
      propertyId: parentPayment.propertyId.toString(),
      leaseId: parentPayment.leaseId?.toString(),
      amount: parentPayment.amount,
      type: parentPayment.type,
      dueDate: nextDueDate,
      description: parentPayment.description,
      schedule: {
        ...schedule,
        lastGeneratedDate: new Date(),
        nextDueDate: this.calculateNextDueDate(schedule, nextDueDate),
      },
      lateFeeConfig: parentPayment.lateFeeConfig,
    });

    // Update parent payment's schedule
    parentPayment.schedule.lastGeneratedDate = new Date();
    parentPayment.schedule.nextDueDate = this.calculateNextDueDate(
      schedule,
      nextDueDate
    );
    await parentPayment.save();

    return nextPayment;
  }

  /**
   * Calculate next due date based on payment schedule
   */
  private calculateNextDueDate(
    schedule: IPaymentSchedule,
    fromDate?: Date
  ): Date | null {
    const baseDate =
      fromDate || schedule.lastGeneratedDate || schedule.startDate;
    const nextDate = new Date(baseDate);

    switch (schedule.frequency) {
      case PaymentFrequency.WEEKLY:
        nextDate.setDate(nextDate.getDate() + 7);
        break;

      case PaymentFrequency.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + 1);
        if (schedule.dayOfMonth) {
          nextDate.setDate(schedule.dayOfMonth);
        }
        break;

      case PaymentFrequency.QUARTERLY:
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;

      case PaymentFrequency.ANNUALLY:
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;

      case PaymentFrequency.CUSTOM:
        if (schedule.customInterval) {
          nextDate.setMonth(nextDate.getMonth() + schedule.customInterval);
        }
        break;

      default:
        return null; // One-time payment
    }

    return nextDate;
  }

  /**
   * Bulk update payment statuses (for admin operations)
   */
  async bulkUpdatePayments(
    paymentIds: string[],
    updates: Partial<PaymentUpdateData>
  ): Promise<{ updated: number; errors: string[] }> {
    const errors: string[] = [];
    let updated = 0;

    for (const paymentId of paymentIds) {
      try {
        await this.updatePaymentStatus(
          paymentId,
          updates.status || PaymentStatus.PENDING,
          updates
        );
        updated++;
      } catch (error) {
        errors.push(
          `Payment ${paymentId}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    return { updated, errors };
  }

  /**
   * Get payment summary for dashboard
   */
  async getPaymentSummary(filters: {
    propertyId?: string;
    tenantId?: string;
  }): Promise<any> {
    const matchStage: any = { deletedAt: null };

    if (filters.propertyId)
      matchStage.propertyId = new Types.ObjectId(filters.propertyId);
    if (filters.tenantId)
      matchStage.tenantId = new Types.ObjectId(filters.tenantId);

    const today = new Date();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const summary = await Payment.aggregate([
      { $match: matchStage },
      {
        $facet: {
          thisMonth: [
            { $match: { dueDate: { $gte: thisMonth, $lt: nextMonth } } },
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
                amount: { $sum: "$amount" },
                paid: { $sum: "$amountPaid" },
              },
            },
          ],
          overdue: [
            {
              $match: {
                dueDate: { $lt: today },
                status: { $in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] },
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                amount: { $sum: "$amount" },
                lateFees: { $sum: "$lateFeeApplied" },
              },
            },
          ],
          upcoming: [
            {
              $match: {
                dueDate: {
                  $gte: today,
                  $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
                status: PaymentStatus.PENDING,
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                amount: { $sum: "$amount" },
              },
            },
          ],
        },
      },
    ]);

    return summary[0];
  }
}

export const paymentService = new PaymentService();

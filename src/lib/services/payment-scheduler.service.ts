/**
 * PropertyPro - Payment Scheduling Service
 * Handles recurring payments, scheduling, and automated payment generation
 */

import {
  PaymentFrequency,
  IPaymentSchedule,
  PaymentType,
  IPayment,
  ILease,
} from "@/types";
import { Payment, Lease } from "@/models";
import { paymentService } from "./payment.service";
import { Types } from "mongoose";

export interface ScheduleConfig {
  frequency: PaymentFrequency;
  startDate: Date;
  endDate?: Date;
  dayOfMonth?: number;
  dayOfWeek?: number;
  customInterval?: number;
  amount: number;
  type: PaymentType;
  description?: string;
}

export interface RecurringPaymentSetup {
  leaseId: string;
  tenantId: string;
  propertyId: string;
  schedules: ScheduleConfig[];
}

class PaymentSchedulerService {
  /**
   * Create a recurring payment schedule
   */
  async createRecurringSchedule(
    setup: RecurringPaymentSetup
  ): Promise<IPayment[]> {
    const createdPayments: IPayment[] = [];

    for (const scheduleConfig of setup.schedules) {
      const payments = await this.generatePaymentsFromSchedule(
        setup,
        scheduleConfig
      );
      createdPayments.push(...payments);
    }

    return createdPayments;
  }

  /**
   * Generate payments from a schedule configuration
   */
  private async generatePaymentsFromSchedule(
    setup: RecurringPaymentSetup,
    config: ScheduleConfig
  ): Promise<IPayment[]> {
    const payments: IPayment[] = [];
    const dueDates = this.calculateDueDates(config);

    for (const dueDate of dueDates) {
      const payment = await paymentService.createPayment({
        tenantId: setup.tenantId,
        propertyId: setup.propertyId,
        leaseId: setup.leaseId,
        amount: config.amount,
        type: config.type,
        dueDate,
        description:
          config.description ||
          this.generatePaymentDescription(config, dueDate),
        schedule: {
          frequency: config.frequency,
          startDate: config.startDate,
          endDate: config.endDate,
          dayOfMonth: config.dayOfMonth,
          dayOfWeek: config.dayOfWeek,
          customInterval: config.customInterval,
          isActive: true,
        },
      });

      payments.push(payment);
    }

    return payments;
  }

  /**
   * Calculate all due dates for a schedule
   */
  private calculateDueDates(config: ScheduleConfig): Date[] {
    const dueDates: Date[] = [];
    let currentDate = new Date(config.startDate);
    const endDate = config.endDate || this.getDefaultEndDate(config.startDate);

    while (currentDate <= endDate) {
      dueDates.push(new Date(currentDate));
      currentDate = this.getNextDueDate(currentDate, config);

      // Prevent infinite loops
      if (dueDates.length > 1000) {
        break;
      }
    }

    return dueDates;
  }

  /**
   * Get the next due date based on frequency
   */
  private getNextDueDate(currentDate: Date, config: ScheduleConfig): Date {
    const nextDate = new Date(currentDate);

    switch (config.frequency) {
      case PaymentFrequency.WEEKLY:
        nextDate.setDate(nextDate.getDate() + 7);
        if (config.dayOfWeek !== undefined) {
          // Adjust to specific day of week
          const dayDiff = config.dayOfWeek - nextDate.getDay();
          nextDate.setDate(nextDate.getDate() + dayDiff);
        }
        break;

      case PaymentFrequency.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + 1);
        if (config.dayOfMonth) {
          nextDate.setDate(config.dayOfMonth);
          // Handle months with fewer days
          if (nextDate.getDate() !== config.dayOfMonth) {
            nextDate.setDate(0); // Last day of previous month
          }
        }
        break;

      case PaymentFrequency.QUARTERLY:
        nextDate.setMonth(nextDate.getMonth() + 3);
        if (config.dayOfMonth) {
          nextDate.setDate(config.dayOfMonth);
        }
        break;

      case PaymentFrequency.ANNUALLY:
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        if (config.dayOfMonth) {
          nextDate.setDate(config.dayOfMonth);
        }
        break;

      case PaymentFrequency.CUSTOM:
        if (config.customInterval) {
          nextDate.setMonth(nextDate.getMonth() + config.customInterval);
        } else {
          nextDate.setDate(nextDate.getDate() + 30); // Default to 30 days
        }
        break;

      default:
        // One-time payment, return far future date to stop iteration
        nextDate.setFullYear(nextDate.getFullYear() + 100);
        break;
    }

    return nextDate;
  }

  /**
   * Get default end date (1 year from start for most schedules)
   */
  private getDefaultEndDate(startDate: Date): Date {
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
    return endDate;
  }

  /**
   * Generate payment description based on schedule
   */
  private generatePaymentDescription(
    config: ScheduleConfig,
    dueDate: Date
  ): string {
    const monthYear = dueDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    switch (config.type) {
      case PaymentType.RENT:
        return `Monthly rent - ${monthYear}`;
      case PaymentType.UTILITY:
        return `Utility payment - ${monthYear}`;
      case PaymentType.MAINTENANCE:
        return `Maintenance fee - ${monthYear}`;
      default:
        return `${config.type} payment - ${monthYear}`;
    }
  }

  /**
   * Setup standard lease payment schedule
   */
  async setupLeasePaymentSchedule(leaseId: string): Promise<IPayment[]> {
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
      throw new Error("Lease not found");
    }

    const paymentConfig = lease.terms.paymentConfig;
    if (!paymentConfig?.autoCreatePayments) {
      return [];
    }

    const schedules: ScheduleConfig[] = [];

    // Security deposit (one-time)
    if (lease.terms.securityDeposit > 0) {
      schedules.push({
        frequency: PaymentFrequency.ONE_TIME,
        startDate: new Date(lease.startDate),
        amount: lease.terms.securityDeposit,
        type: PaymentType.SECURITY_DEPOSIT,
        description: "Security deposit",
      });
    }

    // Pet deposit (one-time)
    if (lease.terms.petDeposit && lease.terms.petDeposit > 0) {
      schedules.push({
        frequency: PaymentFrequency.ONE_TIME,
        startDate: new Date(lease.startDate),
        amount: lease.terms.petDeposit,
        type: PaymentType.PET_DEPOSIT,
        description: "Pet deposit",
      });
    }

    // Monthly rent
    const rentStartDate = new Date(lease.startDate);
    rentStartDate.setDate(paymentConfig.rentDueDay);

    // If rent due day has passed in start month, move to next month
    if (rentStartDate < new Date(lease.startDate)) {
      rentStartDate.setMonth(rentStartDate.getMonth() + 1);
    }

    schedules.push({
      frequency: PaymentFrequency.MONTHLY,
      startDate: rentStartDate,
      endDate: new Date(lease.endDate),
      dayOfMonth: paymentConfig.rentDueDay,
      amount: lease.terms.rentAmount,
      type: PaymentType.RENT,
      description: "Monthly rent",
    });

    // Advance payments if configured
    if (
      paymentConfig.advancePaymentMonths &&
      paymentConfig.advancePaymentMonths > 0
    ) {
      const advanceAmount =
        lease.terms.rentAmount * paymentConfig.advancePaymentMonths;
      schedules.push({
        frequency: PaymentFrequency.ONE_TIME,
        startDate: new Date(lease.startDate),
        amount: advanceAmount,
        type: PaymentType.RENT,
        description: `Advance rent payment (${paymentConfig.advancePaymentMonths} months)`,
      });
    }

    return this.createRecurringSchedule({
      leaseId: lease._id.toString(),
      tenantId: lease.tenantId.toString(),
      propertyId: lease.propertyId.toString(),
      schedules,
    });
  }

  /**
   * Process scheduled payments (run daily via cron job)
   */
  async processScheduledPayments(): Promise<{
    generated: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let generated = 0;

    try {
      // Find active recurring payments that need next payment generated
      const recurringPayments = await Payment.find({
        isRecurring: true,
        "schedule.isActive": true,
        "schedule.nextDueDate": { $lte: new Date() },
        deletedAt: null,
      });

      for (const payment of recurringPayments) {
        try {
          const nextPayment = await this.generateNextPayment(payment);
          if (nextPayment) {
            generated++;
          }
        } catch (error) {
          errors.push(
            `Payment ${payment._id}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }
    } catch (error) {
      errors.push(
        `Failed to process scheduled payments: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    return { generated, errors };
  }

  /**
   * Generate the next payment in a recurring series
   */
  private async generateNextPayment(
    parentPayment: IPayment
  ): Promise<IPayment | null> {
    if (!parentPayment.schedule || !parentPayment.schedule.isActive) {
      return null;
    }

    const schedule = parentPayment.schedule;
    const nextDueDate = schedule.nextDueDate;

    if (!nextDueDate || (schedule.endDate && nextDueDate > schedule.endDate)) {
      // Mark schedule as inactive
      parentPayment.schedule.isActive = false;
      await parentPayment.save();
      return null;
    }

    // Create next payment
    const nextPayment = await paymentService.createPayment({
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
        nextDueDate: this.getNextDueDate(nextDueDate, {
          frequency: schedule.frequency,
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          dayOfMonth: schedule.dayOfMonth,
          dayOfWeek: schedule.dayOfWeek,
          customInterval: schedule.customInterval,
          amount: parentPayment.amount,
          type: parentPayment.type,
        }),
      },
      lateFeeConfig: parentPayment.lateFeeConfig,
    });

    // Update parent payment's schedule
    parentPayment.schedule.lastGeneratedDate = new Date();
    parentPayment.schedule.nextDueDate = this.getNextDueDate(nextDueDate, {
      frequency: schedule.frequency,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      dayOfMonth: schedule.dayOfMonth,
      dayOfWeek: schedule.dayOfWeek,
      customInterval: schedule.customInterval,
      amount: parentPayment.amount,
      type: parentPayment.type,
    });

    await parentPayment.save();

    return nextPayment;
  }

  /**
   * Update payment schedule
   */
  async updatePaymentSchedule(
    paymentId: string,
    scheduleUpdate: Partial<IPaymentSchedule>
  ): Promise<IPayment> {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new Error("Payment not found");
    }

    if (!payment.schedule) {
      throw new Error("Payment does not have a schedule");
    }

    // Update schedule
    Object.assign(payment.schedule, scheduleUpdate);

    // Recalculate next due date if frequency or timing changed
    if (
      scheduleUpdate.frequency ||
      scheduleUpdate.dayOfMonth ||
      scheduleUpdate.dayOfWeek
    ) {
      const lastDate =
        payment.schedule.lastGeneratedDate || payment.schedule.startDate;
      payment.schedule.nextDueDate = this.getNextDueDate(lastDate, {
        frequency: payment.schedule.frequency,
        startDate: payment.schedule.startDate,
        endDate: payment.schedule.endDate,
        dayOfMonth: payment.schedule.dayOfMonth,
        dayOfWeek: payment.schedule.dayOfWeek,
        customInterval: payment.schedule.customInterval,
        amount: payment.amount,
        type: payment.type,
      });
    }

    await payment.save();
    return payment;
  }

  /**
   * Cancel recurring payment schedule
   */
  async cancelPaymentSchedule(paymentId: string): Promise<IPayment> {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.schedule) {
      payment.schedule.isActive = false;
    }

    await payment.save();
    return payment;
  }

  /**
   * Get upcoming scheduled payments
   */
  async getUpcomingPayments(days: number = 30) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return Payment.find({
      dueDate: { $gte: new Date(), $lte: endDate },
      status: "pending",
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
      .sort({ dueDate: 1 });
  }
}

export const paymentSchedulerService = new PaymentSchedulerService();

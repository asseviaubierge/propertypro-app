/**
 * PropertyPro - Notification Automation System
 * Handles automated notification triggers and scheduling
 */

import {
  notificationService,
  NotificationType,
  NotificationPriority,
} from "./notification-service";
import {
  IUser,
  IProperty,
  ILease,
  IPayment,
  IMaintenanceRequest,
} from "@/types";
import User from "@/models/User";
import Property from "@/models/Property";
import Lease from "@/models/Lease";
import Payment from "@/models/Payment";
import { PaymentStatus } from "@/types";
import MaintenanceRequest from "@/models/MaintenanceRequest";

// Automation rule interface
export interface AutomationRule {
  id: string;
  name: string;
  type: NotificationType;
  trigger: "schedule" | "event" | "condition";
  conditions: Record<string, any>;
  schedule?: {
    frequency: "daily" | "weekly" | "monthly";
    time: string; // HH:MM format
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
  };
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export class NotificationAutomation {
  private automationRules: Map<string, AutomationRule> = new Map();
  private isRunning = false;

  constructor() {
    this.initializeDefaultRules();
    this.startAutomationEngine();
  }

  // Initialize default automation rules
  private initializeDefaultRules(): void {
    // Payment reminder rules
    this.addRule({
      id: "payment_reminder_3_days",
      name: "Payment Reminder - 3 Days Before Due",
      type: NotificationType.PAYMENT_REMINDER,
      trigger: "schedule",
      conditions: { daysBefore: 3 },
      schedule: {
        frequency: "daily",
        time: "09:00",
      },
      enabled: true,
    });

    this.addRule({
      id: "payment_reminder_1_day",
      name: "Payment Reminder - 1 Day Before Due",
      type: NotificationType.PAYMENT_REMINDER,
      trigger: "schedule",
      conditions: { daysBefore: 1 },
      schedule: {
        frequency: "daily",
        time: "09:00",
      },
      enabled: true,
    });

    this.addRule({
      id: "payment_overdue_daily",
      name: "Daily Overdue Payment Reminders",
      type: NotificationType.PAYMENT_OVERDUE,
      trigger: "schedule",
      conditions: { overdue: true },
      schedule: {
        frequency: "daily",
        time: "10:00",
      },
      enabled: true,
    });

    // Lease expiry rules
    this.addRule({
      id: "lease_expiry_90_days",
      name: "Lease Expiry - 90 Days Notice",
      type: NotificationType.LEASE_EXPIRY,
      trigger: "schedule",
      conditions: { daysBefore: 90 },
      schedule: {
        frequency: "daily",
        time: "08:00",
      },
      enabled: true,
    });

    this.addRule({
      id: "lease_expiry_60_days",
      name: "Lease Expiry - 60 Days Notice",
      type: NotificationType.LEASE_EXPIRY,
      trigger: "schedule",
      conditions: { daysBefore: 60 },
      schedule: {
        frequency: "daily",
        time: "08:00",
      },
      enabled: true,
    });

    this.addRule({
      id: "lease_expiry_30_days",
      name: "Lease Expiry - 30 Days Notice",
      type: NotificationType.LEASE_EXPIRY,
      trigger: "schedule",
      conditions: { daysBefore: 30 },
      schedule: {
        frequency: "daily",
        time: "08:00",
      },
      enabled: true,
    });

    this.addRule({
      id: "lease_expiry_14_days",
      name: "Lease Expiry - 14 Days Notice",
      type: NotificationType.LEASE_EXPIRY,
      trigger: "schedule",
      conditions: { daysBefore: 14 },
      schedule: {
        frequency: "daily",
        time: "08:00",
      },
      enabled: true,
    });

    this.addRule({
      id: "lease_expiry_7_days",
      name: "Lease Expiry - 7 Days Notice",
      type: NotificationType.LEASE_EXPIRY,
      trigger: "schedule",
      conditions: { daysBefore: 7 },
      schedule: {
        frequency: "daily",
        time: "08:00",
      },
      enabled: true,
    });
  }

  // Add automation rule
  addRule(rule: Omit<AutomationRule, "nextRun">): void {
    const fullRule: AutomationRule = {
      ...rule,
      nextRun: this.calculateNextRun(rule.schedule),
    };
    this.automationRules.set(rule.id, fullRule);
  }

  // Remove automation rule
  removeRule(ruleId: string): boolean {
    return this.automationRules.delete(ruleId);
  }

  // Enable/disable rule
  toggleRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.automationRules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      if (enabled) {
        rule.nextRun = this.calculateNextRun(rule.schedule);
      }
      return true;
    }
    return false;
  }

  // Calculate next run time for scheduled rules
  private calculateNextRun(
    schedule?: AutomationRule["schedule"]
  ): Date | undefined {
    if (!schedule) return undefined;

    const now = new Date();
    const [hours, minutes] = schedule.time.split(":").map(Number);

    let nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    // If the time has passed today, move to next occurrence
    if (nextRun <= now) {
      switch (schedule.frequency) {
        case "daily":
          nextRun.setDate(nextRun.getDate() + 1);
          break;
        case "weekly":
          const daysUntilNext =
            (7 + (schedule.dayOfWeek || 0) - nextRun.getDay()) % 7;
          nextRun.setDate(nextRun.getDate() + (daysUntilNext || 7));
          break;
        case "monthly":
          nextRun.setMonth(nextRun.getMonth() + 1);
          if (schedule.dayOfMonth) {
            nextRun.setDate(schedule.dayOfMonth);
          }
          break;
      }
    }

    return nextRun;
  }

  // Start automation engine
  private startAutomationEngine(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    // Check for scheduled rules every minute
    setInterval(async () => {
      await this.processScheduledRules();
    }, 60000);
  }

  // Process scheduled automation rules
  private async processScheduledRules(): Promise<void> {
    const now = new Date();

    for (const [ruleId, rule] of this.automationRules) {
      if (!rule.enabled || !rule.nextRun || rule.nextRun > now) {
        continue;
      }

      try {
        await this.executeRule(rule);
        rule.lastRun = now;
        rule.nextRun = this.calculateNextRun(rule.schedule);
      } catch (error) {
        console.error(`Failed to execute automation rule ${ruleId}:`, error);
      }
    }
  }

  // Execute automation rule
  private async executeRule(rule: AutomationRule): Promise<void> {
    switch (rule.type) {
      case NotificationType.PAYMENT_REMINDER:
        await this.processPaymentReminders(rule);
        break;
      case NotificationType.PAYMENT_OVERDUE:
        await this.processOverduePayments(rule);
        break;
      case NotificationType.LEASE_EXPIRY:
        await this.processLeaseExpiries(rule);
        break;
      default:
        console.warn(`Unknown automation rule type: ${rule.type}`);
    }
  }

  // Process payment reminders
  private async processPaymentReminders(rule: AutomationRule): Promise<void> {
    const daysBefore = rule.conditions.daysBefore || 0;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysBefore);

    // Find leases with payments due on target date
    const leases = await Lease.find({
      status: "active",
      deletedAt: { $exists: false },
    }).populate("tenantId propertyId");

    for (const lease of leases) {
      try {
        // Calculate next payment due date (simplified logic)
        const nextDueDate = new Date(lease.startDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);

        if (this.isSameDay(nextDueDate, targetDate)) {
          const tenant = lease.tenantId as any;
          const property = lease.propertyId as any;

          // Skip if tenant or property is missing
          const tenantId = tenant?._id?.toString?.();
          const propertyName = property?.name;
          const tenantEmail = tenant?.email;

          if (!tenantId || !propertyName || !tenantEmail) {
            console.warn(
              `Skipping payment reminder for lease ${lease._id}: missing tenant or property data`
            );
            continue;
          }

          await notificationService.sendNotification({
            type: NotificationType.PAYMENT_REMINDER,
            priority: NotificationPriority.NORMAL,
            userId: tenantId,
            title: "Rent Payment Reminder",
            message: `Your rent payment is due in ${daysBefore} day${
              daysBefore !== 1 ? "s" : ""
            }`,
            data: {
              audience: "tenant",
              recipientRole: "tenant",
              tenantId,
              leaseId: lease._id.toString(),
              propertyId: property._id?.toString?.(),
              userEmail: tenantEmail,
              userName: `${tenant?.firstName || ""} ${tenant?.lastName || ""}`.trim() || "Locataire",
              propertyName: propertyName,
              rentAmount: lease.terms?.rentAmount || 0,
              dueDate: nextDueDate.toISOString(),
              daysOverdue: 0,
            },
          });
        }
      } catch (err) {
        console.error(
          `Error processing payment reminder for lease ${lease._id}:`,
          err
        );
        continue;
      }
    }
  }

  // Process overdue payments
  private async processOverduePayments(rule: AutomationRule): Promise<void> {
    const today = new Date();

    // Find overdue payments across enhanced statuses
    const overduePayments = await Payment.find({
      status: {
        $in: [
          PaymentStatus.PENDING,
          PaymentStatus.PENDING,
          PaymentStatus.PENDING,
          PaymentStatus.OVERDUE,
          PaymentStatus.OVERDUE,
          PaymentStatus.OVERDUE,
          PaymentStatus.OVERDUE,
        ],
      },
      dueDate: { $lt: today },
      deletedAt: { $exists: false },
    }).populate("tenantId propertyId");

    // Safety check for null/undefined results
    if (!overduePayments || !Array.isArray(overduePayments)) {
      console.warn("No overdue payments found or invalid result from query");
      return;
    }

    for (let i = 0; i < overduePayments.length; i++) {
      const payment = overduePayments[i];
      try {
        // Skip null payments (shouldn't happen but being defensive)
        if (!payment) {
          console.warn(`Skipping null payment at index ${i}`);
          continue;
        }

        const tenant = payment.tenantId as any;
        const property = payment.propertyId as any;

        // Skip if tenant or property is null/undefined (deleted or invalid reference)
        if (!tenant || !property) {
          console.warn(
            `Skipping overdue payment notification for payment ${payment._id}: tenant or property is null (tenant: ${!!tenant}, property: ${!!property})`
          );
          continue;
        }

        // Check for null/undefined and also check if it's just an ObjectId (not populated)
        const tenantId = tenant._id?.toString?.() || (typeof tenant === 'string' ? null : tenant._id);
        const propertyName = property.name;
        const tenantEmail = tenant.email;
        const tenantFirstName = tenant.firstName;
        const tenantLastName = tenant.lastName;

        if (!tenantId || !propertyName || !tenantEmail) {
          console.warn(
            `Skipping overdue payment notification for payment ${payment._id}: missing tenant (${!!tenantId}) or property (${!!propertyName}) data`
          );
          continue;
        }

        const daysOverdue = Math.floor(
          (today.getTime() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        await notificationService.sendNotification({
          type: NotificationType.PAYMENT_OVERDUE,
          priority:
            daysOverdue > 7
              ? NotificationPriority.HIGH
              : NotificationPriority.NORMAL,
          userId: tenantId,
          title: "Overdue Payment Notice",
          message: `Your rent payment is ${daysOverdue} day${
            daysOverdue !== 1 ? "s" : ""
          } overdue`,
          data: {
            audience: "tenant",
            recipientRole: "tenant",
            tenantId,
            paymentId: payment._id.toString(),
            leaseId: payment.leaseId?.toString?.(),
            invoiceId: payment.invoiceId?.toString?.(),
            propertyId: property._id?.toString?.(),
            userEmail: tenantEmail,
            userName: `${tenantFirstName || ''} ${tenantLastName || ''}`.trim() || 'Locataire',
            propertyName: propertyName,
            rentAmount: payment.amount,
            dueDate: payment.dueDate.toISOString(),
            daysOverdue,
          },
        });
      } catch (err) {
        console.error(
          `Error processing overdue payment notification for payment ${payment?._id || 'unknown'}:`,
          err
        );
        // Continue with next payment instead of failing the entire batch
        continue;
      }
    }
  }

  // Process lease expiries
  private async processLeaseExpiries(rule: AutomationRule): Promise<void> {
    const daysBefore = rule.conditions.daysBefore || 0;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysBefore);

    // Find leases expiring on target date and populate property with owner and manager
    const expiringLeases = await Lease.find({
      status: "active",
      endDate: {
        $gte: new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate()
        ),
        $lt: new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate() + 1
        ),
      },
      deletedAt: { $exists: false },
    }).populate([
      {
        path: "tenantId",
        select: "firstName lastName email",
      },
      {
        path: "propertyId",
        select: "name ownerId managerId",
        populate: [
          {
            path: "ownerId",
            select: "firstName lastName email role",
          },
          {
            path: "managerId",
            select: "firstName lastName email role",
          },
        ],
      },
    ]);

    for (const lease of expiringLeases) {
      try {
        const tenant = lease.tenantId as any;
        const property = lease.propertyId as any;
        const owner = property?.ownerId as any;
        const manager = property?.managerId as any;

        // Extract property name safely
        const propertyName = property?.name;
        if (!propertyName) {
          console.warn(
            `Skipping lease expiry notification for lease ${lease._id}: missing property data`
          );
          continue;
        }

        // Helper to get user name safely
        const getUserName = (user: any) =>
          `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Utilisateur";

        // Send notification to tenant
        if (tenant?._id && tenant?.email) {
          await notificationService.sendNotification({
            type: NotificationType.LEASE_EXPIRY,
            priority:
              daysBefore <= 30
                ? NotificationPriority.HIGH
                : NotificationPriority.NORMAL,
            userId: tenant._id.toString(),
            title: "Lease Expiry Notice",
            message: `Your lease expires in ${daysBefore} day${
              daysBefore !== 1 ? "s" : ""
            }`,
            data: {
              audience: "tenant",
              recipientRole: "tenant",
              tenantId: tenant._id.toString(),
              leaseId: lease._id.toString(),
              propertyId: property._id?.toString?.(),
              userEmail: tenant.email,
              userName: getUserName(tenant),
              propertyName: propertyName,
              expiryDate: lease.endDate.toISOString(),
              daysUntilExpiry: daysBefore,
            },
          });
        }

        // Send notification to property owner (admin/manager role)
        if (owner?._id && owner?.email) {
          await notificationService.sendNotification({
            type: NotificationType.LEASE_EXPIRY,
            priority:
              daysBefore <= 30
                ? NotificationPriority.HIGH
                : NotificationPriority.NORMAL,
            userId: owner._id.toString(),
            title: "Lease Expiring Soon - Action Required",
            message: `Lease for ${propertyName} expires in ${daysBefore} day${
              daysBefore !== 1 ? "s" : ""
            }`,
            data: {
              audience: "staff",
              recipientRole: "owner",
              tenantId: tenant?._id?.toString?.(),
              propertyId: property._id?.toString?.(),
              userEmail: owner.email,
              userName: getUserName(owner),
              propertyName: propertyName,
              tenantName: getUserName(tenant),
              expiryDate: lease.endDate.toISOString(),
              daysUntilExpiry: daysBefore,
              leaseId: lease._id.toString(),
              isLandlord: true,
            },
          });
        }

        // Send notification to property manager if different from owner
        if (
          manager?._id &&
          manager?.email &&
          manager._id.toString() !== owner?._id?.toString()
        ) {
          await notificationService.sendNotification({
            type: NotificationType.LEASE_EXPIRY,
            priority:
              daysBefore <= 30
                ? NotificationPriority.HIGH
                : NotificationPriority.NORMAL,
            userId: manager._id.toString(),
            title: "Lease Expiring Soon - Action Required",
            message: `Lease for ${propertyName} expires in ${daysBefore} day${
              daysBefore !== 1 ? "s" : ""
            }`,
            data: {
              audience: "staff",
              recipientRole: "manager",
              tenantId: tenant?._id?.toString?.(),
              propertyId: property._id?.toString?.(),
              userEmail: manager.email,
              userName: getUserName(manager),
              propertyName: propertyName,
              tenantName: getUserName(tenant),
              expiryDate: lease.endDate.toISOString(),
              daysUntilExpiry: daysBefore,
              leaseId: lease._id.toString(),
              isLandlord: true,
            },
          });
        }
      } catch (err) {
        console.error(
          `Error processing lease expiry notification for lease ${lease._id}:`,
          err
        );
        continue;
      }
    }
  }

  // Utility function to check if two dates are the same day
  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  // Get all automation rules
  getAllRules(): AutomationRule[] {
    return Array.from(this.automationRules.values());
  }

  // Get rule by ID
  getRule(ruleId: string): AutomationRule | undefined {
    return this.automationRules.get(ruleId);
  }
}

// Create singleton instance
export const notificationAutomation = new NotificationAutomation();

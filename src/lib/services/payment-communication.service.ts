/**
 * PropertyPro - Payment Communication Service
 * Automated payment reminders and notifications with smart scheduling
 */

import { IPayment, PaymentStatus, ILease } from "@/types";
import { Payment, Lease, User } from "@/models";
import { paymentStatusService } from "./payment-status.service";
import mongoose from "mongoose";

export interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
}

export interface NotificationSchedule {
  type: "reminder" | "overdue" | "final_notice" | "confirmation";
  triggerDays: number; // Days before/after due date (negative = before, positive = after)
  enabled: boolean;
  channels: ("email" | "sms" | "push")[];
  templateId: string;
  priority: "low" | "medium" | "high";
}

export interface CommunicationConfig {
  schedules: NotificationSchedule[];
  globalSettings: {
    enableEmail: boolean;
    enableSMS: boolean;
    enablePush: boolean;
    businessHours: {
      start: string; // "09:00"
      end: string; // "17:00"
      timezone: string;
    };
    respectDoNotDisturb: boolean;
  };
}

export interface NotificationResult {
  notificationId: string;
  paymentId: string;
  tenantId: string;
  type: string;
  channels: string[];
  status: "sent" | "failed" | "scheduled";
  sentAt?: Date;
  scheduledFor?: Date;
  error?: string;
}

export interface CommunicationBatch {
  batchId: string;
  totalNotifications: number;
  successCount: number;
  failureCount: number;
  results: NotificationResult[];
  processedAt: Date;
}

export class PaymentCommunicationService {
  private defaultConfig: CommunicationConfig = {
    schedules: [
      {
        type: "reminder",
        triggerDays: -7,
        enabled: true,
        channels: ["email"],
        templateId: "payment_reminder_7_days",
        priority: "low",
      },
      {
        type: "reminder",
        triggerDays: -3,
        enabled: true,
        channels: ["email"],
        templateId: "payment_reminder_3_days",
        priority: "medium",
      },
      {
        type: "reminder",
        triggerDays: -1,
        enabled: true,
        channels: ["email", "sms"],
        templateId: "payment_reminder_1_day",
        priority: "high",
      },
      {
        type: "reminder",
        triggerDays: 0,
        enabled: true,
        channels: ["email", "sms"],
        templateId: "payment_due_today",
        priority: "high",
      },
      {
        type: "overdue",
        triggerDays: 1,
        enabled: true,
        channels: ["email", "sms"],
        templateId: "payment_overdue_1_day",
        priority: "high",
      },
      {
        type: "overdue",
        triggerDays: 5,
        enabled: true,
        channels: ["email", "sms"],
        templateId: "payment_overdue_5_days",
        priority: "high",
      },
      {
        type: "final_notice",
        triggerDays: 15,
        enabled: true,
        channels: ["email", "sms"],
        templateId: "payment_final_notice",
        priority: "high",
      },
    ],
    globalSettings: {
      enableEmail: true,
      enableSMS: false,
      enablePush: false,
      businessHours: {
        start: "09:00",
        end: "17:00",
        timezone: "America/New_York",
      },
      respectDoNotDisturb: true,
    },
  };

  private templates: Record<string, NotificationTemplate> = {
    payment_reminder_7_days: {
      id: "payment_reminder_7_days",
      name: "7-Day Payment Reminder",
      subject: "Rent Payment Due in 7 Days - {{propertyName}}",
      htmlContent: `
        <h2>Rappel de paiement</h2>
        <p>Dear {{tenantName}},</p>
        <p>This is a friendly reminder that your rent payment of <strong>{{amount}}</strong> for {{propertyName}} is due on {{dueDate}}.</p>
        <p><strong>Payment Details:</strong></p>
        <ul>
          <li>Amount: {{amount}}</li>
          <li>Due Date: {{dueDate}}</li>
          <li>Property: {{propertyName}}</li>
        </ul>
        <p>You can make your payment online through your tenant portal.</p>
        <p>Thank you for your prompt attention to this matter.</p>
      `,
      textContent: `Payment Reminder: Your rent payment of {{amount}} for {{propertyName}} is due on {{dueDate}}. Please make your payment through the tenant portal.`,
      variables: ["tenantName", "amount", "dueDate", "propertyName"],
    },
    payment_reminder_3_days: {
      id: "payment_reminder_3_days",
      name: "3-Day Payment Reminder",
      subject: "Rent Payment Due in 3 Days - {{propertyName}}",
      htmlContent: `
        <h2>Rappel de paiement</h2>
        <p>Dear {{tenantName}},</p>
        <p>Your rent payment of <strong>{{amount}}</strong> for {{propertyName}} is due in 3 days on {{dueDate}}.</p>
        <p>Please ensure your payment is submitted on time to avoid any late fees.</p>
        <p><a href="{{paymentLink}}">Make Payment Now</a></p>
      `,
      textContent: `Reminder: Your rent payment of {{amount}} is due in 3 days on {{dueDate}}. Make your payment at {{paymentLink}}`,
      variables: [
        "tenantName",
        "amount",
        "dueDate",
        "propertyName",
        "paymentLink",
      ],
    },
    payment_reminder_1_day: {
      id: "payment_reminder_1_day",
      name: "1-Day Payment Reminder",
      subject: "URGENT: Rent Payment Due Tomorrow - {{propertyName}}",
      htmlContent: `
        <h2>Urgent Payment Reminder</h2>
        <p>Dear {{tenantName}},</p>
        <p><strong>Your rent payment of {{amount}} is due TOMORROW ({{dueDate}}).</strong></p>
        <p>Please submit your payment immediately to avoid late fees.</p>
        <p><a href="{{paymentLink}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Pay Now</a></p>
      `,
      textContent: `URGENT: Your rent payment of {{amount}} is due tomorrow ({{dueDate}}). Pay now at {{paymentLink}}`,
      variables: [
        "tenantName",
        "amount",
        "dueDate",
        "propertyName",
        "paymentLink",
      ],
    },
    payment_due_today: {
      id: "payment_due_today",
      name: "Payment Due Today",
      subject: "URGENT: Rent Payment Due Today - {{propertyName}}",
      htmlContent: `
        <h2>Payment Due Today</h2>
        <p>Dear {{tenantName}},</p>
        <p><strong>Your rent payment of {{amount}} is due TODAY.</strong></p>
        <p>Please submit your payment immediately to avoid late fees.</p>
        <p><a href="{{paymentLink}}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Pay Immediately</a></p>
      `,
      textContent: `URGENT: Your rent payment of {{amount}} is due TODAY. Pay immediately at {{paymentLink}}`,
      variables: [
        "tenantName",
        "amount",
        "dueDate",
        "propertyName",
        "paymentLink",
      ],
    },
    payment_overdue_1_day: {
      id: "payment_overdue_1_day",
      name: "1-Day Overdue Notice",
      subject: "OVERDUE: Rent Payment Past Due - {{propertyName}}",
      htmlContent: `
        <h2>Overdue Payment Notice</h2>
        <p>Dear {{tenantName}},</p>
        <p><strong>Your rent payment of {{amount}} is now 1 day overdue.</strong></p>
        <p>Late fees may apply. Please submit your payment immediately.</p>
        <p>If you have already made this payment, please disregard this notice.</p>
        <p><a href="{{paymentLink}}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Pay Now</a></p>
      `,
      textContent: `OVERDUE: Your rent payment of {{amount}} is 1 day past due. Late fees may apply. Pay now at {{paymentLink}}`,
      variables: [
        "tenantName",
        "amount",
        "dueDate",
        "propertyName",
        "paymentLink",
      ],
    },
    payment_overdue_5_days: {
      id: "payment_overdue_5_days",
      name: "5-Day Overdue Notice",
      subject: "URGENT: Rent Payment 5 Days Overdue - {{propertyName}}",
      htmlContent: `
        <h2>Urgent Overdue Notice</h2>
        <p>Dear {{tenantName}},</p>
        <p><strong>Your rent payment of {{amount}} is now 5 days overdue.</strong></p>
        <p>Late fees have been applied to your account. Please contact us immediately to discuss payment arrangements.</p>
        <p>Total amount due: {{totalAmountDue}}</p>
        <p><a href="{{paymentLink}}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Pay Now</a></p>
        <p>Contact us: {{contactPhone}} | {{contactEmail}}</p>
      `,
      textContent: `URGENT: Your rent payment is 5 days overdue. Late fees applied. Total due: {{totalAmountDue}}. Pay at {{paymentLink}} or call {{contactPhone}}`,
      variables: [
        "tenantName",
        "amount",
        "dueDate",
        "propertyName",
        "paymentLink",
        "totalAmountDue",
        "contactPhone",
        "contactEmail",
      ],
    },
    payment_final_notice: {
      id: "payment_final_notice",
      name: "Final Notice",
      subject: "FINAL NOTICE: Immediate Payment Required - {{propertyName}}",
      htmlContent: `
        <h2>Final Notice</h2>
        <p>Dear {{tenantName}},</p>
        <p><strong>This is your FINAL NOTICE for the overdue rent payment.</strong></p>
        <p>Your payment of {{amount}} is now {{daysOverdue}} days overdue.</p>
        <p>If payment is not received within 3 business days, we will begin eviction proceedings as outlined in your lease agreement.</p>
        <p>Total amount due (including late fees): {{totalAmountDue}}</p>
        <p><strong>Contact us immediately: {{contactPhone}}</strong></p>
      `,
      textContent: `FINAL NOTICE: Payment {{daysOverdue}} days overdue. Total due: {{totalAmountDue}}. Contact {{contactPhone}} immediately or eviction proceedings will begin.`,
      variables: [
        "tenantName",
        "amount",
        "dueDate",
        "propertyName",
        "daysOverdue",
        "totalAmountDue",
        "contactPhone",
        "contactEmail",
      ],
    },
  };

  /**
   * Process automated notifications for all eligible payments
   */
  async processAutomatedNotifications(
    config: Partial<CommunicationConfig> = {}
  ): Promise<CommunicationBatch> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const batchId = new mongoose.Types.ObjectId().toString();
    const results: NotificationResult[] = [];

    try {
      // Get all payments that might need notifications
      const payments = await Payment.find({
        status: {
          $nin: [
            PaymentStatus.PAID,
            PaymentStatus.PAID,
            PaymentStatus.CANCELLED,
          ],
        },
        dueDate: { $exists: true },
        deletedAt: null,
      }).populate([
        {
          path: "tenantId",
          populate: {
            path: "userId",
            select: "firstName lastName email phone",
          },
        },
        { path: "propertyId", select: "name address" },
        { path: "leaseId" },
      ]);


      // Process each payment
      for (const payment of payments) {
        const paymentResults = await this.processPaymentNotifications(
          payment,
          finalConfig
        );
        results.push(...paymentResults);
      }

      const successCount = results.filter((r) => r.status === "sent").length;
      const failureCount = results.filter((r) => r.status === "failed").length;

      return {
        batchId,
        totalNotifications: results.length,
        successCount,
        failureCount,
        results,
        processedAt: new Date(),
      };
    } catch (error) {
      console.error("Error processing automated notifications:", error);
      throw error;
    }
  }

  /**
   * Process notifications for a specific payment
   */
  private async processPaymentNotifications(
    payment: any,
    config: CommunicationConfig
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    const now = new Date();
    const dueDate = new Date(payment.dueDate);
    const daysDiff = Math.ceil(
      (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Check each notification schedule
    for (const schedule of config.schedules) {
      if (!schedule.enabled) continue;

      // Check if this notification should be triggered
      const shouldTrigger = this.shouldTriggerNotification(
        daysDiff,
        schedule,
        payment
      );

      if (shouldTrigger) {
        const result = await this.sendNotification(payment, schedule, config);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Determine if a notification should be triggered
   */
  private shouldTriggerNotification(
    daysDiff: number,
    schedule: NotificationSchedule,
    payment: any
  ): boolean {
    // Check if we're at the right trigger point
    if (daysDiff !== schedule.triggerDays) {
      return false;
    }

    // Check if this notification has already been sent
    const alreadySent = payment.remindersSent?.some(
      (reminder: any) =>
        reminder.type === schedule.type &&
        Math.abs(new Date(reminder.sentDate).getTime() - new Date().getTime()) <
          24 * 60 * 60 * 1000
    );

    return !alreadySent;
  }

  /**
   * Send a notification
   */
  private async sendNotification(
    payment: any,
    schedule: NotificationSchedule,
    config: CommunicationConfig
  ): Promise<NotificationResult> {
    const notificationId = new mongoose.Types.ObjectId().toString();

    try {
      const template = this.templates[schedule.templateId];
      if (!template) {
        throw new Error(`Template not found: ${schedule.templateId}`);
      }

      // Prepare notification data
      const notificationData = this.prepareNotificationData(payment, template);

      // Send through enabled channels
      const channelResults = await Promise.all(
        schedule.channels.map((channel) =>
          this.sendThroughChannel(channel, notificationData, config)
        )
      );

      // Update payment with reminder sent
      await this.recordReminderSent(
        payment._id,
        schedule.type,
        schedule.channels
      );

      const allSuccessful = channelResults.every((result) => result.success);

      return {
        notificationId,
        paymentId: payment._id.toString(),
        tenantId: payment.tenantId._id.toString(),
        type: schedule.type,
        channels: schedule.channels,
        status: allSuccessful ? "sent" : "failed",
        sentAt: new Date(),
        error: allSuccessful ? undefined : "Some channels failed",
      };
    } catch (error) {
      console.error(`Error sending notification ${notificationId}:`, error);

      return {
        notificationId,
        paymentId: payment._id.toString(),
        tenantId: payment.tenantId._id.toString(),
        type: schedule.type,
        channels: schedule.channels,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Prepare notification data with variable substitution
   */
  private prepareNotificationData(
    payment: any,
    template: NotificationTemplate
  ): any {
    const tenant = payment.tenantId;
    const property = payment.propertyId;
    const user = tenant.userId;

    const variables = {
      tenantName: `${user.firstName} ${user.lastName}`,
      amount: this.formatCurrency(payment.amount),
      dueDate: this.formatDate(payment.dueDate),
      propertyName: property.name,
      paymentLink: `${process.env.NEXT_PUBLIC_APP_URL}/tenant/payments`,
      totalAmountDue: this.formatCurrency(
        payment.amount + (payment.lateFeeApplied || 0)
      ),
      daysOverdue: Math.max(
        0,
        Math.ceil(
          (new Date().getTime() - new Date(payment.dueDate).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      ),
      contactPhone: process.env.CONTACT_PHONE || "(555) 123-4567",
      contactEmail: process.env.CONTACT_EMAIL || "support@PropertyPro.com",
    };

    // Replace variables in template
    let subject = template.subject;
    let htmlContent = template.htmlContent;
    let textContent = template.textContent;

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, "g"), value.toString());
      htmlContent = htmlContent.replace(
        new RegExp(placeholder, "g"),
        value.toString()
      );
      textContent = textContent.replace(
        new RegExp(placeholder, "g"),
        value.toString()
      );
    });

    return {
      to: user.email,
      phone: user.phone,
      subject,
      htmlContent,
      textContent,
      variables,
    };
  }

  /**
   * Send notification through specific channel
   */
  private async sendThroughChannel(
    channel: string,
    notificationData: any,
    config: CommunicationConfig
  ): Promise<{ success: boolean; error?: string }> {
    try {
      switch (channel) {
        case "email":
          if (!config.globalSettings.enableEmail) {
            return { success: false, error: "Email notifications disabled" };
          }
          return await this.sendEmail(notificationData);

        case "sms":
          if (!config.globalSettings.enableSMS) {
            return { success: false, error: "SMS notifications disabled" };
          }
          return await this.sendSMS(notificationData);

        case "push":
          if (!config.globalSettings.enablePush) {
            return { success: false, error: "Push notifications disabled" };
          }
          return await this.sendPushNotification(notificationData);

        default:
          return { success: false, error: `Unknown channel: ${channel}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    data: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { emailService } = await import("./email.service");

      const result = await emailService.sendEmail({
        to: data.to,
        subject: data.subject,
        html: data.htmlContent,
        text: data.textContent,
      });

      if (result.success) {

        return { success: true };
      } else {
        console.error("Email sending failed:", result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("Email service error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Email sending failed",
      };
    }
  }

  /**
   * Send SMS notification (disabled - SMS service not configured)
   */
  private async sendSMS(
    data: any
  ): Promise<{ success: boolean; error?: string }> {
    console.warn("SMS service not configured, skipping SMS notification");
    return { success: false, error: "SMS service not configured" };
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(
    data: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // TODO: Implement actual push notification sending

      // Simulate push notification sending
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Push notification failed",
      };
    }
  }

  /**
   * Record that a reminder was sent
   */
  private async recordReminderSent(
    paymentId: string,
    type: string,
    channels: string[]
  ): Promise<void> {
    await Payment.findByIdAndUpdate(paymentId, {
      $push: {
        remindersSent: {
          type,
          sentDate: new Date(),
          method: channels.join(","),
        },
      },
    });
  }

  /**
   * Utility methods
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }

  private formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}

export const paymentCommunicationService = new PaymentCommunicationService();

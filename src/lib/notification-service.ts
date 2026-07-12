/**
 * PropertyPro - Comprehensive Notification Service
 * Handles automated notifications, SMS integration, and scheduling
 */

import { emailService } from "./email-service";
import {
  IUser,
  IProperty,
  ILease,
  IPayment,
  IMaintenanceRequest,
} from "@/types";
import { Types } from "mongoose";
import Notification from "@/models/Notification";
import { formatCurrency } from "@/lib/utils/formatting";
import { publish } from "@/lib/realtime/bus";
import { sendPushToUsers } from "@/lib/push/send";

// Notification types
export enum NotificationType {
  PAYMENT_REMINDER = "payment_reminder",
  PAYMENT_OVERDUE = "payment_overdue",
  LEASE_EXPIRY = "lease_expiry",
  LEASE_RENEWAL = "lease_renewal",
  MAINTENANCE_UPDATE = "maintenance_update",
  MAINTENANCE_EMERGENCY = "maintenance_emergency",
  WELCOME = "welcome",
  ACCOUNT_ACTIVATION = "account_activation",
  PASSWORD_RESET = "password_reset",
  SYSTEM_ANNOUNCEMENT = "system_announcement",
  PROPERTY_UPDATE = "property_update",
}

// Notification priority levels
export enum NotificationPriority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  CRITICAL = "critical",
}

// Notification preferences interface
export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
}

// Notification data interface
export interface NotificationData {
  type: NotificationType;
  priority: NotificationPriority;
  userId: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  scheduledFor?: Date;
  preferences?: NotificationPreferences;
}

// Scheduled notification interface
export interface ScheduledNotification {
  id: string;
  type: NotificationType;
  userId: string;
  scheduledFor: Date;
  data: Record<string, any>;
  status: "pending" | "sent" | "failed" | "cancelled";
  createdAt: Date;
}

export class NotificationService {
  private scheduledNotifications: Map<string, ScheduledNotification> =
    new Map();

  constructor() {
    this.initializeScheduler();
  }

  // Initialize notification scheduler
  private initializeScheduler(): void {
    // Check for scheduled notifications every minute
    setInterval(() => {
      this.processScheduledNotifications();
    }, 60000);
  }

  // Process scheduled notifications
  private async processScheduledNotifications(): Promise<void> {
    const now = new Date();

    for (const [id, notification] of this.scheduledNotifications) {
      if (
        notification.status === "pending" &&
        notification.scheduledFor <= now
      ) {
        try {
          await this.sendNotification({
            type: notification.type,
            priority: NotificationPriority.NORMAL,
            userId: notification.userId,
            title: "",
            message: "",
            data: notification.data,
          });

          notification.status = "sent";
        } catch (error) {
          console.error(`Failed to send scheduled notification ${id}:`, error);
          notification.status = "failed";
        }
      }
    }
  }

  // Schedule a notification
  async scheduleNotification(
    type: NotificationType,
    userId: string,
    scheduledFor: Date,
    data: Record<string, any>
  ): Promise<string> {
    const id = `${type}_${userId}_${Date.now()}`;

    const scheduledNotification: ScheduledNotification = {
      id,
      type,
      userId,
      scheduledFor,
      data,
      status: "pending",
      createdAt: new Date(),
    };

    this.scheduledNotifications.set(id, scheduledNotification);
    return id;
  }

  // Cancel a scheduled notification
  cancelScheduledNotification(id: string): boolean {
    const notification = this.scheduledNotifications.get(id);
    if (notification && notification.status === "pending") {
      notification.status = "cancelled";
      return true;
    }
    return false;
  }

  // Send immediate notification
  async sendNotification(data: NotificationData): Promise<boolean> {
    try {
      // Get user preferences (in real implementation, fetch from database)
      const preferences = data.preferences || {
        email: true,
        sms:
          data.priority === NotificationPriority.CRITICAL ||
          data.priority === NotificationPriority.HIGH,
        push: true,
        inApp: true,
      };

      let success = true;

      // Send email notification
      if (preferences.email) {
        success = (await this.sendEmailNotification(data)) && success;
      }

      // Send SMS notification for high priority
      if (
        preferences.sms &&
        (data.priority === NotificationPriority.HIGH ||
          data.priority === NotificationPriority.CRITICAL)
      ) {
        success = (await this.sendSMSNotification(data)) && success;
      }

      // Send push notification (placeholder)
      if (preferences.push) {
        success = (await this.sendPushNotification(data)) && success;
      }

      // Store in-app notification (placeholder)
      if (preferences.inApp) {
        success = (await this.storeInAppNotification(data)) && success;
      }

      return success;
    } catch (error) {
      console.error("Failed to send notification:", error);
      return false;
    }
  }

  // Send email notification based on type
  private async sendEmailNotification(
    data: NotificationData
  ): Promise<boolean> {
    try {
      switch (data.type) {
        case NotificationType.PAYMENT_REMINDER:
          return await this.sendPaymentReminderEmail(data);
        case NotificationType.PAYMENT_OVERDUE:
          return await this.sendPaymentOverdueEmail(data);
        case NotificationType.LEASE_EXPIRY:
          return await this.sendLeaseExpiryEmail(data);
        case NotificationType.MAINTENANCE_UPDATE:
          return await this.sendMaintenanceUpdateEmail(data);
        default:
          return await this.sendGenericEmail(data);
      }
    } catch (error) {
      console.error("Failed to send email notification:", error);
      return false;
    }
  }

  // Send SMS notification (disabled - SMS service not configured)
  private async sendSMSNotification(data: NotificationData): Promise<boolean> {
    return false;
  }

  // Send push notification (placeholder)
  private async sendPushNotification(data: NotificationData): Promise<boolean> {
    // TODO: Implement push notification service (Firebase, OneSignal, etc.)

    return true;
  }

  // Store in-app notification (placeholder)
  private async storeInAppNotification(
    data: NotificationData
  ): Promise<boolean> {
    try {
      let userId = data.userId as unknown as Types.ObjectId;

      if (typeof data.userId === "string") {
        if (!Types.ObjectId.isValid(data.userId)) {
          console.warn("Skipping in-app notification storage: invalid userId");
          return false;
        }
        userId = new Types.ObjectId(data.userId);
      }

      const title = this.resolveNotificationTitle(data);
      const message = this.resolveNotificationMessage(data);
      const actionUrl = data.data?.actionUrl;

      const created = await Notification.create({
        userId,
        title,
        message,
        type: data.type,
        priority: data.priority,
        actionUrl,
        metadata: data.data || {},
      });

      const userIdStr = String(userId);

      publish({
        type: "notification.created",
        userId: userIdStr,
        notification: {
          id: String(created._id),
          title,
          message,
          type: data.type,
          priority: data.priority,
          actionUrl,
          createdAt: created.createdAt ?? new Date(),
        },
      });

      void sendPushToUsers([userIdStr], {
        title,
        body: message.slice(0, 160),
        url: actionUrl || "/dashboard/notifications",
        tag: `notification-${String(created._id)}`,
      });

      return true;
    } catch (error) {
      console.error("Failed to store in-app notification:", error);
      return false;
    }
  }

  // Generate SMS message based on notification type
  private generateSMSMessage(data: NotificationData): string {
    switch (data.type) {
      case NotificationType.PAYMENT_OVERDUE:
        return `PropertyPro: Your rent payment is overdue. Amount: ${formatCurrency(Number(data.data?.amount))}. Please pay immediately to avoid late fees.`;
      case NotificationType.MAINTENANCE_EMERGENCY:
        return `PropertyPro EMERGENCY: ${data.data?.description}. Request #${data.data?.requestId}. Immediate attention required.`;
      case NotificationType.LEASE_EXPIRY:
        return `PropertyPro: Your lease expires in ${data.data?.daysUntilExpiry} days. Contact your property manager for renewal.`;
      default:
        return `PropertyPro: ${data.message}`;
    }
  }

  // Email notification methods
  private async sendPaymentReminderEmail(
    data: NotificationData
  ): Promise<boolean> {
    const {
      userEmail,
      userName,
      propertyName,
      rentAmount,
      dueDate,
      daysOverdue,
    } = data.data || {};
    return await emailService.sendPaymentReminder(
      userEmail,
      userName,
      propertyName,
      rentAmount,
      new Date(dueDate),
      daysOverdue || 0
    );
  }

  private async sendPaymentOverdueEmail(
    data: NotificationData
  ): Promise<boolean> {
    const {
      userEmail,
      userName,
      propertyName,
      rentAmount,
      dueDate,
      daysOverdue,
    } = data.data || {};
    return await emailService.sendPaymentReminder(
      userEmail,
      userName,
      propertyName,
      rentAmount,
      new Date(dueDate),
      daysOverdue
    );
  }

  private async sendLeaseExpiryEmail(data: NotificationData): Promise<boolean> {
    const {
      userEmail,
      userName,
      propertyName,
      expiryDate,
      daysUntilExpiry,
      isLandlord,
      tenantName,
      leaseId,
    } = data.data || {};

    // Send landlord-specific email if this is for a property owner/manager
    if (isLandlord) {
      return await emailService.sendLeaseExpiryReminderToLandlord(
        userEmail,
        userName,
        propertyName,
        tenantName,
        new Date(expiryDate),
        daysUntilExpiry,
        leaseId
      );
    }

    // Send tenant-specific email
    return await emailService.sendLeaseExpiryReminder(
      userEmail,
      userName,
      propertyName,
      new Date(expiryDate),
      daysUntilExpiry
    );
  }

  private async sendMaintenanceUpdateEmail(
    data: NotificationData
  ): Promise<boolean> {
    const {
      userEmail,
      userName,
      requestId,
      propertyName,
      status,
      description,
      notes,
    } = data.data || {};
    return await emailService.sendMaintenanceUpdate(
      userEmail,
      userName,
      requestId,
      propertyName,
      status,
      description,
      notes
    );
  }

  private async sendGenericEmail(data: NotificationData): Promise<boolean> {
    const { userEmail, userName } = data.data || {};
    return await emailService.sendNotification(
      userEmail,
      userName,
      data.title,
      data.message
    );
  }

  private resolveNotificationTitle(data: NotificationData): string {
    if (data.title?.trim()) {
      return data.title;
    }

    const fallbackTitle =
      typeof data.data?.title === "string" && data.data.title.trim()
        ? data.data.title
        : null;

    if (fallbackTitle) {
      return fallbackTitle;
    }

    switch (data.type) {
      case NotificationType.PAYMENT_REMINDER:
        return "Upcoming payment reminder";
      case NotificationType.PAYMENT_OVERDUE:
        return "Payment is overdue";
      case NotificationType.LEASE_EXPIRY:
        return "Lease expiration notice";
      case NotificationType.MAINTENANCE_UPDATE:
        return "Maintenance request update";
      case NotificationType.MAINTENANCE_EMERGENCY:
        return "Emergency maintenance alert";
      case NotificationType.SYSTEM_ANNOUNCEMENT:
        return "System announcement";
      default:
        return "New notification";
    }
  }

  private resolveNotificationMessage(data: NotificationData): string {
    if (data.message?.trim()) {
      return data.message;
    }

    const fallbackMessage =
      typeof data.data?.message === "string" && data.data.message.trim()
        ? data.data.message
        : null;

    if (fallbackMessage) {
      return fallbackMessage;
    }

    switch (data.type) {
      case NotificationType.PAYMENT_REMINDER:
        return "You have an upcoming payment due soon.";
      case NotificationType.PAYMENT_OVERDUE:
        return "A payment is overdue. Please review and take action.";
      case NotificationType.LEASE_EXPIRY:
        return "A lease is approaching its expiration date.";
      case NotificationType.MAINTENANCE_UPDATE:
        return "There is an update on one of your maintenance requests.";
      case NotificationType.MAINTENANCE_EMERGENCY:
        return "An emergency maintenance request has been logged.";
      case NotificationType.SYSTEM_ANNOUNCEMENT:
        return "A new system announcement is available.";
      default:
        return "You have a new notification.";
    }
  }
}

// Create singleton instance
export const notificationService = new NotificationService();

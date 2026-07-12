import mongoose, { Schema, Document, Model } from "mongoose";

// Notification Settings Interface
export interface INotificationSettings extends Document {
  userId: mongoose.Types.ObjectId;

  // Email Notifications
  email: {
    enabled: boolean;
    paymentReminders: boolean;
    maintenanceUpdates: boolean;
    leaseReminders: boolean;
    propertyNews: boolean;
    systemAlerts: boolean;
    marketingEmails: boolean;
    weeklyReports: boolean;
    monthlyReports: boolean;
    tenantMessages: boolean;
    documentSharing: boolean;
    calendarReminders: boolean;
    frequency: "immediate" | "daily" | "weekly";
    quietHours: {
      enabled: boolean;
      startTime: string;
      endTime: string;
      timezone: string;
    };
  };

  // SMS Notifications
  sms: {
    enabled: boolean;
    emergencyOnly: boolean;
    paymentReminders: boolean;
    maintenanceUpdates: boolean;
    leaseReminders: boolean;
    systemAlerts: boolean;
    quietHours: {
      enabled: boolean;
      startTime: string;
      endTime: string;
      timezone: string;
    };
  };

  // Push Notifications
  push: {
    enabled: boolean;
    paymentReminders: boolean;
    maintenanceUpdates: boolean;
    leaseReminders: boolean;
    tenantMessages: boolean;
    systemAlerts: boolean;
    propertyNews: boolean;
    documentSharing: boolean;
    calendarReminders: boolean;
    quietHours: {
      enabled: boolean;
      startTime: string;
      endTime: string;
      timezone: string;
    };
  };

  // In-App Notifications
  inApp: {
    enabled: boolean;
    showDesktop: boolean;
    playSound: boolean;
    showBadges: boolean;
    autoMarkRead: boolean;
    retentionDays: number;
  };

  // Metadata
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

// Notification Settings Schema
const notificationSettingsSchema = new Schema<INotificationSettings>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Email Notifications
    email: {
      enabled: { type: Boolean, default: true },
      paymentReminders: { type: Boolean, default: true },
      maintenanceUpdates: { type: Boolean, default: true },
      leaseReminders: { type: Boolean, default: true },
      propertyNews: { type: Boolean, default: false },
      systemAlerts: { type: Boolean, default: true },
      marketingEmails: { type: Boolean, default: false },
      weeklyReports: { type: Boolean, default: true },
      monthlyReports: { type: Boolean, default: true },
      tenantMessages: { type: Boolean, default: true },
      documentSharing: { type: Boolean, default: true },
      calendarReminders: { type: Boolean, default: true },
      frequency: {
        type: String,
        enum: ["immediate", "daily", "weekly"],
        default: "immediate",
      },
      quietHours: {
        enabled: { type: Boolean, default: false },
        startTime: { type: String, default: "22:00" },
        endTime: { type: String, default: "08:00" },
        timezone: { type: String, default: "America/New_York" },
      },
    },

    // SMS Notifications
    sms: {
      enabled: { type: Boolean, default: false },
      emergencyOnly: { type: Boolean, default: true },
      paymentReminders: { type: Boolean, default: false },
      maintenanceUpdates: { type: Boolean, default: false },
      leaseReminders: { type: Boolean, default: false },
      systemAlerts: { type: Boolean, default: true },
      quietHours: {
        enabled: { type: Boolean, default: false },
        startTime: { type: String, default: "22:00" },
        endTime: { type: String, default: "08:00" },
        timezone: { type: String, default: "America/New_York" },
      },
    },

    // Push Notifications
    push: {
      enabled: { type: Boolean, default: true },
      paymentReminders: { type: Boolean, default: true },
      maintenanceUpdates: { type: Boolean, default: true },
      leaseReminders: { type: Boolean, default: true },
      tenantMessages: { type: Boolean, default: true },
      systemAlerts: { type: Boolean, default: true },
      propertyNews: { type: Boolean, default: false },
      documentSharing: { type: Boolean, default: true },
      calendarReminders: { type: Boolean, default: true },
      quietHours: {
        enabled: { type: Boolean, default: false },
        startTime: { type: String, default: "22:00" },
        endTime: { type: String, default: "08:00" },
        timezone: { type: String, default: "America/New_York" },
      },
    },

    // In-App Notifications
    inApp: {
      enabled: { type: Boolean, default: true },
      showDesktop: { type: Boolean, default: true },
      playSound: { type: Boolean, default: true },
      showBadges: { type: Boolean, default: true },
      autoMarkRead: { type: Boolean, default: false },
      retentionDays: { type: Number, default: 30, min: 7, max: 365 },
    },

    // Metadata
    isActive: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    collection: "notification_settings",
  }
);

// Indexes
notificationSettingsSchema.index({ userId: 1 }, { unique: true });
notificationSettingsSchema.index({ isActive: 1 });
notificationSettingsSchema.index({ createdAt: -1 });

// Instance Methods
notificationSettingsSchema.methods.updateNotifications = function (
  notificationData: Partial<INotificationSettings>
) {
  Object.assign(this, notificationData);
  this.version += 1;
  this.updatedAt = new Date();
  return this.save();
};

notificationSettingsSchema.methods.isNotificationEnabled = function (
  type: string,
  category: string
): boolean {
  const typeSettings = this[type as keyof INotificationSettings];
  if (!typeSettings || typeof typeSettings !== "object") return false;

  return (typeSettings as any).enabled && (typeSettings as any)[category];
};

// Static Methods
notificationSettingsSchema.statics.findByUserId = function (userId: string) {
  return this.findOne({ userId, isActive: true });
};

notificationSettingsSchema.statics.createDefaultNotifications = function (
  userId: string
) {
  return this.create({
    userId,
    email: {
      enabled: true,
      paymentReminders: true,
      maintenanceUpdates: true,
      leaseReminders: true,
      propertyNews: false,
      systemAlerts: true,
      marketingEmails: false,
      weeklyReports: true,
      monthlyReports: true,
      tenantMessages: true,
      documentSharing: true,
      calendarReminders: true,
      frequency: "immediate",
      quietHours: {
        enabled: false,
        startTime: "22:00",
        endTime: "08:00",
        timezone: "America/New_York",
      },
    },
    sms: {
      enabled: false,
      emergencyOnly: true,
      paymentReminders: false,
      maintenanceUpdates: false,
      leaseReminders: false,
      systemAlerts: true,
      quietHours: {
        enabled: false,
        startTime: "22:00",
        endTime: "08:00",
        timezone: "America/New_York",
      },
    },
    push: {
      enabled: true,
      paymentReminders: true,
      maintenanceUpdates: true,
      leaseReminders: true,
      tenantMessages: true,
      systemAlerts: true,
      propertyNews: false,
      documentSharing: true,
      calendarReminders: true,
      quietHours: {
        enabled: false,
        startTime: "22:00",
        endTime: "08:00",
        timezone: "America/New_York",
      },
    },
    inApp: {
      enabled: true,
      showDesktop: true,
      playSound: true,
      showBadges: true,
      autoMarkRead: false,
      retentionDays: 30,
    },
  });
};

// Pre-save middleware
notificationSettingsSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.version += 1;
  }
  next();
});

// Create and export the model with safer initialization
let NotificationSettings: Model<INotificationSettings>;

try {
  // Try to get existing model first
  NotificationSettings = mongoose.model<INotificationSettings>(
    "NotificationSettings"
  );
} catch (error) {
  // Model doesn't exist, create it
  NotificationSettings = mongoose.model<INotificationSettings>(
    "NotificationSettings",
    notificationSettingsSchema
  );
}

export default NotificationSettings;
export type { INotificationSettings };

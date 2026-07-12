import mongoose, { Schema, Document } from "mongoose";

export interface IEventReminder extends Document {
  eventId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId; // User to remind

  // Reminder configuration
  type: "email" | "sms" | "push" | "in_app";
  minutesBefore: number; // Minutes before event to send reminder

  // Scheduling
  scheduledFor: Date; // When to send the reminder
  sent: boolean;
  sentAt?: Date;

  // Delivery tracking
  deliveryStatus: "pending" | "sent" | "delivered" | "failed" | "bounced";
  deliveryAttempts: number;
  lastAttemptAt?: Date;
  errorMessage?: string;

  // Content customization
  customMessage?: string;
  template?: string;

  // Metadata
  metadata: {
    emailId?: string; // Email service provider ID
    smsId?: string; // SMS service provider ID
    pushId?: string; // Push notification ID
    userAgent?: string;
    ipAddress?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

const EventReminderSchema = new Schema<IEventReminder>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Reminder configuration
    type: {
      type: String,
      enum: ["email", "sms", "push", "in_app"],
      required: true,
      default: "email",
    },
    minutesBefore: {
      type: Number,
      required: true,
      min: 0,
      max: 10080, // Max 1 week (7 * 24 * 60)
    },

    // Scheduling
    scheduledFor: {
      type: Date,
      required: true,
    },
    sent: {
      type: Boolean,
      default: false,
    },
    sentAt: {
      type: Date,
    },

    // Delivery tracking
    deliveryStatus: {
      type: String,
      enum: ["pending", "sent", "delivered", "failed", "bounced"],
      default: "pending",
    },
    deliveryAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastAttemptAt: {
      type: Date,
    },
    errorMessage: {
      type: String,
      maxlength: 500,
    },

    // Content customization
    customMessage: {
      type: String,
      maxlength: 1000,
    },
    template: {
      type: String,
      default: "default",
    },

    // Metadata
    metadata: {
      emailId: {
        type: String,
      },
      smsId: {
        type: String,
      },
      pushId: {
        type: String,
      },
      userAgent: {
        type: String,
      },
      ipAddress: {
        type: String,
      },
    },
  },
  {
    timestamps: true,
    collection: "event_reminders",
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes - with error handling to prevent emitWarning issues
try {
  EventReminderSchema.index(
    { eventId: 1, userId: 1, minutesBefore: 1 },
    { unique: true }
  );
  EventReminderSchema.index({ scheduledFor: 1, sent: 1 });
  EventReminderSchema.index({ deliveryStatus: 1 });
  EventReminderSchema.index({ type: 1 });
  EventReminderSchema.index({ createdAt: 1 });
} catch (error) {
  // Silently handle index creation errors in development
  if (process.env.NODE_ENV !== "production") {
    console.warn("EventReminder index creation warning:", error);
  }
}

// Virtual for time until reminder
EventReminderSchema.virtual("timeUntilReminder").get(function () {
  const now = new Date();
  return this.scheduledFor.getTime() - now.getTime();
});

// Virtual for is overdue
EventReminderSchema.virtual("isOverdue").get(function () {
  return !this.sent && new Date() > this.scheduledFor;
});

// Static method to create reminders for an event
EventReminderSchema.statics.createForEvent = async function (
  eventId: string,
  userId: string,
  eventStartDate: Date,
  reminderMinutes: number[],
  types: string[] = ["email"]
) {
  const reminders = [];

  for (const minutes of reminderMinutes) {
    for (const type of types) {
      const scheduledFor = new Date(
        eventStartDate.getTime() - minutes * 60 * 1000
      );

      // Only create reminder if it's in the future
      if (scheduledFor > new Date()) {
        reminders.push({
          eventId,
          userId,
          type,
          minutesBefore: minutes,
          scheduledFor,
        });
      }
    }
  }

  if (reminders.length > 0) {
    return this.insertMany(reminders, { ordered: false });
  }

  return [];
};

// Static method to get pending reminders
EventReminderSchema.statics.getPendingReminders = function (
  limit: number = 100
) {
  return this.find({
    sent: false,
    scheduledFor: { $lte: new Date() },
    deliveryAttempts: { $lt: 3 }, // Max 3 attempts
  })
    .populate("eventId")
    .populate("userId", "firstName lastName email phone")
    .sort({ scheduledFor: 1 })
    .limit(limit);
};

// Static method to get failed reminders for retry
EventReminderSchema.statics.getFailedReminders = function (
  maxAge: number = 24, // hours
  limit: number = 50
) {
  const cutoffDate = new Date(Date.now() - maxAge * 60 * 60 * 1000);

  return this.find({
    sent: false,
    deliveryStatus: "failed",
    deliveryAttempts: { $lt: 3 },
    lastAttemptAt: { $gte: cutoffDate },
  })
    .populate("eventId")
    .populate("userId", "firstName lastName email phone")
    .sort({ lastAttemptAt: 1 })
    .limit(limit);
};

// Instance method to mark as sent
EventReminderSchema.methods.markAsSent = function (
  deliveryId?: string,
  deliveryStatus: string = "sent"
) {
  this.sent = true;
  this.sentAt = new Date();
  this.deliveryStatus = deliveryStatus;
  this.deliveryAttempts += 1;
  this.lastAttemptAt = new Date();

  if (deliveryId) {
    const idField = `${this.type}Id`;
    this.metadata[idField] = deliveryId;
  }

  return this.save();
};

// Instance method to mark as failed
EventReminderSchema.methods.markAsFailed = function (errorMessage?: string) {
  this.deliveryStatus = "failed";
  this.deliveryAttempts += 1;
  this.lastAttemptAt = new Date();
  this.errorMessage = errorMessage;

  return this.save();
};

// Instance method to retry sending
EventReminderSchema.methods.retry = function () {
  this.deliveryStatus = "pending";
  this.errorMessage = undefined;

  return this.save();
};

// Static method to cleanup old reminders
EventReminderSchema.statics.cleanup = function (daysOld: number = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  return this.deleteMany({
    $or: [
      { sent: true, sentAt: { $lt: cutoffDate } },
      { sent: false, scheduledFor: { $lt: cutoffDate } },
    ],
  });
};

// Static method to get reminder statistics
EventReminderSchema.statics.getStats = async function (
  startDate?: Date,
  endDate?: Date
) {
  const matchConditions: any = {};

  if (startDate || endDate) {
    matchConditions.createdAt = {};
    if (startDate) matchConditions.createdAt.$gte = startDate;
    if (endDate) matchConditions.createdAt.$lte = endDate;
  }

  const stats = await this.aggregate([
    { $match: matchConditions },
    {
      $group: {
        _id: {
          type: "$type",
          status: "$deliveryStatus",
        },
        count: { $sum: 1 },
        avgAttempts: { $avg: "$deliveryAttempts" },
      },
    },
    {
      $group: {
        _id: "$_id.type",
        statuses: {
          $push: {
            status: "$_id.status",
            count: "$count",
            avgAttempts: "$avgAttempts",
          },
        },
        total: { $sum: "$count" },
      },
    },
  ]);

  return stats;
};

// Pre-save middleware to validate scheduled time
EventReminderSchema.pre("save", function (next) {
  if (this.isNew && this.scheduledFor <= new Date()) {
    return next(new Error("Reminder cannot be scheduled for the past"));
  }
  next();
});

// Create and export the model with safer initialization
let EventReminder: mongoose.Model<IEventReminder>;

try {
  // Try to get existing model first
  EventReminder = mongoose.model<IEventReminder>("EventReminder");
} catch (error) {
  // Model doesn't exist, create it
  EventReminder = mongoose.model<IEventReminder>(
    "EventReminder",
    EventReminderSchema
  );
}

export { EventReminder };

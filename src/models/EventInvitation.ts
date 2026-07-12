import mongoose, { Schema, Document } from "mongoose";

export interface IEventInvitation extends Document {
  eventId: mongoose.Types.ObjectId;
  inviterId: mongoose.Types.ObjectId; // User who sent the invitation
  inviteeId?: mongoose.Types.ObjectId; // User who received the invitation (if registered)
  inviteeEmail: string; // Email address of invitee
  inviteeName: string; // Name of invitee

  // Invitation details
  invitationToken: string; // Unique token for RSVP
  status: "pending" | "accepted" | "declined" | "tentative";

  // Response details
  respondedAt?: Date;
  responseMessage?: string; // Optional message from invitee

  // Email tracking
  invitationSentAt: Date;
  remindersSent: number;
  lastReminderSentAt?: Date;

  // Metadata
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    responseSource?: "email" | "web" | "mobile";
  };

  createdAt: Date;
  updatedAt: Date;
}

const EventInvitationSchema = new Schema<IEventInvitation>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    inviterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    inviteeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    inviteeEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    inviteeName: {
      type: String,
      required: true,
      trim: true,
    },

    // Invitation details
    invitationToken: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "tentative"],
      default: "pending",
    },

    // Response details
    respondedAt: {
      type: Date,
    },
    responseMessage: {
      type: String,
      maxlength: 500,
    },

    // Email tracking
    invitationSentAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    remindersSent: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastReminderSentAt: {
      type: Date,
    },

    // Metadata
    metadata: {
      userAgent: {
        type: String,
      },
      ipAddress: {
        type: String,
      },
      responseSource: {
        type: String,
        enum: ["email", "web", "mobile"],
      },
    },
  },
  {
    timestamps: true,
    collection: "event_invitations",
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        delete ret.invitationToken; // Don't expose token in JSON
        return ret;
      },
    },
  }
);

// Indexes - with error handling to prevent emitWarning issues
try {
  EventInvitationSchema.index(
    { eventId: 1, inviteeEmail: 1 },
    { unique: true }
  );
  EventInvitationSchema.index({ inviterId: 1 });
  EventInvitationSchema.index({ inviteeId: 1 });
  EventInvitationSchema.index({ status: 1 });
  EventInvitationSchema.index({ invitationSentAt: 1 });
  EventInvitationSchema.index({ respondedAt: 1 });
} catch (error) {
  // Silently handle index creation errors in development
  if (process.env.NODE_ENV !== "production") {
    console.warn("EventInvitation index creation warning:", error);
  }
}

// Virtual for response time (how long it took to respond)
EventInvitationSchema.virtual("responseTime").get(function () {
  if (this.respondedAt && this.invitationSentAt) {
    return this.respondedAt.getTime() - this.invitationSentAt.getTime();
  }
  return null;
});

// Virtual for days since invitation
EventInvitationSchema.virtual("daysSinceInvitation").get(function () {
  const now = new Date();
  const diffTime = now.getTime() - this.invitationSentAt.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
});

// Static method to create invitation with token
EventInvitationSchema.statics.createInvitation = async function (
  eventId: string,
  inviterId: string,
  inviteeEmail: string,
  inviteeName: string,
  inviteeId?: string
) {
  const token = this.generateInvitationToken();

  return this.create({
    eventId,
    inviterId,
    inviteeId,
    inviteeEmail,
    inviteeName,
    invitationToken: token,
  });
};

// Static method to generate unique invitation token
EventInvitationSchema.statics.generateInvitationToken = function () {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2);
  return `${timestamp}-${randomStr}`;
};

// Static method to find invitation by token
EventInvitationSchema.statics.findByToken = function (token: string) {
  return this.findOne({ invitationToken: token })
    .populate("eventId")
    .populate("inviterId", "firstName lastName email")
    .populate("inviteeId", "firstName lastName email");
};

// Instance method to respond to invitation
EventInvitationSchema.methods.respond = function (
  status: "accepted" | "declined" | "tentative",
  message?: string,
  metadata?: any
) {
  this.status = status;
  this.respondedAt = new Date();
  this.responseMessage = message;

  if (metadata) {
    this.metadata = { ...this.metadata, ...metadata };
  }

  return this.save();
};

// Instance method to send reminder
EventInvitationSchema.methods.sendReminder = function () {
  this.remindersSent += 1;
  this.lastReminderSentAt = new Date();
  return this.save();
};

// Static method to get invitation statistics for an event
EventInvitationSchema.statics.getEventStats = async function (eventId: string) {
  const stats = await this.aggregate([
    { $match: { eventId: new mongoose.Types.ObjectId(eventId) } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    total: 0,
    pending: 0,
    accepted: 0,
    declined: 0,
    tentative: 0,
  };

  stats.forEach((stat) => {
    result[stat._id as keyof typeof result] = stat.count;
    result.total += stat.count;
  });

  return result;
};

// Static method to get invitations needing reminders
EventInvitationSchema.statics.getNeedingReminders = function (
  maxReminders: number = 3,
  daysSinceInvitation: number = 1
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysSinceInvitation);

  return this.find({
    status: "pending",
    remindersSent: { $lt: maxReminders },
    invitationSentAt: { $lte: cutoffDate },
    $or: [
      { lastReminderSentAt: { $exists: false } },
      {
        lastReminderSentAt: {
          $lte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        },
      },
    ],
  })
    .populate("eventId")
    .populate("inviterId", "firstName lastName email");
};

// Pre-save middleware to update event attendee status
EventInvitationSchema.pre("save", async function (next) {
  if (this.isModified("status") && this.status !== "pending") {
    try {
      const Event = mongoose.model("Event");
      await Event.updateOne(
        {
          _id: this.eventId,
          "attendees.email": this.inviteeEmail,
        },
        {
          $set: {
            "attendees.$.status": this.status,
            "attendees.$.respondedAt": this.respondedAt,
          },
        }
      );
    } catch (error) {
      console.error("Error updating event attendee status:", error);
    }
  }
  next();
});

// Create and export the model with safer initialization
let EventInvitation: mongoose.Model<IEventInvitation>;

try {
  // Try to get existing model first
  EventInvitation = mongoose.model<IEventInvitation>("EventInvitation");
} catch (error) {
  // Model doesn't exist, create it
  EventInvitation = mongoose.model<IEventInvitation>(
    "EventInvitation",
    EventInvitationSchema
  );
}

export { EventInvitation };

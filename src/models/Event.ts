import mongoose, { Schema } from "mongoose";
import {
  IEvent,
  IEventRecurrence,
  IEventReminder,
  IEventAttendee,
  IEventLocation,
  EventType,
  EventStatus,
  EventPriority,
  RecurrenceType,
  UserRole,
  LocationType,
  OnlinePlatform,
} from "@/types";

// Event Attendee Schema
const EventAttendeeSchema = new Schema<IEventAttendee>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined", "tentative"],
    default: "pending",
  },
  responseAt: {
    type: Date,
  },
  notes: {
    type: String,
    trim: true,
  },
});

// Event Reminder Schema
const EventReminderSchema = new Schema<IEventReminder>({
  type: {
    type: String,
    enum: ["email", "sms", "push", "in_app"],
    required: true,
  },
  minutesBefore: {
    type: Number,
    required: true,
    min: 0,
  },
  sent: {
    type: Boolean,
    default: false,
  },
  sentAt: {
    type: Date,
  },
});

// Event Location Schema
const EventLocationSchema = new Schema<IEventLocation>({
  type: {
    type: String,
    enum: Object.values(LocationType),
    required: true,
  },
  // For physical locations
  address: {
    type: String,
    trim: true,
  },
  // For online locations
  platform: {
    type: String,
    enum: Object.values(OnlinePlatform),
  },
  meetingLink: {
    type: String,
    trim: true,
  },
  meetingId: {
    type: String,
    trim: true,
  },
  passcode: {
    type: String,
    trim: true,
  },
});

// Event Recurrence Schema
const EventRecurrenceSchema = new Schema<IEventRecurrence>({
  type: {
    type: String,
    enum: Object.values(RecurrenceType),
    required: true,
  },
  interval: {
    type: Number,
    required: true,
    min: 1,
  },
  endDate: {
    type: Date,
  },
  occurrences: {
    type: Number,
    min: 1,
  },
  daysOfWeek: {
    type: [Number],
    validate: {
      validator: function (days: number[]) {
        return days.every((day) => day >= 0 && day <= 6);
      },
      message: "Les jours de la semaine doivent être compris entre 0 (dimanche) et 6 (samedi)",
    },
  },
  dayOfMonth: {
    type: Number,
    min: 1,
    max: 31,
  },
  exceptions: {
    type: [Date],
    default: [],
  },
});

// Main Event Schema
const EventSchema = new Schema<IEvent>(
  {
    title: {
      type: String,
      required: [true, "Le titre de l'événement est requis"],
      trim: true,
      maxlength: [200, "Le titre ne peut pas dépasser 200 caractères"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "La description ne peut pas dépasser 2000 caractères"],
    },
    type: {
      type: String,
      enum: Object.values(EventType),
      required: [true, "Le type d'événement est requis"],
    },
    status: {
      type: String,
      enum: Object.values(EventStatus),
      default: EventStatus.SCHEDULED,
    },
    priority: {
      type: String,
      enum: Object.values(EventPriority),
      default: EventPriority.MEDIUM,
    },

    // Date and time
    startDate: {
      type: Date,
      required: [true, "La date de début est requise"],
    },
    endDate: {
      type: Date,
      required: [true, "La date de fin est requise"],
      validate: {
        validator: function (this: IEvent, endDate: Date) {
          return endDate >= this.startDate;
        },
        message: "La date de fin doit être postérieure à la date de début",
      },
    },
    allDay: {
      type: Boolean,
      default: false,
    },
    timezone: {
      type: String,
      default: "UTC",
    },

    // Location
    location: {
      type: EventLocationSchema,
      required: false,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      set: (value: any) => (value === "" ? undefined : value),
    },
    unitNumber: {
      type: String,
      trim: true,
    },

    // Participants
    organizer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "L'organisateur de l'événement est requis"],
    },
    attendees: {
      type: [EventAttendeeSchema],
      default: [],
    },

    // Related entities
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      set: (value: any) => (value === "" ? undefined : value),
    },
    leaseId: {
      type: Schema.Types.ObjectId,
      ref: "Lease",
      set: (value: any) => (value === "" ? undefined : value),
    },
    maintenanceRequestId: {
      type: Schema.Types.ObjectId,
      ref: "MaintenanceRequest",
      set: (value: any) => (value === "" ? undefined : value),
    },

    // Recurrence
    recurrence: {
      type: EventRecurrenceSchema,
    },
    parentEventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },

    // Reminders and notifications
    reminders: {
      type: [EventReminderSchema],
      default: [],
    },

    // Additional data
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    attachments: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
    },

    // Audit fields
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance - with error handling to prevent emitWarning issues
try {
  EventSchema.index({ startDate: 1, endDate: 1 });
  EventSchema.index({ organizer: 1, startDate: 1 });
  EventSchema.index({ propertyId: 1, startDate: 1 });
  EventSchema.index({ tenantId: 1, startDate: 1 });
  EventSchema.index({ type: 1, status: 1 });
  EventSchema.index({ "attendees.userId": 1 });
  EventSchema.index({ parentEventId: 1 });
  EventSchema.index({ deletedAt: 1 });
} catch (error) {
  // Silently handle index creation errors in development
  if (process.env.NODE_ENV !== "production") {
    console.warn("Avertissement de création des index Event :", error);
  }
}

// Virtual for duration in minutes
EventSchema.virtual("durationMinutes").get(function (this: IEvent) {
  return Math.round(
    (this.endDate.getTime() - this.startDate.getTime()) / (1000 * 60)
  );
});

// Virtual for checking if event is past
EventSchema.virtual("isPast").get(function (this: IEvent) {
  return this.endDate < new Date();
});

// Virtual for checking if event is today
EventSchema.virtual("isToday").get(function (this: IEvent) {
  const today = new Date();
  const eventDate = new Date(this.startDate);
  return (
    eventDate.getDate() === today.getDate() &&
    eventDate.getMonth() === today.getMonth() &&
    eventDate.getFullYear() === today.getFullYear()
  );
});

// Virtual for checking if event is upcoming (within next 7 days)
EventSchema.virtual("isUpcoming").get(function (this: IEvent) {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return this.startDate >= now && this.startDate <= sevenDaysFromNow;
});

// Soft delete query helper
EventSchema.pre(/^find/, function (this: any) {
  (this as any).where({
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  });
});

// Create and export the model with safer initialization
let Event: mongoose.Model<IEvent>;

// Force recreation of the model to ensure schema changes are applied
if (mongoose.models?.Event) {
  delete mongoose.models.Event;
}

Event = mongoose.model<IEvent>("Event", EventSchema);

export default Event;

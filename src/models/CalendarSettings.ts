import mongoose, { Schema, Document } from "mongoose";

export interface ICalendarSettings extends Document {
  userId: mongoose.Types.ObjectId;

  // Display preferences
  defaultView: "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek";
  weekends: boolean;
  firstDay: number; // 0 = Sunday, 1 = Monday, etc.
  timezone: string;

  // Time settings
  businessHours: {
    enabled: boolean;
    startTime: string; // HH:mm format
    endTime: string; // HH:mm format
    daysOfWeek: number[]; // [1,2,3,4,5] for Mon-Fri
  };

  slotDuration: string; // "00:30" for 30 minutes
  snapDuration: string; // "00:15" for 15 minutes
  defaultEventDuration: string; // "01:00" for 1 hour

  // Event preferences
  defaultEventType: string;
  defaultEventPriority: string;
  defaultReminders: number[]; // Minutes before event

  // Notification preferences
  emailNotifications: {
    invitations: boolean;
    reminders: boolean;
    updates: boolean;
    cancellations: boolean;
  };

  // View preferences
  showWeekNumbers: boolean;
  showDeclinedEvents: boolean;
  eventLimit: number; // Max events to show per day in month view

  // Color preferences
  eventColors: {
    [key: string]: string; // Event type -> color mapping
  };

  // Integration settings
  integrations: {
    googleCalendar: {
      enabled: boolean;
      autoSync: boolean;
      syncDirection: "import" | "export" | "bidirectional";
      selectedCalendarId?: string;
      lastSync?: Date;
    };
  };

  createdAt: Date;
  updatedAt: Date;
}

const CalendarSettingsSchema = new Schema<ICalendarSettings>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // Display preferences
    defaultView: {
      type: String,
      enum: ["dayGridMonth", "timeGridWeek", "timeGridDay", "listWeek"],
      default: "dayGridMonth",
    },
    weekends: {
      type: Boolean,
      default: true,
    },
    firstDay: {
      type: Number,
      min: 0,
      max: 6,
      default: 0, // Sunday
    },
    timezone: {
      type: String,
      default: "local",
    },

    // Time settings
    businessHours: {
      enabled: {
        type: Boolean,
        default: true,
      },
      startTime: {
        type: String,
        default: "09:00",
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
      },
      endTime: {
        type: String,
        default: "17:00",
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
      },
      daysOfWeek: {
        type: [Number],
        default: [1, 2, 3, 4, 5], // Monday to Friday
        validate: {
          validator: function (days: number[]) {
            return days.every((day) => day >= 0 && day <= 6);
          },
          message: "Days of week must be between 0 (Sunday) and 6 (Saturday)",
        },
      },
    },

    slotDuration: {
      type: String,
      default: "00:30",
      match: /^[0-9]{2}:[0-5][0-9]$/,
    },
    snapDuration: {
      type: String,
      default: "00:15",
      match: /^[0-9]{2}:[0-5][0-9]$/,
    },
    defaultEventDuration: {
      type: String,
      default: "01:00",
      match: /^[0-9]{2}:[0-5][0-9]$/,
    },

    // Event preferences
    defaultEventType: {
      type: String,
      default: "GENERAL",
    },
    defaultEventPriority: {
      type: String,
      default: "MEDIUM",
    },
    defaultReminders: {
      type: [Number],
      default: [15], // 15 minutes before
    },

    // Notification preferences
    emailNotifications: {
      invitations: {
        type: Boolean,
        default: true,
      },
      reminders: {
        type: Boolean,
        default: true,
      },
      updates: {
        type: Boolean,
        default: true,
      },
      cancellations: {
        type: Boolean,
        default: true,
      },
    },

    // View preferences
    showWeekNumbers: {
      type: Boolean,
      default: false,
    },
    showDeclinedEvents: {
      type: Boolean,
      default: false,
    },
    eventLimit: {
      type: Number,
      default: 3,
      min: 1,
      max: 10,
    },

    // Color preferences
    eventColors: {
      type: Map,
      of: String,
      default: () =>
        new Map([
          ["LEASE_RENEWAL", "#3b82f6"],
          ["PROPERTY_INSPECTION", "#10b981"],
          ["MAINTENANCE_APPOINTMENT", "#f59e0b"],
          ["PROPERTY_SHOWING", "#8b5cf6"],
          ["TENANT_MEETING", "#6366f1"],
          ["RENT_COLLECTION", "#059669"],
          ["MOVE_IN", "#06b6d4"],
          ["MOVE_OUT", "#ef4444"],
          ["GENERAL", "#6b7280"],
        ]),
    },

    // Integration settings
    integrations: {
      googleCalendar: {
        enabled: {
          type: Boolean,
          default: false,
        },
        autoSync: {
          type: Boolean,
          default: false,
        },
        syncDirection: {
          type: String,
          enum: ["import", "export", "bidirectional"],
          default: "bidirectional",
        },
        selectedCalendarId: {
          type: String,
        },
        lastSync: {
          type: Date,
        },
      },
    },
  },
  {
    timestamps: true,
    collection: "calendar_settings",
    toJSON: {
      virtuals: true,
      transform: function (
        _doc,
        ret: Record<string, unknown> & { __v?: number }
      ) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes - userId index is already created by unique: true on line 68
// No additional indexes needed for this simple schema

// Static method to get or create settings for a user
CalendarSettingsSchema.statics.getOrCreateForUser = async function (
  userId: string
) {
  let settings = await this.findOne({ userId });

  if (!settings) {
    settings = await this.create({ userId });
  }

  return settings;
};

// Instance method to update specific setting
CalendarSettingsSchema.methods.updateSetting = function (
  path: string,
  value: any
) {
  this.set(path, value);
  return this.save();
};

// Instance method to reset to defaults
CalendarSettingsSchema.methods.resetToDefaults = function () {
  const schema = (this.constructor as mongoose.Model<ICalendarSettings>).schema;

  Object.keys(schema.paths).forEach((path) => {
    if (path !== "_id" && path !== "userId" && path !== "__v") {
      const schemaType = schema.paths[path];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const defaultValue = (schemaType as any).defaultValue;
      if (defaultValue !== undefined) {
        this.set(path, defaultValue);
      }
    }
  });

  return this.save();
};

// Create and export the model with safer initialization
let CalendarSettings: mongoose.Model<ICalendarSettings>;

try {
  // Try to get existing model first
  CalendarSettings = mongoose.model<ICalendarSettings>("CalendarSettings");
} catch {
  // Model doesn't exist, create it
  CalendarSettings = mongoose.model<ICalendarSettings>(
    "CalendarSettings",
    CalendarSettingsSchema
  );
}

export { CalendarSettings };

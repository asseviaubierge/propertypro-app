import mongoose, { Document, Model, Schema } from "mongoose";

export interface IUserSettingsHistory extends Document {
  userId: mongoose.Types.ObjectId;
  settingsType:
    | "display"
    | "notifications"
    | "security"
    | "privacy"
    | "profile";
  version: number;
  previousSettings: any;
  newSettings: any;
  changes: {
    field: string;
    previousValue: any;
    newValue: any;
    changeType: "added" | "modified" | "removed";
  }[];
  changeReason?: string;
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    sessionId?: string;
    source: "user" | "admin" | "system" | "import" | "reset";
    triggeredBy?: mongoose.Types.ObjectId;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSettingsHistorySchema = new Schema<IUserSettingsHistory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    settingsType: {
      type: String,
      enum: ["display", "notifications", "security", "privacy", "profile"],
      required: true,
    },
    version: {
      type: Number,
      required: true,
      min: 1,
    },
    previousSettings: {
      type: Schema.Types.Mixed,
      required: true,
    },
    newSettings: {
      type: Schema.Types.Mixed,
      required: true,
    },
    changes: [
      {
        field: {
          type: String,
          required: true,
        },
        previousValue: {
          type: Schema.Types.Mixed,
        },
        newValue: {
          type: Schema.Types.Mixed,
        },
        changeType: {
          type: String,
          enum: ["added", "modified", "removed"],
          required: true,
        },
      },
    ],
    changeReason: {
      type: String,
      maxlength: 500,
    },
    metadata: {
      userAgent: {
        type: String,
        maxlength: 1000,
      },
      ipAddress: {
        type: String,
        maxlength: 45,
      },
      sessionId: {
        type: String,
        maxlength: 100,
      },
      source: {
        type: String,
        enum: ["user", "admin", "system", "import", "reset"],
        required: true,
        default: "user",
      },
      triggeredBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "user_settings_history",
  }
);

// Compound indexes
userSettingsHistorySchema.index({ userId: 1, settingsType: 1, createdAt: -1 });
userSettingsHistorySchema.index({ userId: 1, version: -1 });
userSettingsHistorySchema.index({ createdAt: -1 });
userSettingsHistorySchema.index({ "metadata.source": 1, createdAt: -1 });

// Static methods
userSettingsHistorySchema.statics.createHistoryEntry = async function (
  userId: string,
  settingsType: string,
  previousSettings: any,
  newSettings: any,
  metadata: any = {}
) {
  const changes = calculateChanges(previousSettings, newSettings);

  const lastEntry = await this.findOne(
    { userId: new mongoose.Types.ObjectId(userId), settingsType },
    {},
    { sort: { version: -1 } }
  );

  const version = lastEntry ? lastEntry.version + 1 : 1;

  const historyEntry = new this({
    userId: new mongoose.Types.ObjectId(userId),
    settingsType,
    version,
    previousSettings,
    newSettings,
    changes,
    metadata: {
      source: "user",
      ...metadata,
    },
  });

  await historyEntry.save();
  await this.cleanupOldEntries(userId, settingsType, 50);

  return historyEntry;
};

userSettingsHistorySchema.statics.getHistory = async function (
  userId: string,
  settingsType?: string,
  options: {
    limit?: number;
    skip?: number;
    fromDate?: Date;
    toDate?: Date;
    source?: string;
  } = {}
) {
  const query: any = {
    userId: new mongoose.Types.ObjectId(userId),
    isActive: true,
  };

  if (settingsType) {
    query.settingsType = settingsType;
  }

  if (options.fromDate || options.toDate) {
    query.createdAt = {};
    if (options.fromDate) query.createdAt.$gte = options.fromDate;
    if (options.toDate) query.createdAt.$lte = options.toDate;
  }

  if (options.source) {
    query["metadata.source"] = options.source;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 20)
    .skip(options.skip || 0)
    .populate("metadata.triggeredBy", "firstName lastName email")
    .lean();
};

userSettingsHistorySchema.statics.getVersionHistory = async function (
  userId: string,
  settingsType: string,
  limit: number = 10
) {
  return this.find({
    userId: new mongoose.Types.ObjectId(userId),
    settingsType,
    isActive: true,
  })
    .sort({ version: -1 })
    .limit(limit)
    .select("version newSettings createdAt metadata.source changeReason")
    .lean();
};

userSettingsHistorySchema.statics.getSettingsByVersion = async function (
  userId: string,
  settingsType: string,
  version: number
) {
  const entry = await this.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    settingsType,
    version,
    isActive: true,
  });

  return entry ? entry.newSettings : null;
};

userSettingsHistorySchema.statics.cleanupOldEntries = async function (
  userId: string,
  settingsType: string,
  keepCount: number = 50
) {
  const entries = await this.find({
    userId: new mongoose.Types.ObjectId(userId),
    settingsType,
    isActive: true,
  })
    .sort({ version: -1 })
    .skip(keepCount)
    .select("_id");

  if (entries.length > 0) {
    const idsToDeactivate = entries.map((entry) => entry._id);
    await this.updateMany(
      { _id: { $in: idsToDeactivate } },
      { isActive: false }
    );
  }
};

// Helper function to calculate changes
function calculateChanges(
  previous: any,
  current: any,
  path: string = ""
): any[] {
  const changes: any[] = [];

  if (previous === null || previous === undefined) {
    if (current !== null && current !== undefined) {
      changes.push({
        field: path || "root",
        previousValue: previous,
        newValue: current,
        changeType: "added",
      });
    }
    return changes;
  }

  if (current === null || current === undefined) {
    changes.push({
      field: path || "root",
      previousValue: previous,
      newValue: current,
      changeType: "removed",
    });
    return changes;
  }

  if (typeof previous !== "object" || typeof current !== "object") {
    if (previous !== current) {
      changes.push({
        field: path || "root",
        previousValue: previous,
        newValue: current,
        changeType: "modified",
      });
    }
    return changes;
  }

  const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);

  for (const key of allKeys) {
    const newPath = path ? `${path}.${key}` : key;
    const prevValue = previous[key];
    const currValue = current[key];

    if (!(key in previous)) {
      changes.push({
        field: newPath,
        previousValue: undefined,
        newValue: currValue,
        changeType: "added",
      });
    } else if (!(key in current)) {
      changes.push({
        field: newPath,
        previousValue: prevValue,
        newValue: undefined,
        changeType: "removed",
      });
    } else {
      changes.push(...calculateChanges(prevValue, currValue, newPath));
    }
  }

  return changes;
}

const UserSettingsHistory: Model<IUserSettingsHistory> =
  (mongoose.models
    ?.UserSettingsHistory as mongoose.Model<IUserSettingsHistory>) ||
  mongoose.model<IUserSettingsHistory>(
    "UserSettingsHistory",
    userSettingsHistorySchema
  );

export default UserSettingsHistory;

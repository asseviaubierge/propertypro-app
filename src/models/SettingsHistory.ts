import mongoose, { Schema, Model } from "mongoose";
import { Types, Document } from "mongoose";

export interface ISettingsHistory extends Document {
  _id: Types.ObjectId;
  settingId: Types.ObjectId;
  category: string;
  key: string;
  action: "create" | "update" | "delete";
  oldValue?: any;
  newValue?: any;
  oldDataType?: string;
  newDataType?: string;
  changedBy: Types.ObjectId;
  changeReason?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: {
    source?: string; // 'ui', 'api', 'import', 'system'
    batchId?: string; // For bulk operations
    importFile?: string; // For import operations
  };
  createdAt: Date;
}

const SettingsHistorySchema = new Schema<ISettingsHistory>(
  {
    settingId: {
      type: Schema.Types.ObjectId,
      ref: "SystemSettings",
      required: [true, "Setting ID is required"],
      index: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      index: true,
    },
    key: {
      type: String,
      required: [true, "Setting key is required"],
      index: true,
    },
    action: {
      type: String,
      enum: ["create", "update", "delete"],
      required: [true, "Action is required"],
      index: true,
    },
    oldValue: {
      type: Schema.Types.Mixed,
    },
    newValue: {
      type: Schema.Types.Mixed,
    },
    oldDataType: {
      type: String,
    },
    newDataType: {
      type: String,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Changed by user is required"],
      index: true,
    },
    changeReason: {
      type: String,
      maxlength: [500, "Change reason cannot exceed 500 characters"],
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    metadata: {
      source: {
        type: String,
        enum: ["ui", "api", "import", "system"],
        default: "ui",
      },
      batchId: {
        type: String,
      },
      importFile: {
        type: String,
      },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "settings_history",
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Compound indexes for efficient queries
SettingsHistorySchema.index({ settingId: 1, createdAt: -1 });
SettingsHistorySchema.index({ category: 1, key: 1, createdAt: -1 });
SettingsHistorySchema.index({ changedBy: 1, createdAt: -1 });
SettingsHistorySchema.index({ action: 1, createdAt: -1 });
SettingsHistorySchema.index({ "metadata.source": 1, createdAt: -1 });

// Virtual for user reference
SettingsHistorySchema.virtual("changedByUser", {
  ref: "User",
  localField: "changedBy",
  foreignField: "_id",
  justOne: true,
});

// Virtual for setting reference
SettingsHistorySchema.virtual("setting", {
  ref: "SystemSettings",
  localField: "settingId",
  foreignField: "_id",
  justOne: true,
});

// Static methods
SettingsHistorySchema.statics.getSettingHistory = function (
  settingId: string,
  limit: number = 50
) {
  return this.find({ settingId })
    .populate("changedByUser", "firstName lastName email")
    .sort({ createdAt: -1 })
    .limit(limit);
};

SettingsHistorySchema.statics.getUserActivity = function (
  userId: string,
  limit: number = 50
) {
  return this.find({ changedBy: userId })
    .populate("setting", "category key description")
    .sort({ createdAt: -1 })
    .limit(limit);
};

SettingsHistorySchema.statics.getCategoryHistory = function (
  category: string,
  limit: number = 100
) {
  return this.find({ category })
    .populate("changedByUser", "firstName lastName email")
    .populate("setting", "key description")
    .sort({ createdAt: -1 })
    .limit(limit);
};

SettingsHistorySchema.statics.getRecentActivity = function (
  hours: number = 24,
  limit: number = 100
) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({ createdAt: { $gte: since } })
    .populate("changedByUser", "firstName lastName email")
    .populate("setting", "category key description")
    .sort({ createdAt: -1 })
    .limit(limit);
};

SettingsHistorySchema.statics.getBulkOperations = function (
  limit: number = 50
) {
  return this.aggregate([
    {
      $match: {
        "metadata.batchId": { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: "$metadata.batchId",
        count: { $sum: 1 },
        actions: { $addToSet: "$action" },
        categories: { $addToSet: "$category" },
        changedBy: { $first: "$changedBy" },
        source: { $first: "$metadata.source" },
        createdAt: { $first: "$createdAt" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "changedBy",
        foreignField: "_id",
        as: "changedByUser",
      },
    },
    {
      $unwind: "$changedByUser",
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $limit: limit,
    },
  ]);
};

// Instance methods
SettingsHistorySchema.methods.getValueDiff = function () {
  if (this.action === "create") {
    return {
      type: "create",
      value: this.newValue,
    };
  }

  if (this.action === "delete") {
    return {
      type: "delete",
      value: this.oldValue,
    };
  }

  if (this.action === "update") {
    return {
      type: "update",
      from: this.oldValue,
      to: this.newValue,
      changed: this.oldValue !== this.newValue,
    };
  }

  return null;
};

SettingsHistorySchema.methods.getDisplayValue = function (value: any) {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
};

// Helper function to create history entry
export async function createSettingsHistory(
  settingId: string,
  category: string,
  key: string,
  action: "create" | "update" | "delete",
  changedBy: string,
  options: {
    oldValue?: any;
    newValue?: any;
    oldDataType?: string;
    newDataType?: string;
    changeReason?: string;
    ipAddress?: string;
    userAgent?: string;
    source?: string;
    batchId?: string;
    importFile?: string;
  } = {}
) {
  try {
    await SettingsHistory.create({
      settingId,
      category,
      key,
      action,
      changedBy,
      oldValue: options.oldValue,
      newValue: options.newValue,
      oldDataType: options.oldDataType,
      newDataType: options.newDataType,
      changeReason: options.changeReason,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      metadata: {
        source: options.source || "ui",
        batchId: options.batchId,
        importFile: options.importFile,
      },
    });
  } catch (error) {
    console.error("Failed to create settings history:", error);
    // Don't throw error to avoid breaking the main operation
  }
}

// Create and export the model
const SettingsHistory: Model<ISettingsHistory> =
  mongoose.models?.SettingsHistory ||
  mongoose.model<ISettingsHistory>("SettingsHistory", SettingsHistorySchema);

export default SettingsHistory;

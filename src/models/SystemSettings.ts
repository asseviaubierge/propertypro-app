import mongoose, { Schema, Model } from "mongoose";
import { ISystemSettings } from "@/types";

const SystemSettingsSchema = new Schema<ISystemSettings>(
  {
    category: {
      type: String,
      enum: [
        "general",
        "email",
        "payment",
        "maintenance",
        "security",
        "branding",
        "appearance",
        "localization",
        "notifications",
        "integrations",
      ],
      required: [true, "Category is required"],
      index: true,
    },
    key: {
      type: String,
      required: [true, "Setting key is required"],
      trim: true,
      maxlength: [100, "Key cannot exceed 100 characters"],
    },
    value: {
      type: Schema.Types.Mixed,
      required: [true, "Setting value is required"],
    },
    dataType: {
      type: String,
      enum: [
        "string",
        "number",
        "boolean",
        "object",
        "array",
        "file",
        "url",
        "color",
        "json",
      ],
      required: [true, "Data type is required"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    isPublic: {
      type: Boolean,
      default: false,
      required: true,
    },
    isEditable: {
      type: Boolean,
      default: true,
      required: true,
    },
    validationRules: {
      required: { type: Boolean, default: false },
      min: { type: Number },
      max: { type: Number },
      pattern: { type: String },
      enum: [{ type: String }],
      fileTypes: [{ type: String }], // For file uploads
      maxFileSize: { type: Number }, // In bytes
      minLength: { type: Number },
      maxLength: { type: Number },
    },
    metadata: {
      group: { type: String }, // For grouping related settings
      order: { type: Number, default: 0 }, // For ordering within category
      helpText: { type: String }, // Additional help text
      icon: { type: String }, // Icon name for UI
      tags: [{ type: String }], // For search and filtering
      dependencies: [{ type: String }], // Settings that depend on this one
    },
    lastModifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Last modified by is required"],
    },
  },
  {
    timestamps: true,
    collection: "system_settings",
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

// Compound index for category and key (unique combination)
SystemSettingsSchema.index({ category: 1, key: 1 }, { unique: true });
SystemSettingsSchema.index({ isPublic: 1 });
SystemSettingsSchema.index({ isEditable: 1 });
SystemSettingsSchema.index({ lastModifiedBy: 1 });

// Virtual for user reference
SystemSettingsSchema.virtual("lastModifiedByUser", {
  ref: "User",
  localField: "lastModifiedBy",
  foreignField: "_id",
  justOne: true,
});

// Instance methods
SystemSettingsSchema.methods.updateValue = function (
  newValue: any,
  modifiedBy: string
) {
  this.value = newValue;
  this.lastModifiedBy = modifiedBy;
  return this.save();
};

SystemSettingsSchema.methods.isValidValue = function (value: any): boolean {
  const rules = this.validationRules;

  if (
    rules?.required &&
    (value === null || value === undefined || value === "")
  ) {
    return false;
  }

  if (
    rules?.min !== undefined &&
    typeof value === "number" &&
    value < rules.min
  ) {
    return false;
  }

  if (
    rules?.max !== undefined &&
    typeof value === "number" &&
    value > rules.max
  ) {
    return false;
  }

  if (rules?.pattern && typeof value === "string") {
    const regex = new RegExp(rules.pattern);
    if (!regex.test(value)) {
      return false;
    }
  }

  if (rules?.enum && rules.enum.length > 0 && !rules.enum.includes(value)) {
    return false;
  }

  return true;
};

// Static methods
SystemSettingsSchema.statics.findByCategory = function (category: string) {
  return this.find({ category }).populate("lastModifiedByUser");
};

SystemSettingsSchema.statics.findPublicSettings = function () {
  return this.find({ isPublic: true });
};

SystemSettingsSchema.statics.findEditableSettings = function () {
  return this.find({ isEditable: true });
};

SystemSettingsSchema.statics.getSetting = function (
  category: string,
  key: string
) {
  return this.findOne({ category, key });
};

SystemSettingsSchema.statics.setSetting = function (
  category: string,
  key: string,
  value: any,
  modifiedBy: string,
  options?: Partial<ISystemSettings>
) {
  return this.findOneAndUpdate(
    { category, key },
    {
      value,
      lastModifiedBy: modifiedBy,
      ...options,
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
    }
  );
};

SystemSettingsSchema.statics.getSettingValue = async function (
  category: string,
  key: string,
  defaultValue?: any
) {
  const setting = await this.findOne({ category, key });
  return setting ? setting.value : defaultValue;
};

SystemSettingsSchema.statics.findByGroup = function (group: string) {
  return this.find({ "metadata.group": group }).populate("lastModifiedByUser");
};

SystemSettingsSchema.statics.findByTags = function (tags: string[]) {
  return this.find({ "metadata.tags": { $in: tags } }).populate(
    "lastModifiedByUser"
  );
};

SystemSettingsSchema.statics.searchSettings = function (searchTerm: string) {
  const regex = new RegExp(searchTerm, "i");
  return this.find({
    $or: [
      { key: regex },
      { description: regex },
      { "metadata.helpText": regex },
      { "metadata.tags": regex },
    ],
  }).populate("lastModifiedByUser");
};

SystemSettingsSchema.statics.getBrandingSettings = function () {
  return this.find({ category: "branding" }).populate("lastModifiedByUser");
};

SystemSettingsSchema.statics.getPublicBrandingSettings = function () {
  return this.find({ category: "branding", isPublic: true });
};

// Pre-save middleware
SystemSettingsSchema.pre("save", async function (next) {
  // Track changes for history
  if (this.isModified() && !this.isNew) {
    const original = await this.constructor.findById(this._id);
    if (original) {
      // Store original values for history tracking
      this.$locals.originalValue = original.value;
      this.$locals.originalDataType = original.dataType;
    }
  }

  // Validate value against data type
  const value = this.value;
  const dataType = this.dataType;

  switch (dataType) {
    case "string":
      if (typeof value !== "string") {
        return next(new Error("Value must be a string"));
      }
      break;
    case "number":
      if (typeof value !== "number" || isNaN(value)) {
        return next(new Error("Value must be a number"));
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        return next(new Error("Value must be a boolean"));
      }
      break;
    case "object":
      if (typeof value !== "object" || Array.isArray(value) || value === null) {
        return next(new Error("Value must be an object"));
      }
      break;
    case "array":
      if (!Array.isArray(value)) {
        return next(new Error("Value must be an array"));
      }
      break;
    case "file":
      if (typeof value !== "string" && typeof value !== "object") {
        return next(
          new Error("File value must be a string (URL) or object (file info)")
        );
      }
      break;
    case "url":
      if (typeof value !== "string") {
        return next(new Error("URL value must be a string"));
      }
      try {
        new URL(value);
      } catch {
        return next(new Error("Value must be a valid URL"));
      }
      break;
    case "color":
      if (typeof value !== "string") {
        return next(new Error("Color value must be a string"));
      }
      // Basic hex color validation
      if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)) {
        return next(new Error("Color value must be a valid hex color"));
      }
      break;
    case "json":
      if (typeof value === "string") {
        try {
          JSON.parse(value);
        } catch {
          return next(new Error("JSON value must be valid JSON string"));
        }
      } else if (typeof value !== "object") {
        return next(
          new Error("JSON value must be an object or valid JSON string")
        );
      }
      break;
  }

  // Validate against custom rules
  if (!this.isValidValue(value)) {
    return next(new Error("Value does not meet validation requirements"));
  }

  next();
});

// Post-save middleware to create history entries
SystemSettingsSchema.post("save", async function (doc) {
  try {
    const { createSettingsHistory } = await import("./SettingsHistory");

    const action =
      doc.$locals.originalValue !== undefined ? "update" : "create";

    await createSettingsHistory(
      doc._id.toString(),
      doc.category,
      doc.key,
      action,
      doc.lastModifiedBy.toString(),
      {
        oldValue: doc.$locals.originalValue,
        newValue: doc.value,
        oldDataType: doc.$locals.originalDataType,
        newDataType: doc.dataType,
        source: doc.$locals.source || "ui",
        batchId: doc.$locals.batchId,
      }
    );
  } catch (error) {
    console.error("Failed to create settings history:", error);
  }
});

// Post-remove middleware to create history entries
SystemSettingsSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    try {
      const { createSettingsHistory } = await import("./SettingsHistory");

      await createSettingsHistory(
        doc._id.toString(),
        doc.category,
        doc.key,
        "delete",
        doc.lastModifiedBy.toString(),
        {
          oldValue: doc.value,
          oldDataType: doc.dataType,
          source: doc.$locals?.source || "ui",
          batchId: doc.$locals?.batchId,
        }
      );
    } catch (error) {
      console.error("Failed to create settings history:", error);
    }
  }
});

// Create and export the model with safer initialization
let SystemSettings: Model<ISystemSettings>;

try {
  // Try to get existing model first
  SystemSettings = mongoose.model<ISystemSettings>("SystemSettings");
} catch (error) {
  // Model doesn't exist, create it
  SystemSettings = mongoose.model<ISystemSettings>(
    "SystemSettings",
    SystemSettingsSchema
  );
}

export default SystemSettings;

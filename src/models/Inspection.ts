import mongoose, { Schema, Model } from "mongoose";
import { IInspection, IInspectionItem, InspectionType } from "@/types";

// Inspection Item Schema
const InspectionItemSchema = new Schema<IInspectionItem>({
  room: {
    type: String,
    required: [true, "Room is required"],
    trim: true,
    maxlength: [100, "Room name too long"],
  },
  item: {
    type: String,
    required: [true, "Item is required"],
    trim: true,
    maxlength: [200, "Item description too long"],
  },
  condition: {
    type: String,
    required: [true, "Condition is required"],
    enum: ["excellent", "good", "fair", "poor", "damaged"],
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, "Notes too long"],
  },
  photos: {
    type: [String],
    default: [],
    validate: {
      validator: function (photos: string[]) {
        return photos.length <= 10;
      },
      message: "Cannot have more than 10 photos per item",
    },
  },
  requiresAttention: {
    type: Boolean,
    default: false,
  },
});

// Signature Schema
const SignatureSchema = new Schema({
  signedAt: {
    type: Date,
    required: [true, "Signature date is required"],
    default: Date.now,
  },
  signature: {
    type: String,
    required: [true, "Signature data is required"],
  },
  ipAddress: {
    type: String,
    trim: true,
  },
});

// Main Inspection Schema
const InspectionSchema = new Schema<IInspection>(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: [true, "Property ID is required"],
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
    },
    leaseId: {
      type: Schema.Types.ObjectId,
      ref: "Lease",
    },
    type: {
      type: String,
      enum: Object.values(InspectionType),
      required: [true, "Inspection type is required"],
    },
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "cancelled"],
      default: "scheduled",
      required: [true, "Inspection status is required"],
    },
    scheduledDate: {
      type: Date,
      required: [true, "Scheduled date is required"],
    },
    completedDate: {
      type: Date,
    },
    inspectorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Inspector ID is required"],
    },
    items: {
      type: [InspectionItemSchema],
      default: [],
      validate: {
        validator: function (items: IInspectionItem[]) {
          return items.length <= 200;
        },
        message: "Cannot have more than 200 inspection items",
      },
    },
    overallCondition: {
      type: String,
      enum: ["excellent", "good", "fair", "poor"],
      required: function () {
        return this.status === "completed";
      },
    },
    tenantSignature: {
      type: SignatureSchema,
    },
    inspectorSignature: {
      type: SignatureSchema,
    },
    photos: {
      type: [String],
      default: [],
      validate: {
        validator: function (photos: string[]) {
          return photos.length <= 50;
        },
        message: "Cannot have more than 50 photos",
      },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, "Notes too long"],
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete (ret as any).__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  },
);

// Indexes for better query performance
InspectionSchema.index({ propertyId: 1, type: 1 });
InspectionSchema.index({ tenantId: 1 });
InspectionSchema.index({ leaseId: 1 });
InspectionSchema.index({ inspectorId: 1 });
InspectionSchema.index({ status: 1, scheduledDate: 1 });
InspectionSchema.index({ deletedAt: 1 });

// Virtual for inspection duration
InspectionSchema.virtual("duration").get(function () {
  if (!this.completedDate) return null;
  const startTime = this.createdAt.getTime();
  const endTime = this.completedDate.getTime();
  return Math.floor((endTime - startTime) / (1000 * 60)); // Duration in minutes
});

// Virtual for items requiring attention
InspectionSchema.virtual("itemsRequiringAttention").get(function () {
  return this.items.filter((item: IInspectionItem) => item.requiresAttention);
});

// Virtual for completion percentage
InspectionSchema.virtual("completionPercentage").get(function () {
  if (this.items.length === 0) return 0;
  const completedItems = this.items.filter(
    (item: IInspectionItem) => item.condition,
  );
  return Math.round((completedItems.length / this.items.length) * 100);
});

// Instance method to start inspection
InspectionSchema.methods.start = function () {
  this.status = "in_progress";
  return this.save();
};

// Instance method to complete inspection
InspectionSchema.methods.complete = function (
  overallCondition: string,
  notes?: string,
) {
  this.status = "completed";
  this.completedDate = new Date();
  this.overallCondition = overallCondition;
  if (notes) this.notes = notes;
  return this.save();
};

// Instance method to cancel inspection
InspectionSchema.methods.cancel = function (reason?: string) {
  this.status = "cancelled";
  if (reason) this.notes = reason;
  return this.save();
};

// Instance method to add signature
InspectionSchema.methods.addTenantSignature = function (
  signature: string,
  ipAddress?: string,
) {
  this.tenantSignature = {
    signedAt: new Date(),
    signature,
    ipAddress,
  };
  return this.save();
};

InspectionSchema.methods.addInspectorSignature = function (signature: string) {
  this.inspectorSignature = {
    signedAt: new Date(),
    signature,
  };
  return this.save();
};

// Instance method to add inspection item
InspectionSchema.methods.addItem = function (item: IInspectionItem) {
  this.items.push(item);
  return this.save();
};

// Instance method to update item condition
InspectionSchema.methods.updateItemCondition = function (
  itemIndex: number,
  condition: string,
  notes?: string,
  photos?: string[],
) {
  if (itemIndex >= 0 && itemIndex < this.items.length) {
    this.items[itemIndex].condition = condition;
    if (notes) this.items[itemIndex].notes = notes;
    if (photos) this.items[itemIndex].photos = photos;
    this.items[itemIndex].requiresAttention = ["poor", "damaged"].includes(
      condition,
    );
  }
  return this.save();
};

// Query middleware to exclude soft deleted documents
InspectionSchema.pre(/^find/, function () {
  // @ts-ignore
  this.find({ deletedAt: null });
});

// Pre-save middleware for validation
InspectionSchema.pre("save", async function (next) {
  // Validate property exists
  if (this.isModified("propertyId")) {
    const Property = mongoose.model("Property");
    const property = await Property.findById(this.propertyId);

    if (!property) {
      return next(new Error("Property not found"));
    }
  }

  // Validate tenant exists if provided
  if (this.isModified("tenantId") && this.tenantId) {
    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findById(this.tenantId);

    if (!tenant) {
      return next(new Error("Tenant not found"));
    }
  }

  // Validate lease exists if provided
  if (this.isModified("leaseId") && this.leaseId) {
    const Lease = mongoose.model("Lease");
    const lease = await Lease.findById(this.leaseId);

    if (!lease) {
      return next(new Error("Lease not found"));
    }
  }

  // Validate inspector exists and has appropriate role
  if (this.isModified("inspectorId")) {
    const User = mongoose.model("User");
    const inspector = await User.findById(this.inspectorId);

    if (!inspector) {
      return next(new Error("Inspector not found"));
    }

    const allowedInspectorRoles = new Set([
      // Current roles used across the app
      "admin",
      "manager",
      // Backward compatibility for legacy role values
      "property_manager",
      "maintenance_staff",
      "super_admin",
    ]);

    if (!allowedInspectorRoles.has(String(inspector.role))) {
      return next(new Error("Invalid inspector role"));
    }
  }

  // Validate scheduled date is not in the past (for new inspections)
  if (this.isNew && this.scheduledDate < new Date()) {
    return next(new Error("Scheduled date cannot be in the past"));
  }

  next();
});

// Create and export the model
const Inspection: Model<IInspection> =
  mongoose.models?.Inspection ||
  mongoose.model<IInspection>("Inspection", InspectionSchema);

export default Inspection;

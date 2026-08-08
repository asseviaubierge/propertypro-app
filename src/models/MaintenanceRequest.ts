import mongoose, { Schema, Model } from "mongoose";
import {
  IMaintenanceRequest,
  MaintenancePriority,
  MaintenanceStatus,
} from "@/types";
import {
  isMaintenanceAssignableRole,
  isTenantAccessRole,
} from "@/lib/model-access";

const MaintenanceRequestSchema = new Schema<IMaintenanceRequest>(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: [true, "Property ID is required"],
    },
    unitId: {
      type: Schema.Types.ObjectId,
      required: false,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Tenant ID is required"],
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    priority: {
      type: String,
      enum: Object.values(MaintenancePriority),
      default: MaintenancePriority.MEDIUM,
      required: [true, "Priority is required"],
    },
    status: {
      type: String,
      enum: Object.values(MaintenanceStatus),
      default: MaintenanceStatus.SUBMITTED,
      required: [true, "Status is required"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      enum: [
        "Plumbing",
        "Electrical",
        "HVAC",
        "Appliances",
        "Flooring",
        "Painting",
        "Roofing",
        "Windows",
        "Doors",
        "Landscaping",
        "Cleaning",
        "Pest Control",
        "Security",
        "General Repair",
        "Emergency",
        "Other",
      ],
    },
    contactPhone: {
      type: String,
      trim: true,
      maxlength: [20, "Contact phone cannot exceed 20 characters"],
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: function (images: string[]) {
          return images.length <= 10;
        },
        message: "Cannot have more than 10 images",
      },
    },
    estimatedCost: {
      type: Number,
      min: [0, "Estimated cost cannot be negative"],
      max: [100000, "Estimated cost cannot exceed $100,000"],
    },
    actualCost: {
      type: Number,
      min: [0, "Actual cost cannot be negative"],
      max: [100000, "Actual cost cannot exceed $100,000"],
    },
    scheduledDate: {
      type: Date,
      validate: {
        validator: function (date: Date) {
          if (!date) return true; // Optional field
          // Allow dates from today onwards (ignore time)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const scheduledDay = new Date(date);
          scheduledDay.setHours(0, 0, 0, 0);
          return scheduledDay >= today;
        },
        message: "Scheduled date cannot be in the past",
      },
    },
    completedDate: {
      type: Date,
      validate: {
        validator: function (date: Date) {
          if (!date) return true; // Optional field
          return date >= this.createdAt;
        },
        message: "Completed date cannot be before request creation",
      },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
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
  }
);

// Indexes for performance
MaintenanceRequestSchema.index({ propertyId: 1 });
MaintenanceRequestSchema.index({ tenantId: 1 });
MaintenanceRequestSchema.index({ assignedTo: 1 });
MaintenanceRequestSchema.index({ status: 1 });
MaintenanceRequestSchema.index({ priority: 1 });
MaintenanceRequestSchema.index({ category: 1 });
MaintenanceRequestSchema.index({ scheduledDate: 1 });
MaintenanceRequestSchema.index({ completedDate: 1 });
MaintenanceRequestSchema.index({ deletedAt: 1 });
MaintenanceRequestSchema.index({ createdAt: -1 });

// Compound indexes for common queries
MaintenanceRequestSchema.index({ propertyId: 1, status: 1 });
MaintenanceRequestSchema.index({ tenantId: 1, status: 1 });
MaintenanceRequestSchema.index({ assignedTo: 1, status: 1 });
MaintenanceRequestSchema.index({ status: 1, priority: 1 });
MaintenanceRequestSchema.index({ category: 1, status: 1 });

// Virtual for days since creation
MaintenanceRequestSchema.virtual("daysSinceCreation").get(function () {
  const now = new Date();
  const created = this.createdAt;
  const diff = now.getTime() - created.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
});

// Virtual for days to completion
MaintenanceRequestSchema.virtual("daysToCompletion").get(function () {
  if (!this.completedDate) return null;
  const completed = this.completedDate;
  const created = this.createdAt;
  const diff = completed.getTime() - created.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
});

// Virtual for is overdue (based on priority)
MaintenanceRequestSchema.virtual("isOverdue").get(function () {
  if (
    this.status === MaintenanceStatus.COMPLETED ||
    this.status === MaintenanceStatus.CANCELLED
  ) {
    return false;
  }

  const daysSinceCreation = (this as any).daysSinceCreation;

  switch (this.priority) {
    case MaintenancePriority.EMERGENCY:
      return daysSinceCreation > 1; // 1 day
    case MaintenancePriority.HIGH:
      return daysSinceCreation > 3; // 3 days
    case MaintenancePriority.MEDIUM:
      return daysSinceCreation > 7; // 1 week
    case MaintenancePriority.LOW:
      return daysSinceCreation > 14; // 2 weeks
    default:
      return false;
  }
});

// Virtual for priority color
MaintenanceRequestSchema.virtual("priorityColor").get(function () {
  switch (this.priority) {
    case MaintenancePriority.EMERGENCY:
      return "red";
    case MaintenancePriority.HIGH:
      return "orange";
    case MaintenancePriority.MEDIUM:
      return "yellow";
    case MaintenancePriority.LOW:
      return "green";
    default:
      return "gray";
  }
});

// Virtual for status color
MaintenanceRequestSchema.virtual("statusColor").get(function () {
  switch (this.status) {
    case MaintenanceStatus.SUBMITTED:
      return "blue";
    case MaintenanceStatus.ASSIGNED:
      return "purple";
    case MaintenanceStatus.IN_PROGRESS:
      return "orange";
    case MaintenanceStatus.COMPLETED:
      return "green";
    case MaintenanceStatus.CANCELLED:
      return "red";
    default:
      return "gray";
  }
});

// Virtual for cost variance
MaintenanceRequestSchema.virtual("costVariance").get(function () {
  if (!this.estimatedCost || !this.actualCost) return null;
  return this.actualCost - this.estimatedCost;
});

// Virtual for cost variance percentage
MaintenanceRequestSchema.virtual("costVariancePercentage").get(function () {
  if (!this.estimatedCost || !this.actualCost) return null;
  if (this.estimatedCost === 0) return null;
  return ((this.actualCost - this.estimatedCost) / this.estimatedCost) * 100;
});

// Static method to find by status
MaintenanceRequestSchema.statics.findByStatus = function (
  status: MaintenanceStatus
) {
  return this.find({
    status,
    deletedAt: null,
  });
};

// Static method to find by priority
MaintenanceRequestSchema.statics.findByPriority = function (
  priority: MaintenancePriority
) {
  return this.find({
    priority,
    deletedAt: null,
  });
};

// Static method to find by property
MaintenanceRequestSchema.statics.findByProperty = function (
  propertyId: string
) {
  return this.find({
    propertyId,
    deletedAt: null,
  });
};

// Static method to find by tenant
MaintenanceRequestSchema.statics.findByTenant = function (tenantId: string) {
  return this.find({
    tenantId,
    deletedAt: null,
  });
};

// Static method to find assigned to user
MaintenanceRequestSchema.statics.findAssignedTo = function (userId: string) {
  return this.find({
    assignedTo: userId,
    deletedAt: null,
  });
};

// Static method to find overdue requests
MaintenanceRequestSchema.statics.findOverdue = function () {
  const now = new Date();
  const emergencyDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
  const highDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
  const mediumDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 1 week ago
  const lowDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 2 weeks ago

  return this.find({
    status: {
      $nin: [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
    },
    $or: [
      {
        priority: MaintenancePriority.EMERGENCY,
        createdAt: { $lt: emergencyDate },
      },
      { priority: MaintenancePriority.HIGH, createdAt: { $lt: highDate } },
      { priority: MaintenancePriority.MEDIUM, createdAt: { $lt: mediumDate } },
      { priority: MaintenancePriority.LOW, createdAt: { $lt: lowDate } },
    ],
    deletedAt: null,
  });
};

// Instance method for soft delete
MaintenanceRequestSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

// Instance method to restore soft deleted request
MaintenanceRequestSchema.methods.restore = function () {
  this.deletedAt = null;
  return this.save();
};

// Instance method to assign to user
MaintenanceRequestSchema.methods.assignTo = function (userId: string) {
  this.assignedTo = new mongoose.Types.ObjectId(userId);
  this.status = MaintenanceStatus.ASSIGNED;
  return this.save();
};

// Instance method to start work
MaintenanceRequestSchema.methods.startWork = function () {
  this.status = MaintenanceStatus.IN_PROGRESS;
  return this.save();
};

// Instance method to complete work
MaintenanceRequestSchema.methods.complete = function (
  actualCost?: number,
  notes?: string
) {
  this.status = MaintenanceStatus.COMPLETED;
  this.completedDate = new Date();
  if (actualCost !== undefined) this.actualCost = actualCost;
  if (notes) this.notes = notes;
  return this.save();
};

// Instance method to cancel request
MaintenanceRequestSchema.methods.cancel = function (reason?: string) {
  this.status = MaintenanceStatus.CANCELLED;
  if (reason) this.notes = reason;
  return this.save();
};

// Query middleware to exclude soft deleted documents
MaintenanceRequestSchema.pre(/^find/, function () {
  // @ts-ignore
  this.find({ deletedAt: null });
});

// Pre-save middleware for validation
MaintenanceRequestSchema.pre("save", async function (next) {
  // Validate property exists
  if (this.isModified("propertyId")) {
    const Property = mongoose.model("Property");
    const property = await Property.findById(this.propertyId);

    if (!property) {
      return next(new Error("Property not found"));
    }
  }

  // Validate tenant exists (tenantId references User model with role 'tenant')
  if (this.isModified("tenantId")) {
    const User = mongoose.model("User");
    const tenant = await User.findById(this.tenantId).select("role");

    if (!tenant || !(await isTenantAccessRole(tenant.role))) {
      return next(
        new Error("Tenant not found or user does not have tenant role")
      );
    }
  }

  // Validate assigned user exists and has appropriate role
  if (this.isModified("assignedTo") && this.assignedTo) {
    const User = mongoose.model("User");
    const user = await User.findById(this.assignedTo);

    if (!user) {
      return next(new Error("Assigned user not found"));
    }

    if (!(await isMaintenanceAssignableRole(user.role))) {
      return next(new Error("User cannot be assigned maintenance requests"));
    }
  }

  next();
});

// Create and export the model
// Delete the model if it exists to ensure we use the latest schema (crucial for hot reloading)
if (mongoose.models.MaintenanceRequest) {
  delete mongoose.models.MaintenanceRequest;
}

const MaintenanceRequest = mongoose.model<IMaintenanceRequest>(
  "MaintenanceRequest",
  MaintenanceRequestSchema
);

export default MaintenanceRequest;

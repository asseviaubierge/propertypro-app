import mongoose, { Schema, Model } from "mongoose";
import { IWorkOrder, WorkOrderStatus, MaintenancePriority } from "@/types";

const WorkOrderSchema = new Schema<IWorkOrder>(
  {
    maintenanceRequestId: {
      type: Schema.Types.ObjectId,
      ref: "MaintenanceRequest",
      required: true,
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: Object.values(WorkOrderStatus),
      default: WorkOrderStatus.PENDING,
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(MaintenancePriority),
      default: MaintenancePriority.MEDIUM,
      required: true,
      index: true,
    },
    estimatedCost: {
      type: Number,
      min: 0,
      validate: {
        validator: function (v: number) {
          return v >= 0;
        },
        message: "Estimated cost must be non-negative",
      },
    },
    actualCost: {
      type: Number,
      min: 0,
      validate: {
        validator: function (v: number) {
          return v >= 0;
        },
        message: "Actual cost must be non-negative",
      },
    },
    scheduledDate: {
      type: Date,
      index: true,
    },
    completedDate: {
      type: Date,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    materials: [
      {
        type: String,
        trim: true,
        maxlength: 200,
      },
    ],
    laborHours: {
      type: Number,
      min: 0,
      validate: {
        validator: function (v: number) {
          return v >= 0;
        },
        message: "Labor hours must be non-negative",
      },
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
WorkOrderSchema.index({ maintenanceRequestId: 1, status: 1 });
WorkOrderSchema.index({ assignedTo: 1, status: 1 });
WorkOrderSchema.index({ createdAt: -1 });
WorkOrderSchema.index({ scheduledDate: 1, status: 1 });
WorkOrderSchema.index({ deletedAt: 1, status: 1 });

// Virtual for maintenance request details
WorkOrderSchema.virtual("maintenanceRequest", {
  ref: "MaintenanceRequest",
  localField: "maintenanceRequestId",
  foreignField: "_id",
  justOne: true,
});

// Virtual for assigned user details
WorkOrderSchema.virtual("assignedUser", {
  ref: "User",
  localField: "assignedTo",
  foreignField: "_id",
  justOne: true,
});

// Pre-save middleware for validation
WorkOrderSchema.pre("save", function (next) {
  // Validate completed date is after scheduled date if both exist
  if (
    this.scheduledDate &&
    this.completedDate &&
    this.completedDate < this.scheduledDate
  ) {
    next(new Error("Completed date cannot be before scheduled date"));
    return;
  }

  // Set completed date when status changes to completed
  if (this.status === WorkOrderStatus.COMPLETED && !this.completedDate) {
    this.completedDate = new Date();
  }

  // Clear completed date if status is not completed
  if (this.status !== WorkOrderStatus.COMPLETED && this.completedDate) {
    this.completedDate = undefined;
  }

  next();
});

// Static methods
WorkOrderSchema.statics.findActive = function () {
  return this.find({ deletedAt: null });
};

WorkOrderSchema.statics.findByStatus = function (status: WorkOrderStatus) {
  return this.find({ status, deletedAt: null });
};

WorkOrderSchema.statics.findByAssignee = function (assignedTo: string) {
  return this.find({ assignedTo, deletedAt: null });
};

WorkOrderSchema.statics.findByMaintenanceRequest = function (
  maintenanceRequestId: string
) {
  return this.find({ maintenanceRequestId, deletedAt: null });
};

// Instance methods
WorkOrderSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

WorkOrderSchema.methods.restore = function () {
  this.deletedAt = null;
  return this.save();
};

WorkOrderSchema.methods.markCompleted = function () {
  this.status = WorkOrderStatus.COMPLETED;
  this.completedDate = new Date();
  return this.save();
};

WorkOrderSchema.methods.assignTo = function (userId: string) {
  this.assignedTo = new mongoose.Types.ObjectId(userId);
  if (this.status === WorkOrderStatus.PENDING) {
    this.status = WorkOrderStatus.ASSIGNED;
  }
  return this.save();
};

// Export the model
const WorkOrder: Model<IWorkOrder> =
  mongoose.models?.WorkOrder ||
  mongoose.model<IWorkOrder>("WorkOrder", WorkOrderSchema);

export default WorkOrder;

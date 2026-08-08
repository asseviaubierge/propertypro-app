import mongoose, { Schema, Model } from "mongoose";
import {
  ITicket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from "@/types";

const TicketCommentSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    message: {
      type: String,
      required: [true, "Comment message is required"],
      trim: true,
      maxlength: [2000, "Comment cannot exceed 2000 characters"],
    },
    attachments: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.length <= 5,
        message: "Maximum 5 attachments per comment",
      },
    },
    isInternal: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const TicketSchema = new Schema<ITicket>(
  {
    ticketNumber: {
      type: String,
      unique: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Tenant ID is required"],
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
    },
    unitId: {
      type: Schema.Types.ObjectId,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Creator user ID is required"],
      },
      role: {
        type: String,
        required: [true, "Creator role is required"],
      },
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
      maxlength: [3000, "Description cannot exceed 3000 characters"],
    },
    category: {
      type: String,
      enum: Object.values(TicketCategory),
      required: [true, "Category is required"],
    },
    priority: {
      type: String,
      enum: Object.values(TicketPriority),
      default: TicketPriority.MEDIUM,
      required: [true, "Priority is required"],
    },
    status: {
      type: String,
      enum: Object.values(TicketStatus),
      default: TicketStatus.OPEN,
      required: [true, "Status is required"],
    },
    attachments: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.length <= 10,
        message: "Maximum 10 attachments allowed",
      },
    },
    comments: {
      type: [TicketCommentSchema],
      default: [],
    },
    resolvedAt: {
      type: Date,
    },
    closedAt: {
      type: Date,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc: any, ret: any) => {
        delete (ret as any).__v;
        return ret;
      },
    },
    toObject: {
      transform: (_doc: any, ret: any) => {
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

// Auto-generate ticket number before saving
TicketSchema.pre("save", async function (next) {
  if (this.isNew && !this.ticketNumber) {
    const count = await mongoose.model("Ticket").countDocuments();
    this.ticketNumber = `TKT-${String(count + 1).padStart(5, "0")}`;
  }

  // Set resolvedAt when status changes to resolved
  if (this.isModified("status") && this.status === TicketStatus.RESOLVED) {
    this.resolvedAt = new Date();
  }

  // Set closedAt when status changes to closed
  if (this.isModified("status") && this.status === TicketStatus.CLOSED) {
    this.closedAt = new Date();
  }

  next();
});

// Exclude soft-deleted documents by default
TicketSchema.pre("find", function () {
  this.where({ deletedAt: null });
});

TicketSchema.pre("findOne", function () {
  this.where({ deletedAt: null });
});

TicketSchema.pre("countDocuments", function () {
  this.where({ deletedAt: null });
});

// Virtual: days since creation
TicketSchema.virtual("daysSinceCreation").get(function () {
  return Math.floor(
    (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
});

// Virtual: priority color
TicketSchema.virtual("priorityColor").get(function () {
  const colors: Record<string, string> = {
    [TicketPriority.LOW]: "green",
    [TicketPriority.MEDIUM]: "yellow",
    [TicketPriority.HIGH]: "orange",
    [TicketPriority.URGENT]: "red",
  };
  return colors[this.priority] || "gray";
});

// Static methods
TicketSchema.statics.findByStatus = function (status: TicketStatus) {
  return this.find({ status });
};

TicketSchema.statics.findByTenant = function (tenantId: string) {
  return this.find({ tenantId });
};

TicketSchema.statics.findByCategory = function (category: TicketCategory) {
  return this.find({ category });
};

// Instance methods
TicketSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save() as Promise<ITicket>;
};

TicketSchema.methods.restore = function () {
  this.deletedAt = null;
  return this.save() as Promise<ITicket>;
};

// Indexes
TicketSchema.index({ tenantId: 1, status: 1 });
TicketSchema.index({ status: 1, priority: 1 });
TicketSchema.index({ assignedTo: 1, status: 1 });
TicketSchema.index({ propertyId: 1 });
TicketSchema.index({ category: 1 });
TicketSchema.index({ createdAt: -1 });

// Prevent model recompilation in development
delete mongoose.models.Ticket;

const Ticket: Model<ITicket> =
  mongoose.models.Ticket || mongoose.model<ITicket>("Ticket", TicketSchema);

export default Ticket;

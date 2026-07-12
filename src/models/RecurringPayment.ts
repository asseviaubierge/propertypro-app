import mongoose, { Schema, Document } from "mongoose";
import { PaymentType, PaymentFrequency } from "@/types";

export interface IRecurringPayment extends Document {
  tenantId: mongoose.Types.ObjectId;
  propertyId: mongoose.Types.ObjectId;
  leaseId: mongoose.Types.ObjectId;
  amount: number;
  type: PaymentType;
  frequency: PaymentFrequency;
  startDate: Date;
  endDate?: Date;
  nextPaymentDate: Date;
  isActive: boolean;
  description?: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  paymentMethodId?: string;
  lastPaymentDate?: Date;
  totalPaymentsMade: number;
  failedPaymentCount: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const RecurringPaymentSchema = new Schema<IRecurringPayment>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Tenant ID is required"],
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: [true, "Property ID is required"],
    },
    leaseId: {
      type: Schema.Types.ObjectId,
      ref: "Lease",
      required: [true, "Lease ID is required"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be at least $0.01"],
    },
    type: {
      type: String,
      enum: Object.values(PaymentType),
      required: [true, "Payment type is required"],
    },
    frequency: {
      type: String,
      enum: Object.values(PaymentFrequency),
      required: [true, "Payment frequency is required"],
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
    },
    nextPaymentDate: {
      type: Date,
      required: [true, "Next payment date is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    stripeSubscriptionId: {
      type: String,
      trim: true,
    },
    stripeCustomerId: {
      type: String,
      trim: true,
    },
    paymentMethodId: {
      type: String,
      trim: true,
    },
    lastPaymentDate: {
      type: Date,
    },
    totalPaymentsMade: {
      type: Number,
      default: 0,
      min: [0, "Total payments made cannot be negative"],
    },
    failedPaymentCount: {
      type: Number,
      default: 0,
      min: [0, "Failed payment count cannot be negative"],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "recurring_payments",
  }
);

// Indexes - with error handling to prevent emitWarning issues
try {
  RecurringPaymentSchema.index({ tenantId: 1, isActive: 1 });
  RecurringPaymentSchema.index({ propertyId: 1 });
  RecurringPaymentSchema.index({ leaseId: 1 });
  RecurringPaymentSchema.index({ nextPaymentDate: 1, isActive: 1 });
  RecurringPaymentSchema.index({ stripeSubscriptionId: 1 }, { sparse: true });
} catch (error) {
  // Silently handle index creation errors in development
  if (process.env.NODE_ENV !== "production") {
    console.warn("RecurringPayment index creation warning:", error);
  }
}

// Instance Methods
RecurringPaymentSchema.methods.updateNextPaymentDate = function () {
  const current = this.nextPaymentDate;

  switch (this.frequency) {
    case PaymentFrequency.WEEKLY:
      this.nextPaymentDate = new Date(
        current.getTime() + 7 * 24 * 60 * 60 * 1000
      );
      break;
    case PaymentFrequency.MONTHLY:
      this.nextPaymentDate = new Date(
        current.getFullYear(),
        current.getMonth() + 1,
        current.getDate()
      );
      break;
    case PaymentFrequency.QUARTERLY:
      this.nextPaymentDate = new Date(
        current.getFullYear(),
        current.getMonth() + 3,
        current.getDate()
      );
      break;
    case PaymentFrequency.YEARLY:
      this.nextPaymentDate = new Date(
        current.getFullYear() + 1,
        current.getMonth(),
        current.getDate()
      );
      break;
  }

  return this.save();
};

RecurringPaymentSchema.methods.recordPayment = function () {
  this.lastPaymentDate = new Date();
  this.totalPaymentsMade += 1;
  this.failedPaymentCount = 0; // Reset failed count on successful payment
  this.updateNextPaymentDate();
  return this.save();
};

RecurringPaymentSchema.methods.recordFailedPayment = function () {
  this.failedPaymentCount += 1;
  return this.save();
};

RecurringPaymentSchema.methods.deactivate = function () {
  this.isActive = false;
  return this.save();
};

// Static Methods
RecurringPaymentSchema.statics.findByTenant = function (tenantId: string) {
  return this.find({ tenantId, isActive: true }).sort({ nextPaymentDate: 1 });
};

RecurringPaymentSchema.statics.findDuePayments = function (date?: Date) {
  const dueDate = date || new Date();
  return this.find({
    isActive: true,
    nextPaymentDate: { $lte: dueDate },
  });
};

const RecurringPayment =
  (mongoose.models?.RecurringPayment as mongoose.Model<IRecurringPayment>) ||
  mongoose.model<IRecurringPayment>("RecurringPayment", RecurringPaymentSchema);

export default RecurringPayment;

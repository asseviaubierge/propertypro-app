import mongoose, { Schema, Document } from "mongoose";

export interface IPaymentNotification extends Document {
  tenantId: mongoose.Types.ObjectId;
  paymentId: mongoose.Types.ObjectId;
  type: "reminder" | "overdue" | "confirmation" | "receipt";
  status: "pending" | "sent" | "failed";
  scheduledDate: Date;
  sentDate?: Date;
  emailAddress: string;
  subject: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentNotificationSchema = new Schema<IPaymentNotification>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Tenant ID is required"],
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: [true, "Payment ID is required"],
    },
    type: {
      type: String,
      enum: ["reminder", "overdue", "confirmation", "receipt"],
      required: [true, "Notification type is required"],
    },
    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
      required: [true, "Notification status is required"],
    },
    scheduledDate: {
      type: Date,
      required: [true, "Scheduled date is required"],
    },
    sentDate: {
      type: Date,
    },
    emailAddress: {
      type: String,
      required: [true, "Email address is required"],
      trim: true,
      lowercase: true,
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      maxlength: [200, "Subject cannot exceed 200 characters"],
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },
  },
  {
    timestamps: true,
    collection: "payment_notifications",
  }
);

// Indexes
PaymentNotificationSchema.index({ tenantId: 1, createdAt: -1 });
PaymentNotificationSchema.index({ paymentId: 1 });
PaymentNotificationSchema.index({ status: 1, scheduledDate: 1 });
PaymentNotificationSchema.index({ type: 1 });

// Instance Methods
PaymentNotificationSchema.methods.markAsSent = function () {
  this.status = "sent";
  this.sentDate = new Date();
  return this.save();
};

PaymentNotificationSchema.methods.markAsFailed = function () {
  this.status = "failed";
  return this.save();
};

// Static Methods
PaymentNotificationSchema.statics.findByTenant = function (tenantId: string) {
  return this.find({ tenantId }).sort({ createdAt: -1 });
};

PaymentNotificationSchema.statics.findPendingNotifications = function () {
  return this.find({
    status: "pending",
    scheduledDate: { $lte: new Date() },
  });
};

const PaymentNotification =
  (mongoose.models
    ?.PaymentNotification as mongoose.Model<IPaymentNotification>) ||
  mongoose.model<IPaymentNotification>(
    "PaymentNotification",
    PaymentNotificationSchema
  );

export default PaymentNotification;

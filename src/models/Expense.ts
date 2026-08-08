import mongoose, { Schema, Model } from "mongoose";
import { IExpense, ExpenseCategory, ExpenseStatus, PaymentMethod, PaymentFrequency } from "@/types";

const ExpenseRecurringConfigSchema = new Schema(
  {
    frequency: {
      type: String,
      enum: Object.values(PaymentFrequency),
    },
    nextDate: { type: Date },
    endDate: { type: Date },
  },
  { _id: false }
);

const ExpenseSchema = new Schema<IExpense>(
  {
    expenseNumber: {
      type: String,
      unique: true,
      trim: true,
      index: true,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      index: true,
    },
    unitId: {
      type: Schema.Types.ObjectId,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
    },
    billId: {
      type: Schema.Types.ObjectId,
      ref: "Bill",
    },
    category: {
      type: String,
      enum: Object.values(ExpenseCategory),
      required: [true, "Expense category is required"],
      index: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be at least $0.01"],
      max: [1000000, "Amount cannot exceed $1,000,000"],
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
    },
    referenceNumber: {
      type: String,
      trim: true,
    },
    receiptUrl: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, "Notes cannot exceed 2000 characters"],
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringConfig: ExpenseRecurringConfigSchema,
    status: {
      type: String,
      enum: Object.values(ExpenseStatus),
      default: ExpenseStatus.PAID,
      index: true,
    },
    taxDeductible: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is required"],
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
ExpenseSchema.index({ propertyId: 1, date: -1 });
ExpenseSchema.index({ category: 1, status: 1 });
ExpenseSchema.index({ createdBy: 1, date: -1 });

// Auto-generate expense number before save
ExpenseSchema.pre("save", async function (next) {
  if (!this.expenseNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.expenseNumber = `EXP-${year}${month}-${random}`;
  }
  next();
});

// Query middleware to exclude soft deleted documents
ExpenseSchema.pre(/^find/, function () {
  // @ts-ignore
  (this as any).find({ $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] });
});

const Expense: Model<IExpense> =
  mongoose.models?.Expense ||
  mongoose.model<IExpense>("Expense", ExpenseSchema);

export default Expense;

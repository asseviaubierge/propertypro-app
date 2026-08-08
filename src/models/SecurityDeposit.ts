/**
 * PropertyPro - Security Deposit Model
 * Tracks security deposits throughout the lease lifecycle:
 * collection, deductions, and refund processing
 */

import mongoose, { Schema, Model } from "mongoose";
import {
  ISecurityDeposit,
  SecurityDepositStatus,
  DeductionCategory,
} from "@/types";

const DeductionSchema = new Schema(
  {
    category: {
      type: String,
      enum: Object.values(DeductionCategory),
      required: true,
    },
    description: {
      type: String,
      required: true,
      maxlength: 500,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    photos: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const SecurityDepositSchema = new Schema<ISecurityDeposit>(
  {
    leaseId: {
      type: Schema.Types.ObjectId,
      ref: "Lease",
      required: true,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    unitId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Deposit amount cannot be negative"],
    },
    status: {
      type: String,
      enum: Object.values(SecurityDepositStatus),
      default: SecurityDepositStatus.PENDING,
      index: true,
    },
    collectedDate: { type: Date },
    collectedPaymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
    },
    deductions: [DeductionSchema],
    refundAmount: { type: Number, min: 0 },
    refundDate: { type: Date },
    refundMethod: { type: String },
    refundPaymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
    },
    refundNotes: { type: String, maxlength: 1000 },
    notes: { type: String, maxlength: 1000 },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: total deductions
SecurityDepositSchema.virtual("totalDeductions").get(function () {
  return this.deductions.reduce(
    (sum: number, d: { amount: number }) => sum + d.amount,
    0
  );
});

// Virtual: available refund (deposit - deductions)
SecurityDepositSchema.virtual("availableRefund").get(function () {
  const totalDeductions = this.deductions.reduce(
    (sum: number, d: { amount: number }) => sum + d.amount,
    0
  );
  return Math.max(0, this.amount - totalDeductions);
});

// Index for soft delete queries
SecurityDepositSchema.index({ deletedAt: 1 });

// Compound index for lease+tenant lookups
SecurityDepositSchema.index({ leaseId: 1, tenantId: 1 });

// Method: mark as collected
SecurityDepositSchema.methods.markCollected = function (
  paymentId?: mongoose.Types.ObjectId
) {
  this.status = SecurityDepositStatus.COLLECTED;
  this.collectedDate = new Date();
  if (paymentId) this.collectedPaymentId = paymentId;
  return this.save() as Promise<ISecurityDeposit>;
};

// Method: add deduction
SecurityDepositSchema.methods.addDeduction = function (deduction: {
  category: DeductionCategory;
  description: string;
  amount: number;
  photos?: string[];
}) {
  const totalDeductions =
    this.deductions.reduce(
      (sum: number, d: { amount: number }) => sum + d.amount,
      0
    ) + deduction.amount;

  if (totalDeductions > this.amount) {
    throw new Error("Total deductions cannot exceed deposit amount");
  }

  this.deductions.push({ ...deduction, createdAt: new Date() });
  return this.save() as Promise<ISecurityDeposit>;
};

// Method: process refund
SecurityDepositSchema.methods.processRefund = function (
  refundMethod: string,
  notes?: string,
  refundPaymentId?: mongoose.Types.ObjectId
) {
  const totalDeductions = this.deductions.reduce(
    (sum: number, d: { amount: number }) => sum + d.amount,
    0
  );
  const refundAmount = this.amount - totalDeductions;

  if (refundAmount <= 0) {
    this.status = SecurityDepositStatus.FORFEITED;
    this.refundAmount = 0;
  } else if (totalDeductions > 0) {
    this.status = SecurityDepositStatus.PARTIALLY_REFUNDED;
    this.refundAmount = refundAmount;
  } else {
    this.status = SecurityDepositStatus.FULLY_REFUNDED;
    this.refundAmount = refundAmount;
  }

  this.refundDate = new Date();
  this.refundMethod = refundMethod;
  if (notes) this.refundNotes = notes;
  if (refundPaymentId) this.refundPaymentId = refundPaymentId;

  return this.save() as Promise<ISecurityDeposit>;
};

const SecurityDeposit: Model<ISecurityDeposit> =
  mongoose.models.SecurityDeposit ||
  mongoose.model<ISecurityDeposit>("SecurityDeposit", SecurityDepositSchema);

export default SecurityDeposit;

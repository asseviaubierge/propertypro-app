import mongoose, { Schema, Model } from "mongoose";

const SubscriptionTierSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    minHouseholds: { type: Number, required: true, min: 0 },
    maxHouseholds: { type: Number, default: null, min: 0 },
    fixedAmount: { type: Number, default: 0, min: 0 },
    percentageRate: { type: Number, default: 0, min: 0, max: 100 },
    minimumAmount: { type: Number, default: 0, min: 0 },
    billingPeriod: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SubscriptionTierSchema.index({ minHouseholds: 1, maxHouseholds: 1 });

const SubscriptionTier: Model<any> =
  mongoose.models.SubscriptionTier ||
  mongoose.model("SubscriptionTier", SubscriptionTierSchema);

export default SubscriptionTier;

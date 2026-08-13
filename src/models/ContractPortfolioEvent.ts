import mongoose, { Schema, Model } from "mongoose";

const ContractPortfolioEventSchema = new Schema(
  {
    contractId: { type: Schema.Types.ObjectId, ref: "SubscriptionContract", required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    leaseId: { type: Schema.Types.ObjectId, ref: "Lease", default: null },
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", default: null },
    tenantId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    type: {
      type: String,
      enum: ["lease_activated", "lease_terminated", "lease_expired", "lease_renewed"],
      required: true,
      index: true,
    },
    message: { type: String, required: true, trim: true },
    occurredAt: { type: Date, default: Date.now, index: true },
    readByAdmin: { type: Boolean, default: false },
    readByOwner: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ContractPortfolioEventSchema.index({ contractId: 1, occurredAt: -1 });

const ContractPortfolioEvent: Model<any> =
  mongoose.models.ContractPortfolioEvent ||
  mongoose.model("ContractPortfolioEvent", ContractPortfolioEventSchema);

export default ContractPortfolioEvent;

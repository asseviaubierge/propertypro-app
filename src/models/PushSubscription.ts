import mongoose, { Schema, Model } from "mongoose";

export interface IPushSubscription {
  _id: string;
  userId: mongoose.Types.ObjectId;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String },
  },
  { timestamps: true }
);

const PushSubscription: Model<IPushSubscription> =
  (mongoose.models.PushSubscription as Model<IPushSubscription>) ||
  mongoose.model<IPushSubscription>("PushSubscription", PushSubscriptionSchema);

export default PushSubscription;

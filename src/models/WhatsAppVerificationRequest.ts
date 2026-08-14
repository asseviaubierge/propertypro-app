import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWhatsAppVerificationRequest extends Document {
  userId: mongoose.Types.ObjectId;
  requestedNumber: string;
  verificationCode: string;
  status: "pending" | "verified" | "rejected";
  requestedAt: Date;
  confirmedSenderNumber?: string | null;
  receivedCode?: string | null;
  messageConfirmedReceived: boolean;
  reviewedBy?: mongoose.Types.ObjectId | null;
  reviewedAt?: Date | null;
  rejectedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppVerificationRequestSchema = new Schema<IWhatsAppVerificationRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestedNumber: { type: String, required: true, trim: true },
    verificationCode: { type: String, required: true, trim: true, index: true },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true,
    },
    requestedAt: { type: Date, default: Date.now, index: true },
    confirmedSenderNumber: { type: String, default: null, trim: true },
    receivedCode: { type: String, default: null, trim: true },
    messageConfirmedReceived: { type: Boolean, default: false },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "whatsapp_verification_requests" }
);

WhatsAppVerificationRequestSchema.index({ userId: 1, status: 1, requestedAt: -1 });
WhatsAppVerificationRequestSchema.index({ status: 1, requestedAt: -1 });

let WhatsAppVerificationRequest: Model<IWhatsAppVerificationRequest>;
try {
  WhatsAppVerificationRequest = mongoose.model<IWhatsAppVerificationRequest>("WhatsAppVerificationRequest");
} catch {
  WhatsAppVerificationRequest = mongoose.model<IWhatsAppVerificationRequest>(
    "WhatsAppVerificationRequest",
    WhatsAppVerificationRequestSchema
  );
}

export default WhatsAppVerificationRequest;

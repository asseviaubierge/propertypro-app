import mongoose, { Schema, Document, Model } from "mongoose";

export type NotificationPriorityLevel =
  | "low"
  | "normal"
  | "medium"
  | "high"
  | "critical";

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: string;
  priority: NotificationPriorityLevel;
  read: boolean;
  readAt?: Date | null;
  actionUrl?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
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
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    type: {
      type: String,
      default: "system",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "medium", "high", "critical"],
      default: "normal",
      index: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    actionUrl: {
      type: String,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "notifications",
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

NotificationSchema.methods.markAsRead = function () {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

type NotificationModel = Model<INotification>;

let Notification: NotificationModel;

try {
  Notification = mongoose.model<INotification>("Notification");
} catch {
  Notification = mongoose.model<INotification>("Notification", NotificationSchema);
}

export default Notification;
export type { NotificationModel };

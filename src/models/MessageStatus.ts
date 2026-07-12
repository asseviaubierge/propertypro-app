import mongoose, { Schema, Model } from "mongoose";

export interface ITypingIndicator {
  userId: mongoose.Types.ObjectId;
  conversationId: string;
  isTyping: boolean;
  lastTypingAt: Date;
}

export interface IOnlineStatus {
  userId: mongoose.Types.ObjectId;
  isOnline: boolean;
  lastSeenAt: Date;
  socketId?: string;
}

export interface IMessageReaction {
  userId: mongoose.Types.ObjectId;
  emoji: string;
  createdAt: Date;
}

export interface IMessageStatus {
  _id: string;
  messageId: mongoose.Types.ObjectId;
  conversationId: string;
  senderId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  status: "sent" | "delivered" | "read" | "failed";
  deliveredAt?: Date;
  readAt?: Date;
  failureReason?: string;
  reactions: IMessageReaction[];
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Message Reaction Schema
const MessageReactionSchema = new Schema<IMessageReaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    emoji: {
      type: String,
      required: [true, "Emoji is required"],
      trim: true,
      maxlength: [10, "Emoji cannot exceed 10 characters"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: [true, "Created date is required"],
    },
  },
  { _id: false }
);

// Message Status Schema
const MessageStatusSchema = new Schema<IMessageStatus>(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      required: [true, "Message ID is required"],
      index: true,
    },
    conversationId: {
      type: String,
      required: [true, "Conversation ID is required"],
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender ID is required"],
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient ID is required"],
      index: true,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read", "failed"],
      default: "sent",
      required: [true, "Status is required"],
    },
    deliveredAt: {
      type: Date,
    },
    readAt: {
      type: Date,
    },
    failureReason: {
      type: String,
      trim: true,
      maxlength: [500, "Failure reason cannot exceed 500 characters"],
    },
    reactions: {
      type: [MessageReactionSchema],
      default: [],
      validate: {
        validator: function (reactions: IMessageReaction[]) {
          return reactions.length <= 50;
        },
        message: "Cannot have more than 50 reactions per message",
      },
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (
        _doc,
        ret: Record<string, unknown> & { __v?: number }
      ) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Typing Indicator Schema
const TypingIndicatorSchema = new Schema<ITypingIndicator>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    conversationId: {
      type: String,
      required: [true, "Conversation ID is required"],
      index: true,
    },
    isTyping: {
      type: Boolean,
      default: false,
      required: [true, "Typing status is required"],
    },
    lastTypingAt: {
      type: Date,
      default: Date.now,
      required: [true, "Last typing date is required"],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (
        _doc,
        ret: Record<string, unknown> & { __v?: number }
      ) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Online Status Schema
const OnlineStatusSchema = new Schema<IOnlineStatus>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true, // unique already creates an index, no need for index: true
    },
    isOnline: {
      type: Boolean,
      default: false,
      required: [true, "Online status is required"],
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      required: [true, "Last seen date is required"],
    },
    socketId: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (
        _doc,
        ret: Record<string, unknown> & { __v?: number }
      ) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for better query performance - with error handling to prevent emitWarning issues
try {
  MessageStatusSchema.index({ messageId: 1, recipientId: 1 }, { unique: true });
  MessageStatusSchema.index({ conversationId: 1, status: 1 });
  MessageStatusSchema.index({ senderId: 1, createdAt: -1 });
  MessageStatusSchema.index({ recipientId: 1, status: 1, createdAt: -1 });

  TypingIndicatorSchema.index(
    { conversationId: 1, userId: 1 },
    { unique: true }
  );
  TypingIndicatorSchema.index({ lastTypingAt: 1 }, { expireAfterSeconds: 30 }); // Auto-expire after 30 seconds

  OnlineStatusSchema.index({ isOnline: 1, lastSeenAt: -1 });
  OnlineStatusSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 86400 }); // Auto-expire after 24 hours
} catch (error) {
  // Silently handle index creation errors in development
  if (process.env.NODE_ENV !== "production") {
    console.warn("MessageStatus index creation warning:", error);
  }
}

// Virtual for reaction summary
MessageStatusSchema.virtual("reactionSummary").get(function () {
  const summary: { [emoji: string]: number } = {};
  this.reactions.forEach((reaction: IMessageReaction) => {
    summary[reaction.emoji] = (summary[reaction.emoji] || 0) + 1;
  });
  return summary;
});

// Instance method to add reaction
MessageStatusSchema.methods.addReaction = function (
  userId: string,
  emoji: string
) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(
    (r: IMessageReaction) => r.userId.toString() !== userId
  );

  // Add new reaction
  this.reactions.push({
    userId: new mongoose.Types.ObjectId(userId),
    emoji,
    createdAt: new Date(),
  });

  return this;
};

// Instance method to remove reaction
MessageStatusSchema.methods.removeReaction = function (
  userId: string,
  emoji?: string
) {
  if (emoji) {
    this.reactions = this.reactions.filter(
      (r: IMessageReaction) =>
        !(r.userId.toString() === userId && r.emoji === emoji)
    );
  } else {
    this.reactions = this.reactions.filter(
      (r: IMessageReaction) => r.userId.toString() !== userId
    );
  }

  return this;
};

// Instance method to mark as delivered
MessageStatusSchema.methods.markAsDelivered = function () {
  if (this.status === "sent") {
    this.status = "delivered";
    this.deliveredAt = new Date();
  }
  return this;
};

// Instance method to mark as read
MessageStatusSchema.methods.markAsRead = function () {
  if (this.status === "delivered" || this.status === "sent") {
    this.status = "read";
    this.readAt = new Date();
    if (!this.deliveredAt) {
      this.deliveredAt = new Date();
    }
  }
  return this;
};

// Static method to get conversation status
MessageStatusSchema.statics.getConversationStatus = function (
  conversationId: string,
  userId: string
) {
  return this.find({
    conversationId,
    recipientId: new mongoose.Types.ObjectId(userId),
  })
    .populate("messageId", "content createdAt")
    .populate("senderId", "firstName lastName")
    .sort({ createdAt: -1 });
};

// Static method to get unread count
MessageStatusSchema.statics.getUnreadCount = function (
  userId: string,
  conversationId?: string
) {
  const query: any = {
    recipientId: new mongoose.Types.ObjectId(userId),
    status: { $ne: "read" },
  };

  if (conversationId) {
    query.conversationId = conversationId;
  }

  return this.countDocuments(query);
};

// Create and export the models
let MessageStatus: Model<IMessageStatus>;
let TypingIndicator: Model<ITypingIndicator>;
let OnlineStatus: Model<IOnlineStatus>;

try {
  MessageStatus = mongoose.model<IMessageStatus>("MessageStatus");
} catch (error) {
  MessageStatus = mongoose.model<IMessageStatus>(
    "MessageStatus",
    MessageStatusSchema
  );
}

try {
  TypingIndicator = mongoose.model<ITypingIndicator>("TypingIndicator");
} catch (error) {
  TypingIndicator = mongoose.model<ITypingIndicator>(
    "TypingIndicator",
    TypingIndicatorSchema
  );
}

try {
  OnlineStatus = mongoose.model<IOnlineStatus>("OnlineStatus");
} catch (error) {
  OnlineStatus = mongoose.model<IOnlineStatus>(
    "OnlineStatus",
    OnlineStatusSchema
  );
}

export { MessageStatus, TypingIndicator, OnlineStatus };
export default MessageStatus;

import mongoose, { Schema, Model } from "mongoose";

export interface IMessage {
  _id: string;
  conversationId: mongoose.Types.ObjectId; // Reference to Conversation model
  senderId: mongoose.Types.ObjectId;
  recipientId?: mongoose.Types.ObjectId; // Optional for group messages
  propertyId?: mongoose.Types.ObjectId;
  subject?: string; // Optional for chat-style messages
  content: string;
  messageType:
    | "general"
    | "maintenance"
    | "payment"
    | "lease"
    | "emergency"
    | "announcement"
    | "system";
  priority: "low" | "normal" | "high" | "urgent";
  status: "sent" | "delivered" | "read" | "failed";
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    fileSize: number;
    fileType: string;
    thumbnailUrl?: string;
  }>;
  readAt?: Date;
  deliveredAt?: Date;
  readBy?: Array<{
    userId: mongoose.Types.ObjectId;
    readAt: Date;
  }>;
  replyToId?: mongoose.Types.ObjectId;
  forwardedFromId?: mongoose.Types.ObjectId;
  isSystemMessage: boolean;
  isEdited: boolean;
  editedAt?: Date;
  editHistory?: Array<{
    content: string;
    editedAt: Date;
  }>;
  mentions?: mongoose.Types.ObjectId[]; // User mentions in the message
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    platform?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
}

// Edit History Schema
const EditHistorySchema = new Schema(
  {
    content: {
      type: String,
      required: [true, "Edit content is required"],
      trim: true,
    },
    editedAt: {
      type: Date,
      required: [true, "Edit date is required"],
      default: Date.now,
    },
  },
  { _id: false }
);

// Metadata Schema
const MetadataSchema = new Schema(
  {
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    platform: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

// Attachment Schema
const AttachmentSchema = new Schema({
  fileName: {
    type: String,
    required: [true, "File name is required"],
    trim: true,
    maxlength: [255, "File name too long"],
  },
  fileUrl: {
    type: String,
    required: [true, "File URL is required"],
    trim: true,
  },
  fileSize: {
    type: Number,
    required: [true, "File size is required"],
    min: [0, "File size cannot be negative"],
    max: [50 * 1024 * 1024, "File size cannot exceed 50MB"], // 50MB limit
  },
  fileType: {
    type: String,
    required: [true, "File type is required"],
    trim: true,
  },
  thumbnailUrl: {
    type: String,
    trim: true,
  },
});

// Main Message Schema
const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
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
      index: true,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      index: true,
    },
    subject: {
      type: String,
      trim: true,
      maxlength: [200, "Subject too long"],
    },
    content: {
      type: String,
      required: [true, "Message content is required"],
      trim: true,
      maxlength: [5000, "Message content too long"],
    },
    messageType: {
      type: String,
      enum: [
        "general",
        "maintenance",
        "payment",
        "lease",
        "emergency",
        "announcement",
        "system",
      ],
      default: "general",
      required: [true, "Message type is required"],
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      required: [true, "Priority is required"],
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read", "failed"],
      default: "sent",
      required: [true, "Status is required"],
    },
    attachments: {
      type: [AttachmentSchema],
      default: [],
      validate: {
        validator: function (attachments: any[]) {
          return attachments.length <= 10;
        },
        message: "Cannot have more than 10 attachments per message",
      },
    },
    readAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    readBy: {
      type: [
        {
          userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          readAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
    },
    replyToId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
    },
    forwardedFromId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
    },
    isSystemMessage: {
      type: Boolean,
      default: false,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    editHistory: {
      type: [EditHistorySchema],
      default: [],
      validate: {
        validator: function (history: any[]) {
          return history.length <= 20;
        },
        message: "Cannot have more than 20 edit history entries",
      },
    },
    mentions: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    metadata: {
      type: MetadataSchema,
    },
    deletedAt: {
      type: Date,
      default: null,
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
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Indexes for better query performance - with error handling to prevent emitWarning issues
try {
  MessageSchema.index({ conversationId: 1, createdAt: -1 });
  MessageSchema.index({ senderId: 1, createdAt: -1 });
  MessageSchema.index({ recipientId: 1, status: 1 });
  MessageSchema.index({ propertyId: 1, createdAt: -1 });
  MessageSchema.index({ messageType: 1, priority: 1 });
  MessageSchema.index({ deletedAt: 1 });
  MessageSchema.index({ mentions: 1, createdAt: -1 });
  MessageSchema.index({ isSystemMessage: 1, createdAt: -1 });
  MessageSchema.index({ replyToId: 1 });
  MessageSchema.index({ forwardedFromId: 1 });
} catch (error) {
  // Silently handle index creation errors in development
  if (process.env.NODE_ENV !== "production") {
    console.warn("Message index creation warning:", error);
  }
}

// Virtual for message thread
MessageSchema.virtual("isReply").get(function () {
  return !!this.replyToId;
});

// Virtual for unread status
MessageSchema.virtual("isUnread").get(function () {
  return this.status !== "read";
});

// Instance method to mark as read
MessageSchema.methods.markAsRead = function () {
  this.status = "read";
  this.readAt = new Date();
  return this.save();
};

// Instance method to mark as delivered
MessageSchema.methods.markAsDelivered = function () {
  if (this.status === "sent") {
    this.status = "delivered";
    this.deliveredAt = new Date();
  }
  return this.save();
};

// Instance method to edit message
MessageSchema.methods.editMessage = function (
  newContent: string,
  userId: string
) {
  if (this.senderId.toString() !== userId) {
    throw new Error("Only the sender can edit the message");
  }

  // Add to edit history
  if (!this.editHistory) {
    this.editHistory = [];
  }

  this.editHistory.push({
    content: this.content,
    editedAt: new Date(),
  });

  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();

  return this.save();
};

// Instance method to soft delete message
MessageSchema.methods.softDelete = function (userId: string) {
  this.deletedAt = new Date();
  this.deletedBy = new mongoose.Types.ObjectId(userId);
  return this.save();
};

// Instance method to add mention
MessageSchema.methods.addMention = function (userId: string) {
  if (!this.mentions) {
    this.mentions = [];
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  if (!this.mentions.some((id) => id.toString() === userId)) {
    this.mentions.push(userObjectId);
  }

  return this;
};

// Instance method to forward message
MessageSchema.methods.forward = function (
  senderId: string,
  conversationId: string,
  additionalContent?: string
) {
  const Message = mongoose.model("Message");

  const forwardedContent = additionalContent
    ? `${additionalContent}\n\n--- Forwarded Message ---\n${this.content}`
    : this.content;

  return new Message({
    conversationId: new mongoose.Types.ObjectId(conversationId),
    senderId: new mongoose.Types.ObjectId(senderId),
    content: forwardedContent,
    messageType: this.messageType,
    priority: this.priority,
    forwardedFromId: this._id,
    attachments: this.attachments, // Copy attachments
  });
};

// Instance method to reply to message
MessageSchema.methods.reply = function (
  senderId: string,
  content: string,
  subject?: string
) {
  const Message = mongoose.model("Message");

  return new Message({
    conversationId: this.conversationId,
    senderId,
    recipientId: this.senderId,
    propertyId: this.propertyId,
    subject: subject || `Re: ${this.subject}`,
    content,
    messageType: this.messageType,
    priority: this.priority,
    replyToId: this._id,
  });
};

// Static method to get conversation messages with pagination
MessageSchema.statics.getConversationMessages = function (
  conversationId: string,
  options: {
    page?: number;
    limit?: number;
    beforeDate?: Date;
    afterDate?: Date;
    messageType?: string;
    senderId?: string;
  } = {}
) {
  const {
    page = 1,
    limit = 50,
    beforeDate,
    afterDate,
    messageType,
    senderId,
  } = options;
  const skip = (page - 1) * limit;

  const query: any = {
    conversationId: new mongoose.Types.ObjectId(conversationId),
    deletedAt: null,
  };

  if (beforeDate) query.createdAt = { ...query.createdAt, $lt: beforeDate };
  if (afterDate) query.createdAt = { ...query.createdAt, $gt: afterDate };
  if (messageType) query.messageType = messageType;
  if (senderId) query.senderId = new mongoose.Types.ObjectId(senderId);

  return this.find(query)
    .populate("senderId", "firstName lastName email avatar")
    .populate("recipientId", "firstName lastName email avatar")
    .populate("replyToId", "content senderId createdAt")
    .populate("forwardedFromId", "content senderId createdAt")
    .populate("mentions", "firstName lastName email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to search messages
MessageSchema.statics.searchMessages = function (
  userId: string,
  searchQuery: string,
  options: {
    conversationId?: string;
    messageType?: string;
    limit?: number;
  } = {}
) {
  const { conversationId, messageType, limit = 20 } = options;

  const query: any = {
    $or: [
      { senderId: new mongoose.Types.ObjectId(userId) },
      { recipientId: new mongoose.Types.ObjectId(userId) },
      { mentions: new mongoose.Types.ObjectId(userId) },
    ],
    $text: { $search: searchQuery },
    deletedAt: null,
  };

  if (conversationId) {
    query.conversationId = new mongoose.Types.ObjectId(conversationId);
  }
  if (messageType) {
    query.messageType = messageType;
  }

  return this.find(query)
    .populate("senderId", "firstName lastName email")
    .populate("conversationId", "name type")
    .sort({ score: { $meta: "textScore" }, createdAt: -1 })
    .limit(limit);
};

// Static method to get conversation
MessageSchema.statics.getConversation = function (
  conversationId: string,
  page = 1,
  limit = 20
) {
  const skip = (page - 1) * limit;

  return this.find({ conversationId, deletedAt: null })
    .populate("senderId", "firstName lastName email")
    .populate("recipientId", "firstName lastName email")
    .populate("propertyId", "name address")
    .populate("replyToId", "subject content senderId")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get user conversations
MessageSchema.statics.getUserConversations = function (userId: string) {
  return this.aggregate([
    {
      $match: {
        $or: [
          { senderId: new mongoose.Types.ObjectId(userId) },
          { recipientId: new mongoose.Types.ObjectId(userId) },
        ],
        deletedAt: null,
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $group: {
        _id: "$conversationId",
        lastMessage: { $first: "$$ROOT" },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$senderId", new mongoose.Types.ObjectId(userId)] },
                  { $ne: ["$status", "read"] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "lastMessage.senderId",
        foreignField: "_id",
        as: "sender",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "lastMessage.recipientId",
        foreignField: "_id",
        as: "recipient",
      },
    },
    {
      $lookup: {
        from: "properties",
        localField: "lastMessage.propertyId",
        foreignField: "_id",
        as: "property",
      },
    },
    {
      $sort: { "lastMessage.createdAt": -1 },
    },
  ]);
};

// Query middleware to exclude soft deleted documents
MessageSchema.pre(/^find/, function () {
  // @ts-ignore
  this.find({ deletedAt: null });
});

function normalizeMessageObjectIds(message: any) {
  for (const field of [
    "conversationId",
    "senderId",
    "recipientId",
    "propertyId",
    "replyToId",
    "forwardedFromId",
    "deletedBy",
  ]) {
    if (message.isModified(field) && message[field]) {
      message[field] = new mongoose.Types.ObjectId(message[field].toString());
    }
  }

  if (message.isModified("mentions") && Array.isArray(message.mentions)) {
    message.mentions = message.mentions.map(
      (id: mongoose.Types.ObjectId) =>
        new mongoose.Types.ObjectId(id.toString())
    );
  }
}

// Pre-save middleware for validation
MessageSchema.pre("save", async function (next) {
  normalizeMessageObjectIds(this);

  // Validate sender exists
  if (this.isModified("senderId")) {
    const User = mongoose.model("User");
    const sender = await User.findById(this.senderId);
    if (!sender) {
      return next(new Error("Sender not found"));
    }
  }

  // Validate recipient exists (if provided - not required for group messages)
  if (this.isModified("recipientId") && this.recipientId) {
    const User = mongoose.model("User");
    const recipient = await User.findById(this.recipientId);
    if (!recipient) {
      return next(new Error("Recipient not found"));
    }

    // Prevent sending messages to self in individual conversations
    if (this.senderId.toString() === this.recipientId.toString()) {
      return next(new Error("Cannot send message to yourself"));
    }
  }

  // Validate conversation exists
  if (this.isModified("conversationId")) {
    const Conversation = mongoose.model("Conversation");
    const conversation = await Conversation.findById(this.conversationId);
    if (!conversation) {
      return next(new Error("Conversation not found"));
    }

    // Validate sender is a participant in the conversation
    const isParticipant = conversation.participants.some(
      (p: any) => p.userId.toString() === this.senderId.toString() && p.isActive
    );
    if (!isParticipant) {
      return next(
        new Error("Sender is not a participant in this conversation")
      );
    }
  }

  // Validate property exists if provided
  if (this.isModified("propertyId") && this.propertyId) {
    const Property = mongoose.model("Property");
    const property = await Property.findById(this.propertyId);
    if (!property) {
      return next(new Error("Property not found"));
    }
  }

  // Validate mentions exist
  if (
    this.isModified("mentions") &&
    this.mentions &&
    this.mentions.length > 0
  ) {
    const User = mongoose.model("User");
    const mentionedUsers = await User.find({ _id: { $in: this.mentions } });
    if (mentionedUsers.length !== this.mentions.length) {
      return next(new Error("One or more mentioned users not found"));
    }
  }

  // Set delivered timestamp if status is being set to delivered
  if (
    this.isModified("status") &&
    this.status === "delivered" &&
    !this.deliveredAt
  ) {
    this.deliveredAt = new Date();
  }

  // Set read timestamp if status is being set to read
  if (this.isModified("status") && this.status === "read" && !this.readAt) {
    this.readAt = new Date();
    if (!this.deliveredAt) {
      this.deliveredAt = new Date();
    }
  }

  next();
});

// Post-save middleware to update conversation
MessageSchema.post("save", async function (doc) {
  try {
    const Conversation = mongoose.model("Conversation");
    const conversation = await Conversation.findById(doc.conversationId);

    if (conversation) {
      // Update last message and metadata
      await conversation.updateLastMessage(doc);
      await conversation.save();
    }
  } catch (error) {
    console.error("Error updating conversation after message save:", error);
  }
});

// Create and export the model with safer initialization
let Message: Model<IMessage>;

try {
  // Try to get existing model first
  Message = mongoose.model<IMessage>("Message");
} catch (error) {
  // Model doesn't exist, create it
  Message = mongoose.model<IMessage>("Message", MessageSchema);
}

export default Message;

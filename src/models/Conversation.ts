import mongoose, { Schema, Model } from "mongoose";

const CONVERSATION_PARTICIPANT_ROLE = {
  ADMIN: "admin",
  MEMBER: "member",
} as const;

const CONVERSATION_TYPE = {
  INDIVIDUAL: "individual",
  GROUP: "group",
  ANNOUNCEMENT: "announcement",
} as const;

const MESSAGE_STATUS = {
  READ: "read",
} as const;

const ADMIN_PARTICIPANT_PERMISSIONS = {
  canAddMembers: true,
  canRemoveMembers: true,
  canEditConversation: true,
  canDeleteMessages: true,
} as const;

const MEMBER_PARTICIPANT_PERMISSIONS = {
  canAddMembers: false,
  canRemoveMembers: false,
  canEditConversation: false,
  canDeleteMessages: false,
} as const;

type ConversationParticipantRoleValue =
  (typeof CONVERSATION_PARTICIPANT_ROLE)[keyof typeof CONVERSATION_PARTICIPANT_ROLE];
type ConversationTypeValue =
  (typeof CONVERSATION_TYPE)[keyof typeof CONVERSATION_TYPE];

export interface IConversationParticipant {
  userId: mongoose.Types.ObjectId;
  role: ConversationParticipantRoleValue;
  joinedAt: Date;
  lastReadAt?: Date;
  isActive: boolean;
  permissions: {
    canAddMembers: boolean;
    canRemoveMembers: boolean;
    canEditConversation: boolean;
    canDeleteMessages: boolean;
  };
}

export interface IConversationSettings {
  allowFileSharing: boolean;
  allowMemberInvites: boolean;
  muteNotifications: boolean;
  autoDeleteMessages: boolean;
  autoDeleteDays?: number;
  requireApprovalForNewMembers: boolean;
}

export interface IConversation {
  _id: string;
  name?: string; // For group conversations
  description?: string;
  type: ConversationTypeValue;
  participants: IConversationParticipant[];
  createdBy: mongoose.Types.ObjectId;
  propertyId?: mongoose.Types.ObjectId; // Optional property context
  lastMessage?: {
    messageId: mongoose.Types.ObjectId;
    content: string;
    senderId: mongoose.Types.ObjectId;
    senderName: string;
    createdAt: Date;
    messageType: string;
  };
  settings: IConversationSettings;
  avatar?: string; // Group conversation avatar
  isArchived: boolean;
  isPinned: boolean;
  tags: string[];
  metadata: {
    totalMessages: number;
    totalParticipants: number;
    lastActivity: Date;
  };
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Participant Schema
const ParticipantSchema = new Schema<IConversationParticipant>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    role: {
      type: String,
      enum: Object.values(CONVERSATION_PARTICIPANT_ROLE),
      default: CONVERSATION_PARTICIPANT_ROLE.MEMBER,
      required: [true, "Participant role is required"],
    },
    joinedAt: {
      type: Date,
      default: Date.now,
      required: [true, "Joined date is required"],
    },
    lastReadAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: [true, "Active status is required"],
    },
    permissions: {
      canAddMembers: {
        type: Boolean,
        default: false,
      },
      canRemoveMembers: {
        type: Boolean,
        default: false,
      },
      canEditConversation: {
        type: Boolean,
        default: false,
      },
      canDeleteMessages: {
        type: Boolean,
        default: false,
      },
    },
  },
  { _id: false }
);

// Settings Schema
const SettingsSchema = new Schema<IConversationSettings>(
  {
    allowFileSharing: {
      type: Boolean,
      default: true,
    },
    allowMemberInvites: {
      type: Boolean,
      default: true,
    },
    muteNotifications: {
      type: Boolean,
      default: false,
    },
    autoDeleteMessages: {
      type: Boolean,
      default: false,
    },
    autoDeleteDays: {
      type: Number,
      min: [1, "Auto delete days must be at least 1"],
      max: [365, "Auto delete days cannot exceed 365"],
    },
    requireApprovalForNewMembers: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

// Last Message Schema
const LastMessageSchema = new Schema(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      required: [true, "Message ID is required"],
    },
    content: {
      type: String,
      required: [true, "Message content is required"],
      trim: true,
      maxlength: [200, "Last message content preview too long"],
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender ID is required"],
    },
    senderName: {
      type: String,
      required: [true, "Sender name is required"],
      trim: true,
    },
    createdAt: {
      type: Date,
      required: [true, "Message date is required"],
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
      ],
      default: "general",
    },
  },
  { _id: false }
);

// Metadata Schema
const MetadataSchema = new Schema(
  {
    totalMessages: {
      type: Number,
      default: 0,
      min: [0, "Total messages cannot be negative"],
    },
    totalParticipants: {
      type: Number,
      default: 0,
      min: [0, "Total participants cannot be negative"],
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// Main Conversation Schema
const ConversationSchema = new Schema<IConversation>(
  {
    name: {
      type: String,
      trim: true,
      maxlength: [100, "Conversation name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    type: {
      type: String,
      enum: Object.values(CONVERSATION_TYPE),
      required: [true, "Conversation type is required"],
    },
    participants: {
      type: [ParticipantSchema],
      required: [true, "Participants are required"],
      validate: {
        validator: function (participants: IConversationParticipant[]) {
          return participants.length >= 1;
        },
        message: "Conversation must have at least 1 participant",
      },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is required"],
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      index: true,
    },
    lastMessage: {
      type: LastMessageSchema,
    },
    settings: {
      type: SettingsSchema,
      default: () => ({}),
    },
    avatar: {
      type: String,
      trim: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: function (tags: string[]) {
          return tags.length <= 10;
        },
        message: "Cannot have more than 10 tags",
      },
    },
    metadata: {
      type: MetadataSchema,
      default: () => ({}),
    },
    deletedAt: {
      type: Date,
      default: null,
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

// Indexes for better query performance
ConversationSchema.index({ type: 1, createdAt: -1 });
ConversationSchema.index({ "participants.userId": 1, isArchived: 1 });
ConversationSchema.index({ propertyId: 1, type: 1 });
ConversationSchema.index({ createdBy: 1, createdAt: -1 });
ConversationSchema.index({ "lastMessage.createdAt": -1 });
ConversationSchema.index({ deletedAt: 1 });
ConversationSchema.index({ isPinned: -1, "lastMessage.createdAt": -1 });

// Virtual for active participants count
ConversationSchema.virtual("activeParticipantsCount").get(function () {
  return this.participants.filter(
    (p: IConversationParticipant) => p.isActive
  ).length;
});

// Instance method for unread count for a specific user
ConversationSchema.methods.getUnreadCount = async function (userId: string) {
  try {
    // Use mongoose to get the Message model to avoid circular dependency
    const mongoose = require("mongoose");
    const Message = mongoose.model("Message");

    // Count unread messages for this user in this conversation
    const unreadCount = await Message.countDocuments({
      conversationId: this._id,
      senderId: { $ne: userId }, // Don't count own messages
      $and: [
        { status: { $ne: MESSAGE_STATUS.READ } }, // Message not marked as read globally
        {
          readBy: {
            $not: {
              $elemMatch: { userId: userId },
            },
          },
        }, // User hasn't read this message specifically
      ],
    });

    return unreadCount;
  } catch (error) {
    console.error("Error calculating unread count:", error);
    // Fallback to simple logic
    const participant = this.participants.find(
      (p: IConversationParticipant) => p.userId.toString() === userId
    );
    if (!participant || !participant.lastReadAt || !this.lastMessage) {
      return this.metadata?.totalMessages || 0;
    }
    return this.lastMessage.createdAt > participant.lastReadAt ? 1 : 0;
  }
};

// Virtual for conversation display name
ConversationSchema.virtual("displayName").get(function () {
  if (
    this.type === CONVERSATION_TYPE.GROUP ||
    this.type === CONVERSATION_TYPE.ANNOUNCEMENT
  ) {
    return this.name || "Unnamed Group";
  }

  // For individual conversations, return the other participant's name
  if (this.participants && this.participants.length >= 2) {
    // Find the participant that's not the current user (this would need to be called with context)
    // For now, return the first participant's name or fallback
    const participant = this.participants[0];
    if (participant && participant.userId) {
      const user = participant.userId;
      if (user.firstName || user.lastName) {
        return [user.firstName, user.lastName].filter(Boolean).join(" ");
      }
      return user.email || "Unknown User";
    }
  }

  return "Direct Message";
});

ConversationSchema.methods.getActiveParticipant = function (userId: string) {
  return this.participants.find(
    (participant: IConversationParticipant) =>
      participant.isActive && participant.userId.toString() === userId
  );
};

ConversationSchema.methods.canParticipantEditConversation = function (
  userId: string
) {
  const participant = this.getActiveParticipant(userId);
  if (!participant) {
    return false;
  }

  return (
    participant.role === CONVERSATION_PARTICIPANT_ROLE.ADMIN ||
    participant.permissions.canEditConversation
  );
};

ConversationSchema.methods.isParticipantAdmin = function (userId: string) {
  const participant = this.getActiveParticipant(userId);
  return participant?.role === CONVERSATION_PARTICIPANT_ROLE.ADMIN;
};

ConversationSchema.methods.canParticipantAddMembers = function (userId: string) {
  const participant = this.getActiveParticipant(userId);
  if (!participant) {
    return false;
  }

  return (
    participant.role === CONVERSATION_PARTICIPANT_ROLE.ADMIN ||
    participant.permissions.canAddMembers
  );
};

ConversationSchema.methods.canParticipantRemoveMembers = function (
  userId: string
) {
  const participant = this.getActiveParticipant(userId);
  if (!participant) {
    return false;
  }

  return (
    participant.role === CONVERSATION_PARTICIPANT_ROLE.ADMIN ||
    participant.permissions.canRemoveMembers
  );
};

ConversationSchema.methods.canParticipantDeleteMessages = function (
  userId: string
) {
  const participant = this.getActiveParticipant(userId);
  if (!participant) {
    return false;
  }

  return (
    participant.role === CONVERSATION_PARTICIPANT_ROLE.ADMIN ||
    participant.permissions.canDeleteMessages
  );
};

ConversationSchema.methods.canParticipantDeleteConversation = function (
  userId: string
) {
  const participant = this.getActiveParticipant(userId);
  if (!participant) {
    return false;
  }

  return (
    participant.role === CONVERSATION_PARTICIPANT_ROLE.ADMIN ||
    this.createdBy?.toString() === userId
  );
};

// Instance method to add participant
ConversationSchema.methods.addParticipant = function (
  userId: string,
  role: ConversationParticipantRoleValue = CONVERSATION_PARTICIPANT_ROLE.MEMBER,
  permissions?: Partial<IConversationParticipant["permissions"]>
) {
  const existingParticipant = this.participants.find(
    (p: IConversationParticipant) => p.userId.toString() === userId
  );

  if (existingParticipant) {
    if (!existingParticipant.isActive) {
      existingParticipant.isActive = true;
      existingParticipant.joinedAt = new Date();
      existingParticipant.role = role;

      const reactivatedPermissions =
        role === CONVERSATION_PARTICIPANT_ROLE.ADMIN
          ? ADMIN_PARTICIPANT_PERMISSIONS
          : MEMBER_PARTICIPANT_PERMISSIONS;

      existingParticipant.permissions = {
        ...reactivatedPermissions,
        ...permissions,
      };
    }
    return this;
  }

  const defaultPermissions =
    role === CONVERSATION_PARTICIPANT_ROLE.ADMIN
      ? ADMIN_PARTICIPANT_PERMISSIONS
      : MEMBER_PARTICIPANT_PERMISSIONS;

  this.participants.push({
    userId: new mongoose.Types.ObjectId(userId),
    role,
    joinedAt: new Date(),
    isActive: true,
    permissions: { ...defaultPermissions, ...permissions },
  });

  this.metadata.totalParticipants = this.activeParticipantsCount;
  return this;
};

// Instance method to remove participant
ConversationSchema.methods.removeParticipant = function (userId: string) {
  const participantIndex = this.participants.findIndex(
    (p: IConversationParticipant) => p.userId.toString() === userId
  );

  if (participantIndex !== -1) {
    const participant = this.participants[participantIndex];
    const isRemovingAdmin =
      participant.role === CONVERSATION_PARTICIPANT_ROLE.ADMIN;

    participant.isActive = false;

    if (
      isRemovingAdmin &&
      this.type !== CONVERSATION_TYPE.INDIVIDUAL &&
      this.participants.some(
        (p: IConversationParticipant) =>
          p.isActive && p.role === CONVERSATION_PARTICIPANT_ROLE.ADMIN
      ) === false
    ) {
      const replacementAdmin = this.participants.find(
        (p: IConversationParticipant) => p.isActive
      );

      if (replacementAdmin) {
        replacementAdmin.role = CONVERSATION_PARTICIPANT_ROLE.ADMIN;
        replacementAdmin.permissions = {
          ...ADMIN_PARTICIPANT_PERMISSIONS,
        };
      }
    }

    this.metadata.totalParticipants = this.activeParticipantsCount;
  }

  return this;
};

// Instance method to update last message
ConversationSchema.methods.updateLastMessage = function (message: any) {
  this.lastMessage = {
    messageId: message._id,
    content: message.content.substring(0, 200),
    senderId: message.senderId,
    senderName: message.senderName || "Unknown",
    createdAt: message.createdAt,
    messageType: message.messageType,
  };
  this.metadata.lastActivity = new Date();
  this.metadata.totalMessages += 1;
  return this;
};

// Instance method to mark as read for user
ConversationSchema.methods.markAsReadForUser = function (userId: string) {
  const participant = this.participants.find(
    (p: IConversationParticipant) => p.userId.toString() === userId
  );

  if (participant) {
    participant.lastReadAt = new Date();
  }

  return this;
};

// Static method to create individual conversation
ConversationSchema.statics.createIndividualConversation = function (
  user1Id: string,
  user2Id: string,
  propertyId?: string
) {
  return new this({
    type: CONVERSATION_TYPE.INDIVIDUAL,
    participants: [
      {
        userId: new mongoose.Types.ObjectId(user1Id),
        role: CONVERSATION_PARTICIPANT_ROLE.MEMBER,
        joinedAt: new Date(),
        isActive: true,
        permissions: { ...MEMBER_PARTICIPANT_PERMISSIONS },
      },
      {
        userId: new mongoose.Types.ObjectId(user2Id),
        role: CONVERSATION_PARTICIPANT_ROLE.MEMBER,
        joinedAt: new Date(),
        isActive: true,
        permissions: { ...MEMBER_PARTICIPANT_PERMISSIONS },
      },
    ],
    createdBy: new mongoose.Types.ObjectId(user1Id),
    propertyId: propertyId
      ? new mongoose.Types.ObjectId(propertyId)
      : undefined,
    metadata: {
      totalMessages: 0,
      totalParticipants: 2,
      lastActivity: new Date(),
    },
  });
};

// Static method to find or create individual conversation
ConversationSchema.statics.findOrCreateIndividualConversation = async function (
  user1Id: string,
  user2Id: string,
  propertyId?: string
) {
  const query: any = {
    type: CONVERSATION_TYPE.INDIVIDUAL,
    "participants.userId": {
      $all: [
        new mongoose.Types.ObjectId(user1Id),
        new mongoose.Types.ObjectId(user2Id),
      ],
    },
    deletedAt: null,
  };

  if (propertyId) {
    query.propertyId = new mongoose.Types.ObjectId(propertyId);
  }

  let conversation = await this.findOne(query).populate(
    "participants.userId",
    "firstName lastName email avatar"
  );

  if (!conversation) {
    conversation = this.createIndividualConversation(
      user1Id,
      user2Id,
      propertyId
    );
    await conversation.save();
    await conversation.populate(
      "participants.userId",
      "firstName lastName email avatar"
    );
  }

  return conversation;
};

// Static method to get user conversations
ConversationSchema.statics.getUserConversations = function (
  userId: string,
  options: {
    includeArchived?: boolean;
    limit?: number;
    skip?: number;
    propertyId?: string;
  } = {}
) {
  const { includeArchived = false, limit = 20, skip = 0, propertyId } = options;

  const matchQuery: any = {
    "participants.userId": new mongoose.Types.ObjectId(userId),
    "participants.isActive": true,
    deletedAt: null,
  };

  if (!includeArchived) {
    matchQuery.isArchived = false;
  }

  if (propertyId) {
    matchQuery.propertyId = new mongoose.Types.ObjectId(propertyId);
  }

  return this.find(matchQuery)
    .populate("participants.userId", "firstName lastName email avatar")
    .populate("propertyId", "name address")
    .populate("createdBy", "firstName lastName email")
    .sort({ isPinned: -1, "lastMessage.createdAt": -1, createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Query middleware to exclude soft deleted documents
ConversationSchema.pre(/^find/, function () {
  // @ts-ignore
  this.find({ deletedAt: null });
});

// Pre-save middleware
ConversationSchema.pre("save", async function (next) {
  // Update metadata
  if (this.isModified("participants")) {
    this.metadata.totalParticipants = this.activeParticipantsCount;
  }

  // Validate participants for individual conversations
  if (
    this.type === CONVERSATION_TYPE.INDIVIDUAL &&
    this.activeParticipantsCount !== 2
  ) {
    return next(
      new Error(
        "Individual conversations must have exactly 2 active participants"
      )
    );
  }

  // Ensure group conversations have names
  if (this.type === CONVERSATION_TYPE.GROUP && !this.name) {
    return next(new Error("Group conversations must have a name"));
  }

  // Non-individual conversations must always keep at least one active admin.
  if (this.type !== CONVERSATION_TYPE.INDIVIDUAL) {
    const hasActiveAdmin = this.participants.some(
      (participant: IConversationParticipant) =>
        participant.isActive &&
        participant.role === CONVERSATION_PARTICIPANT_ROLE.ADMIN
    );

    if (this.activeParticipantsCount > 0 && !hasActiveAdmin) {
      return next(
        new Error(
          "Group and announcement conversations must have at least one active admin"
        )
      );
    }
  }

  // Validate creator is a participant
  const creatorIsParticipant = this.participants.some(
    (p: IConversationParticipant) =>
      p.userId.toString() === this.createdBy.toString() && p.isActive
  );

  if (!creatorIsParticipant) {
    return next(new Error("Creator must be an active participant"));
  }

  next();
});

// Create and export the model
let Conversation: Model<IConversation>;

try {
  Conversation = mongoose.model<IConversation>("Conversation");
} catch (error) {
  Conversation = mongoose.model<IConversation>(
    "Conversation",
    ConversationSchema
  );
}

export default Conversation;

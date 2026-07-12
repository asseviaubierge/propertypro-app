import mongoose, { Schema } from "mongoose";
import { UserRole } from "@/types";

export interface IAnnouncement extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  content: string;
  priority: "low" | "normal" | "high" | "urgent";
  type: "general" | "maintenance" | "policy" | "emergency" | "event" | "system";

  // Targeting
  targetAudience: {
    roles?: UserRole[];
    propertyIds?: mongoose.Types.ObjectId[];
    userIds?: mongoose.Types.ObjectId[];
    tenantIds?: mongoose.Types.ObjectId[];
    includeAll?: boolean;
  };

  // Scheduling
  publishedAt?: Date;
  scheduledFor?: Date;
  expiresAt?: Date;

  // Content
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    fileSize: number;
    fileType: string;
  }>;

  actionButton?: {
    text: string;
    url: string;
  };

  // Engagement
  views: Array<{
    userId: mongoose.Types.ObjectId;
    viewedAt: Date;
    ipAddress?: string;
  }>;

  reactions: Array<{
    userId: mongoose.Types.ObjectId;
    type: "like" | "love" | "helpful" | "important";
    createdAt: Date;
  }>;

  // Status
  status: "draft" | "scheduled" | "published" | "expired" | "archived";
  isSticky: boolean; // Pin to top
  allowComments: boolean;

  // Audit
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Attachment Schema
const AttachmentSchema = new Schema({
  fileName: {
    type: String,
    required: true,
    trim: true,
  },
  fileUrl: {
    type: String,
    required: true,
    trim: true,
  },
  fileSize: {
    type: Number,
    required: true,
    min: 0,
  },
  fileType: {
    type: String,
    required: true,
    trim: true,
  },
});

// View Schema
const ViewSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  viewedAt: {
    type: Date,
    default: Date.now,
  },
  ipAddress: {
    type: String,
    trim: true,
  },
});

// Reaction Schema
const ReactionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    enum: ["like", "love", "helpful", "important"],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Target Audience Schema
const TargetAudienceSchema = new Schema({
  roles: {
    type: [String],
    enum: Object.values(UserRole),
    default: [],
  },
  propertyIds: {
    type: [Schema.Types.ObjectId],
    ref: "Property",
    default: [],
  },
  userIds: {
    type: [Schema.Types.ObjectId],
    ref: "User",
    default: [],
  },
  tenantIds: {
    type: [Schema.Types.ObjectId],
    ref: "Tenant",
    default: [],
  },
  includeAll: {
    type: Boolean,
    default: false,
  },
});

// Action Button Schema
const ActionButtonSchema = new Schema({
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  url: {
    type: String,
    required: true,
    trim: true,
  },
});

// Main Announcement Schema
const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    title: {
      type: String,
      required: [true, "Announcement title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    content: {
      type: String,
      required: [true, "Announcement content is required"],
      trim: true,
      maxlength: [5000, "Content cannot exceed 5000 characters"],
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    type: {
      type: String,
      enum: [
        "general",
        "maintenance",
        "policy",
        "emergency",
        "event",
        "system",
      ],
      default: "general",
    },
    targetAudience: {
      type: TargetAudienceSchema,
      required: true,
    },
    publishedAt: {
      type: Date,
    },
    scheduledFor: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    attachments: {
      type: [AttachmentSchema],
      default: [],
      validate: {
        validator: function (attachments: any[]) {
          return attachments.length <= 5;
        },
        message: "Cannot have more than 5 attachments per announcement",
      },
    },
    actionButton: {
      type: ActionButtonSchema,
    },
    views: {
      type: [ViewSchema],
      default: [],
    },
    reactions: {
      type: [ReactionSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "published", "expired", "archived"],
      default: "draft",
    },
    isSticky: {
      type: Boolean,
      default: false,
    },
    allowComments: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
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

// Indexes for performance
AnnouncementSchema.index({ status: 1, publishedAt: -1 });
AnnouncementSchema.index({ "targetAudience.roles": 1 });
AnnouncementSchema.index({ "targetAudience.propertyIds": 1 });
AnnouncementSchema.index({ "targetAudience.userIds": 1 });
AnnouncementSchema.index({ type: 1, priority: 1 });
AnnouncementSchema.index({ isSticky: 1, publishedAt: -1 });
AnnouncementSchema.index({ expiresAt: 1 });
AnnouncementSchema.index({ deletedAt: 1 });

// Text search index
AnnouncementSchema.index({
  title: "text",
  content: "text",
});

// Virtual for view count
AnnouncementSchema.virtual("viewCount").get(function (this: IAnnouncement) {
  return this.views.length;
});

// Virtual for reaction counts
AnnouncementSchema.virtual("reactionCounts").get(function (
  this: IAnnouncement
) {
  const counts = {
    like: 0,
    love: 0,
    helpful: 0,
    important: 0,
    total: 0,
  };

  this.reactions.forEach((reaction) => {
    counts[reaction.type]++;
    counts.total++;
  });

  return counts;
});

// Virtual for checking if announcement is active
AnnouncementSchema.virtual("isActive").get(function (this: IAnnouncement) {
  const now = new Date();
  return (
    this.status === "published" &&
    (!this.expiresAt || this.expiresAt > now) &&
    (!this.scheduledFor || this.scheduledFor <= now)
  );
});

// Virtual for checking if announcement is expired
AnnouncementSchema.virtual("isExpired").get(function (this: IAnnouncement) {
  return this.expiresAt && this.expiresAt < new Date();
});

// Pre-save middleware
AnnouncementSchema.pre("save", function (next) {
  // Auto-publish if scheduled time has passed
  if (
    this.status === "scheduled" &&
    this.scheduledFor &&
    this.scheduledFor <= new Date()
  ) {
    this.status = "published";
    this.publishedAt = new Date();
  }

  // Auto-expire if expiry time has passed
  if (
    this.status === "published" &&
    this.expiresAt &&
    this.expiresAt <= new Date()
  ) {
    this.status = "expired";
  }

  next();
});

// Instance methods
AnnouncementSchema.methods.addView = function (
  userId: string,
  ipAddress?: string
) {
  // Check if user already viewed this announcement
  const existingView = this.views.find(
    (view: any) => view.userId.toString() === userId
  );

  if (!existingView) {
    this.views.push({
      userId: new mongoose.Types.ObjectId(userId),
      viewedAt: new Date(),
      ipAddress,
    });
  }

  return this.save();
};

AnnouncementSchema.methods.addReaction = function (
  userId: string,
  reactionType: string
) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(
    (reaction: any) => reaction.userId.toString() !== userId
  );

  // Add new reaction
  this.reactions.push({
    userId: new mongoose.Types.ObjectId(userId),
    type: reactionType,
    createdAt: new Date(),
  });

  return this.save();
};

AnnouncementSchema.methods.removeReaction = function (userId: string) {
  this.reactions = this.reactions.filter(
    (reaction: any) => reaction.userId.toString() !== userId
  );

  return this.save();
};

// Static methods
AnnouncementSchema.statics.getActiveAnnouncements = function (targetCriteria?: {
  roles?: UserRole[];
  propertyIds?: string[];
  userId?: string;
  tenantIds?: string[];
}) {
  const now = new Date();
  const query: any = {
    status: "published",
    deletedAt: null,
    $and: [
      {
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: now } },
        ],
      },
      {
        $or: [
          { scheduledFor: { $exists: false } },
          { scheduledFor: null },
          { scheduledFor: { $lte: now } },
        ],
      },
    ],
  };

  if (targetCriteria) {
    const targetConditions: any[] = [];

    // Include all announcements
    targetConditions.push({ "targetAudience.includeAll": true });

    // Role-based targeting
    if (targetCriteria.roles && targetCriteria.roles.length > 0) {
      targetConditions.push({
        "targetAudience.roles": { $in: targetCriteria.roles },
      });
    }

    // Property-based targeting
    if (targetCriteria.propertyIds && targetCriteria.propertyIds.length > 0) {
      targetConditions.push({
        "targetAudience.propertyIds": {
          $in: targetCriteria.propertyIds.map(
            (id) => new mongoose.Types.ObjectId(id)
          ),
        },
      });
    }

    // User-specific targeting
    if (targetCriteria.userId) {
      targetConditions.push({
        "targetAudience.userIds": new mongoose.Types.ObjectId(
          targetCriteria.userId
        ),
      });
    }

    if (targetCriteria.tenantIds && targetCriteria.tenantIds.length > 0) {
      targetConditions.push({
        "targetAudience.tenantIds": {
          $in: targetCriteria.tenantIds.map(
            (id) => new mongoose.Types.ObjectId(id)
          ),
        },
      });
    }

    if (targetConditions.length > 0) {
      query.$and.push({ $or: targetConditions });
    }
  }

  return this.find(query)
    .sort({ isSticky: -1, publishedAt: -1 })
    .populate([
      { path: "createdBy", select: "firstName lastName email" },
      { path: "targetAudience.propertyIds", select: "name address" },
    ]);
};

// Soft delete query helper
AnnouncementSchema.pre(/^find/, function (this: any) {
  this.where({ deletedAt: null });
});

// Create and export the model with safer initialization
let Announcement: Model<IAnnouncement>;

try {
  // Try to get existing model first
  Announcement = mongoose.model<IAnnouncement>("Announcement");
} catch (error) {
  // Model doesn't exist, create it
  Announcement = mongoose.model<IAnnouncement>(
    "Announcement",
    AnnouncementSchema
  );
}

export default Announcement;

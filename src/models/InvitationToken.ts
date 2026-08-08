import mongoose, { Schema, Document } from "mongoose";

export interface IInvitationToken extends Document {
  _id: string;
  email: string;
  token: string;
  type:
    | "tenant_invitation"
    | "password_reset"
    | "email_change"
    | "email_verification";
  userId?: string; // For password resets / email changes / email verification
  newEmail?: string; // For email change requests (the address being verified)
  tenantData?: {
    firstName: string;
    lastName: string;
    phone?: string;
    role: string;
    avatar?: string;
    // Additional tenant-specific data
    dateOfBirth?: string;
    employmentInfo?: {
      employer: string;
      position: string;
      income: number;
      startDate: string;
    };
    emergencyContacts?: Array<{
      name: string;
      relationship: string;
      phone: string;
      email?: string;
    }>;
    creditScore?: number;
    moveInDate?: string;
    applicationNotes?: string;
  }; // For tenant invitations
  invitedBy: string; // User ID of who created the invitation
  expiresAt: Date;
  usedAt?: Date;
  isUsed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InvitationTokenSchema = new Schema<IInvitationToken>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email address",
      ],
    },
    token: {
      type: String,
      required: [true, "Token is required"],
      unique: true,
    },
    type: {
      type: String,
      required: [true, "Token type is required"],
      enum: [
        "tenant_invitation",
        "password_reset",
        "email_change",
        "email_verification",
      ],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: function (this: IInvitationToken) {
        return (
          this.type === "password_reset" ||
          this.type === "email_change" ||
          this.type === "email_verification"
        );
      },
    },
    newEmail: {
      type: String,
      lowercase: true,
      trim: true,
      required: function (this: IInvitationToken) {
        return this.type === "email_change";
      },
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email address",
      ],
    },
    tenantData: {
      firstName: {
        type: String,
        required: function (this: IInvitationToken) {
          return this.type === "tenant_invitation";
        },
        trim: true,
        maxlength: [50, "First name cannot exceed 50 characters"],
      },
      lastName: {
        type: String,
        required: function (this: IInvitationToken) {
          return this.type === "tenant_invitation";
        },
        trim: true,
        maxlength: [50, "Last name cannot exceed 50 characters"],
      },
      phone: {
        type: String,
        trim: true,
      },
      role: {
        type: String,
        default: "tenant",
      },
      avatar: {
        type: String,
        trim: true,
      },
      dateOfBirth: {
        type: String,
      },
      employmentInfo: {
        employer: {
          type: String,
          trim: true,
          maxlength: [100, "Employer name cannot exceed 100 characters"],
        },
        position: {
          type: String,
          trim: true,
          maxlength: [100, "Position cannot exceed 100 characters"],
        },
        income: {
          type: Number,
          min: [0, "Income cannot be negative"],
        },
        startDate: {
          type: String,
        },
      },
      emergencyContacts: [
        {
          name: {
            type: String,
            required: false,
            trim: true,
            maxlength: [100, "Name cannot exceed 100 characters"],
          },
          relationship: {
            type: String,
            required: false,
            trim: true,
            maxlength: [50, "Relationship cannot exceed 50 characters"],
          },
          phone: {
            type: String,
            required: false,
            trim: true,
          },
          email: {
            type: String,
            trim: true,
            lowercase: true,
            match: [
              /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
              "Please enter a valid email address",
            ],
          },
        },
      ],
      creditScore: {
        type: Number,
        min: [300, "Credit score cannot be less than 300"],
        max: [850, "Credit score cannot be more than 850"],
      },
      moveInDate: {
        type: String,
      },
      applicationNotes: {
        type: String,
        maxlength: [1000, "Application notes cannot exceed 1000 characters"],
      },
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Invited by user ID is required"],
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration date is required"],
    },
    usedAt: {
      type: Date,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "invitation_tokens",
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete (ret as any).__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Indexes for performance
InvitationTokenSchema.index({ email: 1, type: 1 });
InvitationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
InvitationTokenSchema.index({ isUsed: 1 });

// Virtual for checking if token is expired
InvitationTokenSchema.virtual("isExpired").get(function (
  this: IInvitationToken
) {
  return new Date() > this.expiresAt;
});

// Virtual for checking if token is valid (not used and not expired)
InvitationTokenSchema.virtual("isValid").get(function (this: IInvitationToken) {
  return !this.isUsed && !this.isExpired;
});

// Method to mark token as used
InvitationTokenSchema.methods.markAsUsed = function (this: IInvitationToken) {
  this.isUsed = true;
  this.usedAt = new Date();
  return this.save();
};

// Static method to find valid token
InvitationTokenSchema.statics.findValidToken = function (
  token: string,
  type?: string
) {
  const query: any = {
    token,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  };

  if (type) {
    query.type = type;
  }

  return this.findOne(query);
};

// Static method to cleanup expired tokens
InvitationTokenSchema.statics.cleanupExpired = function () {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      {
        isUsed: true,
        usedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }, // Remove used tokens older than 7 days
    ],
  });
};

const InvitationToken =
  mongoose.models?.InvitationToken ||
  mongoose.model<IInvitationToken>("InvitationToken", InvitationTokenSchema);

export default InvitationToken;

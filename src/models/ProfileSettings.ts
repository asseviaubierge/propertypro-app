import mongoose, { Schema, Document, Model } from "mongoose";

// Profile Settings Interface
export interface IProfileSettings extends Document {
  userId: mongoose.Types.ObjectId;

  // Basic Information
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  bio?: string;
  location?: string;
  city?: string;
  website?: string;
  address?: string;
  avatar?: string;

  // Professional Information
  jobTitle?: string;
  company?: string;
  dateOfBirth?: Date;
  gender?: "male" | "female" | "other" | "prefer_not_to_say";

  // Contact Preferences
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  };

  // Social Links
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };

  // User Preferences
  preferences?: {
    preferredContactMethod: "email" | "phone" | "sms";
    language: string;
    timezone: string;
    newsletter: boolean;
    marketingEmails: boolean;
  };

  // Metadata
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

// Profile Settings Schema
const profileSettingsSchema = new Schema<IProfileSettings>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Basic Information
    firstName: { type: String, trim: true, maxlength: 50 },
    lastName: { type: String, trim: true, maxlength: 50 },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    bio: { type: String, maxlength: 500 },
    location: { type: String, trim: true },
    city: { type: String, trim: true },
    website: { type: String, trim: true },
    address: { type: String, trim: true },
    avatar: { type: String, trim: true },

    // Professional Information
    jobTitle: { type: String, trim: true },
    company: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      default: "prefer_not_to_say",
    },

    // Contact Preferences
    emergencyContact: {
      name: { type: String, trim: true },
      relationship: { type: String, trim: true },
      phone: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },

    // Social Links
    socialLinks: {
      linkedin: { type: String, trim: true },
      twitter: { type: String, trim: true },
      facebook: { type: String, trim: true },
      instagram: { type: String, trim: true },
    },

    // User Preferences
    preferences: {
      preferredContactMethod: {
        type: String,
        enum: ["email", "phone", "sms"],
        default: "email",
      },
      language: { type: String, default: "en" },
      timezone: { type: String, default: "America/New_York" },
      newsletter: { type: Boolean, default: false },
      marketingEmails: { type: Boolean, default: false },
    },

    // Metadata
    isActive: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    collection: "profile_settings",
  }
);

// Indexes
profileSettingsSchema.index({ userId: 1 }, { unique: true });
profileSettingsSchema.index({ email: 1 }, { sparse: true });
profileSettingsSchema.index({ isActive: 1 });
profileSettingsSchema.index({ createdAt: -1 });

// Instance Methods
profileSettingsSchema.methods.updateProfile = function (
  profileData: Partial<IProfileSettings>
) {
  Object.assign(this, profileData);
  this.version += 1;
  this.updatedAt = new Date();
  return this.save();
};

profileSettingsSchema.methods.getPublicProfile = function () {
  return {
    firstName: this.firstName,
    lastName: this.lastName,
    bio: this.bio,
    location: this.location,
    city: this.city,
    website: this.website,
    avatar: this.avatar,
    jobTitle: this.jobTitle,
    company: this.company,
    socialLinks: this.socialLinks,
  };
};

// Static Methods
profileSettingsSchema.statics.findByUserId = function (userId: string) {
  // Ensure userId is properly converted to ObjectId if needed
  const objectId =
    typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;
  return this.findOne({ userId: objectId, isActive: true });
};

profileSettingsSchema.statics.createDefaultProfile = function (
  userId: string,
  userData?: Partial<IProfileSettings>
) {
  const objectId =
    typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;
  return this.create({
    userId: objectId,
    preferences: {
      preferredContactMethod: "email",
      language: "en",
      timezone: "America/New_York",
      newsletter: false,
      marketingEmails: false,
    },
    ...userData,
  });
};

profileSettingsSchema.statics.updateByUserId = function (
  userId: string,
  updateData: Partial<IProfileSettings>
) {
  const objectId =
    typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;
  return this.findOneAndUpdate(
    { userId: objectId, isActive: true },
    {
      ...updateData,
      $inc: { version: 1 },
      updatedAt: new Date(),
    },
    { new: true, upsert: true, runValidators: true }
  );
};

// Pre-save middleware
profileSettingsSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.version += 1;
  }
  next();
});

// Create and export the model with safer initialization
let ProfileSettings: Model<IProfileSettings>;

try {
  // Try to get existing model first
  ProfileSettings = mongoose.model<IProfileSettings>("ProfileSettings");
} catch (error) {
  // Model doesn't exist, create it
  ProfileSettings = mongoose.model<IProfileSettings>(
    "ProfileSettings",
    profileSettingsSchema
  );
}

export default ProfileSettings;
export type { IProfileSettings };

import mongoose, { Schema, Document, Model } from "mongoose";

// Privacy Settings Interface
export interface IPrivacySettings extends Document {
  userId: mongoose.Types.ObjectId;

  // Profile Visibility
  profileVisibility: "public" | "private" | "contacts";
  showOnlineStatus: boolean;
  showContactInfo: boolean;
  showActivityStatus: boolean;

  // Data Collection & Usage
  allowDataCollection: boolean;
  allowMarketing: boolean;
  shareUsageData: boolean;
  allowThirdPartyIntegrations: boolean;
  allowSearchEngineIndexing: boolean;
  shareLocationData: boolean;

  // Communication Preferences
  allowDirectMessages: boolean;
  allowGroupInvitations: boolean;
  allowEventInvitations: boolean;
  allowNewsletters: boolean;

  // Data Retention
  dataRetentionPeriod: number; // in days
  autoDeleteInactiveData: boolean;

  // Cookie Preferences
  cookiePreferences: {
    essential: boolean; // Always true, cannot be disabled
    analytics: boolean;
    marketing: boolean;
    personalization: boolean;
    functional: boolean;
  };

  // Data Export & Portability
  dataExport: {
    allowExport: boolean;
    exportFormat: "json" | "csv" | "xml";
    includeMetadata: boolean;
    encryptExport: boolean;
  };

  // Account Deletion
  accountDeletion: {
    allowSelfDeletion: boolean;
    retainDataAfterDeletion: boolean;
    retentionPeriod: number; // in days
    anonymizeData: boolean;
  };

  // Third-Party Integrations
  integrations: {
    allowGoogleIntegration: boolean;
    allowMicrosoftIntegration: boolean;
    allowSocialMediaIntegration: boolean;
    allowPaymentIntegration: boolean;
    allowCalendarIntegration: boolean;
  };

  // Audit & Logging
  auditSettings: {
    logDataAccess: boolean;
    logDataChanges: boolean;
    logExports: boolean;
    logSharing: boolean;
    retainAuditLogs: number; // in days
  };

  // GDPR & Compliance
  gdprCompliance: {
    consentGiven: boolean;
    consentDate?: Date;
    consentVersion: string;
    rightToBeForgotten: boolean;
    dataPortabilityRequested: boolean;
  };

  // Metadata
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

// Privacy Settings Schema
const privacySettingsSchema = new Schema<IPrivacySettings>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Profile Visibility
    profileVisibility: {
      type: String,
      enum: ["public", "private", "contacts"],
      default: "private",
    },
    showOnlineStatus: { type: Boolean, default: true },
    showContactInfo: { type: Boolean, default: false },
    showActivityStatus: { type: Boolean, default: true },

    // Data Collection & Usage
    allowDataCollection: { type: Boolean, default: true },
    allowMarketing: { type: Boolean, default: false },
    shareUsageData: { type: Boolean, default: true },
    allowThirdPartyIntegrations: { type: Boolean, default: true },
    allowSearchEngineIndexing: { type: Boolean, default: false },
    shareLocationData: { type: Boolean, default: false },

    // Communication Preferences
    allowDirectMessages: { type: Boolean, default: true },
    allowGroupInvitations: { type: Boolean, default: true },
    allowEventInvitations: { type: Boolean, default: true },
    allowNewsletters: { type: Boolean, default: false },

    // Data Retention
    dataRetentionPeriod: { type: Number, default: 365, min: 30, max: 2555 },
    autoDeleteInactiveData: { type: Boolean, default: false },

    // Cookie Preferences
    cookiePreferences: {
      essential: { type: Boolean, default: true }, // Cannot be disabled
      analytics: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false },
      personalization: { type: Boolean, default: true },
      functional: { type: Boolean, default: true },
    },

    // Data Export & Portability
    dataExport: {
      allowExport: { type: Boolean, default: true },
      exportFormat: {
        type: String,
        enum: ["json", "csv", "xml"],
        default: "json",
      },
      includeMetadata: { type: Boolean, default: false },
      encryptExport: { type: Boolean, default: true },
    },

    // Account Deletion
    accountDeletion: {
      allowSelfDeletion: { type: Boolean, default: true },
      retainDataAfterDeletion: { type: Boolean, default: false },
      retentionPeriod: { type: Number, default: 30, min: 0, max: 365 },
      anonymizeData: { type: Boolean, default: true },
    },

    // Third-Party Integrations
    integrations: {
      allowGoogleIntegration: { type: Boolean, default: false },
      allowMicrosoftIntegration: { type: Boolean, default: false },
      allowSocialMediaIntegration: { type: Boolean, default: false },
      allowPaymentIntegration: { type: Boolean, default: true },
      allowCalendarIntegration: { type: Boolean, default: true },
    },

    // Audit & Logging
    auditSettings: {
      logDataAccess: { type: Boolean, default: true },
      logDataChanges: { type: Boolean, default: true },
      logExports: { type: Boolean, default: true },
      logSharing: { type: Boolean, default: true },
      retainAuditLogs: { type: Number, default: 90, min: 30, max: 365 },
    },

    // GDPR & Compliance
    gdprCompliance: {
      consentGiven: { type: Boolean, default: false },
      consentDate: { type: Date },
      consentVersion: { type: String, default: "1.0" },
      rightToBeForgotten: { type: Boolean, default: false },
      dataPortabilityRequested: { type: Boolean, default: false },
    },

    // Metadata
    isActive: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    collection: "privacy_settings",
  }
);

// Indexes
privacySettingsSchema.index({ userId: 1 }, { unique: true });
privacySettingsSchema.index({ isActive: 1 });
privacySettingsSchema.index({ profileVisibility: 1 });
privacySettingsSchema.index({ "gdprCompliance.consentGiven": 1 });
privacySettingsSchema.index({ createdAt: -1 });

// Instance Methods
privacySettingsSchema.methods.updatePrivacy = function (
  privacyData: Partial<IPrivacySettings>
) {
  Object.assign(this, privacyData);
  this.version += 1;
  this.updatedAt = new Date();
  return this.save();
};

privacySettingsSchema.methods.giveGDPRConsent = function (
  version: string = "1.0"
) {
  this.gdprCompliance.consentGiven = true;
  this.gdprCompliance.consentDate = new Date();
  this.gdprCompliance.consentVersion = version;
  return this.save();
};

privacySettingsSchema.methods.revokeGDPRConsent = function () {
  this.gdprCompliance.consentGiven = false;
  this.gdprCompliance.consentDate = undefined;
  return this.save();
};

privacySettingsSchema.methods.requestDataPortability = function () {
  this.gdprCompliance.dataPortabilityRequested = true;
  return this.save();
};

privacySettingsSchema.methods.requestRightToBeForgotten = function () {
  this.gdprCompliance.rightToBeForgotten = true;
  return this.save();
};

// Static Methods
privacySettingsSchema.statics.findByUserId = function (userId: string) {
  return this.findOne({ userId, isActive: true });
};

privacySettingsSchema.statics.createDefaultPrivacy = function (userId: string) {
  return this.create({
    userId,
    profileVisibility: "private",
    showOnlineStatus: true,
    showContactInfo: false,
    showActivityStatus: true,
    allowDataCollection: true,
    allowMarketing: false,
    shareUsageData: true,
    allowThirdPartyIntegrations: true,
    allowSearchEngineIndexing: false,
    shareLocationData: false,
    allowDirectMessages: true,
    allowGroupInvitations: true,
    allowEventInvitations: true,
    allowNewsletters: false,
    dataRetentionPeriod: 365,
    autoDeleteInactiveData: false,
    cookiePreferences: {
      essential: true,
      analytics: true,
      marketing: false,
      personalization: true,
      functional: true,
    },
    dataExport: {
      allowExport: true,
      exportFormat: "json",
      includeMetadata: false,
      encryptExport: true,
    },
    accountDeletion: {
      allowSelfDeletion: true,
      retainDataAfterDeletion: false,
      retentionPeriod: 30,
      anonymizeData: true,
    },
    integrations: {
      allowGoogleIntegration: false,
      allowMicrosoftIntegration: false,
      allowSocialMediaIntegration: false,
      allowPaymentIntegration: true,
      allowCalendarIntegration: true,
    },
    auditSettings: {
      logDataAccess: true,
      logDataChanges: true,
      logExports: true,
      logSharing: true,
      retainAuditLogs: 90,
    },
    gdprCompliance: {
      consentGiven: false,
      consentVersion: "1.0",
      rightToBeForgotten: false,
      dataPortabilityRequested: false,
    },
  });
};

// Pre-save middleware
privacySettingsSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.version += 1;
  }

  // Ensure essential cookies are always enabled
  if (this.cookiePreferences) {
    this.cookiePreferences.essential = true;
  }

  next();
});

// Create and export the model with safer initialization
let PrivacySettings: Model<IPrivacySettings>;

try {
  // Try to get existing model first
  PrivacySettings = mongoose.model<IPrivacySettings>("PrivacySettings");
} catch (error) {
  // Model doesn't exist, create it
  PrivacySettings = mongoose.model<IPrivacySettings>(
    "PrivacySettings",
    privacySettingsSchema
  );
}

export default PrivacySettings;
export type { IPrivacySettings };

import mongoose, { Schema, Model } from "mongoose";

// Audit action categories
export enum AuditCategory {
  AUTHENTICATION = "authentication",
  USER_MANAGEMENT = "user_management",
  PROPERTY_MANAGEMENT = "property_management",
  TENANT_MANAGEMENT = "tenant_management",
  LEASE_MANAGEMENT = "lease_management",
  PAYMENT_MANAGEMENT = "payment_management",
  MAINTENANCE_MANAGEMENT = "maintenance_management",
  DOCUMENT_MANAGEMENT = "document_management",
  SYSTEM_CONFIGURATION = "system_configuration",
  DATA_EXPORT = "data_export",
  DATA_IMPORT = "data_import",
  COMPLIANCE = "compliance",
  SECURITY = "security",
  COMMUNICATION = "communication",
}

// Audit action types
export enum AuditAction {
  // Authentication
  LOGIN = "login",
  LOGOUT = "logout",
  LOGIN_FAILED = "login_failed",
  PASSWORD_CHANGED = "password_changed",
  PASSWORD_RESET = "password_reset",

  // CRUD Operations
  CREATE = "create",
  READ = "read",
  UPDATE = "update",
  DELETE = "delete",
  RESTORE = "restore",

  // Bulk Operations
  BULK_CREATE = "bulk_create",
  BULK_UPDATE = "bulk_update",
  BULK_DELETE = "bulk_delete",
  BULK_EXPORT = "bulk_export",
  BULK_IMPORT = "bulk_import",

  // Document Operations
  DOCUMENT_UPLOAD = "document_upload",
  DOCUMENT_DOWNLOAD = "document_download",
  DOCUMENT_VIEW = "document_view",
  DOCUMENT_SHARE = "document_share",
  DOCUMENT_SIGN = "document_sign",

  // Payment Operations
  PAYMENT_PROCESSED = "payment_processed",
  PAYMENT_REFUNDED = "payment_refunded",
  PAYMENT_FAILED = "payment_failed",

  // System Operations
  SETTINGS_CHANGED = "settings_changed",
  ROLE_ASSIGNED = "role_assigned",
  PERMISSION_GRANTED = "permission_granted",
  PERMISSION_REVOKED = "permission_revoked",

  // Security Events
  UNAUTHORIZED_ACCESS = "unauthorized_access",
  SUSPICIOUS_ACTIVITY = "suspicious_activity",
  DATA_BREACH_ATTEMPT = "data_breach_attempt",

  // Communication
  EMAIL_SENT = "email_sent",
  SMS_SENT = "sms_sent",
  NOTIFICATION_SENT = "notification_sent",
}

// Audit severity levels
export enum AuditSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

// Audit log interface
export interface IAuditLog {
  _id: string;

  // Event identification
  category: AuditCategory;
  action: AuditAction;
  severity: AuditSeverity;

  // User information
  userId?: mongoose.Types.ObjectId;
  userEmail?: string;
  userRole?: string;
  impersonatedBy?: mongoose.Types.ObjectId; // For admin impersonation

  // Target resource information
  resourceType?: string; // 'property', 'tenant', 'lease', etc.
  resourceId?: mongoose.Types.ObjectId;
  resourceName?: string;

  // Event details
  description: string;
  details?: Record<string, any>;
  oldValues?: Record<string, any>; // For update operations
  newValues?: Record<string, any>; // For update operations

  // Request information
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;

  // Metadata
  timestamp: Date;
  source: string; // 'web', 'api', 'system', 'mobile'
  tags?: string[];

  // Compliance and retention
  retentionDate?: Date;
  complianceFlags?: string[];

  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    category: {
      type: String,
      enum: Object.values(AuditCategory),
      required: [true, "Audit category is required"],
    },
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: [true, "Audit action is required"],
    },
    severity: {
      type: String,
      enum: Object.values(AuditSeverity),
      default: AuditSeverity.LOW,
    },

    // User information
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    userEmail: {
      type: String,
    },
    userRole: {
      type: String,
    },
    impersonatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // Resource information
    resourceType: {
      type: String,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
    },
    resourceName: {
      type: String,
    },

    // Event details
    description: {
      type: String,
      required: [true, "Description is required"],
      maxlength: [1000, "Description too long"],
    },
    details: {
      type: Schema.Types.Mixed,
    },
    oldValues: {
      type: Schema.Types.Mixed,
    },
    newValues: {
      type: Schema.Types.Mixed,
    },

    // Request information
    ipAddress: {
      type: String,
      index: true,
    },
    userAgent: {
      type: String,
    },
    requestId: {
      type: String,
      index: true,
    },
    sessionId: {
      type: String,
      index: true,
    },

    // Metadata
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["web", "api", "system", "mobile"],
      default: "web",
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },

    // Compliance
    retentionDate: {
      type: Date,
    },
    complianceFlags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "audit_logs",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ category: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ severity: 1, timestamp: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
AuditLogSchema.index({ ipAddress: 1, timestamp: -1 });
AuditLogSchema.index({ retentionDate: 1 }); // For cleanup jobs

// Compound indexes for common queries
AuditLogSchema.index({ userId: 1, category: 1, timestamp: -1 });
AuditLogSchema.index({ resourceType: 1, action: 1, timestamp: -1 });
AuditLogSchema.index({ severity: 1, category: 1, timestamp: -1 });

// Text search index
AuditLogSchema.index({
  description: "text",
  resourceName: "text",
  userEmail: "text",
});

// Virtual for formatted timestamp
AuditLogSchema.virtual("formattedTimestamp").get(function () {
  return this.timestamp.toISOString();
});

// Virtual for user display name
AuditLogSchema.virtual("userDisplayName").get(function () {
  if (this.userEmail) {
    return this.userEmail;
  }
  return "System";
});

// Static methods
AuditLogSchema.statics.logEvent = async function (
  eventData: Partial<IAuditLog>
) {
  const auditLog = new this({
    ...eventData,
    timestamp: eventData.timestamp || new Date(),
  });

  return await auditLog.save();
};

AuditLogSchema.statics.getActivityForUser = async function (
  userId: string,
  limit: number = 50,
  offset: number = 0
) {
  return await this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(offset)
    .populate("userId", "firstName lastName email")
    .lean();
};

AuditLogSchema.statics.getActivityForResource = async function (
  resourceType: string,
  resourceId: string,
  limit: number = 50
) {
  return await this.find({ resourceType, resourceId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate("userId", "firstName lastName email")
    .lean();
};

AuditLogSchema.statics.getSecurityEvents = async function (
  startDate?: Date,
  endDate?: Date,
  severity?: AuditSeverity
) {
  const query: any = {
    category: AuditCategory.SECURITY,
  };

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = startDate;
    if (endDate) query.timestamp.$lte = endDate;
  }

  if (severity) {
    query.severity = severity;
  }

  return await this.find(query)
    .sort({ timestamp: -1 })
    .populate("userId", "firstName lastName email")
    .lean();
};

AuditLogSchema.statics.cleanupExpiredLogs = async function () {
  const now = new Date();
  const result = await this.deleteMany({
    retentionDate: { $lte: now },
  });

  return result.deletedCount;
};

// Instance methods
AuditLogSchema.methods.addTag = function (tag: string) {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
  }
  return this.save();
};

AuditLogSchema.methods.removeTag = function (tag: string) {
  this.tags = this.tags.filter((t: string) => t !== tag);
  return this.save();
};

AuditLogSchema.methods.setRetentionDate = function (days: number) {
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() + days);
  this.retentionDate = retentionDate;
  return this.save();
};

// Pre-save middleware
AuditLogSchema.pre("save", function (next) {
  // Set default retention date if not specified (7 years for compliance)
  if (!this.retentionDate) {
    const retentionDate = new Date();
    retentionDate.setFullYear(retentionDate.getFullYear() + 7);
    this.retentionDate = retentionDate;
  }

  // Add compliance flags based on category and action
  if (
    this.category === AuditCategory.COMPLIANCE ||
    this.action === AuditAction.DATA_BREACH_ATTEMPT ||
    this.severity === AuditSeverity.CRITICAL
  ) {
    if (!this.complianceFlags?.includes("high_priority")) {
      this.complianceFlags = this.complianceFlags || [];
      this.complianceFlags.push("high_priority");
    }
  }

  next();
});

// Create and export the model
const AuditLog: Model<IAuditLog> =
  mongoose.models?.AuditLog ||
  mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

export default AuditLog;

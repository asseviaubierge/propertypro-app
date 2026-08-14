import mongoose, { Schema, Model, HydratedDocument } from "mongoose";
import bcrypt from "bcryptjs";
import {
  IUser,
  IUserMethods,
  UserRole,
  AccountType,
  IEmergencyContact,
} from "@/types";

// Type for User document with methods
export type UserDocument = HydratedDocument<IUser, IUserMethods>;

// Emergency Contact subdocument schema
const EmergencyContactSchema = new Schema<IEmergencyContact>(
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
  { _id: false }
);

// Employment Info subdocument schema
const EmploymentInfoSchema = new Schema(
  {
    employer: {
      type: String,
      required: [true, "Employer name is required"],
      trim: true,
      maxlength: [200, "Employer name cannot exceed 200 characters"],
    },
    position: {
      type: String,
      required: [true, "Position is required"],
      trim: true,
      maxlength: [100, "Position cannot exceed 100 characters"],
    },
    income: {
      type: Number,
      required: [true, "Income is required"],
      min: [0, "Income cannot be negative"],
      max: [10000000, "Income cannot exceed $10,000,000"],
    },
    startDate: {
      type: Date,
      required: [true, "Employment start date is required"],
    },
  },
  { _id: false }
);

const UserSchema = new Schema<
  IUser,
  Model<IUser, Record<string, never>, IUserMethods>,
  IUserMethods
>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email address",
      ],
    },
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters long"],
      select: false, // Don't include password in queries by default
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    phone: {
      type: String,
      trim: true,
      match: [
        /^[\+]?[\d\s\-\(\)\.]{10,20}$/,
        "Please enter a valid phone number",
      ],
    },
    whatsappNumber: {
      type: String,
      trim: true,
      default: "",
    },
    whatsappVerificationStatus: {
      type: String,
      enum: ["not_requested", "pending", "verified", "rejected"],
      default: "not_requested",
      index: true,
    },
    whatsappVerificationCode: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    whatsappVerificationRequestedAt: {
      type: Date,
      default: null,
    },
    whatsappVerificationRejectedAt: {
      type: Date,
      default: null,
    },
    whatsappVerifiedAt: {
      type: Date,
      default: null,
      index: true,
    },
    whatsappVerifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    whatsappPreviousNumber: {
      type: String,
      trim: true,
      default: "",
    },
    whatsappChangeRequestedNumber: {
      type: String,
      trim: true,
      default: "",
    },
    whatsappChangeReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    whatsappChangeStatus: {
      type: String,
      enum: [
        "none",
        "pending",
        "approved",
        "verification_pending",
        "rejected",
        "completed",
      ],
      default: "none",
      index: true,
    },
    whatsappChangeRequestedAt: {
      type: Date,
      default: null,
    },
    whatsappChangeReviewedAt: {
      type: Date,
      default: null,
    },
    whatsappChangeReviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    role: {
      type: String,
      default: UserRole.TENANT,
      required: [true, "User role is required"],
      trim: true,
      lowercase: true,
    },
    
        // Professional / property management identity
    accountType: {
      type: String,
      enum: Object.values(AccountType),
      default: undefined,
    },
    cip: {
      type: String,
      trim: true,
      minlength: [5, "Le numéro CIP doit contenir au moins 5 caractères"],
      maxlength: [30, "Le numéro CIP ne peut pas dépasser 30 caractères"],
    },
    businessName: {
      type: String,
      trim: true,
      maxlength: [150, "Le nom commercial ne peut pas dépasser 150 caractères"],
    },
    businessLogo: {
      type: String,
      trim: true,
      default: null,
    },
    ifu: {
      type: String,
      trim: true,
      maxlength: [50, "Le numéro IFU ne peut pas dépasser 50 caractères"],
    },
    rccm: {
      type: String,
      trim: true,
      maxlength: [100, "Le numéro RCCM ne peut pas dépasser 100 caractères"],
    },
    
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      maxlength: [500, "Bio cannot exceed 500 characters"],
      trim: true,
    },
    location: {
      type: String,
      maxlength: [100, "Location cannot exceed 100 characters"],
      trim: true,
    },
    city: {
      type: String,
      maxlength: [50, "City cannot exceed 50 characters"],
      trim: true,
    },
    website: {
      type: String,
      trim: true,
      match: [
        /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
        "Please enter a valid website URL",
      ],
    },
    address: {
      type: String,
      maxlength: [200, "Address cannot exceed 200 characters"],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    emailVerified: {
      type: Date,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    // Security / authentication tracking
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    // Account/user that originally created this record. For tenant users this
    // preserves visibility before the first lease is assigned.
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    // Property Manager responsible for this tenant application. Unlike
    // createdBy, this field has a single business meaning and is used by the
    // tenant scope before the first lease exists.
    managerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    // Tenant-specific fields (only applicable when role is 'tenant')
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function (date: Date) {
          if (!date) return true; // Optional field
          const now = new Date();
          const birthDate = new Date(date);

          // Check if date is valid
          if (isNaN(birthDate.getTime())) return false;

          // Check if date is not in the future
          if (birthDate > now) return false;

          const age =
            (now.getTime() - birthDate.getTime()) /
            (365.25 * 24 * 60 * 60 * 1000);
          return age >= 18 && age <= 120;
        },
        message: "User must be between 18 and 120 years old",
      },
    },
    ssn: {
  type: String,
  trim: true,
  select: false,
  required: [
    function (this: IUser) {
      return this.role === UserRole.TENANT;
    },
    "Le numéro CIP est obligatoire pour un locataire",
  ],
  validate: {
    validator: function (cip: string) {
      if (!cip) return this.role !== UserRole.TENANT;
      return /^\d{5,15}$/.test(cip);
    },
    message: "Le numéro CIP doit contenir entre 5 et 15 chiffres",
  },
},
    employmentInfo: {
      type: EmploymentInfoSchema,
      default: null,
    },
    emergencyContacts: {
      type: [EmergencyContactSchema],
      default: [],
      validate: {
        validator: function (contacts: IEmergencyContact[]) {
          return contacts.length <= 5;
        },
        message: "Cannot have more than 5 emergency contacts",
      },
    },
    documents: {
      type: [String],
      default: [],
      validate: {
        validator: function (docs: string[]) {
          return docs.length <= 20;
        },
        message: "Cannot have more than 20 documents",
      },
    },
    creditScore: {
      type: Number,
      min: [300, "Credit score cannot be less than 300"],
      max: [850, "Credit score cannot exceed 850"],
    },
    backgroundCheckStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    // Overall tenant status for workflow management
    tenantStatus: {
      type: String,
      enum: [
        "application_submitted",
        "under_review",
        "approved",
        "active",
        "inactive",
        "moved_out",
        "terminated",
      ],
      default: "application_submitted",
      validate: {
        validator: function (status: string) {
          // Only validate for tenant role
          if (this.role !== "tenant") return true;
          return [
            "application_submitted",
            "under_review",
            "approved",
            "active",
            "inactive",
            "moved_out",
            "terminated",
          ].includes(status);
        },
        message: "Invalid tenant status",
      },
    },
    applicationDate: {
      type: Date,
      default: Date.now,
    },
    // Screening and application data
    screeningScore: {
      type: Number,
      min: [0, "Screening score cannot be negative"],
      max: [100, "Screening score cannot exceed 100"],
    },
    applicationNotes: {
      type: String,
      maxlength: [1000, "Application notes cannot exceed 1000 characters"],
      trim: true,
    },
    // Lease relationship
    currentLeaseId: {
      type: Schema.Types.ObjectId,
      ref: "Lease",
      default: null,
    },
    leaseHistory: [
      {
        leaseId: {
          type: Schema.Types.ObjectId,
          ref: "Lease",
        },
        startDate: Date,
        endDate: Date,
        status: {
          type: String,
          enum: ["active", "completed", "terminated", "cancelled"],
        },
      },
    ],
    moveInDate: {
      type: Date,
      validate: {
        validator: function (date: Date) {
          if (!date) return true; // Optional field

          const moveDate = new Date(date);

          // Check if date is valid
          if (isNaN(moveDate.getTime())) return false;

          // Allow move-in dates from 5 years ago to 5 years in the future
          // This accommodates both historical records and future planning
          const fiveYearsAgo = new Date();
          fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

          const fiveYearsFromNow = new Date();
          fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);

          return moveDate >= fiveYearsAgo && moveDate <= fiveYearsFromNow;
        },
        message:
          "Move-in date must be within reasonable range (5 years ago to 5 years from now)",
      },
    },
    moveOutDate: {
      type: Date,
      validate: {
        validator: function (date: Date) {
          if (!date || !this.moveInDate) return true; // Optional fields
          return date >= this.moveInDate;
        },
        message: "Move-out date cannot be before move-in date",
      },
    },
    // Status change audit trail
    statusHistory: [
      {
        status: {
          type: String,
          required: true,
        },
        changedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        reason: {
          type: String,
          maxlength: [500, "Reason cannot exceed 500 characters"],
          trim: true,
        },
        notes: {
          type: String,
          maxlength: [1000, "Notes cannot exceed 1000 characters"],
          trim: true,
        },
      },
    ],
    // Additional tenant metadata
    preferredContactMethod: {
      type: String,
      enum: ["email", "phone", "text", "app"],
      default: "email",
    },
    emergencyContactVerified: {
      type: Boolean,
      default: false,
    },
    backgroundCheckCompletedAt: {
      type: Date,
    },
    lastStatusUpdate: {
      type: Date,
      default: Date.now,
    },

    // Third-party integrations
    integrations: {
      googleCalendar: {
        connected: {
          type: Boolean,
          default: false,
        },
        accessToken: {
          type: String,
        },
        refreshToken: {
          type: String,
        },
        expiryDate: {
          type: Date,
        },
        connectedAt: {
          type: Date,
        },
        lastSync: {
          type: Date,
        },
        autoSync: {
          type: Boolean,
          default: false,
        },
        selectedCalendarId: {
          type: String,
        },
        syncDirection: {
          type: String,
          enum: ["import", "export", "bidirectional"],
          default: "bidirectional",
        },
        syncInterval: {
          type: Number,
          default: 15, // minutes
        },
      },
    },

    // Notification preferences
    notificationPreferences: {
      calendar: {
        email: {
          enabled: {
            type: Boolean,
            default: true,
          },
          invitations: {
            type: Boolean,
            default: true,
          },
          reminders: {
            type: Boolean,
            default: true,
          },
          updates: {
            type: Boolean,
            default: true,
          },
          cancellations: {
            type: Boolean,
            default: true,
          },
          dailyDigest: {
            type: Boolean,
            default: false,
          },
          weeklyDigest: {
            type: Boolean,
            default: true,
          },
        },
        sms: {
          enabled: {
            type: Boolean,
            default: false,
          },
          reminders: {
            type: Boolean,
            default: false,
          },
          urgentUpdates: {
            type: Boolean,
            default: false,
          },
        },
        push: {
          enabled: {
            type: Boolean,
            default: true,
          },
          reminders: {
            type: Boolean,
            default: true,
          },
          updates: {
            type: Boolean,
            default: true,
          },
          invitations: {
            type: Boolean,
            default: true,
          },
        },
        reminderTiming: {
          default: {
            type: [Number],
            default: [15, 60],
          },
          highPriority: {
            type: [Number],
            default: [15, 60, 1440],
          },
          lowPriority: {
            type: [Number],
            default: [60],
          },
        },
        digestTiming: {
          dailyTime: {
            type: String,
            default: "08:00",
          },
          weeklyDay: {
            type: Number,
            default: 1,
          },
          weeklyTime: {
            type: String,
            default: "09:00",
          },
        },
        quietHours: {
          enabled: {
            type: Boolean,
            default: true,
          },
          startTime: {
            type: String,
            default: "22:00",
          },
          endTime: {
            type: String,
            default: "08:00",
          },
          timezone: {
            type: String,
            default: "local",
          },
        },
      },
    },
  },
  {
    timestamps: true,
    collection: "users", // Explicitly set collection name
    toJSON: {
      virtuals: true,
      transform: function (_doc, ret: any) {
        delete (ret as any).password;
        delete (ret as any).__v;
        delete (ret as any).ssn; // Never expose SSN in JSON
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Indexes for performance - with error handling to prevent emitWarning issues
try {
  // email index is already created by unique: true
  UserSchema.index({ role: 1 });
  UserSchema.index({ isActive: 1 });
  UserSchema.index({ deletedAt: 1 });
  UserSchema.index({ createdAt: -1 });
  // Tenant-specific indexes
  UserSchema.index({ applicationDate: -1 });
  UserSchema.index({ backgroundCheckStatus: 1 });
  UserSchema.index({ moveInDate: 1 });
  UserSchema.index({ moveOutDate: 1 });
} catch (error) {
  // Silently handle index creation errors in development
  if (process.env.NODE_ENV !== "production") {
    console.warn("User index creation warning:", error);
  }
}

// Virtual for full name
UserSchema.virtual("fullName").get(function (this: UserDocument) {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for initials
UserSchema.virtual("initials").get(function (this: UserDocument) {
  return `${this.firstName.charAt(0)}${this.lastName.charAt(0)}`.toUpperCase();
});

// Virtual for tenant age (only applicable for tenants)
UserSchema.virtual("age").get(function (this: UserDocument) {
  if (!this.dateOfBirth) return null;
  const age =
    (Date.now() - this.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.floor(age);
});

// Virtual for application status (only applicable for tenants)
UserSchema.virtual("applicationStatus").get(function (this: UserDocument) {
  if (this.role !== "tenant") return null;
  return this.tenantStatus || "application_submitted";
});

// Virtual for display status with user-friendly labels
UserSchema.virtual("displayStatus").get(function (this: UserDocument) {
  if (this.role !== "tenant") return null;

  const statusMap: Record<string, string> = {
    application_submitted: "Application Submitted",
    under_review: "En cours d’examen",
    approved: "Approuvée",
    active: "Active Tenant",
    inactive: "Inactif",
    moved_out: "Partis",
    terminated: "Terminated",
  };

  return statusMap[this.tenantStatus || ""] || "Unknown Status";
});

// Virtual for status color coding
UserSchema.virtual("statusColor").get(function (this: UserDocument) {
  if (this.role !== "tenant") return null;

  const colorMap: Record<string, string> = {
    application_submitted: "secondary",
    under_review: "outline",
    approved: "default",
    active: "default",
    inactive: "secondary",
    moved_out: "secondary",
    terminated: "destructive",
  };

  return colorMap[this.tenantStatus || ""] || "outline";
});

// Virtual for tenancy duration (only applicable for tenants)
UserSchema.virtual("tenancyDuration").get(function (this: UserDocument) {
  if (!this.moveInDate) return null;
  const endDate = this.moveOutDate || new Date();
  const duration = endDate.getTime() - this.moveInDate.getTime();
  return Math.floor(duration / (24 * 60 * 60 * 1000)); // Days
});

// Pre-save middleware to hash password
UserSchema.pre("save", async function (this: UserDocument, next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) return next();

  try {
    // Hash password with cost of 12
    const hashedPassword = await bcrypt.hash(this.password!, 12);
    this.password = hashedPassword;
    // Track when the password was set/changed for the security overview
    this.passwordChangedAt = new Date();
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Pre-save middleware for tenant status management
UserSchema.pre("save", async function (this: UserDocument, next) {
  // Only apply to tenants
  if (this.role !== "tenant") return next();

  try {
    // Store original tenant status for validation if status is being modified
    if (
      !this.isNew &&
      this.isModified("tenantStatus") &&
      !this.$locals.originalTenantStatus
    ) {
      const UserModel = this.constructor as Model<IUser>;
      const original = await UserModel.findById(this._id).select(
        "tenantStatus"
      );
      this.$locals.originalTenantStatus =
        original?.tenantStatus || "application_submitted";
    }
    // Initialize tenant status for new tenants
    if (this.isNew && !this.tenantStatus) {
      this.tenantStatus = "application_submitted";
      this.lastStatusUpdate = new Date();

      // Add initial status to history if not already present
      if (!this.statusHistory || this.statusHistory.length === 0) {
        this.statusHistory = [
          {
            status: "application_submitted",
            changedBy: this._id, // Self-initiated
            changedAt: new Date(),
            reason: "Initial application submission",
            notes: "Tenant application created",
          },
        ];
      }
    }

    // Update lastStatusUpdate if tenantStatus changed
    if (this.isModified("tenantStatus")) {
      this.lastStatusUpdate = new Date();
    }

    // Validate status transitions for existing tenants
    if (!this.isNew && this.isModified("tenantStatus")) {
      const validTransitions: Record<string, string[]> = {
        application_submitted: ["under_review", "approved", "terminated"],
        under_review: ["approved", "terminated"],
        approved: ["active", "terminated"],
        active: ["inactive", "moved_out", "terminated"],
        inactive: ["active", "moved_out", "terminated"],
        moved_out: ["terminated"],
        terminated: [], // Terminal state
      };

      const originalStatus: string = this.isNew
        ? "application_submitted"
        : (this.$locals.originalTenantStatus as string) ||
          (this.tenantStatus as string) ||
          "application_submitted";
      const newStatus = this.tenantStatus || "application_submitted";

      if (!validTransitions[originalStatus]?.includes(newStatus)) {
        return next(
          new Error(
            `Invalid status transition from ${originalStatus} to ${newStatus}`
          )
        );
      }
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance method to check password
UserSchema.methods.comparePassword = async function (
  this: UserDocument,
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Tenant-specific instance methods with enhanced status workflow
UserSchema.methods.changeStatus = function (
  this: UserDocument,
  newStatus: string,
  changedBy: string,
  reason?: string,
  notes?: string,
  moveDate?: Date
) {
  if (this.role !== "tenant")
    throw new Error("Only tenants can have status changes");

  const validTransitions: Record<string, string[]> = {
    application_submitted: ["under_review", "approved", "terminated"],
    under_review: ["approved", "terminated"],
    approved: ["active", "terminated"],
    active: ["inactive", "moved_out", "terminated"],
    inactive: ["active", "moved_out", "terminated"],
    moved_out: ["terminated"],
    terminated: [], // Terminal state
  };

  const rawCurrentStatus = String(this.tenantStatus || "application_submitted").toLowerCase();
  const currentStatus = ["submitted", "pending", "soumis"].includes(rawCurrentStatus)
    ? "application_submitted"
    : rawCurrentStatus;
  if (this.tenantStatus !== currentStatus) {
    this.tenantStatus = currentStatus as any;
  }
  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    throw new Error(
      `Invalid status transition from ${currentStatus} to ${newStatus}`
    );
  }

  // Add to status history
  if (!this.statusHistory) {
    this.statusHistory = [];
  }
  this.statusHistory.push({
    status: newStatus,
    changedBy: changedBy as any,
    changedAt: new Date(),
    reason: reason || "",
    notes: notes || "",
  });

  this.tenantStatus = newStatus as any;
  this.lastStatusUpdate = new Date();

  // Update related fields based on status
  if (newStatus === "approved") {
    this.backgroundCheckStatus = "approved";
    this.backgroundCheckCompletedAt = new Date();
  } else if (newStatus === "terminated") {
    this.backgroundCheckStatus = "rejected";
  }

  // Handle move dates
  if (newStatus === "active" && moveDate) {
    this.moveInDate = moveDate;
  } else if (newStatus === "moved_out" && moveDate) {
    this.moveOutDate = moveDate;
  }

  return this.save();
};

UserSchema.methods.approveApplication = function (
  this: UserDocument,
  changedBy: string,
  reason?: string,
  notes?: string
) {
  return this.changeStatus(
    "approved",
    changedBy,
    reason || "Application approved",
    notes
  );
};

UserSchema.methods.rejectApplication = function (
  this: UserDocument,
  changedBy: string,
  reason?: string,
  notes?: string
) {
  return this.changeStatus(
    "terminated",
    changedBy,
    reason || "Application rejected",
    notes
  );
};

UserSchema.methods.moveIn = function (
  this: UserDocument,
  date?: Date,
  changedBy?: string,
  leaseId?: string
) {
  if (this.role !== "tenant") throw new Error("Only tenants can move in");

  this.moveInDate = date || new Date();
  if (leaseId) {
    this.currentLeaseId = leaseId as any;
    if (!this.leaseHistory) {
      this.leaseHistory = [];
    }
    this.leaseHistory.push({
      leaseId: leaseId as any,
      startDate: this.moveInDate,
      status: "active",
    } as any);
  }

  if (changedBy) {
    this.changeStatus("active", changedBy, "Tenant moved in");
  } else {
    this.tenantStatus = "active";
    this.lastStatusUpdate = new Date();
  }

  return this.save();
};

UserSchema.methods.moveOut = function (
  this: UserDocument,
  date?: Date,
  changedBy?: string,
  reason?: string
) {
  if (this.role !== "tenant") throw new Error("Only tenants can move out");

  this.moveOutDate = date || new Date();

  // Update current lease in history
  if (this.currentLeaseId && this.leaseHistory) {
    const currentLease = this.leaseHistory.find(
      (l: any) => l.leaseId.toString() === this.currentLeaseId?.toString()
    );
    if (currentLease) {
      currentLease.endDate = this.moveOutDate;
      currentLease.status = "completed";
    }
    this.currentLeaseId = undefined;
  }

  if (changedBy) {
    this.changeStatus("moved_out", changedBy, reason || "Tenant moved out");
  } else {
    this.tenantStatus = "moved_out";
    this.lastStatusUpdate = new Date();
  }

  return this.save();
};

// Instance method to update last login
UserSchema.methods.updateLastLogin = function (this: UserDocument) {
  this.lastLogin = new Date();
  return this.save({ validateBeforeSave: false });
};

// Account lockout configuration
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Register a failed login attempt, locking the account once the threshold is hit
UserSchema.methods.incrementLoginAttempts = function (this: UserDocument) {
  const attempts = (this.failedLoginAttempts ?? 0) + 1;
  this.failedLoginAttempts = attempts;

  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    this.isLocked = true;
    this.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
  }

  return this.save({ validateBeforeSave: false });
};

// Clear failed attempts and unlock (used on successful login or admin unlock)
UserSchema.methods.resetLoginAttempts = function (this: UserDocument) {
  this.failedLoginAttempts = 0;
  this.isLocked = false;
  this.lockedUntil = null;
  return this.save({ validateBeforeSave: false });
};

// Static method to find active users
UserSchema.statics.findActive = function () {
  return this.find({ isActive: true, deletedAt: null });
};

// Static method to find by role
UserSchema.statics.findByRole = function (role: UserRole) {
  return this.find({ role, isActive: true, deletedAt: null });
};

// Static methods for tenant status queries
UserSchema.statics.findTenantsByStatus = function (status: string) {
  return this.find({
    role: UserRole.TENANT,
    tenantStatus: status,
    isActive: true,
    deletedAt: null,
  });
};

UserSchema.statics.findActiveTenants = function () {
  return this.find({
    role: UserRole.TENANT,
    tenantStatus: "active",
    isActive: true,
    deletedAt: null,
  });
};

UserSchema.statics.findPendingApplications = function () {
  return this.find({
    role: UserRole.TENANT,
    tenantStatus: { $in: ["application_submitted", "under_review"] },
    isActive: true,
    deletedAt: null,
  });
};

UserSchema.statics.getTenantStatusCounts = async function () {
  const pipeline = [
    {
      $match: {
        role: UserRole.TENANT,
        isActive: true,
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: "$tenantStatus",
        count: { $sum: 1 },
      },
    },
  ];

  const results = await this.aggregate(pipeline);
  const counts: Record<string, number> = {};
  results.forEach((result: any) => {
    counts[result._id] = result.count;
  });

  return counts;
};

// Static method for soft delete
UserSchema.methods.softDelete = function (this: UserDocument) {
  this.deletedAt = new Date();
  this.isActive = false;
  return this.save({ validateBeforeSave: false });
};

// Static method to restore soft deleted user
UserSchema.methods.restore = function (this: UserDocument) {
  this.deletedAt = null;
  this.isActive = true;
  return this.save({ validateBeforeSave: false });
};

// Query middleware to exclude soft deleted documents
UserSchema.pre(/^find/, function () {
  // @ts-expect-error - Query middleware typing issue in Mongoose
  this.find({ deletedAt: null });
});

// Prevent duplicate email registration
UserSchema.pre("save", async function (this: UserDocument, next) {
  if (!this.isModified("email")) return next();

  const UserModel = mongoose.model<IUser>("User");
  const existingUser = await UserModel.findOne({
    email: this.email,
    _id: { $ne: this._id },
  });

  if (existingUser) {
    const error = new Error("Email already exists");
    return next(error);
  }

  next();
});

// Create and export the model with safer initialization
let User: Model<IUser>;

try {
  // Try to get existing model first
  User = mongoose.model<IUser>("User");
} catch {
  // Model doesn't exist, create it
  User = mongoose.model<IUser>("User", UserSchema);
}

export default User;

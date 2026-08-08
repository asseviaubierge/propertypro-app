import mongoose, { Schema, Model } from "mongoose";
import { ITenant, IEmergencyContact } from "@/types";
import { isTenantAccessRole } from "@/lib/model-access";

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

const TenantSchema = new Schema<ITenant>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true,
    },
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
        message: "Tenant must be between 18 and 120 years old",
      },
    },
    ssn: {
  type: String,
  trim: true,
  select: false,
  required: [true, "Le numéro CIP est obligatoire"],
  validate: {
    validator: function (cip: string) {
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
    stripeCustomerId: {
      type: String,
      trim: true,
      index: true,
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
    applicationDate: {
      type: Date,
      required: [true, "Application date is required"],
      default: Date.now,
    },
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

// Indexes for performance (userId index is already created by unique: true)
TenantSchema.index({ applicationDate: -1 });
TenantSchema.index({ backgroundCheckStatus: 1 });
TenantSchema.index({ moveInDate: 1 });
TenantSchema.index({ moveOutDate: 1 });
TenantSchema.index({ deletedAt: 1 });
TenantSchema.index({ createdAt: -1 });

// Virtual for tenant age
TenantSchema.virtual("age").get(function () {
  if (!(this as any).dateOfBirth) return null;
  const age =
    (Date.now() - (this as any).dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.floor(age);
});

// Virtual for application status (based on move dates)
TenantSchema.virtual("applicationStatus").get(function () {
  if ((this as any).moveOutDate) return "moved_out";
  if ((this as any).moveInDate) return "active";
  return "pending";
});

// Virtual for tenancy duration
TenantSchema.virtual("tenancyDuration").get(function () {
  if (!(this as any).moveInDate) return null;
  const endDate = (this as any).moveOutDate || new Date();
  const duration = endDate.getTime() - (this as any).moveInDate.getTime();
  return Math.floor(duration / (24 * 60 * 60 * 1000)); // Days
});

// Static method to find active tenants
TenantSchema.statics.findActive = function () {
  return this.find({
    moveInDate: { $exists: true },
    moveOutDate: null,
    deletedAt: null,
  });
};

// Static method to find by background check status (for actual background check tracking)
TenantSchema.statics.findByBackgroundCheckStatus = function (status: string) {
  const query: any = { deletedAt: null };
  query.backgroundCheckStatus = status;
  return this.find(query);
};

// Static method to find by move status (for move-in/out tracking)
TenantSchema.statics.findByMoveStatus = function (status: string) {
  const query: any = { deletedAt: null };

  switch (status) {
    case "active":
      query.moveInDate = { $exists: true };
      query.moveOutDate = null;
      break;
    case "moved_out":
      query.moveOutDate = { $exists: true };
      break;
  }

  return this.find(query);
};

// Instance method for soft delete
TenantSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

// Instance method to restore soft deleted tenant
TenantSchema.methods.restore = function () {
  this.deletedAt = null;
  return this.save();
};

// Instance method to approve application
TenantSchema.methods.approveApplication = function () {
  this.backgroundCheckStatus = "approved";
  return this.save();
};

// Instance method to reject application
TenantSchema.methods.rejectApplication = function () {
  this.backgroundCheckStatus = "rejected";
  return this.save();
};

// Instance method to move in
TenantSchema.methods.moveIn = function (date?: Date) {
  this.moveInDate = date || new Date();
  return this.save();
};

// Instance method to move out
TenantSchema.methods.moveOut = function (date?: Date) {
  this.moveOutDate = date || new Date();
  return this.save();
};

// Query middleware to exclude soft deleted documents
TenantSchema.pre(/^find/, function () {
  // @ts-ignore
  this.find({ deletedAt: null });
});

// Pre-save middleware for validation
TenantSchema.pre("save", async function (next) {
  // Validate user exists and has tenant role
  if (this.isModified("userId")) {
    const User = mongoose.model("User");
    const user = await User.findById(this.userId);

    if (!user) {
      return next(new Error("User not found"));
    }

    if (!(await isTenantAccessRole(user.role))) {
      return next(new Error("User must have tenant role"));
    }
  }

  next();
});

// Create and export the model
const Tenant: Model<ITenant> =
  mongoose.models?.Tenant || mongoose.model<ITenant>("Tenant", TenantSchema);

export default Tenant;

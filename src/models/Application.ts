import mongoose, { Schema, Model } from "mongoose";
import {
  IApplication,
  IApplicationFee,
  IApplicationDocument,
  ApplicationStatus,
  ApplicationFeeStatus,
  IEmergencyContact,
} from "@/types";

// Application Fee Schema
const ApplicationFeeSchema = new Schema<IApplicationFee>({
  amount: {
    type: Number,
    required: [true, "Application fee amount is required"],
    min: [0, "Application fee cannot be negative"],
    max: [1000, "Application fee too high"],
  },
  status: {
    type: String,
    enum: Object.values(ApplicationFeeStatus),
    default: ApplicationFeeStatus.PENDING,
    required: [true, "Application fee status is required"],
  },
  paymentMethod: {
    type: String,
    trim: true,
  },
  transactionId: {
    type: String,
    trim: true,
  },
  paidAt: {
    type: Date,
  },
});

// Application Document Schema
const ApplicationDocumentSchema = new Schema<IApplicationDocument>({
  type: {
    type: String,
    required: [true, "Document type is required"],
    enum: [
      "id_verification",
      "income_verification",
      "employment_letter",
      "bank_statement",
      "reference_letter",
      "previous_lease",
      "other",
    ],
  },
  fileName: {
    type: String,
    required: [true, "File name is required"],
    trim: true,
  },
  fileUrl: {
    type: String,
    required: [true, "File URL is required"],
    trim: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  verified: {
    type: Boolean,
    default: false,
  },
});

// Emergency Contact Schema (reused from Tenant model)
const EmergencyContactSchema = new Schema<IEmergencyContact>({
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
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
  },
});

// Previous Address Schema
const PreviousAddressSchema = new Schema({
  address: {
    type: String,
    required: [true, "Address is required"],
    trim: true,
    maxlength: [500, "Address too long"],
  },
  landlordName: {
    type: String,
    trim: true,
    maxlength: [100, "Landlord name too long"],
  },
  landlordContact: {
    type: String,
    trim: true,
    maxlength: [100, "Landlord contact too long"],
  },
  moveInDate: {
    type: Date,
    required: [true, "Move-in date is required"],
  },
  moveOutDate: {
    type: Date,
    required: [true, "Move-out date is required"],
  },
  reasonForLeaving: {
    type: String,
    trim: true,
    maxlength: [500, "Reason too long"],
  },
});

// Main Application Schema
const ApplicationSchema = new Schema<IApplication>(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: [true, "Property ID is required"],
    },
    applicantId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Applicant ID is required"],
    },
    status: {
      type: String,
      enum: Object.values(ApplicationStatus),
      default: ApplicationStatus.DRAFT,
      required: [true, "Application status is required"],
    },
    applicationFee: {
      type: ApplicationFeeSchema,
      required: [true, "Application fee information is required"],
    },
    personalInfo: {
      firstName: {
        type: String,
        required: [true, "First name is required"],
        trim: true,
        maxlength: [50, "First name too long"],
      },
      lastName: {
        type: String,
        required: [true, "Last name is required"],
        trim: true,
        maxlength: [50, "Last name too long"],
      },
      email: {
        type: String,
        required: [true, "Email is required"],
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
      },
      phone: {
        type: String,
        required: [true, "Phone number is required"],
        trim: true,
        match: [
          /^[\+]?[\d\s\-\(\)\.]{10,20}$/,
          "Please enter a valid phone number",
        ],
      },
      dateOfBirth: {
        type: Date,
        required: [true, "Date of birth is required"],
        validate: {
          validator: function (date: Date) {
            const age =
              (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
            return age >= 18 && age <= 120;
          },
          message: "Applicant must be between 18 and 120 years old",
        },
      },
      ssn: {
        type: String,
        trim: true,
        match: [/^\d{3}-\d{2}-\d{4}$/, "SSN must be in format XXX-XX-XXXX"],
        select: false, // Never include in queries by default
      },
    },
    employmentInfo: {
      employer: {
        type: String,
        trim: true,
        maxlength: [200, "Employer name too long"],
      },
      position: {
        type: String,
        trim: true,
        maxlength: [100, "Position too long"],
      },
      income: {
        type: Number,
        min: [0, "Income cannot be negative"],
        max: [10000000, "Income too high"],
      },
      startDate: {
        type: Date,
      },
      employerContact: {
        type: String,
        trim: true,
        maxlength: [100, "Employer contact too long"],
      },
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
    previousAddresses: {
      type: [PreviousAddressSchema],
      default: [],
      validate: {
        validator: function (addresses: any[]) {
          return addresses.length <= 10;
        },
        message: "Cannot have more than 10 previous addresses",
      },
    },
    documents: {
      type: [ApplicationDocumentSchema],
      default: [],
      validate: {
        validator: function (docs: IApplicationDocument[]) {
          return docs.length <= 20;
        },
        message: "Cannot have more than 20 documents",
      },
    },
    additionalInfo: {
      pets: {
        type: String,
        trim: true,
        maxlength: [1000, "Pet information too long"],
      },
      vehicles: {
        type: String,
        trim: true,
        maxlength: [1000, "Vehicle information too long"],
      },
      reasonForMoving: {
        type: String,
        trim: true,
        maxlength: [1000, "Reason for moving too long"],
      },
      additionalNotes: {
        type: String,
        trim: true,
        maxlength: [2000, "Additional notes too long"],
      },
    },
    submittedAt: {
      type: Date,
    },
    reviewedAt: {
      type: Date,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewNotes: {
      type: String,
      trim: true,
      maxlength: [2000, "Review notes too long"],
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
        delete ret.personalInfo?.ssn; // Never expose SSN in JSON
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Indexes for better query performance
ApplicationSchema.index({ propertyId: 1, status: 1 });
ApplicationSchema.index({ applicantId: 1 });
ApplicationSchema.index({ status: 1, submittedAt: 1 });
ApplicationSchema.index({ deletedAt: 1 });

// Virtual for application age
ApplicationSchema.virtual("applicationAge").get(function () {
  if (!this.submittedAt) return null;
  return Math.floor(
    (Date.now() - this.submittedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
});

// Instance method to submit application
ApplicationSchema.methods.submit = function () {
  this.status = ApplicationStatus.SUBMITTED;
  this.submittedAt = new Date();
  return this.save();
};

// Instance method to approve application
ApplicationSchema.methods.approve = function (
  reviewerId: string,
  notes?: string
) {
  this.status = ApplicationStatus.APPROVED;
  this.reviewedAt = new Date();
  this.reviewedBy = reviewerId;
  if (notes) this.reviewNotes = notes;
  return this.save();
};

// Instance method to reject application
ApplicationSchema.methods.reject = function (
  reviewerId: string,
  notes?: string
) {
  this.status = ApplicationStatus.REJECTED;
  this.reviewedAt = new Date();
  this.reviewedBy = reviewerId;
  if (notes) this.reviewNotes = notes;
  return this.save();
};

// Query middleware to exclude soft deleted documents
ApplicationSchema.pre(/^find/, function () {
  // @ts-ignore
  this.find({ deletedAt: null });
});

// Pre-save middleware for validation
ApplicationSchema.pre("save", async function (next) {
  // Validate property exists
  if (this.isModified("propertyId")) {
    const Property = mongoose.model("Property");
    const property = await Property.findById(this.propertyId);

    if (!property) {
      return next(new Error("Property not found"));
    }
  }

  // Validate applicant exists and has appropriate role
  if (this.isModified("applicantId")) {
    const User = mongoose.model("User");
    const user = await User.findById(this.applicantId);

    if (!user) {
      return next(new Error("Applicant not found"));
    }

    if (!["tenant", "owner"].includes(user.role)) {
      return next(new Error("Invalid applicant role"));
    }
  }

  // Validate previous addresses date logic
  if (this.previousAddresses && this.previousAddresses.length > 0) {
    for (const address of this.previousAddresses) {
      if (address.moveOutDate <= address.moveInDate) {
        return next(new Error("Move-out date must be after move-in date"));
      }
    }
  }

  next();
});

// Create and export the model with safer initialization
let Application: Model<IApplication>;

try {
  // Try to get existing model first
  Application = mongoose.model<IApplication>("Application");
} catch (error) {
  // Model doesn't exist, create it
  Application = mongoose.model<IApplication>("Application", ApplicationSchema);
}

export default Application;

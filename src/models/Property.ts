import mongoose, { Schema, Model } from "mongoose";
import {
  IProperty,
  PropertyType,
  PropertyStatus,
  IAddress,
  IAmenity,
} from "@/types";
import { isCompanyStaffAccessRole } from "@/lib/model-access";

// Embedded Unit Schema for unified property-unit model
const EmbeddedUnitSchema = new Schema(
  {
    unitNumber: {
      type: String,
      required: [true, "Unit number is required"],
      trim: true,
      maxlength: [20, "Unit number cannot exceed 20 characters"],
    },
    unitType: {
      type: String,
      enum: ["apartment", "house", "studio", "penthouse", "loft", "room"],
      required: [true, "Unit type is required"],
    },
    floor: {
      type: Number,
      min: [0, "Floor cannot be negative"],
      max: [200, "Floor cannot exceed 200"],
    },
    bedrooms: {
      type: Number,
      required: [true, "Number of bedrooms is required"],
      min: [0, "Bedrooms cannot be negative"],
      max: [20, "Bedrooms cannot exceed 20"],
    },
    bathrooms: {
      type: Number,
      required: [true, "Number of bathrooms is required"],
      min: [0, "Bathrooms cannot be negative"],
      max: [20, "Bathrooms cannot exceed 20"],
    },
    squareFootage: {
      type: Number,
      required: [true, "Square footage is required"],
      min: [50, "Square footage must be at least 50"],
      max: [50000, "Square footage cannot exceed 50,000"],
    },
    rentAmount: {
      type: Number,
      required: [true, "Rent amount is required"],
      min: [0, "Rent amount cannot be negative"],
      max: [100000, "Rent amount cannot exceed $100,000"],
    },
    securityDeposit: {
      type: Number,
      required: [true, "Security deposit is required"],
      min: [0, "Security deposit cannot be negative"],
      max: [50000, "Security deposit cannot exceed $50,000"],
    },
    status: {
      type: String,
      enum: Object.values(PropertyStatus),
      default: PropertyStatus.AVAILABLE,
      required: [true, "Unit status is required"],
    },

    // Outdoor Features
    balcony: {
      type: Boolean,
      default: false,
    },
    patio: {
      type: Boolean,
      default: false,
    },
    garden: {
      type: Boolean,
      default: false,
    },

    // Interior Features
    dishwasher: {
      type: Boolean,
      default: false,
    },
    inUnitLaundry: {
      type: Boolean,
      default: false,
    },
    hardwoodFloors: {
      type: Boolean,
      default: false,
    },
    fireplace: {
      type: Boolean,
      default: false,
    },
    walkInClosets: {
      type: Boolean,
      default: false,
    },
    centralAir: {
      type: Boolean,
      default: false,
    },
    ceilingFans: {
      type: Boolean,
      default: false,
    },

    // Appliances (nested object)
    appliances: {
      refrigerator: {
        type: Boolean,
        default: false,
      },
      stove: {
        type: Boolean,
        default: false,
      },
      oven: {
        type: Boolean,
        default: false,
      },
      microwave: {
        type: Boolean,
        default: false,
      },
      dishwasher: {
        type: Boolean,
        default: false,
      },
      washer: {
        type: Boolean,
        default: false,
      },
      dryer: {
        type: Boolean,
        default: false,
      },
      washerDryerHookups: {
        type: Boolean,
        default: false,
      },
    },

    // Parking Details (nested object)
    parking: {
      included: {
        type: Boolean,
        default: false,
      },
      spaces: {
        type: Number,
        min: [0, "Parking spaces cannot be negative"],
        max: [10, "Parking spaces cannot exceed 10"],
        default: 0,
      },
      type: {
        type: String,
        enum: ["garage", "covered", "open", "street"],
        default: "open",
      },
      gated: {
        type: Boolean,
        default: false,
      },
      assigned: {
        type: Boolean,
        default: false,
      },
    },

    // Utilities Included (nested object)
    utilities: {
      electricity: {
        type: String,
        enum: ["included", "tenant", "shared"],
        default: "tenant",
      },
      water: {
        type: String,
        enum: ["included", "tenant", "shared"],
        default: "tenant",
      },
      gas: {
        type: String,
        enum: ["included", "tenant", "shared"],
        default: "tenant",
      },
      internet: {
        type: String,
        enum: ["included", "tenant", "shared"],
        default: "tenant",
      },
      cable: {
        type: String,
        enum: ["included", "tenant", "shared"],
        default: "tenant",
      },
      heating: {
        type: String,
        enum: ["included", "tenant", "shared"],
        default: "tenant",
      },
      cooling: {
        type: String,
        enum: ["included", "tenant", "shared"],
        default: "tenant",
      },
      trash: {
        type: String,
        enum: ["included", "tenant", "shared"],
        default: "included",
      },
      sewer: {
        type: String,
        enum: ["included", "tenant", "shared"],
        default: "included",
      },
    },

    // Additional Details
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: function (images: string[]) {
          return images.length <= 15;
        },
        message: "Cannot have more than 15 images per unit",
      },
    },
    attachments: {
      type: [
        {
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
            min: [0, "File size cannot be negative"],
          },
          fileType: {
            type: String,
            required: true,
            trim: true,
          },
          uploadedAt: {
            type: Date,
            default: Date.now,
          },
          uploadedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
          },
        },
      ],
      default: [],
      validate: {
        validator: function (attachments: any[]) {
          return attachments.length <= 20;
        },
        message: "Cannot have more than 20 attachments",
      },
    },
    availableFrom: {
      type: Date,
    },
    lastRenovated: {
      type: Date,
    },

    // Current tenant information
    currentTenantId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    currentLeaseId: {
      type: Schema.Types.ObjectId,
      ref: "Lease",
    },
  },
  {
    _id: true, // Each unit gets its own _id for easy reference
    timestamps: false, // Use parent document timestamps
  },
);

// Address subdocument schema
const AddressSchema = new Schema<IAddress>(
  {
    street: {
      type: String,
      required: [true, "Street address is required"],
      trim: true,
      maxlength: [200, "Street address cannot exceed 200 characters"],
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
      maxlength: [100, "City cannot exceed 100 characters"],
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
      maxlength: [50, "State cannot exceed 50 characters"],
    },
    zipCode: {
      type: String,
      required: [true, "ZIP/Postal code is required"],
      trim: true,
      maxlength: [20, "ZIP/Postal code cannot exceed 20 characters"],
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
      default: "United States",
      maxlength: [100, "Country cannot exceed 100 characters"],
    },
  },
  { _id: false },
);

// Amenity subdocument schema
const AmenitySchema = new Schema<IAmenity>(
  {
    name: {
      type: String,
      required: [true, "Amenity name is required"],
      trim: true,
      maxlength: [100, "Amenity name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Amenity description cannot exceed 500 characters"],
    },
    category: {
      type: String,
      required: [true, "Amenity category is required"],
      trim: true,
      enum: [
        "Kitchen",
        "Bathroom",
        "Living",
        "Bedroom",
        "Outdoor",
        "Parking",
        "Security",
        "Utilities",
        "Recreation",
        "Laundry",
        "Climate",
        "Other",
      ],
    },
  },
  { _id: false },
);

const PropertySchema = new Schema<IProperty>(
  {
    name: {
      type: String,
      required: [true, "Property name is required"],
      trim: true,
      maxlength: [200, "Property name cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    type: {
      type: String,
      enum: Object.values(PropertyType),
      required: [true, "Property type is required"],
    },
    status: {
      type: String,
      enum: Object.values(PropertyStatus),
      default: PropertyStatus.AVAILABLE,
      required: [true, "Property status is required"],
    },
    address: {
      type: AddressSchema,
      required: [true, "Property address is required"],
    },
    // Note: bedrooms, bathrooms, squareFootage, rentAmount, securityDeposit
    // are now stored only at the unit level in the units array
    yearBuilt: {
      type: Number,
      min: [1800, "Year built cannot be before 1800"],
      max: [
        new Date().getFullYear() + 5,
        "Year built cannot be more than 5 years in the future",
      ],
    },
    amenities: {
      type: [AmenitySchema],
      default: [],
    },

    // Property Type Configuration
    isMultiUnit: {
      type: Boolean,
      default: false,
    },
    totalUnits: {
      type: Number,
      min: [1, "Total units must be at least 1"],
      max: [1000, "Total units cannot exceed 1000"],
      default: 1,
    },

    // Embedded Units Array (unified approach)
    units: {
      type: [EmbeddedUnitSchema],
      default: [],
      validate: {
        validator: function (units: any[]) {
          return units.length <= 1000;
        },
        message: "Cannot have more than 1000 units per property",
      },
    },

    // Property Attachments
    attachments: {
      type: [
        {
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
            min: [0, "File size cannot be negative"],
          },
          fileType: {
            type: String,
            required: true,
            trim: true,
          },
          uploadedAt: {
            type: Date,
            default: Date.now,
          },
          uploadedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
          },
        },
      ],
      default: [],
      validate: {
        validator: function (attachments: any[]) {
          return attachments.length <= 20;
        },
        message: "Cannot have more than 20 attachments",
      },
    },

    images: {
      type: [String],
      default: [],
      validate: {
        validator: function (images: string[]) {
          return images.length <= 20;
        },
        message: "Cannot have more than 20 images",
      },
    },
    // Single company architecture - simplified ownership model
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Property owner is required"],
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      // In single company, this is more for organizational purposes
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
  },
);

// Indexes for performance - with error handling to prevent emitWarning issues
try {
  PropertySchema.index({ ownerId: 1 });
  PropertySchema.index({ managerId: 1 });
  PropertySchema.index({ status: 1 });
  PropertySchema.index({ type: 1 });
  // Note: rentAmount index removed - now stored in units
  PropertySchema.index({ "address.city": 1 });
  PropertySchema.index({ "address.state": 1 });
  PropertySchema.index({ "address.zipCode": 1 });
  PropertySchema.index({ deletedAt: 1 });
  PropertySchema.index({ createdAt: -1 });

  // Compound indexes for common queries
  PropertySchema.index({ status: 1, type: 1 });
  PropertySchema.index({ ownerId: 1, status: 1 });
  PropertySchema.index({ managerId: 1, status: 1 });
} catch {
  // Silently handle index creation errors
}

// Virtual for full address
PropertySchema.virtual("fullAddress").get(function () {
  const address = this.address;
  if (!address) return "";

  const { street, city, state, zipCode } = address;
  const streetPart = street?.trim();
  const cityStateZipPart = [city, state, zipCode]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");

  return [streetPart, cityStateZipPart].filter(Boolean).join(", ");
});

// Virtual for rent per square foot (calculates from units)
PropertySchema.virtual("rentPerSqFt").get(function () {
  const units = this.units || [];
  if (units.length === 0) return 0;
  const totalRent = units.reduce(
    (sum: number, unit: any) => sum + (unit.rentAmount || 0),
    0,
  );
  const totalSqFt = units.reduce(
    (sum: number, unit: any) => sum + (unit.squareFootage || 0),
    0,
  );
  return totalSqFt > 0 ? (totalRent / totalSqFt).toFixed(2) : 0;
});

// Virtual for property summary (calculates from units)
PropertySchema.virtual("summary").get(function () {
  const units = this.units || [];
  if (units.length === 0) return "No units";
  const totalBedrooms = units.reduce(
    (sum: number, unit: any) => sum + (unit.bedrooms || 0),
    0,
  );
  const totalBathrooms = units.reduce(
    (sum: number, unit: any) => sum + (unit.bathrooms || 0),
    0,
  );
  const totalSqFt = units.reduce(
    (sum: number, unit: any) => sum + (unit.squareFootage || 0),
    0,
  );
  return `${totalBedrooms}BR/${totalBathrooms}BA - ${totalSqFt} sq ft`;
});

// Static method to find available properties
PropertySchema.statics.findAvailable = function () {
  return this.find({
    status: PropertyStatus.AVAILABLE,
    deletedAt: null,
  });
};

// Static method to find by owner
PropertySchema.statics.findByOwner = function (ownerId: string) {
  return this.find({
    ownerId,
    deletedAt: null,
  });
};

// Static method to find by manager
PropertySchema.statics.findByManager = function (managerId: string) {
  return this.find({
    managerId,
    deletedAt: null,
  });
};

// Static method to search properties
PropertySchema.statics.search = function (query: string) {
  const searchRegex = new RegExp(query, "i");
  return this.find({
    $or: [
      { name: searchRegex },
      { description: searchRegex },
      { "address.street": searchRegex },
      { "address.city": searchRegex },
      { "address.state": searchRegex },
    ],
    deletedAt: null,
  });
};

// Instance method for soft delete
PropertySchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  this.status = PropertyStatus.UNAVAILABLE;
  return this.save();
};

// Instance method to restore soft deleted property
PropertySchema.methods.restore = function () {
  this.deletedAt = null;
  this.status = PropertyStatus.AVAILABLE;
  return this.save();
};

// Instance method to update status
PropertySchema.methods.updateStatus = function (status: PropertyStatus) {
  this.status = status;
  return this.save();
};

// Instance method to calculate property status based on unit statuses
PropertySchema.methods.calculatePropertyStatus = function (): PropertyStatus {
  const hasUnits = Array.isArray(this.units) && this.units.length > 0;

  // No embedded units to reference, fall back to the stored property status
  if (!hasUnits) {
    return this.status;
  }

  const unitStatuses = this.units
    .map((unit: any) => unit?.status)
    .filter((status: any): status is PropertyStatus =>
      Object.values(PropertyStatus).includes(status),
    );

  // If units exist but there are no valid statuses, keep the current status
  if (unitStatuses.length === 0) {
    return this.status;
  }

  const totalUnits = unitStatuses.length;

  const statusCounts = {
    available: unitStatuses.filter((s) => s === PropertyStatus.AVAILABLE)
      .length,
    occupied: unitStatuses.filter((s) => s === PropertyStatus.OCCUPIED).length,
    maintenance: unitStatuses.filter((s) => s === PropertyStatus.MAINTENANCE)
      .length,
    unavailable: unitStatuses.filter((s) => s === PropertyStatus.UNAVAILABLE)
      .length,
  };

  // Business logic for property status calculation:
  // 1. If all units are occupied -> Property is OCCUPIED
  // 2. If all units are unavailable -> Property is UNAVAILABLE
  // 3. If any unit is in maintenance and no units available -> Property is MAINTENANCE
  // 4. If at least one unit is available -> Property is AVAILABLE

  if (statusCounts.occupied === totalUnits) {
    return PropertyStatus.OCCUPIED;
  }

  if (statusCounts.unavailable === totalUnits) {
    return PropertyStatus.UNAVAILABLE;
  }

  if (statusCounts.maintenance > 0 && statusCounts.available === 0) {
    return PropertyStatus.MAINTENANCE;
  }

  if (statusCounts.available > 0) {
    return PropertyStatus.AVAILABLE;
  }

  // Default fallback
  return PropertyStatus.AVAILABLE;
};

// Instance method to update property status based on unit statuses and save
PropertySchema.methods.updatePropertyStatusFromUnits = async function () {
  const hasUnits = Array.isArray(this.units) && this.units.length > 0;

  if (hasUnits) {
    const newStatus = this.calculatePropertyStatus();
    if (this.status !== newStatus) {
      this.status = newStatus;
      await this.save();
      return newStatus;
    }
  }

  return this.status;
};

// Query middleware to exclude soft deleted documents by default
PropertySchema.pre(/^find/, function () {
  // Only apply soft delete filter if not already specified in the query
  const query = this.getQuery();
  if (!query.hasOwnProperty("deletedAt")) {
    // @ts-ignore
    this.find({ deletedAt: null });
  }
});

// Pre-save middleware for validation and auto-calculation
PropertySchema.pre("save", async function (next) {
  // Strip deprecated fields that should only exist at unit level
  // These fields are now stored only in the units array
  const deprecatedFields = [
    "bedrooms",
    "bathrooms",
    "squareFootage",
    "rentAmount",
    "securityDeposit",
  ];
  deprecatedFields.forEach((field) => {
    if ((this as any)[field] !== undefined) {
      (this as any)[field] = undefined;
    }
  });

  // Auto-calculate status metadata based on units array
  if (this.isModified("units") || this.isNew) {
    this.totalUnits = this.units?.length || 1;
    this.isMultiUnit = this.totalUnits > 1;

    // Auto-calculate property status based on unit statuses whenever units exist
    if (this.units && this.units.length > 0) {
      const oldStatus = this.status;
      const calculatedStatus = this.calculatePropertyStatus();

      // Only update if the calculated status is different from current status
      // This prevents manual status overrides from being constantly reset
      if (this.status !== calculatedStatus) {
        this.status = calculatedStatus;
      }
    }
  }

  // Track status changes for post-save logging
  if (this.isModified("status") && !this.isNew) {
    // Store the old status for post-save middleware
    this._oldStatus = this.getChanges().$set?.status || this.status;
  }

  // Validate owner exists and has appropriate role
  if (this.isModified("ownerId")) {
    const User = mongoose.model("User");
    const owner = await User.findById(this.ownerId);

    if (!owner) {
      return next(new Error("Property owner not found"));
    }

    if (!(await isCompanyStaffAccessRole(owner.role))) {
      return next(new Error("Invalid owner role"));
    }
  }

  // Validate manager if provided
  if (this.isModified("managerId") && this.managerId) {
    const User = mongoose.model("User");
    const manager = await User.findById(this.managerId);

    if (!manager) {
      return next(new Error("Property manager not found"));
    }

    if (!(await isCompanyStaffAccessRole(manager.role))) {
      return next(new Error("Invalid manager role"));
    }
  }

  next();
});

// Post-save middleware for enhanced logging and synchronization validation
PropertySchema.post("save", async function (doc) {
  try {
    // Validate synchronization consistency for multi-unit properties
    if (doc.isMultiUnit && doc.units && doc.units.length > 0) {
      const calculatedStatus = doc.calculatePropertyStatus();

      if (doc.status !== calculatedStatus) {
        if (process.env.NODE_ENV === "development") {
          doc.status = calculatedStatus;
          await doc.save();
        }
      }
    }

    // Clean up temporary tracking field
    if (doc._oldStatus) {
      delete doc._oldStatus;
    }
  } catch {
    // Don't throw error to avoid breaking the save operation
  }
});

// Create and export the model with safer initialization
let Property: Model<IProperty>;

try {
  // Try to get existing model first
  Property = mongoose.model<IProperty>("Property");
} catch (error) {
  // Model doesn't exist, create it
  Property = mongoose.model<IProperty>("Property", PropertySchema);
}

export default Property;

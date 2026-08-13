import mongoose, { Schema, Model } from "mongoose";
import {
  ILease,
  LeaseStatus,
  ILeaseTerms,
  ILeasePaymentConfig,
  ILateFeeConfig,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from "@/types";
import { isTenantAccessRole } from "@/lib/model-access";

// Late Fee Configuration subdocument schema (reused from Payment model)
const LateFeeConfigSchema = new Schema<ILateFeeConfig>(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    gracePeriodDays: {
      type: Number,
      default: 5,
      min: [0, "Grace period cannot be negative"],
      max: [30, "Grace period cannot exceed 30 days"],
    },
    feeType: {
      type: String,
      enum: ["fixed", "percentage", "tiered", "daily"],
      default: "fixed",
    },
    feeAmount: {
      type: Number,
      required: [true, "Fee amount is required"],
      min: [0, "Fee amount cannot be negative"],
    },
    maxFeeAmount: {
      type: Number,
      min: [0, "Maximum fee amount cannot be negative"],
    },
    compoundDaily: {
      type: Boolean,
      default: false,
    },
    minFeeAmount: {
      type: Number,
      min: [0, "Minimum fee amount cannot be negative"],
    },
    dailyLateFee: {
      type: Number,
      min: [0, "Daily late fee cannot be negative"],
    },
    percentageFee: {
      type: Number,
      min: [0, "Percentage fee cannot be negative"],
      max: [100, "Percentage fee cannot exceed 100%"],
    },
    flatFee: {
      type: Number,
      min: [0, "Flat fee cannot be negative"],
    },
    maxLateFee: {
      type: Number,
      min: [0, "Maximum late fee cannot be negative"],
    },
    tiers: {
      type: [
        {
          daysOverdue: {
            type: Number,
            required: true,
            min: [1, "Days overdue must be at least 1"],
          },
          amount: {
            type: Number,
            required: true,
            min: [0, "Tier amount cannot be negative"],
          },
          percentage: {
            type: Number,
            min: [0, "Tier percentage cannot be negative"],
            max: [100, "Tier percentage cannot exceed 100%"],
          },
        },
      ],
      default: [],
    },
    notificationDays: {
      type: [Number],
      default: [3, 7, 14],
      validate: {
        validator: function (days: number[]) {
          return days.every((day) => day > 0 && day <= 365);
        },
        message: "Notification days must be between 1 and 365",
      },
    },
  },
  { _id: false }
);

// Lease Payment Configuration subdocument schema
const LeasePaymentConfigSchema = new Schema<ILeasePaymentConfig>(
  {
    rentDueDay: {
      type: Number,
      required: [true, "Rent due day is required"],
      min: [1, "Rent due day must be between 1 and 31"],
      max: [31, "Rent due day must be between 1 and 31"],
      default: 1,
    },
    lateFeeConfig: {
      type: LateFeeConfigSchema,
      required: [true, "Late fee configuration is required"],
    },
    acceptedPaymentMethods: {
      type: [String],
      enum: Object.values(PaymentMethod),
      default: [PaymentMethod.BANK_TRANSFER, PaymentMethod.CREDIT_CARD],
      validate: {
        validator: function (methods: PaymentMethod[]) {
          return methods.length > 0;
        },
        message: "At least one payment method must be accepted",
      },
    },
    autoCreatePayments: {
      type: Boolean,
      default: true,
    },
    prorationEnabled: {
      type: Boolean,
      default: true,
    },
    advancePaymentMonths: {
      type: Number,
      min: [0, "Advance payment months cannot be negative"],
      max: [12, "Advance payment months cannot exceed 12"],
      default: 0,
    },
    autoGenerateInvoices: {
      type: Boolean,
      default: true,
    },
    autoEmailInvoices: {
      type: Boolean,
      default: false,
    },
    enableCommunicationAutomation: {
      type: Boolean,
      default: true,
    },
    prorationMethod: {
      type: String,
      enum: ["daily", "calendar", "banking"],
      default: "daily",
    },
    roundingMethod: {
      type: String,
      enum: ["round", "floor", "ceil"],
      default: "round",
    },
    minimumProrationCharge: {
      type: Number,
      min: [0, "Minimum proration charge cannot be negative"],
      default: 0,
    },
  },
  { _id: false }
);

// Lease Terms subdocument schema
const LeaseTermsSchema = new Schema<ILeaseTerms>(
  {
    rentAmount: {
      type: Number,
      required: [true, "Rent amount is required"],
      min: [0, "Rent amount cannot be negative"],
      max: [100000000, "Rent amount cannot exceed $100,000"],
    },
    securityDeposit: {
      type: Number,
      required: [true, "Security deposit is required"],
      min: [0, "Security deposit cannot be negative"],
      max: [100000000, "Security deposit cannot exceed $50,000"],
    },
    lateFee: {
      type: Number,
      required: [true, "Late fee is required"],
      min: [0, "Late fee cannot be negative"],
      max: [100000000, "Late fee cannot exceed $1,000"],
    },
    petDeposit: {
      type: Number,
      min: [0, "Pet deposit cannot be negative"],
      max: [10000000, "Pet deposit cannot exceed $5,000"],
    },
    utilities: {
      type: [String],
      default: [],
      validate: {
        validator: function (utilities: string[]) {
          const validUtilities = [
            "electricity",
            "gas",
            "water",
            "sewer",
            "trash",
            "internet",
            "cable",
            "heating",
            "cooling",
            "landscaping",
          ];
          return utilities.every((utility) => validUtilities.includes(utility));
        },
        message: "Invalid utility type",
      },
    },
    restrictions: {
      type: [String],
      default: [],
      validate: {
        validator: function (restrictions: string[]) {
          return restrictions.length <= 20;
        },
        message: "Cannot have more than 20 restrictions",
      },
    },
    paymentConfig: {
      type: LeasePaymentConfigSchema,
    },
  },
  { _id: false }
);

// Renewal Options subdocument schema
const RenewalOptionsSchema = new Schema(
  {
    available: {
      type: Boolean,
      default: false,
    },
    terms: {
      type: String,
      trim: true,
      maxlength: [1000, "Renewal terms cannot exceed 1000 characters"],
    },
  },
  { _id: false }
);

const LeaseSchema = new Schema<ILease>(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: [true, "Property ID is required"],
    },
    unitId: {
      type: Schema.Types.ObjectId,
      required: [true, "Unit ID is required"],
      validate: {
        validator: async function (unitId: any) {
          if (!this.isNew && !this.isModified("unitId") && !this.isModified("propertyId")) {
            return true;
          }
          // Validate that the unit exists within the specified property's embedded units array
          try {
            const property = await mongoose
              .model("Property")
              .findById(this.propertyId)
              .select("units._id");
            if (!property) {
              return false;
            }

            // Check if the unit exists in the embedded units array
            const unitExists = property.units.some(
              (unit: any) =>
                unit._id && unit._id.toString() === unitId.toString()
            );

            return unitExists;
          } catch (error) {
            return false;
          }
        },
        message: "Unit must exist within the specified property's units array",
      },
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Tenant ID is required"],
    },
    startDate: {
      type: Date,
      required: [true, "Lease start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "Lease end date is required"],
      validate: {
        validator: function (date: Date) {
          return date > this.startDate;
        },
        message: "End date must be after start date",
      },
    },
    status: {
      type: String,
      enum: Object.values(LeaseStatus),
      default: LeaseStatus.DRAFT,
      required: [true, "Lease status is required"],
    },
    paymentStatus: {
      type: String,
      enum: ["current", "pending", "overdue"],
      default: "pending",
      index: true,
    },
    terms: {
      type: LeaseTermsSchema,
      required: [true, "Lease terms are required"],
    },
    documents: {
      type: [String],
      default: [],
      validate: {
        validator: function (docs: string[]) {
          return docs.length <= 10;
        },
        message: "Cannot have more than 10 documents",
      },
    },
    signedDate: {
      type: Date,
      validate: {
        validator: function (date: Date) {
          if (!date) return true; // Optional field
          return date >= this.createdAt;
        },
        message: "Signed date cannot be before lease creation",
      },
    },
    renewalOptions: {
      type: RenewalOptionsSchema,
      default: { available: false },
    },
    signedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    signatureData: {
      type: String,
      trim: true,
    },
    signatureIpAddress: {
      type: String,
      trim: true,
    },
    terminatedDate: {
      type: Date,
    },
    terminatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    terminationReason: {
      type: String,
      trim: true,
      maxlength: [500, "Termination reason cannot exceed 500 characters"],
    },
    terminationNotice: {
      type: String,
      trim: true,
      maxlength: [2000, "Termination notice cannot exceed 2000 characters"],
    },
    renewedLeaseId: {
      type: Schema.Types.ObjectId,
      ref: "Lease",
    },
    parentLeaseId: {
      type: Schema.Types.ObjectId,
      ref: "Lease",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, "Notes cannot exceed 2000 characters"],
    },
    contractText: {
      type: String,
      trim: true,
      maxlength: [30000, "Le contrat ne peut pas dépasser 30 000 caractères"],
      default: "",
    },
    contractVersion: {
      type: Number,
      default: 1,
      min: 1,
    },
    contractValidatedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
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
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Indexes for performance
LeaseSchema.index({ propertyId: 1 });
LeaseSchema.index({ tenantId: 1 });
LeaseSchema.index({ status: 1 });
LeaseSchema.index({ startDate: 1 });
LeaseSchema.index({ endDate: 1 });
LeaseSchema.index({ signedDate: 1 });
LeaseSchema.index({ deletedAt: 1 });
LeaseSchema.index({ archivedAt: 1 });
LeaseSchema.index({ createdAt: -1 });

// Compound indexes for common queries
LeaseSchema.index({ propertyId: 1, status: 1 });
LeaseSchema.index({ tenantId: 1, status: 1 });
LeaseSchema.index({ status: 1, endDate: 1 });

// Virtual for lease duration in days
LeaseSchema.virtual("durationDays").get(function () {
  const getValue = (field: string) =>
    typeof this.get === "function" ? this.get(field) : this[field];

  const rawStart = getValue("startDate");
  const rawEnd = getValue("endDate");

  if (!rawStart || !rawEnd) {
    return null;
  }

  const toDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    if (
      typeof value === "object" &&
      value !== null &&
      "getTime" in (value as Record<string, unknown>) &&
      typeof (value as { getTime: unknown }).getTime === "function"
    ) {
      return new Date((value as { getTime: () => number }).getTime());
    }
    return null;
  };

  const startDate = toDate(rawStart);
  const endDate = toDate(rawEnd);

  if (!startDate || !endDate) {
    return null;
  }

  const duration = endDate.getTime() - startDate.getTime();
  return Math.ceil(duration / (24 * 60 * 60 * 1000));
});

// Virtual for lease duration in months
LeaseSchema.virtual("durationMonths").get(function () {
  const startYear = this.startDate.getFullYear();
  const startMonth = this.startDate.getMonth();
  const endYear = this.endDate.getFullYear();
  const endMonth = this.endDate.getMonth();

  return (endYear - startYear) * 12 + (endMonth - startMonth);
});

// Virtual for days remaining
LeaseSchema.virtual("daysRemaining").get(function () {
  const now = new Date();
  if (now > this.endDate) return 0;
  const remaining = this.endDate.getTime() - now.getTime();
  return Math.ceil(remaining / (24 * 60 * 60 * 1000));
});

// Virtual for lease progress percentage
LeaseSchema.virtual("progressPercentage").get(function () {
  const now = new Date();
  const total = this.endDate.getTime() - this.startDate.getTime();
  const elapsed = Math.min(now.getTime() - this.startDate.getTime(), total);
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
});

// Virtual for monthly rent
LeaseSchema.virtual("monthlyRent").get(function () {
  return typeof this.terms?.rentAmount === "number"
    ? this.terms.rentAmount
    : null;
});

// Virtual for total lease value
LeaseSchema.virtual("totalValue").get(function () {
  if (typeof this.terms?.rentAmount !== "number") {
    return null;
  }

  if (typeof this.durationMonths !== "number") {
    return null;
  }

  return this.terms.rentAmount * this.durationMonths;
});

// Static method to find active leases
LeaseSchema.statics.findActive = function () {
  return this.find({
    status: LeaseStatus.ACTIVE,
    deletedAt: null,
  });
};

// Static method to find expiring leases
LeaseSchema.statics.findExpiring = function (days: number = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return this.find({
    status: LeaseStatus.ACTIVE,
    endDate: { $lte: futureDate },
    deletedAt: null,
  });
};

// Static method to find by property
LeaseSchema.statics.findByProperty = function (propertyId: string) {
  return this.find({
    propertyId,
    deletedAt: null,
  });
};

// Static method to find by tenant
LeaseSchema.statics.findByTenant = function (tenantId: string) {
  return this.find({
    tenantId,
    deletedAt: null,
  });
};

// Instance method for soft delete
LeaseSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

// Instance method to restore soft deleted lease
LeaseSchema.methods.restore = function () {
  this.deletedAt = null;
  return this.save();
};

// Instance method to activate lease
LeaseSchema.methods.activate = function () {
  this.status = LeaseStatus.ACTIVE;
  if (!this.signedDate) {
    this.signedDate = new Date();
  }
  return this.save();
};

// Instance method to terminate lease
LeaseSchema.methods.terminate = function (
  userId: string,
  terminationDate: Date,
  reason: string,
  notice?: string
) {
  this.status = LeaseStatus.TERMINATED;
  this.terminatedDate = terminationDate;
  this.terminatedBy = new mongoose.Types.ObjectId(userId);
  this.terminationReason = reason;
  if (notice) this.terminationNotice = notice;
  return this.save();
};

// Instance method to expire lease
LeaseSchema.methods.expire = function () {
  this.status = LeaseStatus.EXPIRED;
  return this.save();
};

// Instance method to sign lease
LeaseSchema.methods.sign = function (
  userId: string,
  signature: string,
  ipAddress?: string
) {
  this.signedDate = new Date();
  this.signedBy = new mongoose.Types.ObjectId(userId);
  this.signatureData = signature;
  if (ipAddress) this.signatureIpAddress = ipAddress;

  if (
    this.status === LeaseStatus.DRAFT ||
    this.status === LeaseStatus.PENDING_SIGNATURE
  ) {
    this.status = LeaseStatus.ACTIVE;
  }
  return this.save();
};

// Instance method to renew lease
LeaseSchema.methods.renew = function (newEndDate: Date, newTerms?: any) {
  this.status = LeaseStatus.RENEWED;
  this.endDate = newEndDate;
  if (newTerms) {
    Object.assign(this.terms, newTerms);
  }
  return this.save();
};

// Query middleware to exclude soft deleted documents
LeaseSchema.pre(/^find/, function (this: any) {
  this.find({ deletedAt: null });
});

// Pre-save middleware for validation
LeaseSchema.pre("save", async function (next) {
  // Validate property exists
  if (this.isModified("propertyId")) {
    const Property = mongoose.model("Property");
    const property = await Property.findById(this.propertyId);

    if (!property) {
      return next(new Error("Property not found"));
    }
  }

  // Validate tenant exists and has tenant role
  if (this.isModified("tenantId")) {
    const User = mongoose.model("User");
    const tenant = await User.findById(this.tenantId).select("role");

    if (!tenant || !(await isTenantAccessRole(tenant.role))) {
      return next(
        new Error("Tenant not found or user does not have tenant role")
      );
    }
  }

  // Check for overlapping leases for the same unit (not just property)
  if (
    this.isModified("startDate") ||
    this.isModified("endDate") ||
    this.isModified("propertyId") ||
    this.isModified("unitId")
  ) {
    const overlappingLease = await mongoose.model("Lease").findOne({
      propertyId: this.propertyId,
      unitId: this.unitId, // Check for same unit, not just property
      _id: { $ne: this._id },
      status: { $in: [LeaseStatus.ACTIVE, LeaseStatus.PENDING] },
      $or: [
        {
          startDate: { $lte: this.endDate },
          endDate: { $gte: this.startDate },
        },
      ],
      deletedAt: null,
    });

    if (overlappingLease) {
      return next(
        new Error("Lease dates overlap with existing lease for this unit")
      );
    }
  }

  next();
});

// Memorize the lease status transition for E-IMMO contract synchronization.
LeaseSchema.pre("save", function (next) {
  (this as any).$locals = (this as any).$locals || {};
  (this as any).$locals.eimmoStatusChanged = this.isModified("status");
  next();
});

// Post-save middleware to update unit status and handle payment cascades
LeaseSchema.post("save", async function () {
  try {
    const Property = mongoose.model("Property");
    const property = await Property.findById(this.propertyId);

    if (!property) return;

    // Find the specific unit in the embedded units array
    const unit = property.units.find(
      (u: any) => u._id && u._id.toString() === this.unitId.toString()
    );

    if (!unit) return;

    // Update unit status based on lease status
    if (this.status === LeaseStatus.ACTIVE) {
      unit.status = "occupied";
      unit.currentTenantId = this.tenantId;
      unit.currentLeaseId = this._id;
    } else if (
      this.status === LeaseStatus.TERMINATED ||
      this.status === LeaseStatus.EXPIRED
    ) {
      unit.status = "available";
      unit.currentTenantId = undefined;
      unit.currentLeaseId = undefined;
    }

    // Save the property with updated unit information
    await property.save();

    // E-IMMO contract portfolio event logging.
    // Non bloquant : un problème de journalisation ne doit jamais casser le bail.
    if ((this as any).$locals?.eimmoStatusChanged) {
      try {
        const { default: SubscriptionContract } = await import("./SubscriptionContract");
        const { default: ContractPortfolioEvent } = await import("./ContractPortfolioEvent");

        const accountIds = [
          property.ownerId ? String(property.ownerId) : null,
          property.managerId ? String(property.managerId) : null,
        ].filter(Boolean);

        const contracts = accountIds.length
          ? await SubscriptionContract.find({
              accountId: { $in: accountIds },
              status: "active",
              "mandateRules.leaseSyncEnabled": { $ne: false },
            }).select("_id accountId mandateRules")
          : [];

        const eventTypeMap: Record<string, string> = {
          active: "lease_activated",
          terminated: "lease_terminated",
          expired: "lease_expired",
          renewed: "lease_renewed",
        };

        const eventType = eventTypeMap[String(this.status)];
        if (eventType) {
          const label =
            eventType === "lease_activated"
              ? "Bail activé"
              : eventType === "lease_terminated"
                ? "Bail résilié"
                : eventType === "lease_expired"
                  ? "Bail arrivé à expiration"
                  : "Bail renouvelé";

          for (const contract of contracts) {
            const notify =
              eventType === "lease_activated"
                ? contract.mandateRules?.notifyOnLeaseActivation !== false
                : eventType === "lease_terminated"
                  ? contract.mandateRules?.notifyOnLeaseTermination !== false
                  : eventType === "lease_expired"
                    ? contract.mandateRules?.notifyOnLeaseExpiration !== false
                    : true;

            if (!notify) continue;

            await ContractPortfolioEvent.create({
              contractId: contract._id,
              accountId: contract.accountId,
              leaseId: this._id,
              propertyId: this.propertyId,
              tenantId: this.tenantId,
              type: eventType,
              message: `${label} — vérifier l'occupation, les paiements, la caution et la situation de l'unité.`,
              occurredAt: new Date(),
            });
          }
        }
      } catch (contractSyncError) {
        console.warn("Synchronisation contrat E-IMMO non bloquante :", contractSyncError);
      }
    }

    // Handle payment cascades for lease status changes
    if (this.isModified("status")) {
      await this.handlePaymentCascades();
    }
  } catch (error) {
    // Silently handle errors to avoid breaking lease operations
  }
});

// Add payment cascade handling method
LeaseSchema.methods.handlePaymentCascades = async function () {
  try {
    const Payment = mongoose.model("Payment");

    if (
      this.status === LeaseStatus.TERMINATED ||
      this.status === LeaseStatus.EXPIRED
    ) {
      // Cancel all non-paid payments for terminated/expired leases
      await Payment.updateMany(
        {
          leaseId: this._id,
          status: {
            $in: [
              PaymentStatus.PENDING,
              PaymentStatus.OVERDUE,
              PaymentStatus.PARTIAL,
              PaymentStatus.FAILED,
            ],
          },
          deletedAt: null,
        },
        {
          status: PaymentStatus.CANCELLED,
          notes: `Cancelled due to lease ${this.status.toLowerCase()}`,
          lastSyncedAt: new Date(),
          syncStatus: "synced",
        }
      );
    } else if (this.status === LeaseStatus.ACTIVE && this.isModified("terms")) {
      // Update payment amounts if lease terms changed
      await Payment.updateMany(
        {
          leaseId: this._id,
          status: PaymentStatus.PENDING,
          type: PaymentType.RENT,
          deletedAt: null,
        },
        {
          amount: this.terms.rentAmount,
          lastSyncedAt: new Date(),
          syncStatus: "synced",
        }
      );
    }
  } catch (error) {
    // Silently handle payment cascade errors to avoid breaking lease operations
  }
};

// Create and export the model
const Lease: Model<ILease> =
  mongoose.models?.Lease || mongoose.model<ILease>("Lease", LeaseSchema);

export default Lease;

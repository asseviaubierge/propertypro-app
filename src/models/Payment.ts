import mongoose, { Schema, Model } from "mongoose";
import {
  IPayment,
  PaymentType,
  PaymentStatus,
  PaymentMethod,
  PaymentFrequency,
  IPaymentSchedule,
  ILateFeeConfig,
} from "@/types";
import { formatCurrency } from "@/lib/utils/formatting";

// Payment Schedule subdocument schema
const PaymentScheduleSchema = new Schema<IPaymentSchedule>(
  {
    frequency: {
      type: String,
      enum: Object.values(PaymentFrequency),
      required: [true, "Payment frequency is required"],
    },
    startDate: {
      type: Date,
      required: [true, "Schedule start date is required"],
    },
    endDate: {
      type: Date,
      validate: {
        validator: function (date: Date) {
          if (!date) return true; // Optional field
          return date > this.startDate;
        },
        message: "End date must be after start date",
      },
    },
    dayOfMonth: {
      type: Number,
      min: [1, "Day of month must be between 1 and 31"],
      max: [31, "Day of month must be between 1 and 31"],
    },
    dayOfWeek: {
      type: Number,
      min: [0, "Day of week must be between 0 and 6"],
      max: [6, "Day of week must be between 0 and 6"],
    },
    customInterval: {
      type: Number,
      min: [1, "Custom interval must be at least 1"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    nextDueDate: {
      type: Date,
    },
    lastGeneratedDate: {
      type: Date,
    },
  },
  { _id: false },
);

// Late Fee Configuration subdocument schema
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
  { _id: false },
);

// Proration data subdocument schema
const ProrationDataSchema = new Schema(
  {
    isProrated: {
      type: Boolean,
      default: false,
    },
    originalAmount: {
      type: Number,
      min: [0, "Original amount cannot be negative"],
    },
    proratedAmount: {
      type: Number,
      min: [0, "Prorated amount cannot be negative"],
    },
    startDate: {
      type: Date,
      required: [true, "Proration start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "Proration end date is required"],
    },
    daysInPeriod: {
      type: Number,
      min: [1, "Days in period must be at least 1"],
    },
    dailyRate: {
      type: Number,
      min: [0, "Daily rate cannot be negative"],
    },
    method: {
      type: String,
      enum: ["daily", "calendar", "banking"],
      default: "daily",
    },
  },
  { _id: false },
);

const PaymentSchema = new Schema<IPayment>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Tenant ID is required"],
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: [true, "Property ID is required"],
    },
    leaseId: {
      type: Schema.Types.ObjectId,
      ref: "Lease",
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      index: true,
    },
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0.01, "Payment amount must be at least $0.01"],
      max: [100000, "Payment amount cannot exceed $100,000"],
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: [0, "Amount paid cannot be negative"],
      validate: {
        validator: function (amountPaid: number) {
          return amountPaid <= this.amount;
        },
        message: "Amount paid cannot exceed total amount",
      },
    },
    type: {
      type: String,
      enum: Object.values(PaymentType),
      required: [true, "Payment type is required"],
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      required: [true, "Payment status is required"],
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      trim: true,
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    paidDate: {
      type: Date,
      validate: {
        validator: function (date: Date) {
          if (!date) return true; // Optional field
          return date >= this.createdAt;
        },
        message: "Paid date cannot be before payment creation",
      },
    },
    stripePaymentIntentId: {
      type: String,
      trim: true,
      sparse: true, // Allow multiple null values
    },
    stripeCheckoutSessionId: {
      type: String,
      trim: true,
      sparse: true,
    },
    stripePaymentMethodId: {
      type: String,
      trim: true,
      sparse: true, // Allow multiple null values
    },
    stripeCustomerId: {
      type: String,
      trim: true,
      sparse: true, // Allow multiple null values
    },
    paypalOrderId: {
      type: String,
      trim: true,
      sparse: true, // Allow multiple null values
    },
    paypalCaptureId: {
      type: String,
      trim: true,
      sparse: true, // Allow multiple null values
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      sparse: true, // Allow multiple null values
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      sparse: true, // Allow multiple null values
    },
    paystackReference: {
      type: String,
      trim: true,
      sparse: true, // Allow multiple null values
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    receiptUrl: {
      type: String,
      trim: true,
    },

    // Allocation tracking for invoice applications
    allocations: {
      type: [
        new Schema(
          {
            invoiceId: {
              type: Schema.Types.ObjectId,
              ref: "Invoice",
              required: true,
            },
            amount: { type: Number, required: true, min: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    // Enhanced payment scheduling
    schedule: {
      type: PaymentScheduleSchema,
    },
    parentPaymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },

    // Late fee management
    lateFeeConfig: {
      type: LateFeeConfigSchema,
    },
    lateFeeApplied: {
      type: Number,
      default: 0,
      min: [0, "Late fee applied cannot be negative"],
    },
    lateFeeDate: {
      type: Date,
    },

    // Proration tracking
    prorationData: {
      type: ProrationDataSchema,
    },

    // Communication tracking
    remindersSent: {
      type: [
        {
          type: {
            type: String,
            enum: ["reminder", "overdue", "final_notice", "confirmation"],
            required: true,
          },
          sentDate: {
            type: Date,
            required: true,
          },
          method: {
            type: String,
            enum: ["email", "sms", "push", "email,sms"],
            required: true,
          },
          templateId: {
            type: String,
          },
          success: {
            type: Boolean,
            default: true,
          },
        },
      ],
      default: [],
    },

    // Enhanced status tracking
    statusHistory: {
      type: [
        {
          status: {
            type: String,
            enum: Object.values(PaymentStatus),
            required: true,
          },
          changedAt: {
            type: Date,
            required: true,
            default: Date.now,
          },
          changedBy: {
            type: String,
            default: "system",
          },
          reason: {
            type: String,
          },
        },
      ],
      default: [],
    },

    // Payment tracking
    paymentHistory: {
      type: [
        {
          amount: {
            type: Number,
            required: [true, "Payment history amount is required"],
            min: [0.01, "Payment amount must be at least $0.01"],
          },
          paymentMethod: {
            type: String,
            enum: Object.values(PaymentMethod),
            required: [true, "Payment method is required"],
          },
          paidDate: {
            type: Date,
            required: [true, "Payment date is required"],
          },
          transactionId: {
            type: String,
            trim: true,
          },
          notes: {
            type: String,
            trim: true,
            maxlength: [500, "Payment notes cannot exceed 500 characters"],
          },
        },
      ],
      default: [],
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    // Optimistic locking version field
    version: {
      type: Number,
      default: 0,
    },

    // Synchronization tracking
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
    syncStatus: {
      type: String,
      enum: ["synced", "pending", "failed"],
      default: "synced",
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    versionKey: "version",
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
  },
);

// ============================================================================
// INDEXES AND CONSTRAINTS FOR DATA INTEGRITY
// ============================================================================

// Compound indexes for data integrity and performance
PaymentSchema.index(
  { leaseId: 1, type: 1, dueDate: 1 },
  {
    unique: true,
    partialFilterExpression: {
      leaseId: { $exists: true },
      deletedAt: null,
      type: PaymentType.RENT,
    },
    name: "unique_lease_payment_per_due_date",
  },
);

PaymentSchema.index(
  { tenantId: 1, status: 1, dueDate: 1 },
  {
    name: "tenant_payment_status_lookup",
  },
);

PaymentSchema.index(
  { propertyId: 1, status: 1, createdAt: -1 },
  {
    name: "property_payment_history",
  },
);

PaymentSchema.index(
  { status: 1, dueDate: 1 },
  {
    name: "payment_status_due_date",
  },
);

PaymentSchema.index(
  { stripePaymentIntentId: 1 },
  {
    sparse: true,
    name: "stripe_payment_intent_lookup",
  },
);

PaymentSchema.index(
  { paypalOrderId: 1 },
  {
    sparse: true,
    name: "paypal_order_lookup",
  },
);

PaymentSchema.index(
  { razorpayOrderId: 1 },
  {
    sparse: true,
    name: "razorpay_order_lookup",
  },
);

PaymentSchema.index(
  { paystackReference: 1 },
  {
    sparse: true,
    name: "paystack_reference_lookup",
  },
);

PaymentSchema.index(
  { deletedAt: 1 },
  {
    partialFilterExpression: { deletedAt: { $exists: true } },
    name: "soft_delete_lookup",
  },
);

// Performance indexes
PaymentSchema.index({ createdAt: -1 });
PaymentSchema.index({ version: 1 });
PaymentSchema.index({ syncStatus: 1 });
PaymentSchema.index({ status: 1, dueDate: 1 });
PaymentSchema.index({ type: 1, status: 1 });
PaymentSchema.index({ paymentMethod: 1, status: 1 });

// Virtual for days overdue
PaymentSchema.virtual("daysOverdue").get(function () {
  if (
    this.status === PaymentStatus.PAID ||
    this.status === PaymentStatus.REFUNDED
  ) {
    return 0;
  }

  const dueDate =
    this.dueDate instanceof Date
      ? this.dueDate
      : this.dueDate
        ? new Date(this.dueDate)
        : null;

  if (!dueDate || Number.isNaN(dueDate.getTime())) {
    return 0;
  }

  const now = new Date();
  if (now <= dueDate) return 0;
  const overdue = now.getTime() - dueDate.getTime();
  return Math.ceil(overdue / (24 * 60 * 60 * 1000));
});

// Note: isOverdue functionality moved to checkIsOverdue() method to avoid naming conflicts

// Virtual for is late (grace period of 5 days)
PaymentSchema.virtual("isLate").get(function () {
  return this.daysOverdue > 5;
});

// Virtual for payment period (for rent payments)
PaymentSchema.virtual("paymentPeriod").get(function () {
  if (this.type !== PaymentType.RENT) return null;

  const dueDate =
    this.dueDate instanceof Date
      ? this.dueDate
      : this.dueDate
        ? new Date(this.dueDate)
        : null;

  if (!dueDate || Number.isNaN(dueDate.getTime())) {
    return null;
  }

  const year = dueDate.getFullYear();
  const month = dueDate.getMonth();
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return `${monthNames[month]} ${year}`;
});

// Virtual for formatted amount
PaymentSchema.virtual("formattedAmount").get(function () {
  return formatCurrency(this.amount);
});

// Static method to find pending payments
PaymentSchema.statics.findPending = function () {
  return this.find({
    status: PaymentStatus.PENDING,
    deletedAt: null,
  });
};

// Static method to find overdue payments
PaymentSchema.statics.findOverdue = function () {
  const now = new Date();
  return this.find({
    status: { $in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
    dueDate: { $lt: now },
    deletedAt: null,
  });
};

// Static method to find by tenant
PaymentSchema.statics.findByTenant = function (tenantId: string) {
  return this.find({
    tenantId,
    deletedAt: null,
  });
};

// Static method to find by property
PaymentSchema.statics.findByProperty = function (propertyId: string) {
  return this.find({
    propertyId,
    deletedAt: null,
  });
};

// Static method to find by lease
PaymentSchema.statics.findByLease = function (leaseId: string) {
  return this.find({
    leaseId,
    deletedAt: null,
  });
};

// Static method to find by date range
PaymentSchema.statics.findByDateRange = function (
  startDate: Date,
  endDate: Date,
) {
  return this.find({
    dueDate: { $gte: startDate, $lte: endDate },
    deletedAt: null,
  });
};

// Static method to get payment statistics
PaymentSchema.statics.getStatistics = async function (propertyId?: string) {
  const matchStage: any = { deletedAt: null };
  if (propertyId)
    matchStage.propertyId = new mongoose.Types.ObjectId(propertyId);

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
        completedAmount: {
          $sum: {
            $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0],
          },
        },
        pendingAmount: {
          $sum: {
            $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0],
          },
        },
        overdueAmount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ["$status", ["pending", "failed"]] },
                  { $lt: ["$dueDate", new Date()] },
                ],
              },
              "$amount",
              0,
            ],
          },
        },
        totalCount: { $sum: 1 },
        completedCount: {
          $sum: {
            $cond: [{ $eq: ["$status", "paid"] }, 1, 0],
          },
        },
        pendingCount: {
          $sum: {
            $cond: [{ $eq: ["$status", "pending"] }, 1, 0],
          },
        },
        overdueCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ["$status", ["pending", "failed"]] },
                  { $lt: ["$dueDate", new Date()] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  return (
    stats[0] || {
      totalAmount: 0,
      completedAmount: 0,
      pendingAmount: 0,
      overdueAmount: 0,
      totalCount: 0,
      completedCount: 0,
      pendingCount: 0,
      overdueCount: 0,
    }
  );
};

// Instance method for soft delete
PaymentSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

// Instance method to restore soft deleted payment
PaymentSchema.methods.restore = function () {
  this.deletedAt = null;
  return this.save();
};

// Instance method to mark as paid
PaymentSchema.methods.markAsPaid = function (paymentDate?: Date) {
  this.status = PaymentStatus.PAID;
  this.paidDate = paymentDate || new Date();
  return this.save();
};

// Instance method to mark as failed
PaymentSchema.methods.markAsFailed = function () {
  this.status = PaymentStatus.FAILED;
  return this.save();
};

// Instance method to refund payment
PaymentSchema.methods.refund = function () {
  if (this.status !== PaymentStatus.PAID) {
    throw new Error("Can only refund paid payments");
  }
  if (this.status === PaymentStatus.REFUNDED) {
    throw new Error("Payment has already been refunded");
  }
  if (
    !this.stripePaymentIntentId &&
    this.paymentMethod === PaymentMethod.CREDIT_CARD
  ) {
    throw new Error(
      "Cannot refund online payment without Stripe payment intent",
    );
  }
  this.status = PaymentStatus.REFUNDED;
  return this.save();
};

// Query middleware to exclude soft deleted documents
PaymentSchema.pre(/^find/, function () {
  // @ts-ignore
  this.find({ deletedAt: null });
});

// ============================================================================
// MIDDLEWARE FOR DATA INTEGRITY AND SYNCHRONIZATION
// ============================================================================

// Pre-save middleware for validation and synchronization
PaymentSchema.pre("save", async function (next) {
  try {
    const isInvoiceLinkedPayment = Boolean(this.invoiceId);

    // Update sync status when payment is modified
    if (this.isModified() && !this.isNew) {
      this.syncStatus = "pending";
      this.lastSyncedAt = new Date();
    }

    // Validate tenant exists and has tenant role
    if (this.isModified("tenantId")) {
      const User = mongoose.model("User");
      const tenant = await User.collection.findOne(
        {
          _id: new mongoose.Types.ObjectId(this.tenantId.toString()),
        },
        {
          projection: { _id: 1, role: 1 },
        }
      );

      if (!tenant) {
        return next(new Error("Tenant not found"));
      }

      // Emergency compatibility mode:
      // historical data may reference users whose role is no longer `tenant`.
      // For now, only require that the referenced user exists.
    }

    // Validate property exists
    if (this.isModified("propertyId")) {
      const Property = mongoose.model("Property");
      const property = await Property.collection.findOne(
        {
          _id: new mongoose.Types.ObjectId(this.propertyId.toString()),
        },
        {
          projection: { _id: 1 },
        }
      );

      if (!property && !isInvoiceLinkedPayment) {
        return next(new Error("Property not found"));
      }
    }

    // Enhanced lease validation with date and status checks
    if (this.isModified("leaseId") && this.leaseId) {
      const Lease = mongoose.model("Lease");
      const lease = await Lease.collection.findOne(
        {
          _id: new mongoose.Types.ObjectId(this.leaseId.toString()),
        },
        {
          projection: {
            _id: 1,
            tenantId: 1,
            propertyId: 1,
            startDate: 1,
            endDate: 1,
            status: 1,
          },
        }
      );

      if (!lease) {
        if (!isInvoiceLinkedPayment) {
          return next(new Error("Lease not found"));
        }
      } else if (!isInvoiceLinkedPayment) {
        // Ensure lease belongs to the same tenant and property
        if (lease.tenantId?.toString() !== this.tenantId.toString()) {
          return next(new Error("Lease does not belong to the specified tenant"));
        }

        if (lease.propertyId?.toString() !== this.propertyId.toString()) {
          return next(
            new Error("Lease does not belong to the specified property")
          );
        }

        // Validate payment due date is within lease period
        // Allow security deposit payments (or invoices tagged as security_deposit) to be due before lease start
        let isSecurityDeposit = this.type === PaymentType.SECURITY_DEPOSIT;
        if (!isSecurityDeposit && this.invoiceId) {
          try {
            const InvoiceModel = mongoose.model("Invoice");
            const inv: any = await InvoiceModel.findById(this.invoiceId).select(
              "invoiceNumber lineItems"
            );
            if (inv) {
              const hasSecDep = Array.isArray(inv.lineItems)
                ? inv.lineItems.some((li: any) => li?.type === "security_deposit")
                : false;
              const sdPrefix =
                typeof inv.invoiceNumber === "string" &&
                inv.invoiceNumber.startsWith("SD-");
              isSecurityDeposit = hasSecDep || sdPrefix;
            }
          } catch (e) {
            // ignore invoice lookup failures for validation; fall back to existing rules
          }
        }

        if (!isSecurityDeposit) {
          const leaseStartDate = lease.startDate ? new Date(lease.startDate) : null;
          const leaseEndDate = lease.endDate ? new Date(lease.endDate) : null;

          if (
            leaseStartDate &&
            leaseEndDate &&
            (this.dueDate < leaseStartDate || this.dueDate > leaseEndDate)
          ) {
            return next(
              new Error("Payment due date must be within lease period")
            );
          }
        }

        // Validate lease is active for new payments
        if (
          this.isNew &&
          !["active", "pending"].includes(String(lease.status))
        ) {
          return next(new Error("Cannot create payments for inactive leases"));
        }
      }
    }

    // Validate amount consistency
    if (this.amountPaid > this.amount) {
      return next(new Error("Amount paid cannot exceed total amount"));
    }

    // Validate status transitions using prior state
    if (this.isModified("status") && !this.isNew) {
      const paymentModel = mongoose.model("Payment");
      const existing = await paymentModel
        .findById(this._id)
        .select("status version")
        .lean();

      const previousStatus = existing?.status;

      // Check version for optimistic locking
      if (
        existing &&
        existing.version !== undefined &&
        this.version !== existing.version
      ) {
        return next(
          new Error(
            "Payment has been modified by another process. Please refresh and try again.",
          ),
        );
      }

      if (previousStatus) {
        const validTransitions = this.getValidStatusTransitions(previousStatus);
        if (!validTransitions.includes(this.status)) {
          return next(
            new Error(
              `Invalid status transition from ${previousStatus} to ${this.status}`,
            ),
          );
        }
      }
    }

    next();
  } catch (error) {
    next(error instanceof Error ? error : new Error("Validation failed"));
  }
});

// Post-save middleware for lease synchronization
PaymentSchema.post("save", async function (doc) {
  try {
    // Only trigger sync if this is a significant change
    if (doc.isModified("status") || doc.isModified("amountPaid") || doc.isNew) {
      // Import the synchronization service dynamically to avoid circular dependencies
      const { LeasePaymentSynchronizer } =
        await import("../lib/services/lease-payment-synchronizer.service");
      const synchronizer = new LeasePaymentSynchronizer();

      // Trigger async synchronization (don't await to avoid blocking)
      synchronizer
        .syncLeaseWithPayments(doc.leaseId.toString())
        .catch((error) => {
          console.error("Payment sync failed:", error);
        });
    }
  } catch (error) {
    console.error("Post-save sync trigger failed:", error);
  }
});

// Post-remove middleware for cleanup
PaymentSchema.post("remove", async function (doc) {
  try {
    // Import the synchronization service dynamically
    const { LeasePaymentSynchronizer } =
      await import("../lib/services/lease-payment-synchronizer.service");
    const synchronizer = new LeasePaymentSynchronizer();

    // Trigger async synchronization after payment removal
    synchronizer
      .syncLeaseWithPayments(doc.leaseId.toString())
      .catch((error) => {
        console.error("Payment removal sync failed:", error);
      });
  } catch (error) {
    console.error("Post-remove sync trigger failed:", error);
  }
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================

// Method to get valid status transitions for current payment
PaymentSchema.methods.getValidStatusTransitions = function (
  fromStatus?: PaymentStatus,
): PaymentStatus[] {
  const currentStatus = fromStatus || this.status;

  switch (currentStatus) {
    case PaymentStatus.PENDING:
      return [
        PaymentStatus.PAID,
        PaymentStatus.PARTIAL,
        PaymentStatus.OVERDUE,
        PaymentStatus.CANCELLED,
        PaymentStatus.FAILED,
      ];

    case PaymentStatus.PARTIAL:
      return [
        PaymentStatus.PAID,
        PaymentStatus.OVERDUE,
        PaymentStatus.CANCELLED,
      ];

    case PaymentStatus.OVERDUE:
      return [
        PaymentStatus.PAID,
        PaymentStatus.PARTIAL,
        PaymentStatus.CANCELLED,
      ];

    case PaymentStatus.PAID:
      return [PaymentStatus.REFUNDED];

    case PaymentStatus.FAILED:
      return [PaymentStatus.PENDING, PaymentStatus.CANCELLED];

    case PaymentStatus.CANCELLED:
      return [PaymentStatus.PENDING];

    case PaymentStatus.REFUNDED:
      return [];

    default:
      return [];
  }
};

// Method to check if payment is overdue (renamed to avoid conflict with virtual)
PaymentSchema.methods.checkIsOverdue = function (): boolean {
  return (
    this.dueDate < new Date() &&
    this.status === PaymentStatus.PENDING &&
    (this.amountPaid || 0) < this.amount
  );
};

// Method to calculate remaining amount
PaymentSchema.methods.getRemainingAmount = function (): number {
  return Math.max(0, this.amount - (this.amountPaid || 0));
};

// Method to check if payment is fully paid
PaymentSchema.methods.isFullyPaid = function (): boolean {
  return (this.amountPaid || 0) >= this.amount;
};

// Create and export the model
// In development, refresh the model to pick up schema hook changes during
// hot reload. This avoids stale pre-save validation logic.
if (process.env.NODE_ENV !== "production" && mongoose.models?.Payment) {
  delete mongoose.models.Payment;
}

const Payment: Model<IPayment> =
  (mongoose.models?.Payment as Model<IPayment>) ||
  mongoose.model<IPayment>("Payment", PaymentSchema);

const uniqueLeasePaymentIndexSpec = { leaseId: 1, type: 1, dueDate: 1 };
const uniqueLeasePaymentIndexOptions = {
  unique: true,
  name: "unique_lease_payment_per_due_date",
  partialFilterExpression: {
    leaseId: { $exists: true },
    deletedAt: null,
    type: PaymentType.RENT,
  },
};

let ensureIndexesPromise: Promise<void> | null = null;

export async function ensurePaymentIndexes(): Promise<void> {
  if (ensureIndexesPromise) {
    return ensureIndexesPromise;
  }

  ensureIndexesPromise = (async () => {
    if (mongoose.connection.readyState !== 1) {
      await new Promise<void>((resolve, reject) => {
        mongoose.connection.once("connected", () => resolve());
        mongoose.connection.once("error", (error) => reject(error));
      });
    }

    const collection = mongoose.connection.collection("payments");

    try {
      await collection.createIndex(
        uniqueLeasePaymentIndexSpec,
        uniqueLeasePaymentIndexOptions,
      );
    } catch (error) {
      const message = (error as Error).message || "";
      const errorCode = (error as any)?.code;
      const errorCodeName = (error as any)?.codeName;

      const conflict =
        message.includes("already exists") ||
        errorCodeName === "IndexOptionsConflict" ||
        errorCodeName === "IndexKeySpecsConflict" ||
        errorCode === 85 || // IndexOptionsConflict
        errorCode === 86; // IndexKeySpecsConflict

      if (!conflict) {
        throw error;
      }

      try {
        await collection.dropIndex("unique_lease_payment_per_due_date");
      } catch (dropError) {
        const dropMessage = (dropError as Error).message || "";
        if (!dropMessage.includes("not found")) {
          console.error(
            "Failed to drop legacy unique_lease_payment_per_due_date index:",
            dropError,
          );
        }
      }

      await collection.createIndex(
        uniqueLeasePaymentIndexSpec,
        uniqueLeasePaymentIndexOptions,
      );
    }
  })().catch((error) => {
    console.error("Failed to ensure payment indexes:", error);
  });

  await ensureIndexesPromise;
}

export default Payment;

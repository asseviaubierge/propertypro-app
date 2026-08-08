import mongoose, { Schema, Model } from "mongoose";
import { Types } from "mongoose";
import {
  IInvoice,
  IInvoiceLineItem,
  InvoiceStatus,
  InvoiceType,
} from "@/types";

// Invoice Line Item Schema
const InvoiceLineItemSchema = new Schema<IInvoiceLineItem>(
  {
    description: {
      type: String,
      required: [true, "Line item description is required"],
      trim: true,
      maxlength: [200, "Description cannot exceed 200 characters"],
    },
    amount: {
      type: Number,
      required: [true, "Line item amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    type: {
      type: String,
      enum: Object.values(InvoiceType),
      required: [true, "Line item type is required"],
    },
    quantity: {
      type: Number,
      min: [0, "Quantity cannot be negative"],
      default: 1,
    },
    unitPrice: {
      type: Number,
      min: [0, "Unit price cannot be negative"],
    },
    dueDate: {
      type: Date,
    },
  },
  { _id: false }
);

// Main Invoice Schema
const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: {
      type: String,
      required: [true, "Invoice number is required"],
      unique: true,
      trim: true,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Tenant ID is required"],
      index: true,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: [true, "Property ID is required"],
      index: true,
    },
    leaseId: {
      type: Schema.Types.ObjectId,
      ref: "Lease",
      index: true,
    },
    unitId: {
      type: Schema.Types.ObjectId,
    },

    // Invoice Details
    category: {
      type: String,
      enum: Object.values(InvoiceType),
      required: [true, "Invoice category is required"],
      index: true,
    },
    issueDate: {
      type: Date,
      required: [true, "Issue date is required"],
      index: true,
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
      index: true,
      validate: {
        validator: function (date: Date) {
          return date >= this.issueDate;
        },
        message: "Due date must be on or after issue date",
      },
    },
    status: {
      type: String,
      enum: Object.values(InvoiceStatus),
      default: InvoiceStatus.SCHEDULED,
      required: [true, "Invoice status is required"],
      index: true,
    },

    // Financial Information
    subtotal: {
      type: Number,
      required: [true, "Subtotal is required"],
      min: [0, "Subtotal cannot be negative"],
    },
    taxAmount: {
      type: Number,
      min: [0, "Tax amount cannot be negative"],
      default: 0,
    },
    discountAmount: {
      type: Number,
      min: [0, "Discount amount cannot be negative"],
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: [0, "Total amount cannot be negative"],
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: [0, "Amount paid cannot be negative"],
      validate: {
        validator: function (amountPaid: number) {
          return amountPaid <= this.totalAmount;
        },
        message: "Amount paid cannot exceed total amount",
      },
    },
    balanceRemaining: {
      type: Number,
      default: function () {
        return this.totalAmount - this.amountPaid;
      },
      min: [0, "Balance remaining cannot be negative"],
    },

    // Line Items
    lineItems: {
      type: [InvoiceLineItemSchema],
      required: [true, "At least one line item is required"],
      validate: {
        validator: function (items: IInvoiceLineItem[]) {
          return items.length > 0 && items.length <= 50;
        },
        message: "Must have between 1 and 50 line items",
      },
    },

    // Payment Tracking
    paymentIds: {
      type: [Schema.Types.ObjectId],
      ref: "Payment",
      default: [],
    },
    lastPaymentDate: {
      type: Date,
    },

    // Late Fee Tracking
    lateFeeAmount: {
      type: Number,
      default: 0,
      min: [0, "Late fee amount cannot be negative"],
    },
    lateFeeAppliedDate: {
      type: Date,
    },
    gracePeriodEnd: {
      type: Date,
    },

    // Communication
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentDate: {
      type: Date,
    },
    remindersSent: {
      type: [
        {
          type: {
            type: String,
            enum: ["reminder", "overdue", "final_notice"],
            required: true,
          },
          sentDate: {
            type: Date,
            required: true,
          },
          method: {
            type: String,
            enum: ["email", "sms", "both"],
            required: true,
          },
        },
      ],
      default: [],
    },

    // Document Management
    pdfPath: {
      type: String,
      trim: true,
    },
    pdfGenerated: {
      type: Boolean,
      default: false,
    },

    // Metadata
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
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
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Indexes for performance
InvoiceSchema.index({ tenantId: 1, status: 1 });
InvoiceSchema.index({ propertyId: 1, status: 1 });
InvoiceSchema.index({ leaseId: 1, dueDate: 1 });
InvoiceSchema.index({ status: 1, dueDate: 1 });
InvoiceSchema.index({ dueDate: 1, status: 1 });
InvoiceSchema.index({ issueDate: -1 });
InvoiceSchema.index({ deletedAt: 1 });

// Compound indexes for common queries
InvoiceSchema.index({ tenantId: 1, status: 1, dueDate: 1 });
InvoiceSchema.index({ propertyId: 1, status: 1, dueDate: 1 });

// Virtual for days overdue
InvoiceSchema.virtual("daysOverdue").get(function () {
  if (this.status !== InvoiceStatus.OVERDUE) return 0;
  const now = new Date();
  const diffTime = now.getTime() - this.dueDate.getTime();
  return Math.ceil(diffTime / (24 * 60 * 60 * 1000));
});

// Virtual for is overdue
InvoiceSchema.virtual("isOverdue").get(function () {
  return new Date() > this.dueDate && this.balanceRemaining > 0;
});

// Virtual for payment status
InvoiceSchema.virtual("paymentStatus").get(function () {
  if (this.balanceRemaining === 0) return "paid";
  if (this.amountPaid > 0) return "partial";
  if (this.isOverdue) return "overdue";
  return "pending";
});

// Instance Methods
InvoiceSchema.methods.updateStatus = function () {
  const now = new Date();

  // CANCELLED is terminal
  if (this.status === InvoiceStatus.CANCELLED) {
    return this.save();
  }

  if (this.balanceRemaining <= 0 && this.totalAmount > 0) {
    this.status = InvoiceStatus.PAID;
  } else if (this.dueDate && now > this.dueDate) {
    // Overdue beats partial — dunning cares about the unpaid balance past due
    this.status = InvoiceStatus.OVERDUE;
  } else if (this.amountPaid > 0) {
    this.status = InvoiceStatus.PARTIAL;
  } else if (this.issueDate && now >= this.issueDate) {
    this.status = InvoiceStatus.ISSUED;
  }

  return this.save();
};

InvoiceSchema.methods.addPayment = function (
  paymentId: Types.ObjectId,
  amount: number
) {
  // Idempotent: never apply the same payment to an invoice twice. Guards the
  // online flows where a redirect capture/reconcile and the webhook can each
  // try to finalize the same payment.
  const alreadyApplied = this.paymentIds.some(
    (id: Types.ObjectId) => id.toString() === paymentId.toString()
  );
  if (alreadyApplied) {
    return this.updateStatus();
  }

  this.paymentIds.push(paymentId);
  this.amountPaid += amount;
  this.balanceRemaining = this.totalAmount - this.amountPaid;
  this.lastPaymentDate = new Date();

  return this.updateStatus();
};

InvoiceSchema.methods.addLateFee = function (amount: number) {
  this.lateFeeAmount += amount;
  this.totalAmount += amount;
  this.balanceRemaining += amount;
  this.lateFeeAppliedDate = new Date();

  // Add late fee as line item
  this.lineItems.push({
    description: `Late Fee - ${this.daysOverdue} days overdue`,
    amount: amount,
    type: InvoiceType.LATE_FEE,
    quantity: 1,
    unitPrice: amount,
  });

  return this.save();
};

InvoiceSchema.methods.generateInvoiceNumber = function () {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${year}${month}-${random}`;
};

// Static Methods
InvoiceSchema.statics.createFromLease = async function (
  leaseId: Types.ObjectId,
  dueDate: Date
) {
  const Lease = mongoose.model("Lease");
  const lease = await Lease.findById(leaseId).populate("tenantId propertyId");

  if (!lease) {
    throw new Error("Lease not found");
  }

  const invoiceNumber = `INV-${new Date().getFullYear()}${String(
    new Date().getMonth() + 1
  ).padStart(2, "0")}-${Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase()}`;

  const invoice = new this({
    invoiceNumber,
    tenantId: lease.tenantId,
    propertyId: lease.propertyId,
    leaseId: lease._id,
    unitId: lease.unitId,
    issueDate: new Date(),
    dueDate,
    status: InvoiceStatus.SCHEDULED,
    subtotal: lease.terms.rentAmount,
    totalAmount: lease.terms.rentAmount,
    balanceRemaining: lease.terms.rentAmount,
    gracePeriodEnd: new Date(
      dueDate.getTime() +
        (lease.terms.paymentConfig?.lateFeeConfig?.gracePeriodDays || 5) *
          24 *
          60 *
          60 *
          1000
    ),
    lineItems: [
      {
        description: "Monthly Rent",
        amount: lease.terms.rentAmount,
        type: InvoiceType.RENT,
        quantity: 1,
        unitPrice: lease.terms.rentAmount,
      },
    ],
  });

  return invoice.save();
};

// Pre-save middleware
InvoiceSchema.pre("save", function (next) {
  // Auto-generate invoice number if not provided
  if (!this.invoiceNumber) {
    this.invoiceNumber = this.generateInvoiceNumber();
  }

  // Calculate totals from line items
  this.subtotal = this.lineItems.reduce((sum, item) => sum + item.amount, 0);
  this.totalAmount = this.subtotal + (this.taxAmount || 0) - (this.discountAmount || 0);
  if (this.totalAmount < 0) this.totalAmount = 0;
  this.balanceRemaining = this.totalAmount - this.amountPaid;

  // Auto-update status based on current state (CANCELLED is terminal)
  if (this.status !== InvoiceStatus.CANCELLED) {
    const now = new Date();
    if (this.balanceRemaining <= 0 && this.totalAmount > 0) {
      this.status = InvoiceStatus.PAID;
    } else if (this.dueDate && now > this.dueDate) {
      this.status = InvoiceStatus.OVERDUE;
    } else if (this.amountPaid > 0) {
      this.status = InvoiceStatus.PARTIAL;
    } else if (this.issueDate && now >= this.issueDate) {
      this.status = InvoiceStatus.ISSUED;
    }
  }

  next();
});

// Query middleware to exclude soft deleted documents
InvoiceSchema.pre(/^find/, function () {
  // @ts-ignore
  this.find({ $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] });
});

// Create and export the model
const Invoice: Model<IInvoice> =
  mongoose.models?.Invoice ||
  mongoose.model<IInvoice>("Invoice", InvoiceSchema);

export default Invoice;

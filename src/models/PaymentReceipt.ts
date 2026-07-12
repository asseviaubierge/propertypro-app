import mongoose, { Schema, Document } from "mongoose";

export interface IPaymentReceipt extends Document {
  paymentId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  propertyId: mongoose.Types.ObjectId;
  receiptNumber: string;
  amount: number;
  paymentMethod: string;
  transactionId?: string;
  paidDate: Date;
  description: string;
  receiptData: {
    tenantName: string;
    propertyAddress: string;
    paymentDetails: {
      amount: number;
      type: string;
      dueDate: Date;
      paidDate: Date;
    };
    companyInfo: {
      name: string;
      address: string;
      phone: string;
      email: string;
    };
  };
  pdfPath?: string;
  emailSent: boolean;
  emailSentDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentReceiptSchema = new Schema<IPaymentReceipt>(
  {
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: [true, "Payment ID is required"],
    },
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
    receiptNumber: {
      type: String,
      required: [true, "Receipt number is required"],
      unique: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be at least $0.01"],
    },
    paymentMethod: {
      type: String,
      required: [true, "Payment method is required"],
      trim: true,
    },
    transactionId: {
      type: String,
      trim: true,
    },
    paidDate: {
      type: Date,
      required: [true, "Paid date is required"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    receiptData: {
      tenantName: {
        type: String,
        required: [true, "Tenant name is required"],
        trim: true,
      },
      propertyAddress: {
        type: String,
        required: [true, "Property address is required"],
        trim: true,
      },
      paymentDetails: {
        amount: {
          type: Number,
          required: [true, "Payment amount is required"],
        },
        type: {
          type: String,
          required: [true, "Payment type is required"],
        },
        dueDate: {
          type: Date,
          required: [true, "Due date is required"],
        },
        paidDate: {
          type: Date,
          required: [true, "Paid date is required"],
        },
      },
      companyInfo: {
        name: {
          type: String,
          required: [true, "Company name is required"],
          trim: true,
        },
        address: {
          type: String,
          required: [true, "Company address is required"],
          trim: true,
        },
        phone: {
          type: String,
          trim: true,
        },
        email: {
          type: String,
          trim: true,
          lowercase: true,
        },
      },
    },
    pdfPath: {
      type: String,
      trim: true,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: "payment_receipts",
  }
);

// Indexes - with error handling to prevent emitWarning issues
try {
  PaymentReceiptSchema.index({ paymentId: 1 }, { unique: true });
  PaymentReceiptSchema.index({ tenantId: 1, createdAt: -1 });
  // receiptNumber already has unique constraint in schema, no need for additional index
  PaymentReceiptSchema.index({ propertyId: 1 });
} catch (error) {
  // Silently handle index creation errors in development
  if (process.env.NODE_ENV !== "production") {
    console.warn("PaymentReceipt index creation warning:", error);
  }
}

// Pre-save middleware to generate receipt number
PaymentReceiptSchema.pre("save", async function (next) {
  if (this.isNew && !this.receiptNumber) {
    const count = await mongoose.model("PaymentReceipt").countDocuments();
    this.receiptNumber = `RCP-${Date.now()}-${(count + 1)
      .toString()
      .padStart(4, "0")}`;
  }
  next();
});

// Instance Methods
PaymentReceiptSchema.methods.markEmailSent = function () {
  this.emailSent = true;
  this.emailSentDate = new Date();
  return this.save();
};

// Static Methods
PaymentReceiptSchema.statics.findByTenant = function (tenantId: string) {
  return this.find({ tenantId }).sort({ createdAt: -1 });
};

PaymentReceiptSchema.statics.findByPayment = function (paymentId: string) {
  return this.findOne({ paymentId });
};

const PaymentReceipt =
  (mongoose.models?.PaymentReceipt as mongoose.Model<IPaymentReceipt>) ||
  mongoose.model<IPaymentReceipt>("PaymentReceipt", PaymentReceiptSchema);

export default PaymentReceipt;

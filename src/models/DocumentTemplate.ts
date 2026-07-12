import mongoose, { Schema, Model } from "mongoose";

// Template variable interface
export interface ITemplateVariable {
  name: string;
  type: "text" | "number" | "date" | "boolean" | "select" | "multiselect";
  label: string;
  description?: string;
  required: boolean;
  defaultValue?: any;
  options?: string[]; // For select/multiselect types
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

// Template section interface
export interface ITemplateSection {
  id: string;
  name: string;
  content: string;
  order: number;
  conditional?: {
    variable: string;
    operator:
      | "equals"
      | "not_equals"
      | "contains"
      | "greater_than"
      | "less_than";
    value: any;
  };
  repeatable?: boolean;
  repeatSource?: string; // Variable name that contains array data
}

export interface IDocumentTemplate {
  _id: string;
  name: string;
  description?: string;
  category: string;
  type: string;
  version: string;

  // Template content
  content: string; // HTML/Markdown template content
  sections: ITemplateSection[];
  variables: ITemplateVariable[];

  // Styling and formatting
  styles: {
    css?: string;
    pageSize?: "A4" | "Letter" | "Legal";
    orientation?: "portrait" | "landscape";
    margins?: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    header?: string;
    footer?: string;
  };

  // Generation settings
  outputFormat: "pdf" | "docx" | "html";
  autoGenerate: boolean;
  generateTriggers: string[]; // Events that trigger auto-generation

  // Access control
  createdBy: mongoose.Types.ObjectId;
  isPublic: boolean;
  allowedRoles: string[];

  // Usage tracking
  usageCount: number;
  lastUsed?: Date;

  // Status
  status: "active" | "draft" | "archived";

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const TemplateVariableSchema = new Schema<ITemplateVariable>({
  name: {
    type: String,
    required: [true, "Variable name is required"],
    trim: true,
    match: [/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid variable name format"],
  },
  type: {
    type: String,
    enum: ["text", "number", "date", "boolean", "select", "multiselect"],
    required: [true, "Variable type is required"],
  },
  label: {
    type: String,
    required: [true, "Variable label is required"],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  required: {
    type: Boolean,
    default: false,
  },
  defaultValue: {
    type: Schema.Types.Mixed,
  },
  options: {
    type: [String],
    default: [],
  },
  validation: {
    min: { type: Number },
    max: { type: Number },
    pattern: { type: String },
    message: { type: String },
  },
});

const TemplateSectionSchema = new Schema<ITemplateSection>({
  id: {
    type: String,
    required: [true, "Section ID is required"],
    trim: true,
  },
  name: {
    type: String,
    required: [true, "Section name is required"],
    trim: true,
  },
  content: {
    type: String,
    required: [true, "Section content is required"],
  },
  order: {
    type: Number,
    required: [true, "Section order is required"],
    min: 0,
  },
  conditional: {
    variable: { type: String },
    operator: {
      type: String,
      enum: ["equals", "not_equals", "contains", "greater_than", "less_than"],
    },
    value: { type: Schema.Types.Mixed },
  },
  repeatable: {
    type: Boolean,
    default: false,
  },
  repeatSource: {
    type: String,
    trim: true,
  },
});

const DocumentTemplateSchema = new Schema<IDocumentTemplate>(
  {
    name: {
      type: String,
      required: [true, "Template name is required"],
      trim: true,
      maxlength: [255, "Template name too long"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description too long"],
    },
    category: {
      type: String,
      required: [true, "Template category is required"],
      enum: [
        "lease",
        "notice",
        "receipt",
        "invoice",
        "report",
        "letter",
        "form",
        "contract",
        "other",
      ],
      default: "other",
    },
    type: {
      type: String,
      required: [true, "Template type is required"],
      trim: true,
    },
    version: {
      type: String,
      required: [true, "Template version is required"],
      default: "1.0.0",
    },
    content: {
      type: String,
      required: [true, "Template content is required"],
    },
    sections: {
      type: [TemplateSectionSchema],
      default: [],
    },
    variables: {
      type: [TemplateVariableSchema],
      default: [],
    },
    styles: {
      css: { type: String },
      pageSize: {
        type: String,
        enum: ["A4", "Letter", "Legal"],
        default: "A4",
      },
      orientation: {
        type: String,
        enum: ["portrait", "landscape"],
        default: "portrait",
      },
      margins: {
        top: { type: Number, default: 20 },
        right: { type: Number, default: 20 },
        bottom: { type: Number, default: 20 },
        left: { type: Number, default: 20 },
      },
      header: { type: String },
      footer: { type: String },
    },
    outputFormat: {
      type: String,
      enum: ["pdf", "docx", "html"],
      default: "pdf",
    },
    autoGenerate: {
      type: Boolean,
      default: false,
    },
    generateTriggers: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is required"],
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    allowedRoles: {
      type: [String],
      default: [],
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastUsed: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["active", "draft", "archived"],
      default: "draft",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
DocumentTemplateSchema.index({ createdBy: 1, status: 1 });
DocumentTemplateSchema.index({ category: 1, status: 1 });
DocumentTemplateSchema.index({ type: 1, status: 1 });
DocumentTemplateSchema.index({ isPublic: 1, status: 1 });
DocumentTemplateSchema.index({ deletedAt: 1 });

// Text search index
DocumentTemplateSchema.index({
  name: "text",
  description: "text",
  type: "text",
});

// Virtual for checking if template is usable
DocumentTemplateSchema.virtual("isUsable").get(function () {
  return this.status === "active" && !this.deletedAt;
});

// Instance methods
DocumentTemplateSchema.methods.incrementUsage = function () {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

DocumentTemplateSchema.methods.addVariable = function (
  variable: ITemplateVariable
) {
  // Check if variable name already exists
  const exists = this.variables.some((v) => v.name === variable.name);
  if (exists) {
    throw new Error(`Variable '${variable.name}' already exists`);
  }
  this.variables.push(variable);
  return this.save();
};

DocumentTemplateSchema.methods.removeVariable = function (
  variableName: string
) {
  this.variables = this.variables.filter((v) => v.name !== variableName);
  return this.save();
};

DocumentTemplateSchema.methods.addSection = function (
  section: ITemplateSection
) {
  this.sections.push(section);
  // Sort sections by order
  this.sections.sort((a, b) => a.order - b.order);
  return this.save();
};

DocumentTemplateSchema.methods.removeSection = function (sectionId: string) {
  this.sections = this.sections.filter((s) => s.id !== sectionId);
  return this.save();
};

DocumentTemplateSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  this.status = "archived";
  return this.save();
};

DocumentTemplateSchema.methods.restore = function () {
  this.deletedAt = null;
  this.status = "active";
  return this.save();
};

// Query middleware to exclude soft deleted templates
DocumentTemplateSchema.pre(/^find/, function () {
  // @ts-ignore
  this.find({ deletedAt: null });
});

// Create and export the model
const DocumentTemplate: Model<IDocumentTemplate> =
  mongoose.models?.DocumentTemplate ||
  mongoose.model<IDocumentTemplate>("DocumentTemplate", DocumentTemplateSchema);

export default DocumentTemplate;

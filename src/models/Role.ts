import mongoose, { Schema, Model } from "mongoose";
import {
  SYSTEM_PERMISSIONS,
  type SystemPermission,
} from "@/lib/permission-catalog";
export interface IRole extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  label: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
  color: string;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// ============================================================================
// SCHEMA DEFINITION
// ============================================================================

const RoleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: [true, "Role name is required"],
      trim: true,
      lowercase: true,
      match: [
        /^[a-z0-9_]+$/,
        "Role name can only contain lowercase letters, numbers, and underscores",
      ],
      maxlength: [50, "Role name cannot exceed 50 characters"],
    },
    label: {
      type: String,
      required: [true, "Role label is required"],
      trim: true,
      maxlength: [100, "Role label cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Role description is required"],
      trim: true,
      maxlength: [500, "Role description cannot exceed 500 characters"],
    },
    permissions: {
      type: [String],
      required: [true, "At least one permission is required"],
      validate: {
        validator: function (permissions: string[]) {
          // Validate that all permissions are valid system permissions
          return permissions.every((permission) =>
            SYSTEM_PERMISSIONS.includes(permission as SystemPermission)
          );
        },
        message: "Invalid permission specified",
      },
    },
    isSystem: {
      type: Boolean,
      default: false,
      immutable: true, // System roles cannot be changed after creation
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    color: {
      type: String,
      enum: ["default", "destructive", "outline", "secondary"],
      default: "outline",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by user is required"],
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "roles",
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

// ============================================================================
// INDEXES
// ============================================================================

// Partial unique index on name - only enforced for non-deleted roles
RoleSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);
RoleSchema.index({ isSystem: 1 });
RoleSchema.index({ isActive: 1 });
RoleSchema.index({ createdBy: 1 });
RoleSchema.index({ deletedAt: 1 });

// Compound index for active, non-deleted roles
RoleSchema.index({ isActive: 1, deletedAt: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================

RoleSchema.virtual("canEdit").get(function () {
  return !this.isSystem;
});

RoleSchema.virtual("canDelete").get(function () {
  return !this.isSystem;
});

// ============================================================================
// METHODS
// ============================================================================

RoleSchema.methods.hasPermission = function (permission: string): boolean {
  return this.permissions.includes(permission);
};

RoleSchema.methods.addPermission = function (permission: string): void {
  if (
    !this.permissions.includes(permission) &&
    SYSTEM_PERMISSIONS.includes(permission as SystemPermission)
  ) {
    this.permissions.push(permission);
  }
};

RoleSchema.methods.removePermission = function (permission: string): void {
  this.permissions = this.permissions.filter((p: string) => p !== permission);
};

RoleSchema.methods.softDelete = function (
  deletedBy: mongoose.Types.ObjectId
): Promise<IRole> {
  this.deletedAt = new Date();
  this.updatedBy = deletedBy;
  this.isActive = false;
  return this.save() as Promise<IRole>;
};

// ============================================================================
// STATIC METHODS
// ============================================================================

RoleSchema.statics.findActive = function () {
  return this.find({ isActive: true, deletedAt: null });
};

RoleSchema.statics.findByPermission = function (permission: string) {
  return this.find({
    permissions: permission,
    isActive: true,
    deletedAt: null,
  });
};

RoleSchema.statics.getSystemRoles = function () {
  return this.find({ isSystem: true, isActive: true, deletedAt: null });
};

RoleSchema.statics.getCustomRoles = function () {
  return this.find({ isSystem: false, isActive: true, deletedAt: null });
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Pre-save middleware to validate permissions
RoleSchema.pre("save", function (next) {
  // Ensure permissions array is unique
  this.permissions = [...new Set(this.permissions)];

  // Validate permissions
  const invalidPermissions = this.permissions.filter(
    (permission) => !SYSTEM_PERMISSIONS.includes(permission as SystemPermission)
  );

  if (invalidPermissions.length > 0) {
    return next(
      new Error(`Invalid permissions: ${invalidPermissions.join(", ")}`)
    );
  }

  next();
});

// Pre-remove middleware to check if role can be deleted
RoleSchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function (next) {
    if (this.isSystem) {
      return next(new Error("System roles cannot be deleted"));
    }

    const UserModel = mongoose.model("User");
    const assignedUsers = await UserModel.countDocuments({
      role: this.name,
      isActive: true,
      deletedAt: null,
    });

    if (assignedUsers > 0) {
      return next(new Error("Cannot delete role with assigned users"));
    }

    next();
  }
);

// ============================================================================
// MODEL CREATION
// ============================================================================

let Role: Model<IRole>;

try {
  Role = mongoose.model<IRole>("Role");
} catch (error) {
  Role = mongoose.model<IRole>("Role", RoleSchema);
}

export default Role;

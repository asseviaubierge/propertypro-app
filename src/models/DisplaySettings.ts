import mongoose, { Schema, Document, Model } from "mongoose";

// Display Settings Interface
export interface IDisplaySettings extends Document {
  userId: mongoose.Types.ObjectId;

  // Theme & Appearance
  theme: "light" | "dark" | "system";
  language: string;
  timezone: string;

  // Quick appearance preferences (Preferences drawer)
  contrast: boolean;
  compact: boolean;
  rtl: boolean;
  navColor: "integrate" | "apparent";

  // Date & Time Formatting
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD" | "DD-MM-YYYY";
  timeFormat: "12h" | "24h";

  // Currency & Localization
  currency: string;
  numberFormat: "US" | "EU" | "UK" | "custom";

  // Layout Preferences
  compactMode: boolean;
  sidebarCollapsed: boolean;
  showAvatars: boolean;
  animationsEnabled: boolean;
  highContrast: boolean;

  // Typography
  fontSize: "small" | "medium" | "large";
  fontFamily: string;
  lineHeight: "normal" | "relaxed" | "loose";

  // Density & Spacing
  density: "comfortable" | "compact" | "spacious";

  // Color Scheme (PropertyPro Blue Theme)
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };

  // New top-level fields used by the UI form
  dashboardLayout: "grid" | "list" | "cards";
  itemsPerPage: number;

  // Branding & Logos
  branding?: {
    logoLight: string;
    logoDark: string;
    favicon: string;
    primaryColor: string;
    secondaryColor: string;
    companyName?: string;
    companyAddress?: string;
    whatsappNumber?: string;
    whatsappEnabled?: boolean;
    r2?: {
      logoLight?: {
        objectKey?: string;
        format?: string;
        width?: number;
        height?: number;
        bytes?: number;
        optimizedUrls?: Record<string, string>;
      };
      logoDark?: {
        objectKey?: string;
        format?: string;
        width?: number;
        height?: number;
        bytes?: number;
        optimizedUrls?: Record<string, string>;
      };
      favicon?: {
        objectKey?: string;
        format?: string;
        width?: number;
        height?: number;
        bytes?: number;
        optimizedUrls?: Record<string, string>;
      };
    };
  };

  // Dashboard Preferences
  dashboard: {
    defaultView: "grid" | "list" | "cards";
    itemsPerPage: number;
    showQuickActions: boolean;
    showRecentActivity: boolean;
    showNotifications: boolean;
    autoRefresh: boolean;
    refreshInterval: number; // in seconds
  };

  // Table Preferences
  tables: {
    defaultPageSize: number;
    showRowNumbers: boolean;
    enableSorting: boolean;
    enableFiltering: boolean;
    stickyHeaders: boolean;
    zebra: boolean; // alternating row colors
  };

  // Chart Preferences
  charts: {
    defaultType: "bar" | "line" | "pie" | "area";
    showDataLabels: boolean;
    showLegend: boolean;
    showGrid: boolean;
    animateOnLoad: boolean;
  };

  // Accessibility
  accessibility: {
    reduceMotion: boolean;
    highContrast: boolean;
    largeText: boolean;
    screenReader: boolean;
    keyboardNavigation: boolean;
  };

  // Custom CSS
  customCSS?: string;

  // Metadata
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

// Display Settings Schema
const displaySettingsSchema = new Schema<IDisplaySettings>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Theme & Appearance
    theme: {
      type: String,
      enum: ["light", "dark", "system"],
      default: "system",
    },
    language: { type: String, default: "en" },
    timezone: { type: String, default: "America/New_York" },

    // Quick appearance preferences (Preferences drawer)
    contrast: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
    rtl: { type: Boolean, default: false },
    navColor: {
      type: String,
      enum: ["integrate", "apparent"],
      default: "integrate",
    },

    // Date & Time Formatting
    dateFormat: {
      type: String,
      enum: ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"],
      default: "MM/DD/YYYY",
    },
    timeFormat: {
      type: String,
      enum: ["12h", "24h"],
      default: "12h",
    },

    // Currency & Localization
    currency: { type: String, default: "XOF" },
    numberFormat: {
      type: String,
      enum: ["XOF", "US", "EU", "UK", "custom"],
      default: "XOF",
    },

    // Layout Preferences
    compactMode: { type: Boolean, default: false },
    sidebarCollapsed: { type: Boolean, default: false },
    showAvatars: { type: Boolean, default: true },
    animationsEnabled: { type: Boolean, default: true },
    highContrast: { type: Boolean, default: false },

    // Typography
    fontSize: {
      type: String,
      enum: ["small", "medium", "large"],
      default: "medium",
    },
    fontFamily: { type: String, default: "Inter" },
    lineHeight: {
      type: String,
      enum: ["normal", "relaxed", "loose"],
      default: "normal",
    },

    // Density & Spacing
    density: {
      type: String,
      enum: ["comfortable", "compact", "spacious"],
      default: "comfortable",
    },

    // Color Scheme (PropertyPro Blue Theme)
    colorScheme: {
      primary: { type: String, default: "#3b82f6" }, // Blue-500
      secondary: { type: String, default: "#64748b" }, // Slate-500
      accent: { type: String, default: "#06b6d4" }, // Cyan-500
      background: { type: String, default: "#ffffff" },
      surface: { type: String, default: "#f8fafc" }, // Slate-50
      text: { type: String, default: "#1e293b" }, // Slate-800
    },

    // New top-level fields used by the UI form
    dashboardLayout: {
      type: String,
      enum: ["grid", "list", "cards"],
      default: "grid",
    },
    itemsPerPage: { type: Number, default: 25, min: 10, max: 100 },

    // Dashboard Preferences (legacy)
    dashboard: {
      defaultView: {
        type: String,
        enum: ["grid", "list", "cards"],
        default: "grid",
      },
      itemsPerPage: { type: Number, default: 20, min: 5, max: 100 },
      showQuickActions: { type: Boolean, default: true },
      showRecentActivity: { type: Boolean, default: true },
      showNotifications: { type: Boolean, default: true },
      autoRefresh: { type: Boolean, default: false },
      refreshInterval: { type: Number, default: 300, min: 30, max: 3600 },
    },

    // Table Preferences
    tables: {
      defaultPageSize: { type: Number, default: 10, min: 5, max: 100 },
      showRowNumbers: { type: Boolean, default: false },
      enableSorting: { type: Boolean, default: true },
      enableFiltering: { type: Boolean, default: true },
      stickyHeaders: { type: Boolean, default: true },
      zebra: { type: Boolean, default: true },
    },

    // Chart Preferences
    charts: {
      defaultType: {
        type: String,
        enum: ["bar", "line", "pie", "area"],
        default: "bar",
      },
      showDataLabels: { type: Boolean, default: true },
      showLegend: { type: Boolean, default: true },
      showGrid: { type: Boolean, default: true },
      animateOnLoad: { type: Boolean, default: true },
    },

    // Accessibility
    accessibility: {
      reduceMotion: { type: Boolean, default: false },
      highContrast: { type: Boolean, default: false },
      largeText: { type: Boolean, default: false },
      screenReader: { type: Boolean, default: false },
      keyboardNavigation: { type: Boolean, default: true },
    },

    // Branding (optional)
    branding: {
      logoLight: { type: String, default: "/images/logo-light.png" },
      logoDark: { type: String, default: "/images/logo-dark.png" },
      favicon: { type: String, default: "/favicon.ico" },
      primaryColor: {
        type: String,
        default: "#3B82F6",
        validate: {
          validator: (v: string) =>
            /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v),
          message: "Primary color must be a valid hex color",
        },
      },
      secondaryColor: {
        type: String,
        default: "#64748B",
        validate: {
          validator: (v: string) =>
            /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v),
          message: "Secondary color must be a valid hex color",
        },
      },
      companyName: { type: String },
      companyAddress: { type: String },
      whatsappNumber: { type: String, default: "" },
      whatsappEnabled: { type: Boolean, default: false },
      r2: {
        logoLight: {
          objectKey: { type: String },
          format: { type: String },
          width: { type: Number },
          height: { type: Number },
          bytes: { type: Number },
          optimizedUrls: { type: Map, of: String },
        },
        logoDark: {
          objectKey: { type: String },
          format: { type: String },
          width: { type: Number },
          height: { type: Number },
          bytes: { type: Number },
          optimizedUrls: { type: Map, of: String },
        },
        favicon: {
          objectKey: { type: String },
          format: { type: String },
          width: { type: Number },
          height: { type: Number },
          bytes: { type: Number },
          optimizedUrls: { type: Map, of: String },
        },
      },
    },

    // Custom CSS
    customCSS: { type: String, maxlength: 10000 },

    // Metadata
    isActive: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    collection: "display_settings",
  }
);

// Indexes
displaySettingsSchema.index({ userId: 1 }, { unique: true });
displaySettingsSchema.index({ isActive: 1 });
displaySettingsSchema.index({ theme: 1 });
displaySettingsSchema.index({ createdAt: -1 });

// Instance Methods
displaySettingsSchema.methods.updateDisplay = function (
  displayData: Partial<IDisplaySettings>
) {
  Object.assign(this, displayData);
  this.version += 1;
  this.updatedAt = new Date();
  return this.save() as Promise<IDisplaySettings>;
};

displaySettingsSchema.methods.getThemeConfig = function () {
  return {
    theme: this.theme,
    colorScheme: this.colorScheme,
    fontSize: this.fontSize,
    fontFamily: this.fontFamily,
    density: this.density,
    compactMode: this.compactMode,
    animationsEnabled: this.animationsEnabled,
    highContrast: this.highContrast,
  };
};

// Static Methods
displaySettingsSchema.statics.findByUserId = function (userId: string) {
  return this.findOne({ userId, isActive: true });
};

displaySettingsSchema.statics.createDefaultDisplay = function (userId: string) {
  return this.create({
    userId,
    // Core settings used by the simplified UI
    theme: "system",
    currency: "XOF",
    // Branding configuration with default logos
    branding: {
      logoLight: "/images/logo-light.png",
      logoDark: "/images/logo-dark.png",
      favicon: "/favicon.ico",
      primaryColor: "#3B82F6",
      secondaryColor: "#64748B",
      r2: {},
    },
    // Keep some essential defaults for backward compatibility
    language: "en",
    timezone: "America/New_York",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h",
    numberFormat: "US",
    compactMode: false,
    sidebarCollapsed: false,
    showAvatars: true,
    animationsEnabled: true,
    highContrast: false,
    fontSize: "medium",
    fontFamily: "Inter",
    lineHeight: "normal",
    density: "comfortable",
    colorScheme: {
      primary: "#3b82f6",
      secondary: "#64748b",
      accent: "#06b6d4",
      background: "#ffffff",
      surface: "#f8fafc",
      text: "#1e293b",
    },
    dashboard: {
      defaultView: "grid",
      itemsPerPage: 20,
      showQuickActions: true,
      showRecentActivity: true,
      showNotifications: true,
      autoRefresh: false,
      refreshInterval: 300,
    },
    tables: {
      defaultPageSize: 10,
      showRowNumbers: false,
      enableSorting: true,
      enableFiltering: true,
      stickyHeaders: true,
      zebra: true,
    },
    charts: {
      defaultType: "bar",
      showDataLabels: true,
      showLegend: true,
      showGrid: true,
      animateOnLoad: true,
    },
    accessibility: {
      reduceMotion: false,
      highContrast: false,
      largeText: false,
      screenReader: false,
      keyboardNavigation: true,
    },
    dashboardLayout: "grid",
    itemsPerPage: 25,
  });
};

// Pre-save middleware
displaySettingsSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.version += 1;
  }
  next();
});

// Create and export the model with safer initialization
let DisplaySettings: Model<IDisplaySettings>;

try {
  // Try to get existing model first
  DisplaySettings = mongoose.model<IDisplaySettings>("DisplaySettings");
} catch (error) {
  // Model doesn't exist, create it
  DisplaySettings = mongoose.model<IDisplaySettings>(
    "DisplaySettings",
    displaySettingsSchema
  );
}

export default DisplaySettings;
export type { IDisplaySettings };

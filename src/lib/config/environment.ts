/**
 * PropertyPro - Environment Configuration
 * Centralized environment variable management and validation
 */

import { z } from "zod";

// Environment variable schema validation
const envSchema = z.object({
  // Database
  MONGODB_URI: z.string().min(1, "MongoDB URI is required"),

  // Authentication
  NEXTAUTH_SECRET: z.string().min(1, "NextAuth secret is required"),
  NEXTAUTH_URL: z.string().url().optional(),

  // Stripe Configuration
  STRIPE_SECRET_KEY: z.string().min(1, "Stripe secret key is required"),
  STRIPE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "Stripe publishable key is required"),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // SMTP Configuration
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Application Configuration
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().default("3000"),

  // Feature Flags
  ENABLE_EMAIL_NOTIFICATIONS: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  ENABLE_AUTO_LATE_FEES: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  ENABLE_AUTO_REMINDERS: z
    .string()
    .transform((val) => val === "true")
    .default("true"),

  // Security
  ENCRYPTION_KEY: z.string().optional(),
  JWT_SECRET: z.string().optional(),

  // External Services
  REDIS_URL: z.string().optional(),
  WEBHOOK_URL: z.string().url().optional(),

  // Monitoring
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
});

// Parse and validate environment variables
function parseEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error("❌ Invalid environment variables:");
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join(".")}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}

// Export validated environment configuration
export const env = parseEnv();

// Configuration objects for different services
export const databaseConfig = {
  uri: env.MONGODB_URI,
  options: {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  },
};

export const authConfig = {
  secret: env.NEXTAUTH_SECRET,
  url: env.NEXTAUTH_URL,
  jwt: {
    secret: env.JWT_SECRET || env.NEXTAUTH_SECRET,
  },
};

export const stripeConfig = {
  secretKey: env.STRIPE_SECRET_KEY,
  publishableKey: env.STRIPE_PUBLISHABLE_KEY,
  webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  apiVersion: "2024-06-20" as const,
};

export const emailConfig = {
  provider: "smtp",
  smtp: {
    host: env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(env.SMTP_PORT || "587"),
    secure: env.SMTP_PORT === "465",
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM || "noreply@PropertyPro.com",
  },
  enabled: env.ENABLE_EMAIL_NOTIFICATIONS,
};


export const paymentConfig = {
  features: {
    autoLateFees: env.ENABLE_AUTO_LATE_FEES,
    autoReminders: env.ENABLE_AUTO_REMINDERS,
    emailNotifications: env.ENABLE_EMAIL_NOTIFICATIONS,
  },
  defaults: {
    gracePeriod: 5, // days
    lateFeeAmount: 50, // dollars
    reminderDays: [7, 3, 1], // days before due date
    processingTimeout: 30000, // milliseconds
    retryAttempts: 3,
  },
};

export const securityConfig = {
  encryptionKey: env.ENCRYPTION_KEY,
  jwtSecret: env.JWT_SECRET || env.NEXTAUTH_SECRET,
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
};

export const monitoringConfig = {
  sentryDsn: env.SENTRY_DSN,
  logLevel: env.LOG_LEVEL,
  enableMetrics: env.NODE_ENV === "production",
  healthCheckInterval: 60000, // 1 minute
};

// Validation helpers
export const validateConfig = {
  /**
   * Check if email configuration is complete
   */
  isEmailConfigured(): boolean {
    return !!(emailConfig.smtp.host && emailConfig.smtp.user && emailConfig.smtp.pass);
  },

  /**
   * Check if Stripe configuration is complete
   */
  isStripeConfigured(): boolean {
    return !!(stripeConfig.secretKey && stripeConfig.publishableKey);
  },

  /**
   * Check if all required services are configured
   */
  areRequiredServicesConfigured(): boolean {
    return (
      this.isStripeConfigured() &&
      this.isEmailConfigured()
    );
  },

  /**
   * Get configuration status
   */
  getConfigurationStatus() {
    return {
      database: !!databaseConfig.uri,
      stripe: this.isStripeConfigured(),
      email: this.isEmailConfigured(),
      auth: !!authConfig.secret,
      allRequired: this.areRequiredServicesConfigured(),
    };
  },
};

// Environment-specific configurations
export const isDevelopment = env.NODE_ENV === "development";
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

// Export environment for external use
export { env as environment };

// Configuration validation on startup
if (isProduction && !validateConfig.areRequiredServicesConfigured()) {
  console.error("❌ Required services not configured for production");
  console.error(
    "Configuration status:",
    validateConfig.getConfigurationStatus()
  );
  process.exit(1);
}

// Log configuration status in development
if (isDevelopment) {

  const status = validateConfig.getConfigurationStatus();
  Object.entries(status).forEach(([service, configured]) => {

  });
}

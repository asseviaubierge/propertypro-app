/**
 * PropertyPro - Settings Audit Logging System
 * Comprehensive audit logging for settings changes
 */

import { logSettingsChange } from "@/app/api/settings/history/route";

// Audit event types
export enum AuditAction {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  VIEW = "view",
  EXPORT = "export",
  IMPORT = "import",
}

// Audit categories
export enum AuditCategory {
  PROFILE = "profile",
  NOTIFICATIONS = "notifications",
  SECURITY = "security",
  DISPLAY = "display",
  PRIVACY = "privacy",
  SYSTEM = "system",
}

// Audit metadata interface
export interface AuditMetadata {
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
  source?: "web" | "mobile" | "api";
  reason?: string;
  additionalData?: Record<string, any>;
}

// Settings change interface
export interface SettingsChange {
  userId: string;
  category: AuditCategory;
  action: AuditAction;
  field: string;
  oldValue?: any;
  newValue?: any;
  metadata?: AuditMetadata;
}

/**
 * Log a settings change with audit trail
 */
export async function auditSettingsChange(
  change: SettingsChange
): Promise<void> {
  try {
    await logSettingsChange(
      change.userId,
      change.category,
      change.action,
      change.field,
      change.oldValue,
      change.newValue,
      change.metadata
    );
  } catch (error) {
    console.error("Failed to log settings change:", error);
    // Don't throw error to avoid breaking the main operation
  }
}

/**
 * Log profile settings changes
 */
export async function auditProfileChange(
  userId: string,
  field: string,
  oldValue: any,
  newValue: any,
  metadata?: AuditMetadata
): Promise<void> {
  await auditSettingsChange({
    userId,
    category: AuditCategory.PROFILE,
    action: AuditAction.UPDATE,
    field,
    oldValue,
    newValue,
    metadata,
  });
}

/**
 * Log notification settings changes
 */
export async function auditNotificationChange(
  userId: string,
  field: string,
  oldValue: any,
  newValue: any,
  metadata?: AuditMetadata
): Promise<void> {
  await auditSettingsChange({
    userId,
    category: AuditCategory.NOTIFICATIONS,
    action: AuditAction.UPDATE,
    field,
    oldValue,
    newValue,
    metadata,
  });
}

/**
 * Log security settings changes
 */
export async function auditSecurityChange(
  userId: string,
  field: string,
  oldValue: any,
  newValue: any,
  metadata?: AuditMetadata
): Promise<void> {
  await auditSettingsChange({
    userId,
    category: AuditCategory.SECURITY,
    action: AuditAction.UPDATE,
    field,
    oldValue,
    newValue,
    metadata: {
      ...metadata,
      reason: "Security setting modified",
    },
  });
}

/**
 * Log display settings changes
 */
export async function auditDisplayChange(
  userId: string,
  field: string,
  oldValue: any,
  newValue: any,
  metadata?: AuditMetadata
): Promise<void> {
  await auditSettingsChange({
    userId,
    category: AuditCategory.DISPLAY,
    action: AuditAction.UPDATE,
    field,
    oldValue,
    newValue,
    metadata,
  });
}

/**
 * Log privacy settings changes
 */
export async function auditPrivacyChange(
  userId: string,
  field: string,
  oldValue: any,
  newValue: any,
  metadata?: AuditMetadata
): Promise<void> {
  await auditSettingsChange({
    userId,
    category: AuditCategory.PRIVACY,
    action: AuditAction.UPDATE,
    field,
    oldValue,
    newValue,
    metadata: {
      ...metadata,
      reason: "Privacy setting modified",
    },
  });
}

/**
 * Log system settings changes (admin only)
 */
export async function auditSystemChange(
  userId: string,
  field: string,
  oldValue: any,
  newValue: any,
  metadata?: AuditMetadata
): Promise<void> {
  await auditSettingsChange({
    userId,
    category: AuditCategory.SYSTEM,
    action: AuditAction.UPDATE,
    field,
    oldValue,
    newValue,
    metadata: {
      ...metadata,
      reason: "System setting modified by admin",
    },
  });
}

/**
 * Log settings export
 */
export async function auditSettingsExport(
  userId: string,
  exportType: string,
  sections: string[],
  metadata?: AuditMetadata
): Promise<void> {
  await auditSettingsChange({
    userId,
    category: AuditCategory.SYSTEM,
    action: AuditAction.EXPORT,
    field: "settings_export",
    oldValue: null,
    newValue: {
      exportType,
      sections,
      timestamp: new Date().toISOString(),
    },
    metadata: {
      ...metadata,
      reason: "Settings exported",
    },
  });
}

/**
 * Log settings import
 */
export async function auditSettingsImport(
  userId: string,
  importType: string,
  importedSections: string[],
  importResults: any,
  metadata?: AuditMetadata
): Promise<void> {
  await auditSettingsChange({
    userId,
    category: AuditCategory.SYSTEM,
    action: AuditAction.IMPORT,
    field: "settings_import",
    oldValue: null,
    newValue: {
      importType,
      importedSections,
      importResults,
      timestamp: new Date().toISOString(),
    },
    metadata: {
      ...metadata,
      reason: "Settings imported",
    },
  });
}

/**
 * Compare two objects and return the differences
 */
export function getSettingsDiff(
  oldSettings: any,
  newSettings: any
): Array<{
  field: string;
  oldValue: any;
  newValue: any;
}> {
  const differences: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }> = [];

  function compareObjects(obj1: any, obj2: any, prefix = ""): void {
    const allKeys = new Set([
      ...Object.keys(obj1 || {}),
      ...Object.keys(obj2 || {}),
    ]);

    for (const key of allKeys) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const oldValue = obj1?.[key];
      const newValue = obj2?.[key];

      if (
        typeof oldValue === "object" &&
        typeof newValue === "object" &&
        oldValue !== null &&
        newValue !== null &&
        !Array.isArray(oldValue) &&
        !Array.isArray(newValue)
      ) {
        compareObjects(oldValue, newValue, fullKey);
      } else if (oldValue !== newValue) {
        differences.push({
          field: fullKey,
          oldValue,
          newValue,
        });
      }
    }
  }

  compareObjects(oldSettings, newSettings);
  return differences;
}

/**
 * Audit multiple settings changes at once
 */
export async function auditBulkSettingsChanges(
  userId: string,
  category: AuditCategory,
  oldSettings: any,
  newSettings: any,
  metadata?: AuditMetadata
): Promise<void> {
  const differences = getSettingsDiff(oldSettings, newSettings);

  for (const diff of differences) {
    await auditSettingsChange({
      userId,
      category,
      action: AuditAction.UPDATE,
      field: diff.field,
      oldValue: diff.oldValue,
      newValue: diff.newValue,
      metadata,
    });
  }
}

/**
 * Get audit summary for a user
 */
export async function getAuditSummary(
  userId: string,
  days = 30
): Promise<{
  totalChanges: number;
  categoryCounts: Record<string, number>;
  recentChanges: any[];
}> {
  try {
    const response = await fetch(
      `/api/settings/history?userId=${userId}&days=${days}&summary=true`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch audit summary");
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to get audit summary:", error);
    return {
      totalChanges: 0,
      categoryCounts: {},
      recentChanges: [],
    };
  }
}

/**
 * Sanitize sensitive data before logging
 */
export function sanitizeAuditData(data: any): any {
  if (typeof data !== "object" || data === null) {
    return data;
  }

  const sensitiveFields = [
    "password",
    "token",
    "secret",
    "key",
    "apiKey",
    "smtpPassword",
    "stripeSecretKey",
    "paypalClientSecret",
    "twilioAuthToken",
    "accessToken",
    "refreshToken",
    "sessionId",
    "backupCodes",
    "trustedDevices",
    "securityQuestions",
    "emergencyContact.phone",
    "phone",
    "email",
    "socialSecurityNumber",
    "bankAccount",
    "creditCard",
    "paymentMethod",
  ];

  const sanitized = { ...data };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      sanitized[key] = sanitizeAuditData(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Create audit metadata from request
 */
export function createAuditMetadata(request?: Request): AuditMetadata {
  if (!request) {
    return {
      source: "api",
    };
  }

  const userAgent = request.headers.get("user-agent") || undefined;
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress = forwarded
    ? forwarded.split(",")[0]
    : request.headers.get("x-real-ip") || undefined;

  return {
    userAgent,
    ipAddress,
    source: "web",
  };
}

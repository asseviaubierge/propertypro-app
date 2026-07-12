/**
 * PropertyPro - Audit Service
 * Centralized service for logging user activities and system events
 */

import AuditLog, {
  IAuditLog,
  AuditCategory,
  AuditAction,
  AuditSeverity,
} from "@/models/AuditLog";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { formatCurrency } from "@/lib/utils/formatting";

// Audit context interface
export interface AuditContext {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;
  source?: "web" | "api" | "system" | "mobile";
  impersonatedBy?: string;
}

// Audit event interface
export interface AuditEvent {
  category: AuditCategory;
  action: AuditAction;
  severity?: AuditSeverity;
  description: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  details?: Record<string, any>;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  tags?: string[];
  complianceFlags?: string[];
}

export class AuditService {
  // Log an audit event
  async logEvent(
    event: AuditEvent,
    context: AuditContext = {}
  ): Promise<IAuditLog> {
    try {
      const auditData: Partial<IAuditLog> = {
        category: event.category,
        action: event.action,
        severity: event.severity || AuditSeverity.LOW,
        description: event.description,
        resourceType: event.resourceType,
        resourceId: event.resourceId
          ? new mongoose.Types.ObjectId(event.resourceId)
          : undefined,
        resourceName: event.resourceName,
        details: event.details,
        oldValues: event.oldValues,
        newValues: event.newValues,
        userId: context.userId
          ? new mongoose.Types.ObjectId(context.userId)
          : undefined,
        userEmail: context.userEmail,
        userRole: context.userRole,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        sessionId: context.sessionId,
        source: context.source || "web",
        impersonatedBy: context.impersonatedBy
          ? new mongoose.Types.ObjectId(context.impersonatedBy)
          : undefined,
        tags: event.tags || [],
        complianceFlags: event.complianceFlags || [],
        timestamp: new Date(),
      };

      const auditLog = await AuditLog.logEvent(auditData);

      // Handle high-severity events
      if (
        event.severity === AuditSeverity.CRITICAL ||
        event.severity === AuditSeverity.HIGH
      ) {
        await this.handleHighSeverityEvent(auditLog);
      }

      return auditLog;
    } catch (error) {
      console.error("Failed to log audit event:", error);
      throw error;
    }
  }

  // Extract context from Next.js request
  extractContextFromRequest(request: NextRequest, user?: any): AuditContext {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ipAddress = forwarded?.split(",")[0] || realIp || "unknown";

    return {
      userId: user?.id,
      userEmail: user?.email,
      userRole: user?.role,
      ipAddress,
      userAgent: request.headers.get("user-agent") || "unknown",
      requestId: request.headers.get("x-request-id") || undefined,
      source: this.detectSource(request),
    };
  }

  // Detect source from request
  private detectSource(request: NextRequest): "web" | "api" | "mobile" {
    const userAgent = request.headers.get("user-agent")?.toLowerCase() || "";
    const path = request.nextUrl.pathname;

    if (path.startsWith("/api/")) {
      return "api";
    }

    if (
      userAgent.includes("mobile") ||
      userAgent.includes("android") ||
      userAgent.includes("iphone")
    ) {
      return "mobile";
    }

    return "web";
  }

  // Handle high-severity events (notifications, alerts, etc.)
  private async handleHighSeverityEvent(auditLog: IAuditLog): Promise<void> {
    try {
      // Add high priority tag
      await auditLog.addTag("high_priority");

      // Log to console for immediate attention
      console.warn(
        `HIGH SEVERITY AUDIT EVENT: ${auditLog.category} - ${auditLog.action}`,
        {
          userId: auditLog.userId,
          description: auditLog.description,
          timestamp: auditLog.timestamp,
        }
      );

      // TODO: Implement additional alerting mechanisms
      // - Send email to administrators
      // - Create system notification
      // - Trigger security monitoring systems
    } catch (error) {
      console.error("Failed to handle high-severity event:", error);
    }
  }

  // Convenience methods for common audit events

  // Authentication events
  async logLogin(userId: string, context: AuditContext): Promise<IAuditLog> {
    return this.logEvent(
      {
        category: AuditCategory.AUTHENTICATION,
        action: AuditAction.LOGIN,
        severity: AuditSeverity.LOW,
        description: `User logged in successfully`,
        tags: ["authentication", "login"],
      },
      context
    );
  }

  async logLoginFailed(
    email: string,
    reason: string,
    context: AuditContext
  ): Promise<IAuditLog> {
    return this.logEvent(
      {
        category: AuditCategory.AUTHENTICATION,
        action: AuditAction.LOGIN_FAILED,
        severity: AuditSeverity.MEDIUM,
        description: `Login failed for ${email}: ${reason}`,
        details: { email, reason },
        tags: ["authentication", "security", "failed_login"],
      },
      { ...context, userEmail: email }
    );
  }

  async logLogout(userId: string, context: AuditContext): Promise<IAuditLog> {
    return this.logEvent(
      {
        category: AuditCategory.AUTHENTICATION,
        action: AuditAction.LOGOUT,
        severity: AuditSeverity.LOW,
        description: `User logged out`,
        tags: ["authentication", "logout"],
      },
      context
    );
  }

  // CRUD operations
  async logCreate(
    resourceType: string,
    resourceId: string,
    resourceName: string,
    data: any,
    context: AuditContext
  ): Promise<IAuditLog> {
    return this.logEvent(
      {
        category: this.getCategoryForResource(resourceType),
        action: AuditAction.CREATE,
        severity: AuditSeverity.LOW,
        description: `Created ${resourceType}: ${resourceName}`,
        resourceType,
        resourceId,
        resourceName,
        newValues: data,
        tags: ["crud", "create", resourceType],
      },
      context
    );
  }

  async logUpdate(
    resourceType: string,
    resourceId: string,
    resourceName: string,
    oldData: any,
    newData: any,
    context: AuditContext
  ): Promise<IAuditLog> {
    return this.logEvent(
      {
        category: this.getCategoryForResource(resourceType),
        action: AuditAction.UPDATE,
        severity: AuditSeverity.LOW,
        description: `Updated ${resourceType}: ${resourceName}`,
        resourceType,
        resourceId,
        resourceName,
        oldValues: oldData,
        newValues: newData,
        tags: ["crud", "update", resourceType],
      },
      context
    );
  }

  async logDelete(
    resourceType: string,
    resourceId: string,
    resourceName: string,
    context: AuditContext
  ): Promise<IAuditLog> {
    return this.logEvent(
      {
        category: this.getCategoryForResource(resourceType),
        action: AuditAction.DELETE,
        severity: AuditSeverity.MEDIUM,
        description: `Deleted ${resourceType}: ${resourceName}`,
        resourceType,
        resourceId,
        resourceName,
        tags: ["crud", "delete", resourceType],
      },
      context
    );
  }

  // Bulk operations
  async logBulkImport(
    resourceType: string,
    count: number,
    context: AuditContext
  ): Promise<IAuditLog> {
    return this.logEvent(
      {
        category: AuditCategory.DATA_IMPORT,
        action: AuditAction.BULK_IMPORT,
        severity: AuditSeverity.MEDIUM,
        description: `Bulk imported ${count} ${resourceType} records`,
        details: { resourceType, count },
        tags: ["bulk", "import", resourceType],
      },
      context
    );
  }

  async logBulkExport(
    resourceType: string,
    count: number,
    format: string,
    context: AuditContext
  ): Promise<IAuditLog> {
    return this.logEvent(
      {
        category: AuditCategory.DATA_EXPORT,
        action: AuditAction.BULK_EXPORT,
        severity: AuditSeverity.MEDIUM,
        description: `Bulk exported ${count} ${resourceType} records as ${format}`,
        details: { resourceType, count, format },
        tags: ["bulk", "export", resourceType],
      },
      context
    );
  }

  // Security events
  async logUnauthorizedAccess(
    resource: string,
    context: AuditContext
  ): Promise<IAuditLog> {
    return this.logEvent(
      {
        category: AuditCategory.SECURITY,
        action: AuditAction.UNAUTHORIZED_ACCESS,
        severity: AuditSeverity.HIGH,
        description: `Unauthorized access attempt to ${resource}`,
        details: { resource },
        tags: ["security", "unauthorized", "access_denied"],
        complianceFlags: ["security_incident"],
      },
      context
    );
  }

  async logSuspiciousActivity(
    description: string,
    details: any,
    context: AuditContext
  ): Promise<IAuditLog> {
    return this.logEvent(
      {
        category: AuditCategory.SECURITY,
        action: AuditAction.SUSPICIOUS_ACTIVITY,
        severity: AuditSeverity.HIGH,
        description,
        details,
        tags: ["security", "suspicious"],
        complianceFlags: ["security_incident"],
      },
      context
    );
  }

  // Document events
  async logDocumentAccess(
    action: "view" | "download" | "share",
    documentId: string,
    documentName: string,
    context: AuditContext
  ): Promise<IAuditLog> {
    const actionMap = {
      view: AuditAction.READ,
      download: AuditAction.DOCUMENT_DOWNLOAD,
      share: AuditAction.DOCUMENT_SHARE,
    };

    return this.logEvent(
      {
        category: AuditCategory.DOCUMENT_MANAGEMENT,
        action: actionMap[action],
        severity: AuditSeverity.LOW,
        description: `${
          action.charAt(0).toUpperCase() + action.slice(1)
        } document: ${documentName}`,
        resourceType: "document",
        resourceId: documentId,
        resourceName: documentName,
        tags: ["document", action],
      },
      context
    );
  }

  // Payment events
  async logPaymentProcessed(
    paymentId: string,
    amount: number,
    method: string,
    context: AuditContext
  ): Promise<IAuditLog> {
    return this.logEvent(
      {
        category: AuditCategory.PAYMENT_MANAGEMENT,
        action: AuditAction.PAYMENT_PROCESSED,
        severity: AuditSeverity.LOW,
        description: `Payment processed: ${formatCurrency(amount)} via ${method}`,
        resourceType: "payment",
        resourceId: paymentId,
        details: { amount, method },
        tags: ["payment", "processed"],
      },
      context
    );
  }

  // System configuration events
  async logSettingsChange(
    setting: string,
    oldValue: any,
    newValue: any,
    context: AuditContext
  ): Promise<IAuditLog> {
    return this.logEvent(
      {
        category: AuditCategory.SYSTEM_CONFIGURATION,
        action: AuditAction.SETTINGS_CHANGED,
        severity: AuditSeverity.MEDIUM,
        description: `System setting changed: ${setting}`,
        oldValues: { [setting]: oldValue },
        newValues: { [setting]: newValue },
        tags: ["settings", "configuration"],
      },
      context
    );
  }

  // Helper method to get category for resource type
  private getCategoryForResource(resourceType: string): AuditCategory {
    const categoryMap: Record<string, AuditCategory> = {
      user: AuditCategory.USER_MANAGEMENT,
      property: AuditCategory.PROPERTY_MANAGEMENT,
      tenant: AuditCategory.TENANT_MANAGEMENT,
      lease: AuditCategory.LEASE_MANAGEMENT,
      payment: AuditCategory.PAYMENT_MANAGEMENT,
      maintenance: AuditCategory.MAINTENANCE_MANAGEMENT,
      document: AuditCategory.DOCUMENT_MANAGEMENT,
    };

    return categoryMap[resourceType] || AuditCategory.SYSTEM_CONFIGURATION;
  }

  // Query methods
  async getActivityForUser(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<IAuditLog[]> {
    return AuditLog.getActivityForUser(userId, limit, offset);
  }

  async getActivityForResource(
    resourceType: string,
    resourceId: string,
    limit: number = 50
  ): Promise<IAuditLog[]> {
    return AuditLog.getActivityForResource(resourceType, resourceId, limit);
  }

  async getSecurityEvents(
    startDate?: Date,
    endDate?: Date,
    severity?: AuditSeverity
  ): Promise<IAuditLog[]> {
    return AuditLog.getSecurityEvents(startDate, endDate, severity);
  }

  // Cleanup expired logs
  async cleanupExpiredLogs(): Promise<number> {
    return AuditLog.cleanupExpiredLogs();
  }
}

// Create singleton instance
export const auditService = new AuditService();

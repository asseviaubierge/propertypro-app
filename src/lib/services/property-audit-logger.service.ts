/**
 * PropertyPro - Property Status Audit Logger Service
 * Comprehensive audit logging for property status changes and synchronization events
 */

import mongoose from "mongoose";
import { PropertyStatus } from "@/types";

export interface PropertyStatusAuditLog {
  _id?: string;
  propertyId: string;
  propertyName: string;
  eventType: PropertyStatusAuditEventType;
  oldStatus?: PropertyStatus;
  newStatus: PropertyStatus;
  triggeredBy: string;
  triggerSource: PropertyStatusTriggerSource;
  unitChanges?: UnitStatusChange[];
  metadata?: Record<string, any>;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UnitStatusChange {
  unitId: string;
  unitNumber: string;
  oldStatus?: PropertyStatus;
  newStatus: PropertyStatus;
  reason?: string;
}

export enum PropertyStatusAuditEventType {
  STATUS_CHANGE = "status_change",
  SYNC_TRIGGERED = "sync_triggered",
  VALIDATION_FAILED = "validation_failed",
  MANUAL_OVERRIDE = "manual_override",
  BULK_UPDATE = "bulk_update",
  SYSTEM_CORRECTION = "system_correction",
}

export enum PropertyStatusTriggerSource {
  LEASE_ACTIVATION = "lease_activation",
  LEASE_TERMINATION = "lease_termination",
  UNIT_UPDATE = "unit_update",
  MAINTENANCE_REQUEST = "maintenance_request",
  MANUAL_API = "manual_api",
  BULK_OPERATION = "bulk_operation",
  SYSTEM_SYNC = "system_sync",
  VALIDATION_CORRECTION = "validation_correction",
}

// Mongoose schema for audit logs
const PropertyStatusAuditLogSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    propertyName: {
      type: String,
      required: true,
    },
    eventType: {
      type: String,
      enum: Object.values(PropertyStatusAuditEventType),
      required: true,
      index: true,
    },
    oldStatus: {
      type: String,
      enum: Object.values(PropertyStatus),
    },
    newStatus: {
      type: String,
      enum: Object.values(PropertyStatus),
      required: true,
    },
    triggeredBy: {
      type: String,
      required: true,
    },
    triggerSource: {
      type: String,
      enum: Object.values(PropertyStatusTriggerSource),
      required: true,
      index: true,
    },
    unitChanges: [
      {
        unitId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        unitNumber: {
          type: String,
          required: true,
        },
        oldStatus: {
          type: String,
          enum: Object.values(PropertyStatus),
        },
        newStatus: {
          type: String,
          enum: Object.values(PropertyStatus),
          required: true,
        },
        reason: String,
      },
    ],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    sessionId: String,
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
    collection: "property_status_audit_logs",
  }
);

// Indexes for efficient querying
PropertyStatusAuditLogSchema.index({ propertyId: 1, timestamp: -1 });
PropertyStatusAuditLogSchema.index({ eventType: 1, timestamp: -1 });
PropertyStatusAuditLogSchema.index({ triggerSource: 1, timestamp: -1 });
PropertyStatusAuditLogSchema.index({ userId: 1, timestamp: -1 });

export class PropertyAuditLogger {
  private static instance: PropertyAuditLogger;
  private AuditLogModel: mongoose.Model<PropertyStatusAuditLog>;

  constructor() {
    this.AuditLogModel =
      mongoose.models?.PropertyStatusAuditLog ||
      mongoose.model<PropertyStatusAuditLog>(
        "PropertyStatusAuditLog",
        PropertyStatusAuditLogSchema
      );
  }

  public static getInstance(): PropertyAuditLogger {
    if (!PropertyAuditLogger.instance) {
      PropertyAuditLogger.instance = new PropertyAuditLogger();
    }
    return PropertyAuditLogger.instance;
  }

  /**
   * Log a property status change event
   */
  async logStatusChange(
    propertyId: string,
    propertyName: string,
    oldStatus: PropertyStatus | undefined,
    newStatus: PropertyStatus,
    triggeredBy: string,
    triggerSource: PropertyStatusTriggerSource,
    options: {
      unitChanges?: UnitStatusChange[];
      metadata?: Record<string, any>;
      userId?: string;
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<PropertyStatusAuditLog> {
    try {
      const auditLog: PropertyStatusAuditLog = {
        propertyId,
        propertyName,
        eventType: PropertyStatusAuditEventType.STATUS_CHANGE,
        oldStatus,
        newStatus,
        triggeredBy,
        triggerSource,
        unitChanges: options.unitChanges || [],
        metadata: options.metadata || {},
        timestamp: new Date(),
        userId: options.userId,
        sessionId: options.sessionId,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      };

      const savedLog = await this.AuditLogModel.create(auditLog);

      return savedLog.toObject();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Log a synchronization event
   */
  async logSyncEvent(
    propertyId: string,
    propertyName: string,
    eventType: PropertyStatusAuditEventType,
    triggeredBy: string,
    triggerSource: PropertyStatusTriggerSource,
    metadata: Record<string, any> = {}
  ): Promise<PropertyStatusAuditLog> {
    try {
      const auditLog: PropertyStatusAuditLog = {
        propertyId,
        propertyName,
        eventType,
        newStatus: metadata.newStatus || PropertyStatus.AVAILABLE,
        oldStatus: metadata.oldStatus,
        triggeredBy,
        triggerSource,
        metadata,
        timestamp: new Date(),
      };

      const savedLog = await this.AuditLogModel.create(auditLog);

      return savedLog.toObject();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get audit logs for a specific property
   */
  async getPropertyAuditLogs(
    propertyId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      eventTypes?: PropertyStatusAuditEventType[];
      triggerSources?: PropertyStatusTriggerSource[];
    } = {}
  ): Promise<{
    logs: PropertyStatusAuditLog[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const {
        limit = 50,
        offset = 0,
        startDate,
        endDate,
        eventTypes,
        triggerSources,
      } = options;

      const query: any = { propertyId };

      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = startDate;
        if (endDate) query.timestamp.$lte = endDate;
      }

      if (eventTypes?.length > 0) {
        query.eventType = { $in: eventTypes };
      }

      if (triggerSources?.length > 0) {
        query.triggerSource = { $in: triggerSources };
      }

      const [logs, total] = await Promise.all([
        this.AuditLogModel.find(query)
          .sort({ timestamp: -1 })
          .skip(offset)
          .limit(limit)
          .populate("userId", "firstName lastName email")
          .lean(),
        this.AuditLogModel.countDocuments(query),
      ]);

      return {
        logs: logs as PropertyStatusAuditLog[],
        total,
        hasMore: offset + logs.length < total,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(
    options: {
      startDate?: Date;
      endDate?: Date;
      propertyIds?: string[];
    } = {}
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<PropertyStatusAuditEventType, number>;
    eventsBySource: Record<PropertyStatusTriggerSource, number>;
    topProperties: Array<{
      propertyId: string;
      propertyName: string;
      eventCount: number;
    }>;
    recentActivity: PropertyStatusAuditLog[];
  }> {
    try {
      const { startDate, endDate, propertyIds } = options;

      const matchQuery: any = {};
      if (startDate || endDate) {
        matchQuery.timestamp = {};
        if (startDate) matchQuery.timestamp.$gte = startDate;
        if (endDate) matchQuery.timestamp.$lte = endDate;
      }
      if (propertyIds?.length > 0) {
        matchQuery.propertyId = {
          $in: propertyIds.map((id) => new mongoose.Types.ObjectId(id)),
        };
      }

      const [
        totalEvents,
        eventsByType,
        eventsBySource,
        topProperties,
        recentActivity,
      ] = await Promise.all([
        this.AuditLogModel.countDocuments(matchQuery),

        this.AuditLogModel.aggregate([
          { $match: matchQuery },
          { $group: { _id: "$eventType", count: { $sum: 1 } } },
        ]),

        this.AuditLogModel.aggregate([
          { $match: matchQuery },
          { $group: { _id: "$triggerSource", count: { $sum: 1 } } },
        ]),

        this.AuditLogModel.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: { propertyId: "$propertyId", propertyName: "$propertyName" },
              eventCount: { $sum: 1 },
            },
          },
          { $sort: { eventCount: -1 } },
          { $limit: 10 },
        ]),

        this.AuditLogModel.find(matchQuery)
          .sort({ timestamp: -1 })
          .limit(20)
          .populate("userId", "firstName lastName")
          .lean(),
      ]);

      const eventsByTypeMap = Object.values(
        PropertyStatusAuditEventType
      ).reduce((acc, type) => {
        acc[type] = 0;
        return acc;
      }, {} as Record<PropertyStatusAuditEventType, number>);

      eventsByType.forEach((item: any) => {
        eventsByTypeMap[item._id as PropertyStatusAuditEventType] = item.count;
      });

      const eventsBySourceMap = Object.values(
        PropertyStatusTriggerSource
      ).reduce((acc, source) => {
        acc[source] = 0;
        return acc;
      }, {} as Record<PropertyStatusTriggerSource, number>);

      eventsBySource.forEach((item: any) => {
        eventsBySourceMap[item._id as PropertyStatusTriggerSource] = item.count;
      });

      return {
        totalEvents,
        eventsByType: eventsByTypeMap,
        eventsBySource: eventsBySourceMap,
        topProperties: topProperties.map((item: any) => ({
          propertyId: item._id.propertyId.toString(),
          propertyName: item._id.propertyName,
          eventCount: item.eventCount,
        })),
        recentActivity: recentActivity as PropertyStatusAuditLog[],
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Clean up old audit logs
   */
  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.AuditLogModel.deleteMany({
        timestamp: { $lt: cutoffDate },
      });

      return result.deletedCount || 0;
    } catch (error) {
      throw error;
    }
  }
}

// Export singleton instance
export const propertyAuditLogger = PropertyAuditLogger.getInstance();

/**
 * PropertyPro - Admin Dashboard Service
 * Aggregates system-wide metrics, activity, and health data for admin views
 */

import os from "os";
import { Types } from "mongoose";
import {
  User,
  Property,
  Payment,
  MaintenanceRequest,
  AuditLog,
} from "@/models";
import {
  UserRole,
  PaymentStatus,
  PropertyStatus,
  MaintenanceStatus,
} from "@/types";
import {
  monitoringService,
  SystemMetrics,
  HealthCheckResult,
} from "@/lib/services/monitoring.service";
import { AuditSeverity } from "@/models/AuditLog";

// ============================================================================
// TYPES
// ============================================================================

export type AdminAlertType = "error" | "warning" | "info";

export interface AdminDashboardAlert {
  id: string;
  type: AdminAlertType;
  message: string;
  timestamp: string;
  source: string;
}

export interface AdminDashboardUserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "inactive";
  lastLogin?: string | null;
  properties: number;
  createdAt: string;
}

export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  newUsersLast30: number;
  totalProperties: number;
  activeProperties: number;
  totalRevenue: number;
  revenueLast30: number;
  activeSessions: number;
  maintenanceOpen: number;
}

export interface AdminDashboardSystemStatus {
  status: "healthy" | "degraded" | "unhealthy";
  score: number;
  uptime: string;
  metrics: SystemMetrics;
  services: Array<
    HealthCheckResult & {
      score: number;
      displayName: string;
    }
  >;
  databaseStatus: {
    label: string;
    status: "online" | "offline" | "degraded";
    lastChecked: string;
    responseTime: number | null;
  };
}

export interface AdminDashboardResponse {
  stats: AdminDashboardStats;
  recentUsers: AdminDashboardUserSummary[];
  alerts: AdminDashboardAlert[];
  systemStatus: AdminDashboardSystemStatus;
}

// ============================================================================
// HELPERS
// ============================================================================

function toObjectId(id: Types.ObjectId | string): string {
  if (typeof id === "string") return id;
  return id?.toString();
}

function formatName(user: any): string {
  const first = user?.firstName || "";
  const last = user?.lastName || "";
  return `${first} ${last}`.trim() || user?.email || "Inconnu";
}

function calculateServiceScore(status: HealthCheckResult["status"]): number {
  switch (status) {
    case "healthy":
      return 100;
    case "degraded":
      return 65;
    case "unhealthy":
      return 30;
    default:
      return 50;
  }
}

function calculateOverallScore(services: HealthCheckResult[]): number {
  if (!services || services.length === 0) {
    return 60;
  }

  const total = services.reduce(
    (sum, service) => sum + calculateServiceScore(service.status),
    0
  );

  return Math.round(total / services.length);
}

function deriveDatabaseStatus(services: HealthCheckResult[]) {
  const databaseService = services.find(
    (service) => service.service === "database"
  );

  if (!databaseService) {
    return {
      label: "Inconnu",
      status: "offline" as const,
      lastChecked: new Date().toISOString(),
      responseTime: null,
    };
  }

  const statusMap: Record<
    HealthCheckResult["status"],
    "online" | "offline" | "degraded"
  > = {
    healthy: "online",
    degraded: "degraded",
    unhealthy: "offline",
  };

  return {
    label:
      databaseService.status === "healthy"
        ? "MongoDB connected"
        : databaseService.error || "Status unknown",
    status: statusMap[databaseService.status],
    lastChecked:
      databaseService.timestamp?.toISOString?.() || new Date().toISOString(),
    responseTime: databaseService.responseTime ?? null,
  };
}

function getRuntimeMetrics(): Pick<
  SystemMetrics,
  | "uptime"
  | "memoryUsage"
  | "cpuUsage"
  | "requestsPerMinute"
  | "errorRate"
  | "averageResponseTime"
  | "activeConnections"
> {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  const cpuLoad = os.loadavg?.()?.[0] ?? 0; // 1-minute load average
  const cpuCount = os.cpus?.()?.length ?? 1;
  const cpuUsage = Math.min(100, Math.max(0, (cpuLoad / cpuCount) * 100));

  return {
    uptime: os.uptime(),
    memoryUsage: {
      used: usedMemory,
      total: totalMemory,
      percentage: totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0,
    },
    cpuUsage,
    requestsPerMinute: 0,
    errorRate: 0,
    averageResponseTime: 0,
    activeConnections: 0,
  };
}

function normalizeServiceName(service: string): string {
  return service
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

export async function getAdminDashboardData(): Promise<AdminDashboardResponse> {
  const now = new Date();
  const last30Days = new Date(now);
  last30Days.setDate(now.getDate() - 30);
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Revenue counts fully-paid, non-deleted payments — mirrors the rest of the
  // app (dashboard/overview, payment-dashboard.service) for consistent numbers.
  const paymentMatchCompleted = {
    deletedAt: null,
    status: PaymentStatus.PAID,
  };

  const [
    totalUsers,
    activeUsers,
    newUsersLast30,
    totalProperties,
    activeProperties,
    revenueAggregation,
    revenueLast30Aggregation,
    recentUsersRaw,
    activeSessions,
    openMaintenanceRequests,
    auditAlertsRaw,
    systemStatusRaw,
  ] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    User.countDocuments({ deletedAt: null, isActive: true }),
    User.countDocuments({ deletedAt: null, createdAt: { $gte: last30Days } }),
    Property.countDocuments({ deletedAt: null }),
    Property.countDocuments({
      deletedAt: null,
      status: { $in: [PropertyStatus.AVAILABLE, PropertyStatus.OCCUPIED] },
    }),
    Payment.aggregate([
      { $match: paymentMatchCompleted },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
        },
      },
    ]),
    Payment.aggregate([
      {
        $match: {
          ...paymentMatchCompleted,
          // Use the date the money was collected (fall back to the due date),
          // not updatedAt — editing an old payment shouldn't count as recent
          // revenue.
          $expr: {
            $gte: [{ $ifNull: ["$paidDate", "$dueDate"] }, last30Days],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
        },
      },
    ]),
    User.find({ deletedAt: null })
      .sort({ lastLogin: -1, createdAt: -1 })
      .limit(10)
      .select("firstName lastName email role isActive lastLogin createdAt")
      .lean(),
    User.countDocuments({
      deletedAt: null,
      isActive: true,
      lastLogin: { $gte: last24Hours },
    }),
    MaintenanceRequest.countDocuments({
      deletedAt: null,
      status: {
        $in: [
          MaintenanceStatus.SUBMITTED,
          MaintenanceStatus.ASSIGNED,
          MaintenanceStatus.IN_PROGRESS,
        ],
      },
    }),
    AuditLog.find({
      severity: { $in: [AuditSeverity.HIGH, AuditSeverity.CRITICAL] },
      timestamp: { $gte: last30Days },
    })
      .sort({ timestamp: -1 })
      .limit(10)
      .select("description severity timestamp category action source")
      .lean(),
    (async () => {
      try {
        return await monitoringService.getSystemStatus();
      } catch (error) {
        console.warn("Failed to fetch monitoring status", error);
        return null;
      }
    })(),
  ]);

  const totalRevenue = revenueAggregation?.[0]?.totalRevenue || 0;
  const revenueLast30 = revenueLast30Aggregation?.[0]?.totalRevenue || 0;

  const runtimeMetrics = getRuntimeMetrics();

  const systemServices = systemStatusRaw?.services || [];
  const servicesWithScores = systemServices.map((service) => ({
    ...service,
    score: calculateServiceScore(service.status),
    displayName: normalizeServiceName(service.service),
  }));

  const systemScore = calculateOverallScore(systemServices);

  const systemStatus: AdminDashboardSystemStatus = {
    status: (systemStatusRaw?.overall ||
      "degraded") as AdminDashboardSystemStatus["status"],
    score: systemScore,
    uptime: systemStatusRaw?.uptime || "0h 0m",
    metrics: {
      // Host-level metrics are read fresh each request, so they're always
      // populated. The monitoring service collects these on a 60s interval and
      // reports zeros on a cold start, which previously clobbered these values.
      uptime: runtimeMetrics.uptime,
      memoryUsage: runtimeMetrics.memoryUsage,
      cpuUsage: runtimeMetrics.cpuUsage,
      // Request-driven counters only have a meaningful source in the monitoring
      // service; default to 0 when no traffic has been recorded yet.
      requestsPerMinute: systemStatusRaw?.metrics?.requestsPerMinute ?? 0,
      errorRate: systemStatusRaw?.metrics?.errorRate ?? 0,
      averageResponseTime: systemStatusRaw?.metrics?.averageResponseTime ?? 0,
      activeConnections:
        systemStatusRaw?.metrics?.activeConnections || activeSessions,
    },
    services: servicesWithScores,
    databaseStatus: deriveDatabaseStatus(systemServices),
  };

  // Compute property counts for recent users
  const recentUsersWithProperties: AdminDashboardUserSummary[] =
    await Promise.all(
      (recentUsersRaw || []).map(async (user) => {
        const userId = toObjectId(user._id);

        const properties = await Property.countDocuments({
          deletedAt: null,
          $or: [{ ownerId: user._id }, { managerId: user._id }],
        });

        return {
          id: userId,
          name: formatName(user),
          email: user.email,
          role: (user.role as UserRole) || UserRole.TENANT,
          status: user.isActive ? "active" : ("inactive" as const),
          lastLogin: user.lastLogin
            ? new Date(user.lastLogin).toISOString()
            : null,
          properties,
          createdAt: user.createdAt
            ? new Date(user.createdAt).toISOString()
            : now.toISOString(),
        };
      })
    );

  // Build alerts combining system health and audit findings
  const alerts: AdminDashboardAlert[] = [];

  servicesWithScores
    .filter((service) => service.status !== "healthy")
    .forEach((service) => {
      alerts.push({
        id: `health-${service.service}`,
        type: service.status === "unhealthy" ? "error" : "warning",
        message: `${
          service.displayName
        } status is ${service.status.toUpperCase()}`,
        timestamp: service.timestamp?.toISOString?.() || now.toISOString(),
        source: "System Health",
      });
    });

  if (openMaintenanceRequests > 25) {
    alerts.push({
      id: "maintenance-backlog",
      type: "warning",
      message: `High maintenance backlog: ${openMaintenanceRequests} open requests`,
      timestamp: now.toISOString(),
      source: "Maintenance",
    });
  }

  (auditAlertsRaw || []).forEach((alert, index) => {
    alerts.push({
      id: `audit-${index}-${alert._id?.toString?.() ?? index}`,
      type:
        alert.severity === AuditSeverity.CRITICAL
          ? "error"
          : alert.severity === AuditSeverity.HIGH
          ? "warning"
          : "info",
      message: alert.description || "System alert recorded",
      timestamp: alert.timestamp
        ? new Date(alert.timestamp).toISOString()
        : now.toISOString(),
      source: alert.source || `Audit • ${alert.category ?? "system"}`,
    });
  });

  const dedupedAlerts = alerts.filter((alert) => alert.message).slice(0, 12);

  const stats: AdminDashboardStats = {
    totalUsers,
    activeUsers,
    newUsersLast30,
    totalProperties,
    activeProperties,
    totalRevenue,
    revenueLast30,
    activeSessions,
    maintenanceOpen: openMaintenanceRequests,
  };

  return {
    stats,
    recentUsers: recentUsersWithProperties,
    alerts: dedupedAlerts,
    systemStatus,
  };
}

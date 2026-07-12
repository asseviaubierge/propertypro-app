/**
 * PropertyPro - Payment Synchronization Monitoring Service
 * Monitors data consistency, detects synchronization failures, and provides alerts
 */

import mongoose from "mongoose";
import { IPayment, ILease, PaymentStatus, LeaseStatus } from "@/types";
import { leasePaymentSynchronizer } from "./lease-payment-synchronizer.service";

export interface SyncHealthReport {
  timestamp: Date;
  totalLeases: number;
  totalPayments: number;
  syncIssues: SyncIssue[];
  performanceMetrics: PerformanceMetrics;
  recommendations: string[];
}

export interface SyncIssue {
  id: string;
  type:
    | "data_inconsistency"
    | "sync_failure"
    | "performance_issue"
    | "orphaned_data";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  affectedEntities: {
    leaseIds?: string[];
    paymentIds?: string[];
  };
  detectedAt: Date;
  autoFixable: boolean;
}

export interface PerformanceMetrics {
  avgSyncTime: number;
  failureRate: number;
  pendingSyncCount: number;
  lastSyncTime: Date;
}

export class PaymentSyncMonitorService {
  private static instance: PaymentSyncMonitorService;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertThresholds = {
    maxPendingSyncs: 10,
    maxFailureRate: 0.05, // 5%
    maxSyncTime: 5000, // 5 seconds
  };

  constructor() {
    if (PaymentSyncMonitorService.instance) {
      return PaymentSyncMonitorService.instance;
    }
    PaymentSyncMonitorService.instance = this;
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(intervalMs: number = 300000): void {
    // 5 minutes default
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        const report = await this.generateHealthReport();
        await this.processHealthReport(report);
      } catch (error) {
        console.error("Monitoring error:", error);
      }
    }, intervalMs);


  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

  }

  /**
   * Generate comprehensive health report
   */
  async generateHealthReport(): Promise<SyncHealthReport> {
    const timestamp = new Date();
    const syncIssues: SyncIssue[] = [];

    // Get basic counts
    const totalLeases = await mongoose
      .model("Lease")
      .countDocuments({ deletedAt: null });
    const totalPayments = await mongoose
      .model("Payment")
      .countDocuments({ deletedAt: null });

    // Detect sync issues
    const dataInconsistencies = await this.detectDataInconsistencies();
    const syncFailures = await this.detectSyncFailures();
    const performanceIssues = await this.detectPerformanceIssues();
    const orphanedData = await this.detectOrphanedData();

    syncIssues.push(
      ...dataInconsistencies,
      ...syncFailures,
      ...performanceIssues,
      ...orphanedData
    );

    // Calculate performance metrics
    const performanceMetrics = await this.calculatePerformanceMetrics();

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      syncIssues,
      performanceMetrics
    );

    return {
      timestamp,
      totalLeases,
      totalPayments,
      syncIssues,
      performanceMetrics,
      recommendations,
    };
  }

  /**
   * Detect data inconsistencies between leases and payments
   */
  private async detectDataInconsistencies(): Promise<SyncIssue[]> {
    const issues: SyncIssue[] = [];

    try {
      // Find payments with mismatched tenant/property references
      const mismatchedPayments = await mongoose.model("Payment").aggregate([
        {
          $lookup: {
            from: "leases",
            localField: "leaseId",
            foreignField: "_id",
            as: "lease",
          },
        },
        {
          $match: {
            "lease.0": { $exists: true },
            $or: [
              { $expr: { $ne: ["$tenantId", "$lease.tenantId"] } },
              { $expr: { $ne: ["$propertyId", "$lease.propertyId"] } },
            ],
          },
        },
      ]);

      if (mismatchedPayments.length > 0) {
        issues.push({
          id: `mismatched_refs_${Date.now()}`,
          type: "data_inconsistency",
          severity: "high",
          description: `Found ${mismatchedPayments.length} payments with mismatched tenant/property references`,
          affectedEntities: {
            paymentIds: mismatchedPayments.map((p) => p._id.toString()),
          },
          detectedAt: new Date(),
          autoFixable: true,
        });
      }

      // Find payments outside lease date ranges
      const outOfRangePayments = await mongoose.model("Payment").aggregate([
        {
          $lookup: {
            from: "leases",
            localField: "leaseId",
            foreignField: "_id",
            as: "lease",
          },
        },
        {
          $match: {
            "lease.0": { $exists: true },
            $or: [
              { $expr: { $lt: ["$dueDate", "$lease.startDate"] } },
              { $expr: { $gt: ["$dueDate", "$lease.endDate"] } },
            ],
          },
        },
      ]);

      if (outOfRangePayments.length > 0) {
        issues.push({
          id: `out_of_range_${Date.now()}`,
          type: "data_inconsistency",
          severity: "medium",
          description: `Found ${outOfRangePayments.length} payments with due dates outside lease periods`,
          affectedEntities: {
            paymentIds: outOfRangePayments.map((p) => p._id.toString()),
          },
          detectedAt: new Date(),
          autoFixable: false,
        });
      }
    } catch (error) {
      console.error("Error detecting data inconsistencies:", error);
    }

    return issues;
  }

  /**
   * Detect synchronization failures
   */
  private async detectSyncFailures(): Promise<SyncIssue[]> {
    const issues: SyncIssue[] = [];

    try {
      // Find payments with pending sync status for too long
      const stalePendingPayments = await mongoose.model("Payment").find({
        syncStatus: "pending",
        lastSyncedAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) }, // 30 minutes ago
        deletedAt: null,
      });

      if (stalePendingPayments.length > 0) {
        issues.push({
          id: `stale_pending_${Date.now()}`,
          type: "sync_failure",
          severity: "medium",
          description: `Found ${stalePendingPayments.length} payments with stale pending sync status`,
          affectedEntities: {
            paymentIds: stalePendingPayments.map((p) => p._id.toString()),
          },
          detectedAt: new Date(),
          autoFixable: true,
        });
      }

      // Find payments with failed sync status
      const failedSyncPayments = await mongoose.model("Payment").find({
        syncStatus: "failed",
        deletedAt: null,
      });

      if (failedSyncPayments.length > 0) {
        issues.push({
          id: `failed_sync_${Date.now()}`,
          type: "sync_failure",
          severity: "high",
          description: `Found ${failedSyncPayments.length} payments with failed sync status`,
          affectedEntities: {
            paymentIds: failedSyncPayments.map((p) => p._id.toString()),
          },
          detectedAt: new Date(),
          autoFixable: true,
        });
      }
    } catch (error) {
      console.error("Error detecting sync failures:", error);
    }

    return issues;
  }

  /**
   * Detect performance issues
   */
  private async detectPerformanceIssues(): Promise<SyncIssue[]> {
    const issues: SyncIssue[] = [];

    try {
      const pendingSyncCount = await mongoose.model("Payment").countDocuments({
        syncStatus: "pending",
        deletedAt: null,
      });

      if (pendingSyncCount > this.alertThresholds.maxPendingSyncs) {
        issues.push({
          id: `high_pending_count_${Date.now()}`,
          type: "performance_issue",
          severity: "medium",
          description: `High number of pending syncs: ${pendingSyncCount}`,
          affectedEntities: {},
          detectedAt: new Date(),
          autoFixable: false,
        });
      }
    } catch (error) {
      console.error("Error detecting performance issues:", error);
    }

    return issues;
  }

  /**
   * Detect orphaned data
   */
  private async detectOrphanedData(): Promise<SyncIssue[]> {
    const issues: SyncIssue[] = [];

    try {
      // Find payments referencing non-existent leases
      const orphanedPayments = await mongoose.model("Payment").aggregate([
        {
          $lookup: {
            from: "leases",
            localField: "leaseId",
            foreignField: "_id",
            as: "lease",
          },
        },
        {
          $match: {
            leaseId: { $exists: true },
            "lease.0": { $exists: false },
            deletedAt: null,
          },
        },
      ]);

      if (orphanedPayments.length > 0) {
        issues.push({
          id: `orphaned_payments_${Date.now()}`,
          type: "orphaned_data",
          severity: "high",
          description: `Found ${orphanedPayments.length} payments referencing non-existent leases`,
          affectedEntities: {
            paymentIds: orphanedPayments.map((p) => p._id.toString()),
          },
          detectedAt: new Date(),
          autoFixable: false,
        });
      }
    } catch (error) {
      console.error("Error detecting orphaned data:", error);
    }

    return issues;
  }

  /**
   * Calculate performance metrics
   */
  private async calculatePerformanceMetrics(): Promise<PerformanceMetrics> {
    const pendingSyncCount = await mongoose.model("Payment").countDocuments({
      syncStatus: "pending",
      deletedAt: null,
    });

    const lastSyncedPayment = await mongoose
      .model("Payment")
      .findOne({ lastSyncedAt: { $exists: true } })
      .sort({ lastSyncedAt: -1 });

    return {
      avgSyncTime: 0, // Would need to track this in a separate collection
      failureRate: 0, // Would need to track this in a separate collection
      pendingSyncCount,
      lastSyncTime: lastSyncedPayment?.lastSyncedAt || new Date(0),
    };
  }

  /**
   * Generate recommendations based on issues
   */
  private generateRecommendations(
    issues: SyncIssue[],
    metrics: PerformanceMetrics
  ): string[] {
    const recommendations: string[] = [];

    const criticalIssues = issues.filter((i) => i.severity === "critical");
    const highIssues = issues.filter((i) => i.severity === "high");
    const autoFixableIssues = issues.filter((i) => i.autoFixable);

    if (criticalIssues.length > 0) {
      recommendations.push(
        "Immediate attention required: Critical synchronization issues detected"
      );
    }

    if (highIssues.length > 0) {
      recommendations.push(
        "High priority: Review and fix data inconsistencies"
      );
    }

    if (autoFixableIssues.length > 0) {
      recommendations.push(
        `${autoFixableIssues.length} issues can be automatically fixed`
      );
    }

    if (metrics.pendingSyncCount > this.alertThresholds.maxPendingSyncs) {
      recommendations.push("Consider increasing sync processing capacity");
    }

    if (recommendations.length === 0) {
      recommendations.push("All systems operating normally");
    }

    return recommendations;
  }

  /**
   * Process health report and take actions
   */
  private async processHealthReport(report: SyncHealthReport): Promise<void> {
    // Log critical and high severity issues
    const criticalIssues = report.syncIssues.filter(
      (i) => i.severity === "critical"
    );
    const highIssues = report.syncIssues.filter((i) => i.severity === "high");

    if (criticalIssues.length > 0) {
      console.error("CRITICAL SYNC ISSUES:", criticalIssues);
      // Here you would integrate with your alerting system
    }

    if (highIssues.length > 0) {
      console.warn("HIGH PRIORITY SYNC ISSUES:", highIssues);
    }

    // Auto-fix issues where possible
    const autoFixableIssues = report.syncIssues.filter((i) => i.autoFixable);
    for (const issue of autoFixableIssues) {
      try {
        await this.autoFixIssue(issue);
      } catch (error) {
        console.error(`Failed to auto-fix issue ${issue.id}:`, error);
      }
    }
  }

  /**
   * Attempt to automatically fix issues
   */
  private async autoFixIssue(issue: SyncIssue): Promise<void> {
    switch (issue.type) {
      case "sync_failure":
        // Retry synchronization for failed payments
        if (issue.affectedEntities.paymentIds) {
          for (const paymentId of issue.affectedEntities.paymentIds) {
            const payment = await mongoose.model("Payment").findById(paymentId);
            if (payment?.leaseId) {
              await leasePaymentSynchronizer.syncLeaseWithPayments(
                payment.leaseId.toString(),
                { forceSync: true }
              );
            }
          }
        }
        break;

      case "data_inconsistency":
        // For mismatched references, trigger validation and sync
        if (issue.affectedEntities.paymentIds) {
          for (const paymentId of issue.affectedEntities.paymentIds) {
            const payment = await mongoose.model("Payment").findById(paymentId);
            if (payment?.leaseId) {
              const validation =
                await leasePaymentSynchronizer.validateLeasePaymentConsistency(
                  payment.leaseId.toString()
                );
              if (!validation.isValid) {
                console.warn(
                  `Validation failed for payment ${paymentId}:`,
                  validation.errors
                );
              }
            }
          }
        }
        break;
    }
  }
}

// Export singleton instance
export const paymentSyncMonitor = new PaymentSyncMonitorService();

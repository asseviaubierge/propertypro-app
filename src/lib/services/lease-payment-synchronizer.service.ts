/**
 * PropertyPro - Lease Payment Synchronizer Service
 * Centralized service for maintaining data consistency between Lease and Payment collections
 * Implements atomic operations, race condition protection, and comprehensive validation
 */

import mongoose from "mongoose";
import { ILease, IPayment, PaymentStatus, LeaseStatus } from "@/types";
import { paymentService } from "./payment.service";
import { leaseService } from "./lease.service";

export interface SyncOptions {
  session?: mongoose.ClientSession;
  skipValidation?: boolean;
  forceSync?: boolean;
}

export interface SyncResult {
  success: boolean;
  leaseUpdated: boolean;
  paymentsUpdated: number;
  errors: string[];
  warnings: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  inconsistencies: Array<{
    type: string;
    description: string;
    severity: "error" | "warning";
  }>;
}

export class LeasePaymentSynchronizer {
  private static instance: LeasePaymentSynchronizer;
  private syncInProgress = new Set<string>();

  constructor() {
    if (LeasePaymentSynchronizer.instance) {
      return LeasePaymentSynchronizer.instance;
    }
    LeasePaymentSynchronizer.instance = this;
  }

  /**
   * Main synchronization method with atomic operations and race condition protection
   */
  async syncLeaseWithPayments(
    leaseId: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      leaseUpdated: false,
      paymentsUpdated: 0,
      errors: [],
      warnings: [],
    };

    // Prevent concurrent synchronization for the same lease
    if (this.syncInProgress.has(leaseId)) {
      result.warnings.push(
        "Synchronization already in progress for this lease"
      );
      return result;
    }

    this.syncInProgress.add(leaseId);

    try {
      // Use provided session or create new one for atomic operations
      const session = options.session || (await mongoose.startSession());
      const shouldEndSession = !options.session;

      try {
        await session.withTransaction(async () => {
          // Validate data consistency first
          if (!options.skipValidation) {
            const validation = await this.validateLeasePaymentConsistency(
              leaseId,
              { session }
            );
            if (!validation.isValid && !options.forceSync) {
              result.errors.push(...validation.errors);
              throw new Error("Validation failed - use forceSync to override");
            }
            result.warnings.push(...validation.warnings);
          }

          // Get lease and payments with session
          const lease = await mongoose
            .model("Lease")
            .findById(leaseId)
            .session(session);
          if (!lease) {
            throw new Error("Bail introuvable");
          }

          const payments = await mongoose
            .model("Payment")
            .find({ leaseId, deletedAt: null })
            .session(session);

          // Calculate payment summary
          const paymentSummary = this.calculatePaymentSummary(payments);

          // Update lease status based on payment status
          const leaseUpdates = this.calculateLeaseUpdates(
            lease,
            paymentSummary
          );
          if (Object.keys(leaseUpdates).length > 0) {
            await mongoose
              .model("Lease")
              .findByIdAndUpdate(leaseId, leaseUpdates, { session, new: true });
            result.leaseUpdated = true;
          }

          // Update payment statuses based on lease status and dates
          const paymentUpdates = await this.calculatePaymentUpdates(
            lease,
            payments
          );
          if (paymentUpdates.length > 0) {
            for (const update of paymentUpdates) {
              await mongoose
                .model("Payment")
                .findByIdAndUpdate(update.paymentId, update.updates, {
                  session,
                });
              result.paymentsUpdated++;
            }
          }

          // Mark all payments as synced
          await mongoose
            .model("Payment")
            .updateMany(
              { leaseId, deletedAt: null },
              { syncStatus: "synced", lastSyncedAt: new Date() },
              { session }
            );
        });

        if (shouldEndSession) {
          await session.endSession();
        }

        result.success = true;
      } catch (error) {
        if (shouldEndSession) {
          await session.endSession();
        }
        throw error;
      }
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      this.syncInProgress.delete(leaseId);
    }

    return result;
  }

  /**
   * Comprehensive validation of lease-payment consistency
   */
  async validateLeasePaymentConsistency(
    leaseId: string,
    options: { session?: mongoose.ClientSession } = {}
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      inconsistencies: [],
    };

    try {
      const lease = await mongoose
        .model("Lease")
        .findById(leaseId)
        .session(options.session || null);

      if (!lease) {
        result.errors.push("Bail introuvable");
        result.isValid = false;
        return result;
      }

      const payments = await mongoose
        .model("Payment")
        .find({ leaseId, deletedAt: null })
        .session(options.session || null);

      // Validate payment dates are within lease period
      for (const payment of payments) {
        if (
          payment.dueDate < lease.startDate ||
          payment.dueDate > lease.endDate
        ) {
          result.inconsistencies.push({
            type: "date_range",
            description: `Payment ${payment._id} due date ${payment.dueDate} is outside lease period`,
            severity: "error",
          });
          result.isValid = false;
        }
      }

      // Validate payment amounts match lease terms
      const rentPayments = payments.filter((p) => p.type === "rent");
      for (const payment of rentPayments) {
        if (payment.amount !== lease.terms.rentAmount) {
          result.inconsistencies.push({
            type: "amount_mismatch",
            description: `Rent payment ${payment._id} amount ${payment.amount} doesn't match lease rent ${lease.terms.rentAmount}`,
            severity: "warning",
          });
        }
      }

      // Validate no orphaned payments
      const orphanedPayments = payments.filter(
        (p) =>
          !p.tenantId.equals(lease.tenantId) ||
          !p.propertyId.equals(lease.propertyId)
      );

      if (orphanedPayments.length > 0) {
        result.inconsistencies.push({
          type: "orphaned_payments",
          description: `Found ${orphanedPayments.length} payments with mismatched tenant/property references`,
          severity: "error",
        });
        result.isValid = false;
      }

      // Validate payment status consistency
      if (
        lease.status === LeaseStatus.TERMINATED ||
        lease.status === LeaseStatus.EXPIRED
      ) {
        const activePendingPayments = payments.filter(
          (p) => p.status === PaymentStatus.PENDING && p.dueDate > new Date()
        );

        if (activePendingPayments.length > 0) {
          result.inconsistencies.push({
            type: "status_inconsistency",
            description: `Found ${activePendingPayments.length} pending future payments for ${lease.status} lease`,
            severity: "warning",
          });
        }
      }

      // Collect all errors and warnings
      result.errors = result.inconsistencies
        .filter((i) => i.severity === "error")
        .map((i) => i.description);

      result.warnings = result.inconsistencies
        .filter((i) => i.severity === "warning")
        .map((i) => i.description);
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : "Validation failed"
      );
      result.isValid = false;
    }

    return result;
  }

  /**
   * Calculate payment summary for lease status updates
   */
  private calculatePaymentSummary(payments: any[]) {
    const now = new Date();

    return {
      totalDue: payments.reduce((sum, p) => sum + p.amount, 0),
      totalPaid: payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0),
      totalOverdue: payments
        .filter((p) =>
          [
            PaymentStatus.OVERDUE,
            PaymentStatus.OVERDUE,
            PaymentStatus.OVERDUE,
            PaymentStatus.OVERDUE,
          ].includes(p.status)
        )
        .reduce((sum, p) => sum + (p.amount - (p.amountPaid || 0)), 0),
      totalPending: payments
        .filter((p) =>
          [
            PaymentStatus.PENDING,
            PaymentStatus.PENDING,
            PaymentStatus.PENDING,
            PaymentStatus.PENDING,
            PaymentStatus.PENDING,
          ].includes(p.status)
        )
        .reduce((sum, p) => sum + (p.amount - (p.amountPaid || 0)), 0),
      overdueCount: payments.filter((p) =>
        [
          PaymentStatus.OVERDUE,
          PaymentStatus.OVERDUE,
          PaymentStatus.OVERDUE,
          PaymentStatus.OVERDUE,
        ].includes(p.status)
      ).length,
      pendingCount: payments.filter((p) =>
        [
          PaymentStatus.PENDING,
          PaymentStatus.PENDING,
          PaymentStatus.PENDING,
          PaymentStatus.PENDING,
          PaymentStatus.PENDING,
        ].includes(p.status)
      ).length,
      completedCount: payments.filter(
        (p) => p.status === PaymentStatus.PAID
      ).length,
      nextPaymentDate: payments
        .filter(
          (p) =>
            [
              PaymentStatus.PENDING,
              PaymentStatus.PENDING,
              PaymentStatus.PENDING,
              PaymentStatus.PENDING,
            ].includes(p.status) && p.dueDate > now
        )
        .sort(
          (a, b) =>
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        )[0]?.dueDate,
    };
  }

  /**
   * Calculate lease updates based on payment summary
   */
  private calculateLeaseUpdates(lease: any, paymentSummary: any) {
    const updates: any = {};

    // Update lease payment status based on overdue payments
    if (
      paymentSummary.overdueCount > 0 &&
      lease.status === LeaseStatus.ACTIVE
    ) {
      updates.paymentStatus = "overdue";
    } else if (
      paymentSummary.pendingCount === 0 &&
      paymentSummary.completedCount > 0
    ) {
      updates.paymentStatus = "current";
    } else if (paymentSummary.pendingCount > 0) {
      updates.paymentStatus = "pending";
    }

    return updates;
  }

  /**
   * Calculate payment updates based on lease status and current date
   */
  private async calculatePaymentUpdates(lease: any, payments: any[]) {
    const updates: Array<{ paymentId: string; updates: any }> = [];
    const now = new Date();

    for (const payment of payments) {
      const paymentUpdates: any = {};

      // Update overdue status based on due date
      if (
        [
          PaymentStatus.PENDING,
          PaymentStatus.PENDING,
          PaymentStatus.PENDING,
          PaymentStatus.PENDING,
          PaymentStatus.OVERDUE,
        ].includes(payment.status) &&
        payment.dueDate < now &&
        payment.amount > (payment.amountPaid || 0)
      ) {
        paymentUpdates.status = PaymentStatus.OVERDUE;
      }

      // Cancel future payments for terminated/expired leases
      if (
        (lease.status === LeaseStatus.TERMINATED ||
          lease.status === LeaseStatus.EXPIRED) &&
        [
          PaymentStatus.PENDING,
          PaymentStatus.PENDING,
          PaymentStatus.PENDING,
          PaymentStatus.PENDING,
        ].includes(payment.status) &&
        payment.dueDate > now
      ) {
        paymentUpdates.status = PaymentStatus.CANCELLED;
        paymentUpdates.notes = `Cancelled due to lease ${lease.status.toLowerCase()}`;
      }

      if (Object.keys(paymentUpdates).length > 0) {
        updates.push({
          paymentId: payment._id.toString(),
          updates: paymentUpdates,
        });
      }
    }

    return updates;
  }

  /**
   * Process payment with automatic lease synchronization
   */
  async processPaymentWithSync(
    paymentId: string,
    paymentData: any,
    options: SyncOptions = {}
  ) {
    const session = options.session || (await mongoose.startSession());
    const shouldEndSession = !options.session;

    try {
      return await session.withTransaction(async () => {
        // Process the payment
        const payment = await paymentService.processPayment(
          paymentId,
          paymentData,
          { session }
        );

        // Sync the lease
        const syncResult = await this.syncLeaseWithPayments(
          payment.leaseId.toString(),
          {
            session,
            skipValidation: false,
          }
        );

        if (!syncResult.success) {
          throw new Error(
            `Payment processed but sync failed: ${syncResult.errors.join(", ")}`
          );
        }

        return { payment, syncResult };
      });
    } finally {
      if (shouldEndSession) {
        await session.endSession();
      }
    }
  }

  /**
   * Monitor and detect synchronization failures
   */
  async detectSyncFailures(): Promise<
    Array<{ leaseId: string; issues: string[] }>
  > {
    const failures: Array<{ leaseId: string; issues: string[] }> = [];

    try {
      // Find payments with pending sync status
      const unsyncedPayments = await mongoose
        .model("Payment")
        .find({ syncStatus: "pending", deletedAt: null })
        .distinct("leaseId");

      for (const leaseId of unsyncedPayments) {
        const validation = await this.validateLeasePaymentConsistency(leaseId);
        if (!validation.isValid) {
          failures.push({
            leaseId: leaseId.toString(),
            issues: validation.errors,
          });
        }
      }
    } catch {
      // Silently handle detection errors
    }

    return failures;
  }
}

// Export singleton instance
export const leasePaymentSynchronizer = new LeasePaymentSynchronizer();

/**
 * PropertyPro - Payment Synchronization Enhancement Migration
 * Migrates existing payment data to include new synchronization fields
 * and fixes tenant reference inconsistencies
 */

import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";

export interface MigrationResult {
  success: boolean;
  message: string;
  stats: {
    paymentsUpdated: number;
    tenantReferencesFixed: number;
    indexesCreated: number;
    errors: string[];
  };
}

/**
 * Run the migration
 */
export async function up(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    message: "",
    stats: {
      paymentsUpdated: 0,
      tenantReferencesFixed: 0,
      indexesCreated: 0,
      errors: [],
    },
  };

  try {
    await connectDB();

    // Step 1: Add new fields to existing payments

    const paymentUpdateResult = await mongoose.model("Payment").updateMany(
      {
        $or: [
          { version: { $exists: false } },
          { lastSyncedAt: { $exists: false } },
          { syncStatus: { $exists: false } },
        ],
      },
      {
        $set: {
          version: 0,
          lastSyncedAt: new Date(),
          syncStatus: "synced",
        },
      }
    );
    result.stats.paymentsUpdated = paymentUpdateResult.modifiedCount;

    // Step 2: Fix tenant reference inconsistencies

    // Find payments that reference the old Tenant collection
    const paymentsWithOldRefs = await mongoose.model("Payment").aggregate([
      {
        $lookup: {
          from: "tenants",
          localField: "tenantId",
          foreignField: "_id",
          as: "tenant",
        },
      },
      {
        $match: {
          "tenant.0": { $exists: true },
        },
      },
    ]);

    let tenantReferencesFixed = 0;
    for (const payment of paymentsWithOldRefs) {
      try {
        // Find the corresponding User with tenant role
        const tenant = payment.tenant[0];
        if (tenant.userId) {
          await mongoose
            .model("Payment")
            .updateOne(
              { _id: payment._id },
              { $set: { tenantId: tenant.userId } }
            );
          tenantReferencesFixed++;
        }
      } catch (error) {
        result.stats.errors.push(
          `Failed to fix tenant reference for payment ${payment._id}: ${error}`
        );
      }
    }
    result.stats.tenantReferencesFixed = tenantReferencesFixed;

    // Step 3: Create new indexes (if they don't exist)

    const Payment = mongoose.model("Payment");

    try {
      // Create compound index for lease-payment uniqueness
      await Payment.collection.createIndex(
        { leaseId: 1, type: 1, dueDate: 1 },
        {
          unique: true,
          partialFilterExpression: {
            leaseId: { $exists: true },
            deletedAt: null,
          },
          name: "unique_lease_payment_per_due_date",
        }
      );
      result.stats.indexesCreated++;
    } catch (error) {
      // Index might already exist, that's okay

    }

    try {
      // Create sync status index
      await Payment.collection.createIndex(
        { syncStatus: 1, lastSyncedAt: 1 },
        { name: "sync_status_lookup" }
      );
      result.stats.indexesCreated++;
    } catch (error) {

    }

    try {
      // Create version index for optimistic locking
      await Payment.collection.createIndex(
        { version: 1 },
        { name: "version_lookup" }
      );
      result.stats.indexesCreated++;
    } catch (error) {

    }


    // Step 4: Validate data consistency

    const inconsistentPayments = await mongoose.model("Payment").aggregate([
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

    if (inconsistentPayments.length > 0) {
      result.stats.errors.push(
        `Found ${inconsistentPayments.length} payments with inconsistent references`
      );
      console.warn(
        `⚠️ Found ${inconsistentPayments.length} payments with inconsistent references`
      );
    }

    // Step 5: Initialize sync status for all payments

    await mongoose.model("Payment").updateMany(
      { syncStatus: { $ne: "synced" } },
      {
        $set: {
          syncStatus: "pending",
          lastSyncedAt: new Date(),
        },
      }
    );

    result.success = true;
    result.message =
      "Payment sync enhancement migration completed successfully";



  } catch (error) {
    result.success = false;
    result.message =
      error instanceof Error ? error.message : "Migration failed";
    result.stats.errors.push(result.message);
    console.error("❌ Migration failed:", error);
  }

  return result;
}

/**
 * Rollback the migration
 */
export async function down(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    message: "",
    stats: {
      paymentsUpdated: 0,
      tenantReferencesFixed: 0,
      indexesCreated: 0,
      errors: [],
    },
  };

  try {
    await connectDB();

    // Remove new fields from payments

    const paymentUpdateResult = await mongoose.model("Payment").updateMany(
      {},
      {
        $unset: {
          version: "",
          lastSyncedAt: "",
          syncStatus: "",
        },
      }
    );
    result.stats.paymentsUpdated = paymentUpdateResult.modifiedCount;

    // Drop new indexes

    const Payment = mongoose.model("Payment");

    try {
      await Payment.collection.dropIndex("unique_lease_payment_per_due_date");
      result.stats.indexesCreated++;
    } catch (error) {

    }

    try {
      await Payment.collection.dropIndex("sync_status_lookup");
      result.stats.indexesCreated++;
    } catch (error) {

    }

    try {
      await Payment.collection.dropIndex("version_lookup");
      result.stats.indexesCreated++;
    } catch (error) {

    }


    result.success = true;
    result.message =
      "Payment sync enhancement migration rollback completed successfully";


  } catch (error) {
    result.success = false;
    result.message = error instanceof Error ? error.message : "Rollback failed";
    result.stats.errors.push(result.message);
    console.error("❌ Rollback failed:", error);
  }

  return result;
}

/**
 * Check if migration is needed
 */
export async function isNeeded(): Promise<boolean> {
  try {
    await connectDB();

    // Check if any payments are missing the new fields
    const paymentsWithoutSyncFields = await mongoose
      .model("Payment")
      .countDocuments({
        $or: [
          { version: { $exists: false } },
          { lastSyncedAt: { $exists: false } },
          { syncStatus: { $exists: false } },
        ],
      });

    return paymentsWithoutSyncFields > 0;
  } catch (error) {
    console.error("Error checking migration status:", error);
    return false;
  }
}

/**
 * Get migration status
 */
export async function getStatus(): Promise<{
  needed: boolean;
  stats: {
    totalPayments: number;
    paymentsWithSyncFields: number;
    paymentsWithoutSyncFields: number;
  };
}> {
  try {
    await connectDB();

    const totalPayments = await mongoose.model("Payment").countDocuments({});
    const paymentsWithSyncFields = await mongoose
      .model("Payment")
      .countDocuments({
        version: { $exists: true },
        lastSyncedAt: { $exists: true },
        syncStatus: { $exists: true },
      });
    const paymentsWithoutSyncFields = totalPayments - paymentsWithSyncFields;

    return {
      needed: paymentsWithoutSyncFields > 0,
      stats: {
        totalPayments,
        paymentsWithSyncFields,
        paymentsWithoutSyncFields,
      },
    };
  } catch (error) {
    console.error("Error getting migration status:", error);
    return {
      needed: false,
      stats: {
        totalPayments: 0,
        paymentsWithSyncFields: 0,
        paymentsWithoutSyncFields: 0,
      },
    };
  }
}

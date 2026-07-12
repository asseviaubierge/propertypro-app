/**
 * PropertyPro - Property Status Synchronization Service
 * Centralized service for automatic property status synchronization based on unit occupancy
 */

import mongoose from "mongoose";
import { PropertyStatus } from "@/types";
import { calculatePropertyStatusFromUnits } from "@/utils/property-status-calculator";

export interface PropertyStatusSyncResult {
  propertyId: string;
  oldStatus: PropertyStatus;
  newStatus: PropertyStatus;
  changed: boolean;
  unitCount: number;
  unitStatuses: Array<{
    unitId: string;
    unitNumber: string;
    status: PropertyStatus;
  }>;
  timestamp: Date;
  triggeredBy: string;
}

export interface PropertyStatusSyncOptions {
  triggeredBy?: string;
  skipValidation?: boolean;
  dryRun?: boolean;
  logChanges?: boolean;
}

export class PropertyStatusSynchronizer {
  private static instance: PropertyStatusSynchronizer;

  public static getInstance(): PropertyStatusSynchronizer {
    if (!PropertyStatusSynchronizer.instance) {
      PropertyStatusSynchronizer.instance = new PropertyStatusSynchronizer();
    }
    return PropertyStatusSynchronizer.instance;
  }

  /**
   * Synchronize property status based on unit statuses
   */
  async syncPropertyStatus(
    propertyId: string,
    options: PropertyStatusSyncOptions = {}
  ): Promise<PropertyStatusSyncResult> {
    const {
      triggeredBy = "system",
      skipValidation = false,
      dryRun = false,
      logChanges = true,
    } = options;

    try {
      // Import Property model dynamically to avoid circular dependencies
      const { Property } = await import("@/models");

      // Find the property with its units
      const property = await Property.findById(propertyId);
      if (!property) {
        throw new Error(`Property not found: ${propertyId}`);
      }

      // Skip synchronization for single-unit properties unless explicitly requested
      if (!property.isMultiUnit && !skipValidation) {
        return {
          propertyId,
          oldStatus: property.status,
          newStatus: property.status,
          changed: false,
          unitCount: property.units?.length || 0,
          unitStatuses: [],
          timestamp: new Date(),
          triggeredBy,
        };
      }

      const oldStatus = property.status;
      const unitStatuses =
        property.units?.map((unit: any) => unit.status) || [];
      const newStatus = calculatePropertyStatusFromUnits(unitStatuses);

      const result: PropertyStatusSyncResult = {
        propertyId,
        oldStatus,
        newStatus,
        changed: oldStatus !== newStatus,
        unitCount: property.units?.length || 0,
        unitStatuses:
          property.units?.map((unit: any) => ({
            unitId: unit._id.toString(),
            unitNumber: unit.unitNumber,
            status: unit.status,
          })) || [],
        timestamp: new Date(),
        triggeredBy,
      };

      // Update property status if changed and not in dry run mode
      if (result.changed && !dryRun) {
        property.status = newStatus;
        await property.save();

        // Log the status change to audit trail
        try {
          const {
            propertyAuditLogger,
            PropertyStatusTriggerSource,
            PropertyStatusAuditEventType,
          } = await import("@/lib/services/property-audit-logger.service");

          await propertyAuditLogger.logStatusChange(
            propertyId,
            property.name,
            oldStatus,
            newStatus,
            triggeredBy,
            PropertyStatusTriggerSource.SYSTEM_SYNC,
            {
              metadata: {
                unitCount: result.unitCount,
                syncResult: result,
              },
            }
          );
        } catch (auditError) {
          // Don't fail the sync if audit logging fails
        }
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Synchronize multiple properties
   */
  async syncMultipleProperties(
    propertyIds: string[],
    options: PropertyStatusSyncOptions = {}
  ): Promise<PropertyStatusSyncResult[]> {
    const results: PropertyStatusSyncResult[] = [];

    for (const propertyId of propertyIds) {
      try {
        const result = await this.syncPropertyStatus(propertyId, options);
        results.push(result);
      } catch (error) {
        // Continue with other properties even if one fails
      }
    }

    return results;
  }

  /**
   * Synchronize all multi-unit properties
   */
  async syncAllMultiUnitProperties(
    options: PropertyStatusSyncOptions = {}
  ): Promise<PropertyStatusSyncResult[]> {
    try {
      const { Property } = await import("@/models");

      // Find all multi-unit properties
      const properties = await Property.find({
        isMultiUnit: true,
        deletedAt: null,
      }).select("_id");

      const propertyIds = properties.map((p) => p._id.toString());
      return await this.syncMultipleProperties(propertyIds, options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Trigger synchronization after unit status change
   */
  async syncAfterUnitStatusChange(
    propertyId: string,
    unitId: string,
    oldUnitStatus: PropertyStatus,
    newUnitStatus: PropertyStatus,
    options: PropertyStatusSyncOptions = {}
  ): Promise<PropertyStatusSyncResult> {
    const triggeredBy = options.triggeredBy || `unit-status-change:${unitId}`;

    return await this.syncPropertyStatus(propertyId, {
      ...options,
      triggeredBy,
    });
  }

  /**
   * Trigger synchronization after lease status change
   */
  async syncAfterLeaseStatusChange(
    propertyId: string,
    leaseId: string,
    unitId: string,
    oldLeaseStatus: string,
    newLeaseStatus: string,
    options: PropertyStatusSyncOptions = {}
  ): Promise<PropertyStatusSyncResult> {
    const triggeredBy = options.triggeredBy || `lease-status-change:${leaseId}`;

    return await this.syncPropertyStatus(propertyId, {
      ...options,
      triggeredBy,
    });
  }

  /**
   * Trigger synchronization after maintenance request status change
   */
  async syncAfterMaintenanceStatusChange(
    propertyId: string,
    maintenanceRequestId: string,
    unitId: string | null,
    oldStatus: string,
    newStatus: string,
    options: PropertyStatusSyncOptions = {}
  ): Promise<PropertyStatusSyncResult | null> {
    // Only sync if maintenance affects unit availability
    const affectsUnitStatus = this.maintenanceAffectsUnitStatus(
      oldStatus,
      newStatus
    );

    if (!affectsUnitStatus || !unitId) {
      return null;
    }

    const triggeredBy =
      options.triggeredBy ||
      `maintenance-status-change:${maintenanceRequestId}`;

    return await this.syncPropertyStatus(propertyId, {
      ...options,
      triggeredBy,
    });
  }

  /**
   * Check if maintenance status change affects unit status
   */
  private maintenanceAffectsUnitStatus(
    oldStatus: string,
    newStatus: string
  ): boolean {
    // Define maintenance statuses that affect unit availability
    const statusesThatMakeUnitUnavailable = ["IN_PROGRESS", "ASSIGNED"];
    const statusesThatMakeUnitAvailable = ["COMPLETED", "CANCELLED"];

    const oldAffectsAvailability =
      statusesThatMakeUnitUnavailable.includes(oldStatus);
    const newAffectsAvailability =
      statusesThatMakeUnitUnavailable.includes(newStatus);
    const newMakesAvailable = statusesThatMakeUnitAvailable.includes(newStatus);

    // Return true if there's a change in unit availability
    return (
      oldAffectsAvailability !== newAffectsAvailability || newMakesAvailable
    );
  }

  /**
   * Validate property status consistency
   */
  async validatePropertyStatusConsistency(propertyId: string): Promise<{
    isConsistent: boolean;
    currentStatus: PropertyStatus;
    calculatedStatus: PropertyStatus;
    recommendation: string;
  }> {
    try {
      const { Property } = await import("@/models");

      const property = await Property.findById(propertyId);
      if (!property) {
        throw new Error(`Property not found: ${propertyId}`);
      }

      const currentStatus = property.status;
      const unitStatuses =
        property.units?.map((unit: any) => unit.status) || [];
      const calculatedStatus = calculatePropertyStatusFromUnits(unitStatuses);

      const isConsistent = currentStatus === calculatedStatus;

      return {
        isConsistent,
        currentStatus,
        calculatedStatus,
        recommendation: isConsistent
          ? "Property status is consistent with unit statuses"
          : `Property status should be updated from ${currentStatus} to ${calculatedStatus}`,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get synchronization statistics
   */
  async getSynchronizationStats(): Promise<{
    totalProperties: number;
    multiUnitProperties: number;
    inconsistentProperties: number;
    lastSyncTime: Date | null;
  }> {
    try {
      const { Property } = await import("@/models");

      const totalProperties = await Property.countDocuments({
        deletedAt: null,
      });
      const multiUnitProperties = await Property.countDocuments({
        isMultiUnit: true,
        deletedAt: null,
      });

      // Check for inconsistent properties
      const properties = await Property.find({
        isMultiUnit: true,
        deletedAt: null,
      });

      let inconsistentCount = 0;
      for (const property of properties) {
        const unitStatuses =
          property.units?.map((unit: any) => unit.status) || [];
        const calculatedStatus = calculatePropertyStatusFromUnits(unitStatuses);
        if (property.status !== calculatedStatus) {
          inconsistentCount++;
        }
      }

      return {
        totalProperties,
        multiUnitProperties,
        inconsistentProperties: inconsistentCount,
        lastSyncTime: new Date(), // In a real implementation, this would be stored
      };
    } catch (error) {
      throw error;
    }
  }
}

// Export singleton instance
export const propertyStatusSynchronizer =
  PropertyStatusSynchronizer.getInstance();

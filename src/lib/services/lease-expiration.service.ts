import Lease from "@/models/Lease";
import { LeaseStatus } from "@/types";

export const leaseExpirationService = {
  /**
   * Check for expired leases and update their status
   * This should be run by a daily cron job
   */
  checkAndExpireLeases: async () => {
    try {
      const now = new Date();
      // Set to beginning of today to catch anything that expired yesterday or earlier
      // Depending on how endDate is stored (if it includes time), this logic might need adjustment.
      // Assuming endDate is just the date or midnight.
      
      const expiredLeases = await Lease.find({
        status: LeaseStatus.ACTIVE,
        endDate: { $lt: now },
      });

      console.log(`Found ${expiredLeases.length} leases to expire.`);

      const results = {
        processed: 0,
        errors: 0,
        details: [] as any[],
      };

      for (const lease of expiredLeases) {
        try {
          // expire() method sets status to EXPIRED and saves
          // The post-save hook in Lease model will handle:
          // 1. Updating Unit status to AVAILABLE
          // 2. Cancelling pending payments
          await lease.updateOne({ status: LeaseStatus.EXPIRED });
          
          results.processed++;
          results.details.push({
            leaseId: lease._id,
            status: "success",
            message: "Lease expired successfully",
          });
        } catch (error: any) {
          console.error(`Error expiring lease ${lease._id}:`, error);
          results.errors++;
          results.details.push({
            leaseId: lease._id,
            status: "error",
            message: error.message,
          });
        }
      }

      return results;
    } catch (error) {
      console.error("Error in checkAndExpireLeases:", error);
      throw error;
    }
  },
};

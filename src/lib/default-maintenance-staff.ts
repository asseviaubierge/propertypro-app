import { User } from "@/models";
import { AccountType, UserRole } from "@/types";

export const E_IMMO_MAINTENANCE_EMAIL = "maintenance@e-immo.bj";
export const E_IMMO_MAINTENANCE_NAME = "E-IMMO";

/**
 * Returns the non-login system account that receives every new maintenance alert.
 * The account is created lazily, so no manual seed is required.
 */
export async function ensureDefaultMaintenanceStaff() {
  return User.findOneAndUpdate(
    { email: E_IMMO_MAINTENANCE_EMAIL },
    {
      $set: {
        firstName: E_IMMO_MAINTENANCE_NAME,
        lastName: "Staff",
        role: UserRole.MANAGER,
        accountType: AccountType.E_IMMO,
        businessName: "Gestion E-Immo",
        isActive: true,
        deletedAt: null,
        emailVerified: new Date(),
      },
      $setOnInsert: {
        bio: "Compte système chargé de recevoir les alertes de maintenance.",
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );
}

/**
 * PropertyPro - Tenant Utilities
 * Helper functions for working with tenant profiles across the application
 */

import type { HydratedDocument, PopulateOptions } from "mongoose";
import { Tenant, User } from "@/models";
import type { ITenant } from "@/types";

interface EnsureTenantProfileOptions {
  /**
   * When true, includes soft-deleted tenant profiles in the lookup. The helper
   * will automatically restore the profile by clearing `deletedAt`.
   */
  includeSoftDeleted?: boolean;
  /**
   * Populate configuration passed directly to Mongoose populate(). When set to
   * `true` the helper will populate the tenant's `userId` with common fields.
   */
  populate?: boolean | PopulateOptions | PopulateOptions[];
}

const DEFAULT_POPULATE: PopulateOptions = {
  path: "userId",
  select: "firstName lastName email phone",
};

/**
 * Finds (or lazily provisions) a tenant profile for the supplied user. This is
 * critical for brand new tenant accounts that have not completed onboarding yet
 * but still need a placeholder profile so the API can respond gracefully.
 */
export async function ensureTenantProfile(
  userId: string,
  options: EnsureTenantProfileOptions = {}
): Promise<HydratedDocument<ITenant> | null> {
  if (!userId) {
    return null;
  }

  const { includeSoftDeleted = false, populate } = options;

  let tenant = await Tenant.findOne({ userId });

  if (!tenant) {
    const user = await User.findById(userId).lean();

    if (!user) {
      return null;
    }

    const setOnInsert = {
      userId,
      applicationDate: user.createdAt ?? new Date(),
      backgroundCheckStatus: "pending" as ITenant["backgroundCheckStatus"],
      emergencyContacts: [],
      documents: [],
    } satisfies Partial<ITenant> & Record<string, unknown>;

    const updateOperators: Record<string, unknown> = {
      $setOnInsert: setOnInsert,
    };

    if (!includeSoftDeleted) {
      (updateOperators as any).$set = { deletedAt: null };
    }

    tenant = await Tenant.findOneAndUpdate({ userId }, updateOperators, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });
  }

  if (!tenant) {
    return null;
  }

  if (tenant.deletedAt && !includeSoftDeleted) {
    tenant.deletedAt = null;
    tenant = await tenant.save();
  }

  if (populate) {
    const populateConfig = populate === true ? DEFAULT_POPULATE : populate;
    await tenant.populate(populateConfig);
  }

  return tenant as HydratedDocument<ITenant>;
}

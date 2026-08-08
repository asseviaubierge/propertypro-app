import "server-only";

import { Types } from "mongoose";
import { Lease, Payment } from "@/models";
import Tenant from "@/models/Tenant";
import type { AuthenticatedAccessUser } from "@/lib/api-utils";
import { getScopedPropertyIds } from "@/lib/property-scope";

function validObjectId(value: unknown): value is string {
  return typeof value === "string" && Types.ObjectId.isValid(value);
}

/**
 * Determines whether the current user may target another user with an in-app
 * notification. Administrators may target anyone. Other staff may target only
 * themselves or tenants attached to one of their scoped properties.
 */
export async function canNotifyUser(
  user: AuthenticatedAccessUser,
  targetUserId: string,
): Promise<boolean> {
  if (!validObjectId(user.id) || !validObjectId(targetUserId)) return false;
  if (user.isAdmin) return true;
  if (user.id === targetUserId) return true;
  if (user.isTenant) return false;

  const propertyIds = await getScopedPropertyIds(user);
  if (!propertyIds || propertyIds.length === 0) return false;

  const targetIds = new Set<string>([targetUserId]);
  const tenantProfile = await Tenant.findOne({ userId: targetUserId })
    .select("_id userId")
    .lean();

  if (tenantProfile?._id) targetIds.add(String(tenantProfile._id));
  if (tenantProfile?.userId) targetIds.add(String(tenantProfile.userId));

  return Boolean(
    await Lease.exists({
      propertyId: { $in: propertyIds },
      tenantId: {
        $in: [...targetIds].flatMap((id) => [id, new Types.ObjectId(id)]),
      },
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    }),
  );
}

/**
 * Validates creation of a payment notification against the payment, tenant and
 * property scope. This prevents staff from creating reminders for unrelated
 * tenants or payments.
 */
export async function canCreatePaymentNotification(
  user: AuthenticatedAccessUser,
  paymentId: string,
  tenantId: string,
): Promise<boolean> {
  if (!validObjectId(paymentId) || !validObjectId(tenantId)) return false;
  if (user.isTenant) return false;

  const payment = await Payment.findById(paymentId)
    .select("propertyId tenantId")
    .lean();
  if (!payment) return false;

  const paymentTenantId = String((payment as any).tenantId ?? "");
  if (paymentTenantId !== tenantId) {
    const tenantProfile = await Tenant.findOne({
      $or: [{ _id: tenantId }, { userId: tenantId }],
    })
      .select("_id userId")
      .lean();

    const aliases = new Set([
      tenantId,
      tenantProfile?._id ? String(tenantProfile._id) : "",
      tenantProfile?.userId ? String(tenantProfile.userId) : "",
    ]);
    if (!aliases.has(paymentTenantId)) return false;
  }

  if (user.isAdmin) return true;
  const scopedPropertyIds = await getScopedPropertyIds(user);
  return Boolean(
    scopedPropertyIds?.some(
      (id) => id.toString() === String((payment as any).propertyId),
    ),
  );
}

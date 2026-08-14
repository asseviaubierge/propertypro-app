import { Types } from "mongoose";
import type { AuthenticatedAccessUser } from "@/lib/api-utils";
import { getScopedPropertyIds } from "@/lib/property-scope";

function objectId(value: unknown): Types.ObjectId | null {
  const text = String(value ?? "");
  return Types.ObjectId.isValid(text) ? new Types.ObjectId(text) : null;
}

/**
 * Périmètre unique utilisé par la liste, le calendrier et les analyses.
 * Le Super Admin voit tous les événements, le gestionnaire ceux de son
 * portefeuille et le locataire uniquement ceux auxquels il est rattaché.
 */
export async function buildCalendarScope(
  user: AuthenticatedAccessUser,
  tenantProfile?: { _id?: unknown } | null,
): Promise<Record<string, unknown>> {
  if (user.isAdmin) return {};

  const userObjectId = objectId(user.id);
  if (!userObjectId) return { _id: { $exists: false } };

  const involvement: Record<string, unknown>[] = [
    { organizer: userObjectId },
    { createdBy: userObjectId },
    { "attendees.userId": userObjectId },
  ];

  if (user.isTenant) {
    const tenantIds = [objectId(user.id), objectId(tenantProfile?._id)].filter(
      (value): value is Types.ObjectId => Boolean(value),
    );

    if (tenantIds.length > 0) {
      involvement.push({ tenantId: { $in: tenantIds } });
    }

    return { $or: involvement };
  }

  if (user.isManager) {
    const propertyIds = await getScopedPropertyIds(user);
    if (Array.isArray(propertyIds) && propertyIds.length > 0) {
      involvement.push({ propertyId: { $in: propertyIds } });
    }
  }

  return { $or: involvement };
}

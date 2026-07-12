import "server-only";

import { Types } from "mongoose";
import { Lease } from "@/models";
import type { AuthenticatedAccessUser } from "@/lib/api-utils";

type MongoFilter = Record<string, any>;

export function mergeInboxFilters(
  ...filters: Array<MongoFilter | null | undefined>
): MongoFilter {
  const compactFilters = filters.filter(Boolean) as MongoFilter[];

  if (compactFilters.length === 0) {
    return {};
  }

  if (compactFilters.length === 1) {
    return compactFilters[0];
  }

  return { $and: compactFilters };
}

function toObjectIdString(value: unknown): string | null {
  if (!value) {
    return null;
  }

  const stringValue =
    typeof value === "string"
      ? value
      : value instanceof Types.ObjectId
        ? value.toString()
        : typeof (value as { toString?: () => string }).toString === "function"
          ? (value as { toString: () => string }).toString()
          : null;

  return stringValue && Types.ObjectId.isValid(stringValue)
    ? stringValue
    : null;
}

export function getTenantIdentityIds(
  user: AuthenticatedAccessUser,
  tenantProfile?: any
): Types.ObjectId[] {
  const ids = [user.id, tenantProfile?._id, tenantProfile?.userId]
    .map(toObjectIdString)
    .filter((id): id is string => Boolean(id));

  return [...new Set(ids)].map((id) => new Types.ObjectId(id));
}

export function tenantOwnsRecord(
  tenantValue: unknown,
  tenantIds: Types.ObjectId[]
): boolean {
  const recordTenantId = toObjectIdString(tenantValue);

  if (!recordTenantId) {
    return false;
  }

  return tenantIds.some((tenantId) => tenantId.toString() === recordTenantId);
}

export function buildTenantTicketFilter(
  user: AuthenticatedAccessUser,
  tenantProfile?: any
): MongoFilter {
  const tenantIds = getTenantIdentityIds(user, tenantProfile);

  if (tenantIds.length === 0) {
    return { _id: { $exists: false } };
  }

  return { tenantId: { $in: tenantIds } };
}

function activeAnnouncementFilter(now = new Date()): MongoFilter {
  return {
    status: "published",
    $and: [
      {
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: now } },
        ],
      },
      {
        $or: [
          { scheduledFor: { $exists: false } },
          { scheduledFor: null },
          { scheduledFor: { $lte: now } },
        ],
      },
    ],
  };
}

async function getTenantPropertyIds(tenantIds: Types.ObjectId[]) {
  if (tenantIds.length === 0) {
    return [];
  }

  const leases = await Lease.find({
    tenantId: { $in: tenantIds },
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  })
    .select("propertyId")
    .lean();

  return [
    ...new Set(
      leases
        .map((lease: any) => toObjectIdString(lease.propertyId))
        .filter((id): id is string => Boolean(id))
    ),
  ].map((id) => new Types.ObjectId(id));
}

export async function buildAnnouncementVisibilityFilter(
  user: AuthenticatedAccessUser,
  tenantProfile?: any,
  options: { activeOnly?: boolean } = {}
): Promise<MongoFilter> {
  const { activeOnly = true } = options;
  const clauses: MongoFilter[] = [{ deletedAt: null }];

  if (activeOnly) {
    clauses.push(activeAnnouncementFilter());
  }

  if (!user.isCompanyStaff) {
    const userId = Types.ObjectId.isValid(user.id)
      ? new Types.ObjectId(user.id)
      : null;
    const tenantIds = getTenantIdentityIds(user, tenantProfile);
    const propertyIds = await getTenantPropertyIds(tenantIds);
    const roleValues = [
      user.role,
      user.originalRole,
      user.normalizedRole,
      user.systemRole,
    ].filter(Boolean);

    const audienceClauses: MongoFilter[] = [
      { "targetAudience.includeAll": true },
    ];

    if (roleValues.length > 0) {
      audienceClauses.push({ "targetAudience.roles": { $in: roleValues } });
    }

    if (userId) {
      audienceClauses.push({ "targetAudience.userIds": userId });
    }

    if (tenantIds.length > 0) {
      audienceClauses.push({ "targetAudience.tenantIds": { $in: tenantIds } });
    }

    if (propertyIds.length > 0) {
      audienceClauses.push({
        "targetAudience.propertyIds": { $in: propertyIds },
      });
    }

    clauses.push({ $or: audienceClauses });
  }

  return mergeInboxFilters(...clauses);
}

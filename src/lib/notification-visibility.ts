import "server-only";

import { Types } from "mongoose";
import { Lease, MaintenanceRequest, Payment } from "@/models";
import type { AuthenticatedAccessUser } from "@/lib/api-utils";

const STAFF_NOTIFICATION_MARKERS = [
  "admin",
  "admins",
  "manager",
  "managers",
  "staff",
  "landlord",
  "owner",
  "owners",
];

const TENANT_ACCOUNT_NOTIFICATION_TYPES = [
  "welcome",
  "account_activation",
  "password_reset",
];

type MongoFilter = Record<string, any>;

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

  if (!stringValue || !Types.ObjectId.isValid(stringValue)) {
    return null;
  }

  return stringValue;
}

function addObjectId(values: Set<string>, value: unknown): void {
  const objectId = toObjectIdString(value);
  if (objectId) {
    values.add(objectId);
  }
}

function asMongoIdValues(
  values: Iterable<string>
): Array<string | Types.ObjectId> {
  const normalized = [...new Set(values)].filter((value) =>
    Types.ObjectId.isValid(value)
  );

  return normalized.flatMap((value) => [value, new Types.ObjectId(value)]);
}

function inFilter(
  field: string,
  values: Array<string | Types.ObjectId>
): MongoFilter | null {
  if (values.length === 0) {
    return null;
  }

  return { [field]: { $in: values } };
}

function andFilters(
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

function activeRecordFilter(): MongoFilter {
  return {
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };
}

export function mergeNotificationFilters(
  ...filters: Array<MongoFilter | null | undefined>
): MongoFilter {
  return andFilters(...filters);
}

export async function buildNotificationVisibilityFilter(
  user: AuthenticatedAccessUser,
  tenantProfile?: any
): Promise<MongoFilter> {
  if (!Types.ObjectId.isValid(user.id)) {
    return { _id: { $exists: false } };
  }

  const userObjectId = new Types.ObjectId(user.id);
  const recipientFilter = { userId: userObjectId };

  if (!user.isTenant) {
    return recipientFilter;
  }

  const tenantIds = new Set<string>();
  addObjectId(tenantIds, user.id);
  addObjectId(tenantIds, tenantProfile?._id);
  addObjectId(tenantIds, tenantProfile?.userId);

  const tenantMongoIds = asMongoIdValues(tenantIds);

  const [leases, payments, maintenanceRequests] = await Promise.all([
    Lease.find({
      tenantId: { $in: tenantMongoIds },
      ...activeRecordFilter(),
    })
      .select("_id")
      .lean(),
    Payment.find({
      tenantId: { $in: tenantMongoIds },
      ...activeRecordFilter(),
    })
      .select("_id leaseId invoiceId")
      .lean(),
    MaintenanceRequest.find({
      tenantId: { $in: tenantMongoIds },
      ...activeRecordFilter(),
    })
      .select("_id")
      .lean(),
  ]);

  const leaseIds = new Set<string>();
  const paymentIds = new Set<string>();
  const invoiceIds = new Set<string>();
  const maintenanceRequestIds = new Set<string>();

  leases.forEach((lease: any) => {
    addObjectId(leaseIds, lease._id);
  });

  payments.forEach((payment: any) => {
    addObjectId(paymentIds, payment._id);
    addObjectId(leaseIds, payment.leaseId);
    addObjectId(invoiceIds, payment.invoiceId);
  });

  maintenanceRequests.forEach((request: any) => {
    addObjectId(maintenanceRequestIds, request._id);
  });

  const relatedClauses = [
    inFilter("metadata.tenantId", tenantMongoIds),
    inFilter("metadata.leaseId", asMongoIdValues(leaseIds)),
    inFilter("metadata.paymentId", asMongoIdValues(paymentIds)),
    inFilter("metadata.invoiceId", asMongoIdValues(invoiceIds)),
    inFilter(
      "metadata.maintenanceRequestId",
      asMongoIdValues(maintenanceRequestIds)
    ),
    inFilter("metadata.requestId", asMongoIdValues(maintenanceRequestIds)),
    { type: { $in: TENANT_ACCOUNT_NOTIFICATION_TYPES } },
  ].filter(Boolean) as MongoFilter[];

  return andFilters(
    recipientFilter,
    { "metadata.isLandlord": { $ne: true } },
    { "metadata.audience": { $nin: STAFF_NOTIFICATION_MARKERS } },
    { "metadata.recipientRole": { $nin: STAFF_NOTIFICATION_MARKERS } },
    relatedClauses.length > 0
      ? { $or: relatedClauses }
      : { _id: { $exists: false } }
  );
}

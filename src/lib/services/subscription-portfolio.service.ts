import Property from "@/models/Property";
import Lease from "@/models/Lease";
import User from "@/models/User";
import SubscriptionContract from "@/models/SubscriptionContract";
import ContractPortfolioEvent from "@/models/ContractPortfolioEvent";
import { LeaseStatus } from "@/types";

export async function calculatePortfolioSnapshot(accountId: string) {
  const properties = await Property.find({
    deletedAt: null,
    $or: [{ ownerId: accountId }, { managerId: accountId }],
  })
    .select("_id units totalUnits status ownerId managerId")
    .lean();

  const propertyIds = properties.map((p: any) => p._id);

  // Les propriétés historiques à logement unique peuvent ne pas encore avoir
  // d'entrée dans units[]. Elles comptent néanmoins pour une unité réelle.
  const normalizedUnits = properties.flatMap((property: any) => {
    const embeddedUnits = Array.isArray(property.units) ? property.units : [];
    if (embeddedUnits.length > 0) {
      return embeddedUnits.map((unit: any) => ({
        ...unit,
        propertyId: property._id,
        status: String(unit.status || "available").toLowerCase(),
      }));
    }

    const count = Math.max(Number(property.totalUnits || 1), 1);
    const propertyStatus = String(property.status || "available").toLowerCase();
    return Array.from({ length: count }, (_, index) => ({
      _id: `legacy-${String(property._id)}-${index + 1}`,
      propertyId: property._id,
      status: propertyStatus,
      legacy: true,
    }));
  });

  const occupiedStatuses = new Set(["occupied", "occupé", "occupe"]);
  const vacantStatuses = new Set([
    "available",
    "vacant",
    "libre",
    "disponible",
  ]);

  const occupiedUnitCount = normalizedUnits.filter((unit: any) =>
    occupiedStatuses.has(String(unit.status).toLowerCase())
  ).length;

  const vacantUnitCount = normalizedUnits.filter((unit: any) =>
    vacantStatuses.has(String(unit.status).toLowerCase())
  ).length;

  const leases = propertyIds.length
    ? await Lease.find({
        propertyId: { $in: propertyIds },
        deletedAt: null,
      })
        .select("_id propertyId unitId tenantId status startDate endDate")
        .lean()
    : [];

  const activeLeases = leases.filter(
    (lease: any) => String(lease.status) === LeaseStatus.ACTIVE
  );
  const terminatedLeases = leases.filter(
    (lease: any) => String(lease.status) === LeaseStatus.TERMINATED
  );
  const expiredLeases = leases.filter(
    (lease: any) => String(lease.status) === LeaseStatus.EXPIRED
  );

  // Un Manager peut avoir créé/approuvé des locataires avant leur premier bail.
  // Ils doivent apparaître dans le tableau Abonnements comme dans son dashboard.
  const directTenantIds = await User.distinct("_id", {
    role: "tenant",
    deletedAt: null,
    tenantStatus: { $in: ["approved", "active"] },
    $or: [{ managerId: accountId }, { createdBy: accountId }],
  });

  const leasedTenantIds = activeLeases
    .map((lease: any) => lease.tenantId)
    .filter(Boolean);

  const activeTenantIds = new Set(
    [...directTenantIds, ...leasedTenantIds].map((id: any) => String(id))
  );

  // Vérifications uniquement pour les unités qui possèdent un vrai _id MongoDB.
  const activeLeaseKeys = new Set(
    activeLeases.map(
      (lease: any) => `${String(lease.propertyId)}:${String(lease.unitId)}`
    )
  );

  const occupiedUnitKeys = new Set(
    normalizedUnits
      .filter(
        (unit: any) =>
          !unit.legacy &&
          occupiedStatuses.has(String(unit.status).toLowerCase())
      )
      .map((unit: any) => `${String(unit.propertyId)}:${String(unit._id)}`)
  );

  const anomalies: string[] = [];

  for (const key of occupiedUnitKeys) {
    if (!activeLeaseKeys.has(key)) {
      anomalies.push("Une unité est marquée occupée sans bail actif.");
    }
  }
  for (const key of activeLeaseKeys) {
    if (!occupiedUnitKeys.has(key) && !String(key).endsWith(":undefined")) {
      anomalies.push("Un bail actif existe sur une unité non marquée occupée.");
    }
  }

  const snapshot = {
    propertyCount: properties.length,
    unitCount: normalizedUnits.length,
    occupiedUnitCount,
    vacantUnitCount,
    activeTenantCount: activeTenantIds.size,
    activeLeaseCount: activeLeases.length,
    terminatedLeaseCount: terminatedLeases.length,
    expiredLeaseCount: expiredLeases.length,
    lastSyncAt: new Date(),
  };

  return { snapshot, anomalies };
}

export async function syncContractPortfolio(contractId: string) {
  const contract = await SubscriptionContract.findById(contractId);
  if (!contract) return null;
  const { snapshot, anomalies } = await calculatePortfolioSnapshot(String(contract.accountId));
  contract.portfolioSnapshot = snapshot;
  await contract.save();

  const limitWarnings: string[] = [];
  if (snapshot.propertyCount > Number(contract.maxProperties || 0)) {
    limitWarnings.push(`${snapshot.propertyCount} propriétés utilisées pour ${contract.maxProperties} autorisées.`);
  }
  if (snapshot.unitCount > Number(contract.maxUnits || 0)) {
    limitWarnings.push(`${snapshot.unitCount} unités utilisées pour ${contract.maxUnits} autorisées.`);
  }
  if (snapshot.activeTenantCount > Number(contract.maxActiveTenants || 0)) {
    limitWarnings.push(`${snapshot.activeTenantCount} locataires actifs pour ${contract.maxActiveTenants} autorisés.`);
  }

  return { contract, snapshot, anomalies, limitWarnings };
}

export async function getRecentContractEvents(contractId: string) {
  return ContractPortfolioEvent.find({ contractId }).sort({ occurredAt: -1 }).limit(30).lean();
}

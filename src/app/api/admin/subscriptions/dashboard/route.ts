import {
  createSuccessResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";
import User from "@/models/User";
import SubscriptionContract from "@/models/SubscriptionContract";
import ContractPortfolioEvent from "@/models/ContractPortfolioEvent";
import { calculatePortfolioSnapshot } from "@/lib/services/subscription-portfolio.service";

function displayName(user: any) {
  const personal = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
  return user?.businessName || personal || user?.email || "Compte";
}

function contractTypeLabel(type?: string) {
  switch (type) {
    case "scale":
      return "Forfait Barème E-IMMO";
    case "negotiated":
      return "Forfait personnalisé";
    case "management":
      return "Mandat de gestion E-IMMO";
    case "guaranteed_management":
      return "Mandat avec revenu garanti";
    default:
      return "Sans contrat";
  }
}

export const GET = withPermissionAndDB("system_settings")(async () => {
  try {
    const now = new Date();
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);

    // Les souscripteurs E-IMMO sont les comptes Manager : propriétaire direct,
    // agence ou gestionnaire. Les locataires ne souscrivent pas au forfait de gestion.
    const accounts = await User.find({
      role: "manager",
      isActive: { $ne: false },
    })
      .select(
        "firstName lastName email phone role accountType businessName isActive createdAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    const contracts = await SubscriptionContract.find({})
      .sort({ updatedAt: -1 })
      .lean();

    const contractsByAccount = new Map<string, any[]>();
    for (const contract of contracts) {
      const key = String(contract.accountId);
      const list = contractsByAccount.get(key) || [];
      list.push(contract);
      contractsByAccount.set(key, list);
    }

    // Toujours calculer les compteurs depuis les données réelles du compte.
    // Cela évite les zéros pour un Manager sans contrat ou avec un snapshot ancien.
    const livePortfolioEntries = await Promise.all(
      accounts.map(async (account: any) => {
        const result = await calculatePortfolioSnapshot(String(account._id));
        return [String(account._id), result.snapshot] as const;
      })
    );
    const livePortfolioByAccount = new Map(livePortfolioEntries);

    const subscribers = accounts.map((account: any) => {
      const accountContracts = contractsByAccount.get(String(account._id)) || [];
      const latestContract = accountContracts[0] || null;
      const activeContract =
        accountContracts.find((c: any) => c.status === "active") || null;
      const referenceContract = activeContract || latestContract;

      let subscriptionState = "prospect";
      if (referenceContract?.status) subscriptionState = referenceContract.status;

      const snapshot = livePortfolioByAccount.get(String(account._id)) || {};
      const capacityWarnings: string[] = [];

      if (
        referenceContract &&
        Number(referenceContract.maxProperties || 0) > 0 &&
        Number(snapshot.propertyCount || 0) > Number(referenceContract.maxProperties)
      ) {
        capacityWarnings.push("Limite de propriétés dépassée");
      }
      if (
        referenceContract &&
        Number(referenceContract.maxUnits || 0) > 0 &&
        Number(snapshot.unitCount || 0) > Number(referenceContract.maxUnits)
      ) {
        capacityWarnings.push("Limite d'unités dépassée");
      }
      if (
        referenceContract &&
        Number(referenceContract.maxActiveTenants || 0) > 0 &&
        Number(snapshot.activeTenantCount || 0) >
          Number(referenceContract.maxActiveTenants)
      ) {
        capacityWarnings.push("Limite de locataires actifs dépassée");
      }

      return {
        account: {
          _id: account._id,
          name: displayName(account),
          firstName: account.firstName,
          lastName: account.lastName,
          businessName: account.businessName,
          email: account.email,
          phone: account.phone,
          accountType: account.accountType,
          role: account.role,
          createdAt: account.createdAt,
        },
        subscriptionState,
        contract: referenceContract
          ? {
              _id: referenceContract._id,
              contractNumber: referenceContract.contractNumber,
              contractType: referenceContract.contractType,
              contractTypeLabel: contractTypeLabel(referenceContract.contractType),
              status: referenceContract.status,
              tierLabel: referenceContract.tierLabel,
              billingPeriod: referenceContract.billingPeriod,
              fixedAmount: referenceContract.fixedAmount,
              percentageRate: referenceContract.percentageRate,
              startDate: referenceContract.startDate,
              endDate: referenceContract.endDate,
              ownerPayoutDay:
                referenceContract.mandateRules?.ownerPayoutDay || null,
              updatedAt: referenceContract.updatedAt,
            }
          : null,
        portfolio: snapshot,
        capacityWarnings,
      };
    });

    const activeContracts = contracts.filter((c: any) => c.status === "active");
    const draftContracts = contracts.filter((c: any) => c.status === "draft");
    const suspendedContracts = contracts.filter(
      (c: any) => c.status === "suspended"
    );
    const expiredContracts = contracts.filter((c: any) => c.status === "expired");
    const managementContracts = activeContracts.filter((c: any) =>
      ["management", "guaranteed_management"].includes(c.contractType)
    );
    const guaranteedContracts = activeContracts.filter(
      (c: any) => c.contractType === "guaranteed_management"
    );
    const expiringSoon = contracts.filter((c: any) => {
      if (!c.endDate || !["active", "draft"].includes(c.status)) return false;
      const end = new Date(c.endDate);
      return end >= now && end <= in30Days;
    });

    const capacityAlertCount = subscribers.filter(
      (s: any) => s.capacityWarnings.length > 0
    ).length;

    const prospects = subscribers.filter(
      (s: any) => s.subscriptionState === "prospect"
    ).length;

    const recentPortfolioEvents = await ContractPortfolioEvent.find({})
      .sort({ occurredAt: -1 })
      .limit(40)
      .lean();

    const accountNameById = new Map(
      accounts.map((a: any) => [String(a._id), displayName(a)])
    );

    const contractActivities = contracts.slice(0, 25).map((c: any) => ({
      id: `contract-${String(c._id)}`,
      kind: "contract",
      type: c.status === "draft" ? "contract_draft" : "contract_updated",
      title:
        c.status === "draft"
          ? "Contrat en brouillon"
          : "Contrat / mandat mis à jour",
      message: `${c.contractNumber} — ${contractTypeLabel(c.contractType)} — ${
        accountNameById.get(String(c.accountId)) || "Compte"
      }`,
      occurredAt: c.updatedAt || c.createdAt,
      contractId: c._id,
      accountId: c.accountId,
    }));

    const portfolioActivities = recentPortfolioEvents.map((e: any) => ({
      id: `portfolio-${String(e._id)}`,
      kind: "portfolio",
      type: e.type,
      title:
        e.type === "lease_activated"
          ? "Bail activé"
          : e.type === "lease_terminated"
            ? "Bail résilié"
            : e.type === "lease_expired"
              ? "Bail expiré"
              : e.type === "lease_renewed"
                ? "Bail renouvelé"
                : "Activité du portefeuille",
      message: e.message,
      occurredAt: e.occurredAt || e.createdAt,
      contractId: e.contractId,
      accountId: e.accountId,
      leaseId: e.leaseId,
      propertyId: e.propertyId,
    }));

    const activities = [...contractActivities, ...portfolioActivities]
      .sort(
        (a: any, b: any) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      )
      .slice(0, 40);

    const upcomingPayouts = managementContracts
      .filter((c: any) => Number(c.mandateRules?.ownerPayoutDay || 0) > 0)
      .map((c: any) => ({
        contractId: c._id,
        contractNumber: c.contractNumber,
        accountId: c.accountId,
        accountName: accountNameById.get(String(c.accountId)) || "Compte",
        day: Number(c.mandateRules?.ownerPayoutDay),
        payoutRule: c.mandateRules?.payoutRule || "collected",
        contractType: c.contractType,
      }))
      .sort((a: any, b: any) => a.day - b.day);

    return createSuccessResponse({
      stats: {
        eligibleAccounts: accounts.length,
        prospects,
        active: activeContracts.length,
        drafts: draftContracts.length,
        suspended: suspendedContracts.length,
        expired: expiredContracts.length,
        expiringSoon: expiringSoon.length,
        managementMandates: managementContracts.length,
        guaranteedMandates: guaranteedContracts.length,
        capacityAlerts: capacityAlertCount,
      },
      subscribers,
      expiringSoon: expiringSoon.map((c: any) => ({
        _id: c._id,
        contractNumber: c.contractNumber,
        accountId: c.accountId,
        accountName: accountNameById.get(String(c.accountId)) || "Compte",
        contractType: c.contractType,
        endDate: c.endDate,
      })),
      upcomingPayouts,
      activities,
    });
  } catch (error) {
    return handleApiError(
      error,
      "Impossible de charger le tableau de bord Abonnements & Mandats"
    );
  }
});

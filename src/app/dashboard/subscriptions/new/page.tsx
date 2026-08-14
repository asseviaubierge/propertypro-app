"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ContractSafeguardsEditor from "@/components/subscriptions/ContractSafeguardsEditor";
import { buildSubscriptionContractText } from "@/lib/subscriptions/contract-template";

type Account = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  businessName?: string;
  phone?: string;
};

type Contract = any;
type PortfolioSnapshot = {
  propertyCount: number;
  unitCount: number;
  occupiedUnitCount: number;
  vacantUnitCount: number;
  activeTenantCount: number;
  activeLeaseCount: number;
  terminatedLeaseCount: number;
  expiredLeaseCount: number;
};

const unwrap = (j: any) => j?.data ?? j ?? [];
const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const YEARS = Array.from({ length: 16 }, (_, i) => new Date().getFullYear() + i);
const TIERS = [
  "1–3 ménages","4–6 ménages","7–10 ménages","11–15 ménages",
  "16–20 ménages","21–30 ménages","31–40 ménages","41–50 ménages","Plus de 50 ménages"
];

function isoFromParts(day: string | number, month: string | number, year: string | number) {
  if (!day || month === "" || !year) return "";
  const d = new Date(Number(year), Number(month), Number(day), 12, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function partsFromIso(v: string) {
  const d = v ? new Date(`${v}T12:00:00`) : new Date();
  return { day: String(d.getDate()), month: String(d.getMonth()), year: String(d.getFullYear()) };
}

function accountDisplayName(account?: Account) {
  if (!account) return "Compte à sélectionner";
  const personal = `${account.firstName || ""} ${account.lastName || ""}`.trim();
  return account.businessName || personal || account.email;
}

export default function SubscriptionsAdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [saving, setSaving] = useState(false);
  const [contractEdited, setContractEdited] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [portfolioAnomalies, setPortfolioAnomalies] = useState<string[]>([]);

  const [form, setForm] = useState<any>({
    accountId: "",
    contractType: "scale",
    pricingMode: "fixed",
    maxProperties: 1,
    maxUnits: 3,
    maxActiveTenants: 3,
    tierLabel: "1–3 ménages",
    fixedAmount: 0,
    percentageRate: 0,
    minimumAmount: 0,
    billingPeriod: "monthly",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    renewalMode: "manual",
    status: "draft",
    mandateRules: {
      ownerPayoutDay: 15,
      payoutRule: "collected",
      payoutNotes: "",
      manageLeases: false,
      manageCollections: false,
      manageMaintenance: false,
      manageInspections: false,
      tenantReplacementAuthority: "owner_approval",
      expenseApprovalThreshold: 0,
      ownerFullTransparency: true,
      ownerCanViewOccupantContacts: true,
      advanceManagementEnabled: true,
      advancePolicy: "Les avances sur loyer sont enregistrées séparément puis affectées aux échéances concernées.",
      depositPolicy: "Les cautions et dépôts sont suivis séparément des loyers.",
      vacancyManagementEnabled: true,
      vacancyCoverageEnabled: false,
      vacancyCoverageDays: 0,
      vacancyCoverageCap: 0,
      guaranteedIncomeEnabled: false,
      guaranteedIncomeAmount: 0,
      guaranteedIncomeRate: 0,
      guaranteeMaxUnpaidMonths: 0,
      guaranteeAnnualCap: 0,
      leaseSyncEnabled: true,
      notifyOnLeaseActivation: true,
      notifyOnLeaseTermination: true,
      notifyOnLeaseExpiration: true
    },
    safeguards: {
      manualPaymentRegister: true,
      manualOwnerPayoutRegister: true,
      independentEvidenceArchive: true,
      independentBackups: true,
      backupFrequency: "Quotidienne + sauvegardes périodiques",
      outageReconciliation: true,
      immutableAuditTrail: true,
      incidentNotification: true,
      financialInstructionVerification: true,
      employeeFraudControls: true,
      professionalLiabilityInsurance: false,
      propertyInsuranceRequired: true,
      tenantLiabilityInsuranceRecommended: true,
      cyberInsurance: false,
      thirdPartyFundsProtection: false,
      guaranteeReserveRequired: true,
      guaranteeReserveAmount: 0,
      forceMajeureNotes: "",
    },
    onboardingChecklist: {
      ownerIdentityVerified: false, ownershipDocumentsVerified: false, existingOccupantsDeclared: false,
      existingLeasesCollected: false, priorArrearsDeclared: false, depositsAdvancesDeclared: false,
      propertyConditionRecorded: false, knownDisputesDeclared: false, payoutCoordinatesVerified: false,
    },
    offboardingChecklist: {
      closureStatementRequired: true, finalFinancialStatement: true, depositsTransferred: true,
      documentsDelivered: true, activeLeasesTransferred: true, openDisputesRecorded: true,
    },
    complianceRules: {
      identityVerification: true, dataUseNoticeAccepted: true, occupantContactUseRestricted: true,
      accountSecurityAcknowledged: true, collectionAuthorization: true, legalProceedingsNeedApproval: true,
      taxResponsibilityAcknowledged: true, deathSuccessionProcedure: true, propertySaleProcedure: true,
    },
    conditions: "",
    specialClauses: "",
    contractBody: "",
  });

  const initialStart = partsFromIso(form.startDate);
  const [startParts, setStartParts] = useState(initialStart);
  const [endParts, setEndParts] = useState({ day: "", month: "", year: "" });

  const load = async () => {
    const [a, c] = await Promise.all([
      fetch("/api/admin/subscriptions/accounts").then((r) => r.json()),
      fetch("/api/admin/subscriptions/contracts").then((r) => r.json()),
    ]);
    setAccounts(unwrap(a));
    setContracts(unwrap(c));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const accountId = searchParams.get("accountId");
    if (!accountId) return;
    setContractEdited(false);
    setForm((current: any) => ({ ...current, accountId }));
  }, [searchParams]);

  useEffect(() => {
    if (!form.accountId) {
      setPortfolio(null);
      setPortfolioAnomalies([]);
      return;
    }
    fetch(`/api/admin/subscriptions/portfolio/${form.accountId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        const data = unwrap(payload);
        setPortfolio(data?.snapshot || null);
        setPortfolioAnomalies(data?.anomalies || []);
      })
      .catch(() => {
        setPortfolio(null);
        setPortfolioAnomalies([]);
      });
  }, [form.accountId]);

  const selected = useMemo(
    () => accounts.find((a) => a._id === form.accountId),
    [accounts, form.accountId]
  );

  const selectedName = accountDisplayName(selected);
  const isMandate =
    form.contractType === "management" ||
    form.contractType === "guaranteed_management";

  const typeLabel =
    form.contractType === "scale"
      ? "Forfait Barème E-IMMO"
      : form.contractType === "negotiated"
        ? "Forfait personnalisé E-IMMO"
        : form.contractType === "management"
          ? "Mandat de gestion E-IMMO"
          : "Mandat de gestion E-IMMO avec revenu garanti";

  const setMandateRule = (key: string, value: any) => {
    setContractEdited(false);
    setForm((current: any) => ({
      ...current,
      mandateRules: { ...current.mandateRules, [key]: value },
    }));
  };

  const pricingText =
    form.pricingMode === "fixed"
      ? `${Number(form.fixedAmount || 0).toLocaleString("fr-FR")} FCFA / ${form.billingPeriod === "monthly" ? "mois" : "an"}`
      : form.pricingMode === "percentage"
        ? `${Number(form.percentageRate || 0)} % des encaissements confirmés${Number(form.minimumAmount || 0) > 0 ? `, avec un minimum de ${Number(form.minimumAmount).toLocaleString("fr-FR")} FCFA` : ""}`
        : `${Number(form.fixedAmount || 0).toLocaleString("fr-FR")} FCFA + ${Number(form.percentageRate || 0)} % des encaissements confirmés${Number(form.minimumAmount || 0) > 0 ? `, avec un minimum de ${Number(form.minimumAmount).toLocaleString("fr-FR")} FCFA` : ""}`;

  const periodText = `${startParts.day} ${MONTHS[Number(startParts.month)]} ${startParts.year}${
    endParts.day && endParts.month !== "" && endParts.year
      ? ` au ${endParts.day} ${MONTHS[Number(endParts.month)]} ${endParts.year}`
      : " — sans date de fin définie"
  }`;

  const generatedContract = useMemo(() =>
    buildSubscriptionContractText({
      form,
      account: selected,
      accountName: selectedName,
      portfolio,
      periodText,
    }),
    [form, selected, selectedName, portfolio, periodText]
  );

  useEffect(() => {
    if (!contractEdited) {
      setForm((current: any) => ({ ...current, contractBody: generatedContract }));
    }
  }, [generatedContract, contractEdited]);

  async function createContract(e: any) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch("/api/admin/subscriptions/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          fixedAmount: Number(form.fixedAmount || 0),
          percentageRate: Number(form.percentageRate || 0),
          minimumAmount: Number(form.minimumAmount || 0),
          maxProperties: Number(form.maxProperties || 0),
          maxUnits: Number(form.maxUnits || 0),
          maxActiveTenants: Number(form.maxActiveTenants || 0),
          mandateRules: {
            ...form.mandateRules,
            ownerPayoutDay: Number(form.mandateRules.ownerPayoutDay || 1),
            expenseApprovalThreshold: Number(form.mandateRules.expenseApprovalThreshold || 0),
            vacancyCoverageDays: Number(form.mandateRules.vacancyCoverageDays || 0),
            vacancyCoverageCap: Number(form.mandateRules.vacancyCoverageCap || 0),
            guaranteedIncomeAmount: Number(form.mandateRules.guaranteedIncomeAmount || 0),
            guaranteedIncomeRate: Number(form.mandateRules.guaranteedIncomeRate || 0),
            guaranteeMaxUnpaidMonths: Number(form.mandateRules.guaranteeMaxUnpaidMonths || 0),
            guaranteeAnnualCap: Number(form.mandateRules.guaranteeAnnualCap || 0),
          },
          startDate: isoFromParts(startParts.day, startParts.month, startParts.year),
          endDate:
            endParts.day && endParts.month !== "" && endParts.year
              ? isoFromParts(endParts.day, endParts.month, endParts.year)
              : null,
        }),
      });

      const payload = await r.json();
      if (!r.ok) throw new Error(payload?.error || "Création impossible");

      const created = unwrap(payload);
      await load();
      if (created?._id) router.push(`/dashboard/admin/subscriptions/${created._id}`);
      else alert("Contrat créé.");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-7xl overflow-x-hidden p-3 text-slate-950 sm:p-4 md:p-8">
      <div className="mb-5 min-w-0 md:mb-7">
        <p className="text-xs font-semibold text-red-600 sm:text-sm">E-IMMO • Administration</p>
        <h1 className="break-words text-2xl font-bold leading-tight sm:text-3xl">Nouveau contrat / mandat E-IMMO</h1>
        <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600 sm:text-base">
          Créez un contrat modifiable entre E-IMMO et un Gestionnaire, Propriétaire ou une Agence.
        </p>
      </div>

      <form onSubmit={createContract} className="min-w-0 space-y-4 sm:space-y-6">
        <section className="min-w-0 overflow-hidden rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-bold sm:text-xl">1. Compte contractant</h2>
          <select
            required
            className="mt-4 h-11 w-full min-w-0 max-w-full truncate rounded-md border px-3 text-sm"
            value={form.accountId}
            onChange={(e) => {
              setContractEdited(false);
              setForm({ ...form, accountId: e.target.value });
            }}
          >
            <option value="">Sélectionner un compte...</option>
            {accounts.map((a) => (
              <option key={a._id} value={a._id}>
                {accountDisplayName(a)}
              </option>
            ))}
          </select>

          {selected && (
            <div className="mt-3 min-w-0 rounded-xl bg-slate-50 p-3 text-sm">
              <p className="break-words font-semibold">{selectedName}</p>
              <p className="break-all text-slate-600">{selected.email}</p>
              <p className="text-slate-500">{selected.role}</p>
            </div>
          )}
        </section>

        {selected && (
          <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-bold sm:text-xl">État réel synchronisé</h2>
            <p className="mt-1 text-xs text-slate-500">Ces données viennent automatiquement des propriétés et baux. Elles ne remplacent pas les limites du contrat.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["Propriétés", portfolio?.propertyCount ?? 0],
                ["Unités", portfolio?.unitCount ?? 0],
                ["Occupées", portfolio?.occupiedUnitCount ?? 0],
                ["Vacantes", portfolio?.vacantUnitCount ?? 0],
                ["Locataires actifs", portfolio?.activeTenantCount ?? 0],
                ["Baux actifs", portfolio?.activeLeaseCount ?? 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-xl font-bold">{value}</p>
                </div>
              ))}
            </div>
            {!!portfolioAnomalies.length && (
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                {portfolioAnomalies.map((a, i) => <p key={i}>⚠ {a}</p>)}
              </div>
            )}
          </section>
        )}

        <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-bold sm:text-xl">2. Type de contrat</h2>
          <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
            <label className="min-w-0 rounded-xl bg-slate-50 p-4">
              <div className="flex items-start gap-2">
                <input
                  className="mt-1 shrink-0"
                  type="radio"
                  checked={form.contractType === "scale"}
                  onChange={() => {
                    setContractEdited(false);
                    setForm({ ...form, contractType: "scale" });
                  }}
                />
                <div className="min-w-0">
                  <b className="break-words">Barème E-IMMO</b>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    Tarif défini par E-IMMO selon la tranche de ménages du portefeuille.
                  </p>
                </div>
              </div>
            </label>

            <label className="min-w-0 rounded-xl bg-slate-50 p-4">
              <div className="flex items-start gap-2">
                <input
                  className="mt-1 shrink-0"
                  type="radio"
                  checked={form.contractType === "negotiated"}
                  onChange={() => {
                    setContractEdited(false);
                    setForm({ ...form, contractType: "negotiated" });
                  }}
                />
                <div className="min-w-0">
                  <b className="break-words">Contrat personnalisé</b>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    Prix et conditions négociés librement entre E-IMMO et le compte.
                  </p>
                </div>
              </div>
            </label>

            <label className="min-w-0 rounded-xl bg-slate-50 p-4">
              <div className="flex items-start gap-2">
                <input className="mt-1 shrink-0" type="radio" checked={form.contractType === "management"}
                  onChange={() => { setContractEdited(false); setForm((f:any) => ({ ...f, contractType: "management", mandateRules: { ...f.mandateRules, manageLeases: true, manageCollections: true, manageMaintenance: true, manageInspections: true, guaranteedIncomeEnabled: false, payoutRule: "collected" } })); }} />
                <div className="min-w-0"><b className="break-words">Mandat de gestion E-IMMO</b><p className="mt-1 text-sm leading-5 text-slate-600">E-IMMO gère le portefeuille pour le propriétaire avec transparence totale.</p></div>
              </div>
            </label>

            <label className="min-w-0 rounded-xl bg-amber-50 p-4">
              <div className="flex items-start gap-2">
                <input className="mt-1 shrink-0" type="radio" checked={form.contractType === "guaranteed_management"}
                  onChange={() => { setContractEdited(false); setForm((f:any) => ({ ...f, contractType: "guaranteed_management", mandateRules: { ...f.mandateRules, manageLeases: true, manageCollections: true, manageMaintenance: true, manageInspections: true, guaranteedIncomeEnabled: true, payoutRule: "guaranteed" } })); }} />
                <div className="min-w-0"><b className="break-words">Mandat avec revenu garanti</b><p className="mt-1 text-sm leading-5 text-slate-600">E-IMMO gère et assume une garantie financière définie dans le contrat.</p></div>
              </div>
            </label>
          </div>
        </section>

        <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-bold sm:text-xl">3. Capacité autorisée & tarification</h2>
          <p className="mt-2 max-w-4xl text-sm leading-5 text-slate-600">
            Ces valeurs sont les <b>limites autorisées par le contrat</b>, même si le compte n'a encore aucun bien ni locataire.
            L'utilisation réelle est calculée automatiquement dans « État réel synchronisé ».
          </p>

          <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="min-w-0">
              <span className="text-sm font-medium">Propriétés autorisées</span>
              <Input type="number" min="0" value={form.maxProperties} onChange={(e) => { setContractEdited(false); setForm({ ...form, maxProperties: e.target.value }); }} />
              <span className="mt-1 block text-xs text-slate-500">Ex. Maison A + Immeuble B = 2 propriétés.</span>
            </label>

            <label className="min-w-0">
              <span className="text-sm font-medium">Ménages / unités autorisés</span>
              <Input type="number" min="0" value={form.maxUnits} onChange={(e) => { setContractEdited(false); setForm({ ...form, maxUnits: e.target.value }); }} />
              <span className="mt-1 block text-xs text-slate-500">Nombre total d'unités ou ménages gérés.</span>
            </label>

            <label className="min-w-0">
              <span className="text-sm font-medium">Locataires actifs autorisés</span>
              <Input type="number" min="0" value={form.maxActiveTenants} onChange={(e) => { setContractEdited(false); setForm({ ...form, maxActiveTenants: e.target.value }); }} />
              <span className="mt-1 block text-xs text-slate-500">Locataires actuellement actifs dans le portefeuille.</span>
            </label>

            <label className="min-w-0">
              <span className="text-sm font-medium">Tranche commerciale</span>
              <select className="mt-1 h-10 w-full min-w-0 rounded-md border px-3 text-sm" value={form.tierLabel}
                onChange={(e) => { setContractEdited(false); setForm({ ...form, tierLabel: e.target.value }); }}>
                {TIERS.map((tier) => <option key={tier}>{tier}</option>)}
              </select>
              <span className="mt-1 block text-xs text-slate-500">E-IMMO choisit la tranche et fixe manuellement le prix ou le pourcentage.</span>
            </label>

            <label className="min-w-0">
              <span className="text-sm font-medium">Mode de tarification</span>
              <select
                className="mt-1 h-10 w-full min-w-0 rounded-md border px-3 text-sm"
                value={form.pricingMode}
                onChange={(e) => {
                  setContractEdited(false);
                  setForm({ ...form, pricingMode: e.target.value });
                }}
              >
                <option value="fixed">Montant fixe</option>
                <option value="percentage">Pourcentage sur encaissements</option>
                <option value="hybrid">Fixe + pourcentage</option>
              </select>
            </label>

            <label className="min-w-0">
              <span className="text-sm font-medium">Périodicité</span>
              <select
                className="mt-1 h-10 w-full min-w-0 rounded-md border px-3 text-sm"
                value={form.billingPeriod}
                onChange={(e) => {
                  setContractEdited(false);
                  setForm({ ...form, billingPeriod: e.target.value });
                }}
              >
                <option value="monthly">Mensuelle</option>
                <option value="yearly">Annuelle</option>
              </select>
            </label>

            {(form.pricingMode === "fixed" || form.pricingMode === "hybrid") && (
              <label className="min-w-0">
                <span className="text-sm font-medium">Montant fixe (FCFA)</span>
                <Input type="number" min="0" value={form.fixedAmount} onChange={(e) => setForm({ ...form, fixedAmount: e.target.value })} />
              </label>
            )}

            {(form.pricingMode === "percentage" || form.pricingMode === "hybrid") && (
              <label className="min-w-0">
                <span className="text-sm font-medium">Commission (%)</span>
                <Input type="number" min="0" max="100" step="0.01" value={form.percentageRate} onChange={(e) => setForm({ ...form, percentageRate: e.target.value })} />
              </label>
            )}

            {(form.pricingMode === "percentage" || form.pricingMode === "hybrid") && (
              <label className="min-w-0">
                <span className="text-sm font-medium">Minimum de facturation (FCFA)</span>
                <Input type="number" min="0" value={form.minimumAmount} onChange={(e) => setForm({ ...form, minimumAmount: e.target.value })} />
              </label>
            )}
          </div>
        </section>

        <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-bold sm:text-xl">4. Reversement, gestion & transparence</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="min-w-0"><span className="text-sm font-medium">Jour mensuel de reversement</span>
              <select className="mt-1 h-10 w-full rounded-md border px-3" value={form.mandateRules.ownerPayoutDay}
                onChange={(e) => setMandateRule("ownerPayoutDay", e.target.value)}>
                {Array.from({ length: 31 }, (_, i) => <option key={i+1} value={i+1}>Le {i+1}</option>)}
              </select>
            </label>
            <label className="min-w-0"><span className="text-sm font-medium">Règle de reversement</span>
              <select className="mt-1 h-10 w-full rounded-md border px-3" value={form.mandateRules.payoutRule}
                onChange={(e) => setMandateRule("payoutRule", e.target.value)}>
                <option value="collected">Sommes réellement encaissées</option>
                <option value="guaranteed">Montant / revenu garanti</option>
                <option value="custom">Règle personnalisée</option>
              </select>
            </label>
            <label className="min-w-0"><span className="text-sm font-medium">Seuil dépense sans accord (FCFA)</span>
              <Input type="number" min="0" value={form.mandateRules.expenseApprovalThreshold}
                onChange={(e) => setMandateRule("expenseApprovalThreshold", e.target.value)} />
            </label>
            <label className="min-w-0"><span className="text-sm font-medium">Remplacement d'un occupant</span>
              <select className="mt-1 h-10 w-full rounded-md border px-3" value={form.mandateRules.tenantReplacementAuthority}
                onChange={(e) => setMandateRule("tenantReplacementAuthority", e.target.value)}>
                <option value="automatic">Autorisé à E-IMMO</option>
                <option value="owner_approval">Accord propriétaire requis</option>
                <option value="not_authorized">Non autorisé</option>
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              ["manageLeases", "Gestion des baux"],
              ["manageCollections", "Encaissement des loyers"],
              ["manageMaintenance", "Gestion maintenance"],
              ["manageInspections", "Gestion inspections"],
              ["ownerFullTransparency", "Transparence totale propriétaire"],
              ["ownerCanViewOccupantContacts", "Contacts téléphone / WhatsApp visibles au propriétaire"],
              ["advanceManagementEnabled", "Gestion des avances"],
              ["vacancyManagementEnabled", "Suivi des périodes de vacance"],
              ["leaseSyncEnabled", "Synchronisation avec les baux"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm">
                <input className="mt-1 shrink-0" type="checkbox" checked={!!form.mandateRules[key]}
                  onChange={(e) => setMandateRule(key, e.target.checked)} />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <label className="mt-4 block"><span className="text-sm font-medium">Gestion des avances</span>
            <textarea className="mt-1 min-h-20 w-full rounded-md border p-3 text-sm" value={form.mandateRules.advancePolicy}
              onChange={(e) => setMandateRule("advancePolicy", e.target.value)} />
          </label>
          <label className="mt-3 block"><span className="text-sm font-medium">Cautions / dépôts</span>
            <textarea className="mt-1 min-h-20 w-full rounded-md border p-3 text-sm" value={form.mandateRules.depositPolicy}
              onChange={(e) => setMandateRule("depositPolicy", e.target.value)} />
          </label>

          {isMandate && (
            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <h3 className="font-semibold">Vacance / inoccupation</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-sm">Garantie de vacance
                  <select className="mt-1 h-10 w-full rounded-md border px-3"
                    value={form.mandateRules.vacancyCoverageEnabled ? "yes" : "no"}
                    onChange={(e) => setMandateRule("vacancyCoverageEnabled", e.target.value === "yes")}>
                    <option value="no">Non</option><option value="yes">Oui</option>
                  </select>
                </label>
                <label className="text-sm">Jours couverts<Input type="number" min="0" value={form.mandateRules.vacancyCoverageDays}
                  onChange={(e) => setMandateRule("vacancyCoverageDays", e.target.value)} /></label>
                <label className="text-sm">Plafond (FCFA)<Input type="number" min="0" value={form.mandateRules.vacancyCoverageCap}
                  onChange={(e) => setMandateRule("vacancyCoverageCap", e.target.value)} /></label>
              </div>
            </div>
          )}

          {form.contractType === "guaranteed_management" && (
            <div className="mt-4 rounded-xl bg-amber-50 p-3">
              <h3 className="font-semibold">Garantie de revenu</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-sm">Montant garanti (FCFA)<Input type="number" min="0" value={form.mandateRules.guaranteedIncomeAmount}
                  onChange={(e) => setMandateRule("guaranteedIncomeAmount", e.target.value)} /></label>
                <label className="text-sm">Taux garanti (%)<Input type="number" min="0" max="100" value={form.mandateRules.guaranteedIncomeRate}
                  onChange={(e) => setMandateRule("guaranteedIncomeRate", e.target.value)} /></label>
                <label className="text-sm">Mois d'impayés couverts<Input type="number" min="0" max="36" value={form.mandateRules.guaranteeMaxUnpaidMonths}
                  onChange={(e) => setMandateRule("guaranteeMaxUnpaidMonths", e.target.value)} /></label>
                <label className="text-sm">Plafond annuel (FCFA)<Input type="number" min="0" value={form.mandateRules.guaranteeAnnualCap}
                  onChange={(e) => setMandateRule("guaranteeAnnualCap", e.target.value)} /></label>
              </div>
            </div>
          )}
        </section>

        <ContractSafeguardsEditor
          safeguards={form.safeguards || {}}
          onboardingChecklist={form.onboardingChecklist || {}}
          offboardingChecklist={form.offboardingChecklist || {}}
          complianceRules={form.complianceRules || {}}
          onSafeguardsChange={(key, value) => { setContractEdited(false); setForm((f:any) => ({ ...f, safeguards: { ...f.safeguards, [key]: value } })); }}
          onOnboardingChange={(key, value) => { setContractEdited(false); setForm((f:any) => ({ ...f, onboardingChecklist: { ...f.onboardingChecklist, [key]: value } })); }}
          onOffboardingChange={(key, value) => { setContractEdited(false); setForm((f:any) => ({ ...f, offboardingChecklist: { ...f.offboardingChecklist, [key]: value } })); }}
          onComplianceChange={(key, value) => { setContractEdited(false); setForm((f:any) => ({ ...f, complianceRules: { ...f.complianceRules, [key]: value } })); }}
        />

        <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-bold sm:text-xl">6. Contrat modifiable</h2>
          <p className="mt-2 text-sm leading-5 text-slate-600">
            Le texte ci-dessous est généré automatiquement à partir des options choisies. Tu peux ensuite modifier
            manuellement n'importe quelle phrase avant validation.
          </p>

          <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-3">
            <div className="min-w-0">
              <span className="text-sm font-medium">Date de début</span>
              <div className="mt-1 grid min-w-0 grid-cols-3 gap-1.5 sm:gap-2">
                <select className="h-10 min-w-0 rounded-md border px-1 text-xs sm:px-2 sm:text-sm" value={startParts.day} onChange={(e) => { setContractEdited(false); setStartParts({ ...startParts, day: e.target.value }); }}>
                  {Array.from({ length: 31 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}
                </select>
                <select className="h-10 min-w-0 rounded-md border px-1 text-xs sm:px-2 sm:text-sm" value={startParts.month} onChange={(e) => { setContractEdited(false); setStartParts({ ...startParts, month: e.target.value }); }}>
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <select className="h-10 min-w-0 rounded-md border px-1 text-xs sm:px-2 sm:text-sm" value={startParts.year} onChange={(e) => { setContractEdited(false); setStartParts({ ...startParts, year: e.target.value }); }}>
                  {YEARS.map((y) => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="min-w-0">
              <span className="text-sm font-medium">Date de fin (optionnelle)</span>
              <div className="mt-1 grid min-w-0 grid-cols-3 gap-1.5 sm:gap-2">
                <select className="h-10 min-w-0 rounded-md border px-1 text-xs sm:px-2 sm:text-sm" value={endParts.day} onChange={(e) => { setContractEdited(false); setEndParts({ ...endParts, day: e.target.value }); }}>
                  <option value="">Jour</option>
                  {Array.from({ length: 31 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}
                </select>
                <select className="h-10 min-w-0 rounded-md border px-1 text-xs sm:px-2 sm:text-sm" value={endParts.month} onChange={(e) => { setContractEdited(false); setEndParts({ ...endParts, month: e.target.value }); }}>
                  <option value="">Mois</option>
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <select className="h-10 min-w-0 rounded-md border px-1 text-xs sm:px-2 sm:text-sm" value={endParts.year} onChange={(e) => { setContractEdited(false); setEndParts({ ...endParts, year: e.target.value }); }}>
                  <option value="">Année</option>
                  {YEARS.map((y) => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <label className="min-w-0">
              <span className="text-sm font-medium">Renouvellement</span>
              <select
                className="mt-1 h-10 w-full min-w-0 rounded-md border px-3 text-sm"
                value={form.renewalMode}
                onChange={(e) => {
                  setContractEdited(false);
                  setForm({ ...form, renewalMode: e.target.value });
                }}
              >
                <option value="manual">Manuel</option>
                <option value="automatic">Automatique</option>
              </select>
            </label>
          </div>

          <div className="mt-5 min-w-0">
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="text-sm font-semibold">Texte intégral du contrat</label>
              <button
                type="button"
                className="self-start rounded-lg border px-3 py-2 text-xs font-medium hover:bg-slate-50 sm:self-auto"
                onClick={() => {
                  setContractEdited(false);
                  setForm((current: any) => ({ ...current, contractBody: generatedContract }));
                }}
              >
                Régénérer depuis les options
              </button>
            </div>

            <textarea
              className="min-h-[520px] w-full min-w-0 resize-y rounded-xl border bg-white p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-red-200 sm:p-4"
              value={form.contractBody}
              onChange={(e) => {
                setContractEdited(true);
                setForm({ ...form, contractBody: e.target.value });
              }}
            />

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Le texte saisi ici est celui qui sera enregistré avec le contrat. Toute modification manuelle est conservée.
            </p>
          </div>

          <details className="mt-5 rounded-xl bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-semibold">Conditions et clauses structurées</summary>
            <div className="mt-4 space-y-4">
              <label className="block min-w-0">
                <span className="text-sm font-medium">Conditions générales</span>
                <textarea
                  className="mt-1 min-h-28 w-full min-w-0 rounded-md border p-3 text-sm"
                  value={form.conditions}
                  onChange={(e) => {
                    setContractEdited(false);
                    setForm({ ...form, conditions: e.target.value });
                  }}
                  placeholder="Conditions convenues entre E-IMMO et le compte..."
                />
              </label>

              <label className="block min-w-0">
                <span className="text-sm font-medium">Clauses particulières</span>
                <textarea
                  className="mt-1 min-h-24 w-full min-w-0 rounded-md border p-3 text-sm"
                  value={form.specialClauses}
                  onChange={(e) => {
                    setContractEdited(false);
                    setForm({ ...form, specialClauses: e.target.value });
                  }}
                  placeholder="Remises, exceptions, obligations particulières..."
                />
              </label>
            </div>
          </details>
        </section>

        <div className="flex min-w-0 justify-end">
          <Button className="w-full sm:w-auto" type="submit" disabled={saving || !form.accountId}>
            {saving ? "Enregistrement..." : "Créer le contrat"}
          </Button>
        </div>
      </form>

      <section className="mt-8 min-w-0 sm:mt-10">
        <h2 className="mb-3 text-lg font-bold sm:text-xl">Contrats existants</h2>
        <div className="grid min-w-0 gap-3">
          {contracts.map((c) => (
            <Link
              key={c._id}
              href={`/dashboard/admin/subscriptions/${c._id}`}
              className="min-w-0 rounded-xl bg-white p-4 shadow-sm hover:bg-slate-50"
            >
              <p className="break-all font-semibold">{c.contractNumber}</p>
              <p className="mt-1 break-words text-sm">
                {c.accountId?.businessName || `${c.accountId?.firstName || ""} ${c.accountId?.lastName || ""}`}
              </p>
              <span className="text-xs text-slate-500">
                {c.contractType === "scale" ? "Barème" : "Personnalisé"} • {c.status}
              </span>
            </Link>
          ))}
          {!contracts.length && <p className="text-sm text-slate-500">Aucun contrat pour le moment.</p>}
        </div>
      </section>
    </div>
  );
}

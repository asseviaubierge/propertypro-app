"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import ContractSafeguardsEditor from "@/components/subscriptions/ContractSafeguardsEditor";
import { buildSubscriptionContractText } from "@/lib/subscriptions/contract-template";

const unwrap = (j: any) => j?.data ?? j;

const isLegacyContractBody = (body?: string) => {
  if (!body) return true;
  return !body.includes("ARTICLE 22 — VALIDATION AVANT ACCÈS");
};

const isLockedContract = (status?: string) =>
  ["pending_signature", "signed", "active", "expired", "cancelled"].includes(
    String(status || "")
  );

export default function EditSubscriptionContract() {
  const p = useParams<{ id: string }>();
  const [c, setC] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [legacyDraftUpgraded, setLegacyDraftUpgraded] = useState(false);
  const [sending, setSending] = useState<"email" | "whatsapp" | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch(`/api/admin/subscriptions/contracts/${p.id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setC(unwrap(j)));
  }, [p.id]);

  useEffect(() => {
    const accountId = c?.accountId?._id || c?.accountId;
    if (!accountId) return;
    fetch(`/api/admin/subscriptions/portfolio/${accountId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const d = unwrap(j);
        setPortfolio(d?.snapshot || null);
        setEvents(d?.events || []);
      });
  }, [c?.accountId?._id]);

  useEffect(() => {
    if (!c || !portfolio || legacyDraftUpgraded) return;
    if (c.status !== "draft" || !isLegacyContractBody(c.contractBody)) return;

    const currentAccount = c.accountId || {};
    const currentAccountName = currentAccount.businessName || `${currentAccount.firstName || ""} ${currentAccount.lastName || ""}`.trim() || currentAccount.email || "Contractant";
    const dateLabel = (value: any) => value ? new Date(value).toLocaleDateString("fr-FR") : "sans date de fin définie";
    const currentPeriodText = `${dateLabel(c.startDate)} au ${c.endDate ? dateLabel(c.endDate) : "terme non défini"}`;

    setC((current: any) => ({
      ...current,
      contractBody: buildSubscriptionContractText({
        form: current,
        account: current.accountId || {},
        accountName: currentAccountName,
        portfolio,
        periodText: currentPeriodText,
      }),
    }));
    setLegacyDraftUpgraded(true);
  }, [c, portfolio, legacyDraftUpgraded]);

  if (!c) return <div className="p-4 sm:p-8">Chargement du contrat...</div>;

  const account = c.accountId || {};
  const rules = c.mandateRules || {};
  const safeguards = c.safeguards || {};
  const onboardingChecklist = c.onboardingChecklist || {};
  const offboardingChecklist = c.offboardingChecklist || {};
  const complianceRules = c.complianceRules || {};

  const setRule = (key: string, value: any) =>
    setC({ ...c, mandateRules: { ...rules, [key]: value } });
  const setSafeguard = (key: string, value: any) => setC({ ...c, safeguards: { ...safeguards, [key]: value } });
  const setOnboarding = (key: string, value: any) => setC({ ...c, onboardingChecklist: { ...onboardingChecklist, [key]: value } });
  const setOffboarding = (key: string, value: any) => setC({ ...c, offboardingChecklist: { ...offboardingChecklist, [key]: value } });
  const setCompliance = (key: string, value: any) => setC({ ...c, complianceRules: { ...complianceRules, [key]: value } });

  const accountName = account.businessName || `${account.firstName || ""} ${account.lastName || ""}`.trim() || account.email || "Contractant";
  const dateLabel = (value: any) => value ? new Date(value).toLocaleDateString("fr-FR") : "sans date de fin définie";
  const periodText = `${dateLabel(c.startDate)} au ${c.endDate ? dateLabel(c.endDate) : "terme non défini"}`;
  const regenerateContract = () => {
    if (isLockedContract(c.status)) {
      toast({
        title: "Contrat figé",
        description:
          "Ce contrat a déjà quitté le brouillon. Créez un avenant ou une nouvelle version pour le modifier.",
        variant: "destructive",
      });
      return;
    }
    setC({
      ...c,
      contractBody: buildSubscriptionContractText({
        form: c,
        account,
        accountName,
        portfolio,
        periodText,
      }),
    });
    setLegacyDraftUpgraded(true);
  };

  async function sendToContractor(channel: "email" | "whatsapp") {
    setSending(channel);

    try {
      const r = await fetch(
        `/api/admin/subscriptions/contracts/${p.id}/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel }),
        }
      );

      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Envoi impossible");

      const payload = unwrap(j);
      const updatedContract = payload?.contract || payload;
      setC(updatedContract);

      if (channel === "whatsapp" && payload?.whatsappUrl) {
        window.open(payload.whatsappUrl, "_blank", "noopener,noreferrer");
      }

      toast({
        title:
          channel === "whatsapp"
            ? "WhatsApp prêt à envoyer"
            : "Contrat envoyé",
        description:
          channel === "whatsapp"
            ? "WhatsApp s'ouvre avec le message, le lien de lecture et le PDF. Vérifiez puis appuyez sur Envoyer."
            : "Le contractant peut maintenant lire, imprimer et signer le document.",
      });
    } catch (error: any) {
      toast({
        title: "Envoi impossible",
        description: error?.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setSending(null);
    }
  }

  async function save() {
    setSaving(true);
    const r = await fetch(`/api/admin/subscriptions/contracts/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c),
    });
    const j = await r.json();
    setSaving(false);

    if (!r.ok) {
      toast({
        title: "Modification impossible",
        description: j?.error || "Une erreur est survenue.",
        variant: "destructive",
      });
      return;
    }

    setC(unwrap(j));
    toast({
      title: "Contrat mis à jour",
      description: "Les modifications ont été enregistrées.",
    });
  }

  return (
    <div className="mx-auto min-w-0 max-w-6xl overflow-x-hidden p-3 text-slate-950 sm:p-4 md:p-8">
      <Link href="/dashboard/admin/subscriptions" className="mb-4 inline-block text-sm font-medium text-slate-600 hover:text-slate-950">← Tableau de bord Abonnements & Mandats</Link>
      <p className="text-xs font-semibold text-red-600 sm:text-sm">E-IMMO • CONTRAT MODIFIABLE</p>
      <h1 className="break-all text-2xl font-bold sm:text-3xl">{c.contractNumber}</h1>
      <p className="mt-1 break-words text-sm text-slate-600 sm:text-base">
        Entre E-IMMO et {account.businessName || `${account.firstName || ""} ${account.lastName || ""}`}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" variant="outline" onClick={regenerateContract} disabled={isLockedContract(c.status)}>{isLockedContract(c.status) ? "Contrat figé — avenant requis" : "Régénérer les 22 articles"}</Button>
        <a href={`/api/admin/subscriptions/contracts/${p.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white">Voir / imprimer le PDF</a>
        <ConfirmationDialog
          title="Envoyer le contrat par e-mail"
          description="Le contractant recevra un lien sécurisé pour lire, imprimer et signer ce document."
          confirmText="Envoyer par e-mail"
          loading={sending === "email"}
          disabled={!!sending || c.signatureStatus === "signed"}
          onConfirm={() => sendToContractor("email")}
        >
          <Button
            type="button"
            disabled={!!sending || c.signatureStatus === "signed"}
          >
            {sending === "email" ? "Envoi…" : "Envoyer par e-mail"}
          </Button>
        </ConfirmationDialog>

        <ConfirmationDialog
          title="Partager le contrat par WhatsApp"
          description={
            account.whatsappVerificationStatus === "verified" && account.whatsappVerifiedAt
              ? "WhatsApp s'ouvrira avec un message prérempli contenant le lien sécurisé du contrat et du PDF. Aucun service WhatsApp payant n'est utilisé."
              : "Le numéro WhatsApp du contractant doit d'abord être vérifié par le Super Administrateur E-IMMO."
          }
          confirmText="Ouvrir WhatsApp"
          loading={sending === "whatsapp"}
          disabled={
            !!sending ||
            c.signatureStatus === "signed" ||
            !(account.whatsappVerificationStatus === "verified" && account.whatsappVerifiedAt)
          }
          onConfirm={() => sendToContractor("whatsapp")}
        >
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={
              !!sending ||
              c.signatureStatus === "signed" ||
              !(account.whatsappVerificationStatus === "verified" && account.whatsappVerifiedAt)
            }
          >
            {sending === "whatsapp"
              ? "Préparation…"
              : "Envoyer par WhatsApp"}
          </Button>
        </ConfirmationDialog>
      </div>

      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
        <b>Signature du contractant :</b>{" "}
        {c.signatureStatus === "signed"
          ? `Signé${c.signedAt ? ` le ${new Date(c.signedAt).toLocaleDateString("fr-FR")}` : ""}${c.signatoryName ? ` par ${c.signatoryName}` : ""}.`
          : c.signatureStatus === "pending_signature"
            ? `En attente de signature${c.sentAt ? ` depuis le ${new Date(c.sentAt).toLocaleDateString("fr-FR")}` : ""}${c.lastDeliveryChannel ? ` — canal : ${c.lastDeliveryChannel === "whatsapp" ? "WhatsApp" : "e-mail"}` : ""}.`
            : "Pas encore envoyé au contractant."}
      </div>

      {legacyDraftUpgraded && c.status === "draft" && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          Ancienne version détectée : le brouillon a été régénéré avec le modèle contractuel unique à 22 articles.
          Vérifiez le texte puis cliquez sur « Enregistrer les modifications » pour conserver cette version.
        </div>
      )}

      {portfolio && (
        <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-bold">État réel synchronisé</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {[
              ["Propriétés", portfolio.propertyCount],
              ["Unités", portfolio.unitCount],
              ["Occupées", portfolio.occupiedUnitCount],
              ["Vacantes", portfolio.vacantUnitCount],
              ["Locataires actifs", portfolio.activeTenantCount],
              ["Baux actifs", portfolio.activeLeaseCount],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-xl font-bold">{value ?? 0}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-5 min-w-0 space-y-5">
        <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-4 text-lg font-bold">Paramètres contractuels</h2>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="min-w-0">Type
              <select className="h-10 w-full rounded-md border px-3 text-sm" value={c.contractType} onChange={(e) => setC({ ...c, contractType: e.target.value })}>
                <option value="scale">Forfait Barème E-IMMO</option>
                <option value="negotiated">Forfait personnalisé</option>
                <option value="management">Mandat de gestion E-IMMO</option>
                <option value="guaranteed_management">Mandat avec revenu garanti</option>
              </select>
            </label>

            <label className="min-w-0">Tarification
              <select className="h-10 w-full rounded-md border px-3 text-sm" value={c.pricingMode} onChange={(e) => setC({ ...c, pricingMode: e.target.value })}>
                <option value="fixed">Fixe</option>
                <option value="percentage">Pourcentage</option>
                <option value="hybrid">Fixe + pourcentage</option>
              </select>
            </label>

            <label className="min-w-0">Statut
              <select className="h-10 w-full rounded-md border px-3 text-sm" value={c.status} onChange={(e) => setC({ ...c, status: e.target.value })}>
                <option value="draft">Brouillon</option>
                <option value="active">Actif</option>
                <option value="suspended">Suspendu</option>
                <option value="expired">Expiré</option>
                <option value="cancelled">Résilié</option>
              </select>
            </label>

            <label>Propriétés autorisées<Input type="number" min="0" value={c.maxProperties ?? 0} onChange={(e) => setC({ ...c, maxProperties: Number(e.target.value) })} /></label>
            <label>Unités autorisées<Input type="number" min="0" value={c.maxUnits ?? 0} onChange={(e) => setC({ ...c, maxUnits: Number(e.target.value) })} /></label>
            <label>Locataires actifs autorisés<Input type="number" min="0" value={c.maxActiveTenants ?? 0} onChange={(e) => setC({ ...c, maxActiveTenants: Number(e.target.value) })} /></label>

            <label>Montant fixe (FCFA)<Input type="number" value={c.fixedAmount || 0} onChange={(e) => setC({ ...c, fixedAmount: Number(e.target.value) })} /></label>
            <label>Pourcentage (%)<Input type="number" step=".01" value={c.percentageRate || 0} onChange={(e) => setC({ ...c, percentageRate: Number(e.target.value) })} /></label>
            <label>Minimum (FCFA)<Input type="number" value={c.minimumAmount || 0} onChange={(e) => setC({ ...c, minimumAmount: Number(e.target.value) })} /></label>
          </div>
        </section>

        <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-bold">Reversement, gestion et garantie</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label>Jour de reversement
              <select className="h-10 w-full rounded-md border px-3" value={rules.ownerPayoutDay ?? 15} onChange={(e) => setRule("ownerPayoutDay", Number(e.target.value))}>
                {Array.from({ length: 31 }, (_, i) => <option key={i+1} value={i+1}>Le {i+1}</option>)}
              </select>
            </label>
            <label>Règle de reversement
              <select className="h-10 w-full rounded-md border px-3" value={rules.payoutRule || "collected"} onChange={(e) => setRule("payoutRule", e.target.value)}>
                <option value="collected">Sommes encaissées</option>
                <option value="guaranteed">Revenu garanti</option>
                <option value="custom">Personnalisée</option>
              </select>
            </label>
            <label>Seuil dépense (FCFA)<Input type="number" min="0" value={rules.expenseApprovalThreshold || 0} onChange={(e) => setRule("expenseApprovalThreshold", Number(e.target.value))} /></label>
            <label>Remplacement occupant
              <select className="h-10 w-full rounded-md border px-3" value={rules.tenantReplacementAuthority || "owner_approval"} onChange={(e) => setRule("tenantReplacementAuthority", e.target.value)}>
                <option value="automatic">Autorisé à E-IMMO</option>
                <option value="owner_approval">Accord propriétaire requis</option>
                <option value="not_authorized">Non autorisé</option>
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              ["ownerFullTransparency", "Transparence totale propriétaire"],
              ["ownerCanViewOccupantContacts", "Contacts téléphone / WhatsApp visibles"],
              ["advanceManagementEnabled", "Gestion des avances"],
              ["vacancyManagementEnabled", "Suivi des vacances"],
              ["leaseSyncEnabled", "Synchronisation avec les baux"],
              ["manageLeases", "Gestion des baux par E-IMMO"],
              ["manageCollections", "Encaissements par E-IMMO"],
              ["manageMaintenance", "Maintenance par E-IMMO"],
              ["manageInspections", "Inspections par E-IMMO"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm">
                <input className="mt-1" type="checkbox" checked={!!rules[key]} onChange={(e) => setRule(key, e.target.checked)} />
                <span>{label}</span>
              </label>
            ))}
          </div>

          {c.contractType === "guaranteed_management" && (
            <div className="mt-4 grid gap-3 rounded-xl bg-amber-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <label>Montant garanti<Input type="number" min="0" value={rules.guaranteedIncomeAmount || 0} onChange={(e) => setRule("guaranteedIncomeAmount", Number(e.target.value))} /></label>
              <label>Taux garanti (%)<Input type="number" min="0" max="100" value={rules.guaranteedIncomeRate || 0} onChange={(e) => setRule("guaranteedIncomeRate", Number(e.target.value))} /></label>
              <label>Mois impayés couverts<Input type="number" min="0" max="36" value={rules.guaranteeMaxUnpaidMonths || 0} onChange={(e) => setRule("guaranteeMaxUnpaidMonths", Number(e.target.value))} /></label>
              <label>Plafond annuel<Input type="number" min="0" value={rules.guaranteeAnnualCap || 0} onChange={(e) => setRule("guaranteeAnnualCap", Number(e.target.value))} /></label>
            </div>
          )}
        </section>

        <ContractSafeguardsEditor
          safeguards={safeguards}
          onboardingChecklist={onboardingChecklist}
          offboardingChecklist={offboardingChecklist}
          complianceRules={complianceRules}
          onSafeguardsChange={setSafeguard}
          onOnboardingChange={setOnboarding}
          onOffboardingChange={setOffboarding}
          onComplianceChange={setCompliance}
        />

        <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-bold sm:text-xl">Contrat modifiable</h2>
          <p className="mt-1 text-sm text-slate-600">Le texte reste entièrement modifiable avant et après activation selon les droits E-IMMO.</p>

          <textarea
            className="mt-4 min-h-[620px] w-full min-w-0 resize-y rounded-xl border p-3 text-sm leading-6 sm:p-4"
            value={c.contractBody || ""}
            onChange={(e) => setC({ ...c, contractBody: e.target.value })}
          />

          <details className="mt-5 rounded-xl bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-semibold">Conditions et clauses structurées</summary>
            <div className="mt-4 space-y-4">
              <textarea className="min-h-32 w-full rounded-md border p-3 text-sm" value={c.conditions || ""} onChange={(e) => setC({ ...c, conditions: e.target.value })} />
              <textarea className="min-h-28 w-full rounded-md border p-3 text-sm" value={c.specialClauses || ""} onChange={(e) => setC({ ...c, specialClauses: e.target.value })} />
            </div>
          </details>
        </section>

        {!!events.length && (
          <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-bold">Journal des baux</h2>
            <p className="mt-1 text-xs text-slate-500">Les changements importants des baux liés au contrat actif apparaissent ici.</p>
            <div className="mt-3 space-y-2">
              {events.map((ev) => (
                <div key={ev._id} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <b>{ev.type}</b>
                  <p className="mt-1">{ev.message}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(ev.occurredAt).toLocaleString("fr-FR")}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex justify-end">
          <Button className="w-full sm:w-auto" onClick={save} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer les modifications"}
          </Button>
        </div>
      </div>
    </div>
  );
}

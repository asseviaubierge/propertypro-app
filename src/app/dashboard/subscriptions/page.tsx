"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileText,
  Handshake,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

type DashboardData = {
  stats: Record<string, number>;
  subscribers: any[];
  expiringSoon: any[];
  upcomingPayouts: any[];
  activities: any[];
};

const unwrap = (j: any) => j?.data ?? j;

function dateLabel(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  switch (status) {
    case "prospect": return "À souscrire";
    case "draft": return "Brouillon";
    case "pending_signature": return "En attente de signature";
    case "signed": return "Signé — à activer";
    case "active": return "Actif";
    case "suspended": return "Suspendu";
    case "expired": return "Expiré";
    case "cancelled": return "Résilié";
    default: return status || "Inconnu";
  }
}

function statusClass(status: string) {
  switch (status) {
    case "active": return "bg-emerald-100 text-emerald-800";
    case "draft": return "bg-amber-100 text-amber-800";
    case "pending_signature": return "bg-blue-100 text-blue-800";
    case "signed": return "bg-emerald-100 text-emerald-800";
    case "suspended": return "bg-orange-100 text-orange-800";
    case "expired":
    case "cancelled": return "bg-red-100 text-red-800";
    default: return "bg-blue-100 text-blue-800";
  }
}

export default function SubscriptionsDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subscriberFilter, setSubscriberFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/admin/subscriptions/dashboard", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Chargement impossible");
      setData(unwrap(j));
    } catch (e: any) {
      setError(e.message || "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const subscribers = useMemo(() => {
    if (!data?.subscribers) return [];
    if (subscriberFilter === "all") return data.subscribers;
    return data.subscribers.filter((s: any) => s.subscriptionState === subscriberFilter);
  }, [data, subscriberFilter]);

  if (loading) {
    return <div className="p-4 md:p-8 text-slate-700">Chargement du tableau de bord Abonnements & Mandats...</div>;
  }

  if (error || !data) {
    return <div className="p-4 md:p-8">
      <div className="rounded-2xl bg-red-50 p-5 text-red-900">
        <b>Impossible de charger le tableau de bord.</b>
        <p className="mt-1 text-sm">{error}</p>
        <Button className="mt-4" onClick={load}>Réessayer</Button>
      </div>
    </div>;
  }

  const cards = [
    ["Souscripteurs éligibles", data.stats.eligibleAccounts, Users, "Tous les comptes pouvant souscrire"],
    ["À souscrire", data.stats.prospects, UserPlus, "Comptes sans contrat"],
    ["Contrats actifs", data.stats.active, CheckCircle2, "Forfaits et mandats actifs"],
    ["Brouillons", data.stats.drafts, FileText, "À compléter ou valider"],
    ["Mandats de gestion", data.stats.managementMandates, Handshake, "Gestion confiée à E-IMMO"],
    ["Revenu garanti", data.stats.guaranteedMandates, ShieldCheck, "Mandats avec garantie"],
    ["À renouveler", data.stats.expiringSoon, CalendarClock, "Échéance dans les 30 jours"],
    ["Alertes capacité", data.stats.capacityAlerts, AlertTriangle, "Limites contractuelles dépassées"],
  ] as const;

  return <div className="mx-auto min-w-0 max-w-7xl overflow-x-hidden p-3 text-slate-950 sm:p-4 md:p-8">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-red-600 sm:text-sm">E-IMMO • ADMINISTRATION</p>
        <h1 className="break-words text-2xl font-bold sm:text-3xl">Tableau de bord Abonnements & Mandats</h1>
        <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600">
          Pilotage des souscripteurs, contrats, mandats, échéances, reversements et événements liés aux baux.
        </p>
      </div>
      <div className="flex w-full gap-2 md:w-auto">
        <Button variant="outline" className="min-w-0 flex-1 md:flex-none" onClick={load}><RefreshCw className="mr-2 h-4 w-4"/>Actualiser</Button>
        <Button asChild className="min-w-0 flex-1 md:flex-none"><Link href="/dashboard/admin/subscriptions/new"><Plus className="mr-2 h-4 w-4"/>Nouveau contrat</Link></Button>
      </div>
    </div>

    <section className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      {cards.map(([label,value,Icon,desc]) => <div key={label} className="min-w-0 rounded-2xl bg-white p-3 shadow-sm sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
            <p className="mt-1 text-2xl font-bold sm:text-3xl">{value}</p>
          </div>
          <Icon className="h-5 w-5 shrink-0 text-slate-400"/>
        </div>
        <p className="mt-2 hidden text-xs text-slate-500 sm:block">{desc}</p>
      </div>)}
    </section>

    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold sm:text-xl">Souscripteurs & utilisateurs à souscrire</h2>
          <p className="text-sm text-slate-600">Un compte sans contrat apparaît comme « À souscrire ».</p>
        </div>
        <select className="h-10 rounded-md border px-3 text-sm" value={subscriberFilter} onChange={e=>setSubscriberFilter(e.target.value)}>
          <option value="all">Tous les comptes</option>
          <option value="prospect">À souscrire</option>
          <option value="draft">Brouillons</option>
          <option value="pending_signature">En attente de signature</option>
          <option value="signed">Signés — à activer</option>
          <option value="active">Actifs</option>
          <option value="suspended">Suspendus</option>
          <option value="expired">Expirés</option>
        </select>
      </div>

      <div className="mt-4 grid gap-3">
        {subscribers.map((s:any) => <div key={String(s.account._id)} className="min-w-0 rounded-xl bg-slate-50 p-3 sm:p-4">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <b className="break-words">{s.account.name}</b>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(s.subscriptionState)}`}>{statusLabel(s.subscriptionState)}</span>
              </div>
              <p className="mt-1 break-all text-xs text-slate-500">{s.account.email}</p>
              <p className="mt-1 text-xs text-slate-500">{s.account.accountType || "Compte gestionnaire"}</p>
              {s.contract && <p className="mt-2 text-sm"><b>{s.contract.contractNumber}</b> • {s.contract.contractTypeLabel}{s.contract.tierLabel ? ` • ${s.contract.tierLabel}`:""}</p>}
              {s.capacityWarnings?.map((w:string)=><p key={w} className="mt-1 text-xs font-medium text-red-700">⚠ {w}</p>)}
            </div>

            <div className="grid min-w-0 grid-cols-3 gap-2 text-center text-xs sm:min-w-[280px]">
              <div className="rounded-lg bg-white p-2"><p className="text-slate-500">Propriétés</p><b>{s.portfolio?.propertyCount ?? 0}</b></div>
              <div className="rounded-lg bg-white p-2"><p className="text-slate-500">Unités</p><b>{s.portfolio?.unitCount ?? 0}</b></div>
              <div className="rounded-lg bg-white p-2"><p className="text-slate-500">Locataires</p><b>{s.portfolio?.activeTenantCount ?? 0}</b></div>
            </div>

            <div className="flex gap-2 lg:justify-end">
              {s.contract ? <Button asChild variant="outline" className="flex-1 lg:flex-none"><Link href={`/dashboard/admin/subscriptions/${s.contract._id}`}>Ouvrir le contrat</Link></Button>
              : <Button asChild className="flex-1 lg:flex-none"><Link href={`/dashboard/admin/subscriptions/new?accountId=${s.account._id}`}>Créer son contrat</Link></Button>}
            </div>
          </div>
        </div>)}
        {!subscribers.length && <p className="py-6 text-center text-sm text-slate-500">Aucun compte dans ce filtre.</p>}
      </div>
    </section>

    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarClock className="h-5 w-5"/>Échéances & reversements</h2>
        <div className="mt-4 space-y-3">
          {data.expiringSoon.map((c:any)=><Link key={String(c._id)} href={`/dashboard/admin/subscriptions/${c._id}`} className="block rounded-xl bg-amber-50 p-3">
            <b className="break-all text-sm">{c.contractNumber}</b>
            <p className="text-sm">{c.accountName}</p>
            <p className="text-xs text-amber-800">Fin prévue : {dateLabel(c.endDate)}</p>
          </Link>)}
          {data.upcomingPayouts.map((p:any)=><Link key={`p-${String(p.contractId)}`} href={`/dashboard/admin/subscriptions/${p.contractId}`} className="block rounded-xl bg-blue-50 p-3">
            <b className="text-sm">Reversement propriétaire — le {p.day}</b>
            <p className="text-sm">{p.accountName}</p>
            <p className="text-xs text-blue-800">{p.payoutRule === "guaranteed" ? "Revenu garanti" : p.payoutRule === "custom" ? "Règle personnalisée" : "Sommes encaissées"}</p>
          </Link>)}
          {!data.expiringSoon.length && !data.upcomingPayouts.length && <p className="text-sm text-slate-500">Aucune échéance contractuelle immédiate.</p>}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Activity className="h-5 w-5"/>Activités récentes</h2>
        <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
          {data.activities.map((a:any)=><Link key={a.id} href={a.contractId ? `/dashboard/admin/subscriptions/${a.contractId}` : "#"} className="block rounded-xl bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <b className="break-words text-sm">{a.title}</b>
                <p className="mt-1 break-words text-xs leading-5 text-slate-600">{a.message}</p>
              </div>
              <span className="shrink-0 text-[11px] text-slate-400">{dateLabel(a.occurredAt)}</span>
            </div>
          </Link>)}
          {!data.activities.length && <p className="text-sm text-slate-500">Aucune activité contractuelle pour le moment.</p>}
        </div>
      </section>
    </div>

    <section className="mt-6 rounded-2xl bg-slate-950 p-4 text-white shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <Building2 className="mt-1 h-5 w-5 shrink-0"/>
        <div>
          <h2 className="font-bold">Principe de contrôle E-IMMO</h2>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            Le tableau de bord principal de l'application reste inchangé. Ici, le Super Administrateur surveille uniquement les souscriptions, mandats, limites contractuelles, échéances et événements qui peuvent modifier la relation entre E-IMMO et le contractant.
          </p>
        </div>
      </div>
    </section>
  </div>;
}

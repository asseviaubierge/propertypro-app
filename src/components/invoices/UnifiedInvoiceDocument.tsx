"use client";

import React from "react";
import type { NormalizedInvoice } from "@/lib/invoice/invoice-shared";

export interface UnifiedInvoiceDocumentProps {
  invoice: NormalizedInvoice;
  title?: string;
  className?: string;
}

function partyName(party: any, fallback: string) {
  const full = [party?.firstName, party?.lastName].filter(Boolean).join(" ").trim();
  return full || party?.name || party?.companyName || fallback;
}

function addressText(address: any): string {
  if (!address) return "";
  if (typeof address === "string") return address;
  return [address.street, address.line1, address.city, address.state, address.zipCode, address.country]
    .filter(Boolean)
    .join(", ");
}

function money(amount: number, currency = "XOF") {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "XOF" ? 0 : 2,
    }).format(Number(amount || 0));
  } catch {
    return `${Number(amount || 0).toLocaleString("fr-FR")} FCFA`;
  }
}

function dateText(value: Date | string | undefined) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function roleLabel(value?: string) {
  const role = String(value || "").toLowerCase();
  if (["manager", "property_manager"].includes(role)) return "Gestionnaire";
  if (["owner", "direct_owner"].includes(role)) return "Propriétaire direct";
  if (role === "agency") return "Agence immobilière";
  if (["admin", "super_admin", "e_immo"].includes(role)) return "Gestion E-IMMO";
  return value || "";
}

function lineTypeLabel(value?: string) {
  const labels: Record<string, string> = {
    rent: "Loyer",
    security_deposit: "Garantie",
    pet_deposit: "Garantie animal",
    late_fee: "Retard",
    maintenance: "Maintenance",
    utility: "Charges",
    other: "Autre",
  };
  return labels[String(value || "").toLowerCase()] || "";
}

export function UnifiedInvoiceDocument({ invoice, title = "FACTURE", className = "" }: UnifiedInvoiceDocumentProps) {
  const company: any = invoice.companyInfo || {};
  const tenant: any = invoice.tenant || {};
  const property: any = invoice.property || {};
  const lease: any = invoice.leaseId || {};
  const issuerRole = roleLabel(company.roleLabel || company.accountType);
  const currency = invoice.currencyCode || "XOF";
  const propertyAddress = addressText(property.address);

  return (
    <article className={`bg-white text-slate-950 ${className}`}>
      <header className="grid gap-8 md:grid-cols-[1fr_auto] md:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {company.logo ? (
              <img src={company.logo} alt="Logo" className="h-12 w-12 object-contain" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-600 text-sm font-bold text-white">EI</div>
            )}
            <div className="min-w-0">
              <h2 className="break-words text-2xl font-bold tracking-tight">{company.name || "Émetteur"}</h2>
              {issuerRole ? <p className="text-sm font-medium text-slate-600">{issuerRole}</p> : null}
              <p className="text-sm font-semibold text-rose-600">Plateforme : E-IMMO</p>
            </div>
          </div>
          <div className="mt-4 space-y-1 text-sm text-slate-600">
            {company.legalName && company.legalName !== company.name ? <p>{company.legalName}</p> : null}
            {company.address ? <p className="break-words">{company.address}</p> : null}
            {company.phone ? <p>{company.phone}</p> : null}
            {company.email ? <p className="break-all">{company.email}</p> : null}
            {company.website ? <p className="break-all">{company.website}</p> : null}
            {(company.cip || company.ifu || company.rccm) ? (
              <p className="pt-1 text-xs text-slate-500">
                {[company.cip ? `CIP : ${company.cip}` : "", company.ifu ? `IFU : ${company.ifu}` : "", company.rccm ? `RCCM : ${company.rccm}` : ""].filter(Boolean).join(" • ")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="md:text-right">
          <h1 className="text-2xl font-black tracking-tight">{title}</h1>
          <p className="mt-2 text-sm font-semibold">N° {invoice.invoiceNumber}</p>
          <p className="mt-3 text-sm text-slate-600">Date d’émission : {dateText(invoice.issueDate)}</p>
          <p className="text-sm text-slate-600">Date d’échéance : {dateText(invoice.dueDate)}</p>
          <span className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {invoice.statusMeta?.label || invoice.status}
          </span>
        </div>
      </header>

      <section className="mt-7 grid gap-6 sm:mt-10 md:grid-cols-2 md:gap-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Facturé par</p>
          <p className="mt-2 text-base font-bold">{company.name || "—"}</p>
          {issuerRole ? <p className="text-sm text-slate-600">{issuerRole}</p> : null}
          <p className="text-sm font-semibold text-rose-600">Plateforme : E-IMMO</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Facturé à</p>
          <p className="mt-2 text-base font-bold">{partyName(tenant, "Locataire")}</p>
          {tenant.phone ? <p className="text-sm text-slate-600">{tenant.phone}</p> : null}
          {tenant.email ? <p className="break-all text-sm text-slate-600">{tenant.email}</p> : null}
          {property.name ? <p className="mt-1 text-sm text-slate-600">{property.name}{property.unit ? ` — ${property.unit}` : ""}</p> : null}
          {propertyAddress ? <p className="text-sm text-slate-600">{propertyAddress}</p> : null}
        </div>
      </section>

      {(property.name || lease?.startDate || lease?.endDate) ? (
        <section className="mt-7 grid gap-4 rounded-lg bg-slate-50 px-4 py-4 text-sm sm:mt-8 sm:grid-cols-3 sm:px-5">
          <div><p className="text-xs uppercase tracking-wide text-slate-500">Bien</p><p className="mt-1 font-semibold">{property.name || "—"}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-slate-500">Unité</p><p className="mt-1 font-semibold">{property.unit || "—"}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-slate-500">Période du bail</p><p className="mt-1 font-semibold">{lease?.startDate ? dateText(lease.startDate) : "—"}{lease?.endDate ? ` → ${dateText(lease.endDate)}` : ""}</p></div>
        </section>
      ) : null}

      <section className="mt-8 sm:mt-10">
        <div className="space-y-3 sm:hidden">
          {invoice.lineItems.length ? invoice.lineItems.map((item, index) => (
            <div key={`${item.description}-mobile-${index}`} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">{item.description}</p>
                  {lineTypeLabel(item.type) ? <p className="mt-1 text-xs text-slate-500">{lineTypeLabel(item.type)}</p> : null}
                </div>
                <p className="shrink-0 whitespace-nowrap text-sm font-bold">{money(item.total, currency)}</p>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>Qté : {item.quantity}</span>
                <span className="whitespace-nowrap">Prix : {money(item.unitPrice, currency)}</span>
              </div>
            </div>
          )) : (
            <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">Aucune ligne de facture</p>
          )}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[620px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3 font-semibold">#</th>
                <th className="px-3 py-3 font-semibold">Description</th>
                <th className="px-3 py-3 text-right font-semibold">Qté</th>
                <th className="px-3 py-3 text-right font-semibold">Prix unitaire</th>
                <th className="px-3 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.length ? invoice.lineItems.map((item, index) => (
                <tr key={`${item.description}-${index}`} className="odd:bg-white even:bg-slate-50/40">
                  <td className="px-3 py-4 text-slate-500">{index + 1}</td>
                  <td className="px-3 py-4"><p className="font-semibold">{item.description}</p>{lineTypeLabel(item.type) ? <p className="text-xs text-slate-500">{lineTypeLabel(item.type)}</p> : null}</td>
                  <td className="px-3 py-4 text-right">{item.quantity}</td>
                  <td className="px-3 py-4 text-right">{money(item.unitPrice, currency)}</td>
                  <td className="px-3 py-4 text-right font-semibold">{money(item.total, currency)}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Aucune ligne de facture</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 flex justify-end">
        <dl className="w-full max-w-sm space-y-2 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Sous-total</dt><dd className="whitespace-nowrap">{money(invoice.totals.subtotal, currency)}</dd></div>
          {invoice.totals.shippingAmount ? <div className="flex justify-between gap-3"><dt className="text-slate-500">Frais</dt><dd className="whitespace-nowrap">{money(invoice.totals.shippingAmount, currency)}</dd></div> : null}
          {invoice.totals.discountAmount ? <div className="flex justify-between gap-3"><dt className="text-slate-500">Remise</dt><dd className="whitespace-nowrap">-{money(invoice.totals.discountAmount, currency)}</dd></div> : null}
          {invoice.totals.taxAmount ? <div className="flex justify-between gap-3"><dt className="text-slate-500">Taxes</dt><dd className="whitespace-nowrap">{money(invoice.totals.taxAmount, currency)}</dd></div> : null}
          <div className="flex justify-between gap-3 pt-3 text-base font-black sm:text-lg"><dt>Total</dt><dd className="whitespace-nowrap">{money(invoice.totals.total, currency)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Montant payé</dt><dd className="whitespace-nowrap">{money(invoice.totals.amountPaid, currency)}</dd></div>
          <div className="flex justify-between gap-3 font-semibold"><dt>Solde dû</dt><dd className="whitespace-nowrap">{money(invoice.totals.balanceDue, currency)}</dd></div>
        </dl>
      </section>

      {invoice.notes ? (
        <footer className="mt-12 grid gap-6 text-sm md:grid-cols-[1fr_auto]">
          <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Notes</p><p className="mt-2 max-w-xl text-slate-600">{invoice.notes}</p></div>
          <div className="md:text-right"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Une question ?</p><p className="mt-2 break-all text-slate-600">{company.email || "contact@e-immo.bj"}</p></div>
        </footer>
      ) : null}
    </article>
  );
}

export default UnifiedInvoiceDocument;

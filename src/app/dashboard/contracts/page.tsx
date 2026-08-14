"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const unwrap = (j:any)=>j?.data ?? j ?? [];
const signatureLabel = (s:string) => s === "signed" ? "Signé" : s === "pending_signature" ? "À lire et signer" : s === "rejected" ? "Refusé" : "Non envoyé";

export default function MyContractsPage(){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{ fetch("/api/contracts",{cache:"no-store"}).then(async r=>{const j=await r.json(); if(!r.ok) throw new Error(j?.error||"Chargement impossible"); return j;}).then(j=>setItems(unwrap(j))).catch(e=>setError(e.message)).finally(()=>setLoading(false)); },[]);
  if(loading) return <div className="p-4 md:p-8">Chargement des contrats…</div>;
  return <div className="mx-auto max-w-6xl p-3 text-slate-950 sm:p-5 md:p-8">
    <p className="text-xs font-bold text-red-600">E-IMMO.BJ • DOCUMENTS</p>
    <h1 className="text-2xl font-bold">Mes contrats E-IMMO</h1>
    <p className="mt-1 text-sm text-slate-600">Retrouvez les contrats transmis à votre compte, leur statut, leur PDF et leur signature.</p>
    {error && <div className="mt-4 rounded-xl bg-red-50 p-4 text-red-900">{error}</div>}
    <div className="mt-5 grid gap-3">
      {items.map(c=><Link key={c._id} href={`/dashboard/contracts/${c._id}`} className="rounded-2xl bg-white p-4 shadow-sm hover:bg-slate-50">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div><b>{c.contractNumber}</b><p className="text-sm text-slate-600">{c.title || "Contrat E-IMMO"}</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{signatureLabel(c.signatureStatus)}</span>
        </div>
      </Link>)}
      {!items.length && <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">Aucun contrat enregistré pour ce compte.</div>}
    </div>
  </div>;
}

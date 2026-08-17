"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle } from "lucide-react";
import { shareDocumentViaWhatsApp } from "@/lib/whatsapp";

const unwrap = (j: any) => j?.data ?? j;

export default function ContractReviewPage() {
  const p = useParams<{ id: string }>();
  const [contract, setContract] = useState<any>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [ack, setAck] = useState(false);
  const [signing, setSigning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch(`/api/contracts/${p.id}`, { cache: "no-store" })
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j?.error || "Chargement impossible"); return j; })
      .then(j => { const c = unwrap(j); setContract(c); const a=c?.accountId||{}; setName(a.businessName || `${a.firstName||""} ${a.lastName||""}`.trim()); })
      .catch(e => setError(e.message));
  }, [p.id]);

  async function sign() {
    if (!ack || !name.trim()) return;
    setSigning(true);
    try {
      const r = await fetch(`/api/contracts/${p.id}`, { method: "PATCH", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ acknowledged: ack, signatoryName: name }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Signature impossible");
      setContract(unwrap(j));
      toast({
        title: "Contrat signé",
        description:
          "Votre signature a été enregistrée et le document reste disponible dans E-IMMO.",
      });
    } catch(e:any) {
      toast({
        title: "Signature impossible",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSigning(false);
    }
  }

  async function shareContract() {
    const account = contract?.accountId || {};
    const phone = account.whatsappNumber || account.phone;
    if (!phone) {
      toast({
        title: "WhatsApp indisponible",
        description: "Le numéro WhatsApp du contractant n’est pas renseigné.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await shareDocumentViaWhatsApp({
        phone,
        documentUrl: `/api/contracts/${p.id}/pdf`,
        fileName: `contrat-${contract.contractNumber}.pdf`,
        title: `Contrat ${contract.contractNumber}`,
        message: `Bonjour, voici le contrat ${contract.contractNumber} transmis depuis GESTION E-IMMO.`,
      });
      if (result === "unavailable") throw new Error("Numéro WhatsApp invalide");
    } catch (error) {
      toast({
        title: "Partage WhatsApp impossible",
        description: error instanceof Error ? error.message : "Impossible de partager le contrat.",
        variant: "destructive",
      });
    }
  }

  if (error) return <div className="p-4 md:p-8"><div className="rounded-2xl bg-red-50 p-5 text-red-900">{error}</div></div>;
  if (!contract) return <div className="p-4 md:p-8">Chargement du contrat…</div>;

  const signed = contract.signatureStatus === "signed";
  return <div className="mx-auto max-w-5xl p-3 text-slate-950 sm:p-5 md:p-8">
    <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
      <p className="text-xs font-bold text-red-600">E-IMMO.BJ • DOCUMENT CONTRACTUEL</p>
      <h1 className="mt-1 text-2xl font-bold">{contract.contractNumber}</h1>
      <p className="mt-1 text-sm text-slate-600">Prenez le temps de lire l'intégralité du document avant signature.</p>
      <div className="mt-4 grid grid-cols-1 gap-2 print:hidden min-[380px]:grid-cols-3 sm:flex sm:flex-wrap">
        <a href={`/api/contracts/${p.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex h-10 min-w-0 items-center justify-center whitespace-nowrap rounded-md bg-slate-950 px-3 text-xs font-medium text-white sm:px-4 sm:text-sm">Télécharger le PDF</a>
        <Button variant="outline" onClick={() => window.print()}>Imprimer</Button>
        <Button variant="outline" className="text-green-700" onClick={shareContract}>
          <MessageCircle className="mr-2 h-4 w-4" />
          WhatsApp
        </Button>
      </div>
      <div className="mt-5 whitespace-pre-wrap rounded-xl border bg-white p-4 text-sm leading-6 sm:p-6">{contract.contractBody}</div>
    </div>

    <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm sm:p-6 print:hidden">
      <h2 className="text-lg font-bold">Signature du contractant</h2>
      {signed ? <div className="mt-3 rounded-xl bg-emerald-50 p-4 text-emerald-900"><b>Contrat signé.</b><br/>Signataire : {contract.signatoryName}<br/>Date : {contract.signedAt ? new Date(contract.signedAt).toLocaleString("fr-FR") : "—"}</div>
      : contract.signatureStatus !== "pending_signature" ? <p className="mt-2 text-sm text-slate-600">Ce document n'a pas encore été officiellement envoyé pour signature.</p>
      : <>
        <label className="mt-4 block text-sm font-medium">Nom du signataire<Input className="mt-1" value={name} onChange={e=>setName(e.target.value)} /></label>
        <label className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm"><input type="checkbox" className="mt-1" checked={ack} onChange={e=>setAck(e.target.checked)} /><span>Je confirme avoir pris le temps de lire l'intégralité du contrat, comprendre ses conditions et accepter de le signer.</span></label>
        <ConfirmationDialog
          title="Confirmer la signature"
          description="Confirmez-vous avoir lu l'intégralité du contrat et vouloir le signer ?"
          confirmText="Signer le contrat"
          loading={signing}
          disabled={!ack || !name.trim() || signing}
          onConfirm={sign}
        >
          <Button
            className="mt-4 w-full sm:w-auto"
            disabled={!ack || !name.trim() || signing}
          >
            {signing ? "Signature…" : "Signer le contrat"}
          </Button>
        </ConfirmationDialog>
      </>}
    </div>
  </div>;
}

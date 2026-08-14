"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, MessageCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const unwrap = (json: any) => json?.data ?? json;

async function readJson(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Le service WhatsApp E-IMMO est momentanément indisponible.");
  }
  return response.json();
}

export function WhatsAppVerificationCard() {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [number, setNumber] = useState("");
  const [reason, setReason] = useState("");
  const [showReason, setShowReason] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const shown = useRef(false);

  const status = data?.whatsappVerificationStatus || "not_requested";
  const changeStatus = data?.whatsappChangeStatus || "none";
  const verified = status === "verified";
  const approvedChange = changeStatus === "approved";
  const changeVerificationPending = changeStatus === "verification_pending";
  const changed =
    verified && number.trim() !== String(data?.whatsappNumber || "").trim();

  useEffect(() => {
    let mounted = true;
    fetch("/api/users/whatsapp", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then(async response => {
        const json = await readJson(response);
        if (!response.ok) {
          throw new Error(json?.error || "Chargement WhatsApp impossible");
        }
        return json;
      })
      .then(json => {
        if (!mounted) return;
        const current = unwrap(json);
        setData(current);
        const useRequestedNumber = ["approved", "verification_pending"].includes(
          current?.whatsappChangeStatus
        );
        setNumber(
          useRequestedNumber
            ? current?.whatsappChangeRequestedNumber || ""
            : current?.whatsappNumber || current?.phone || ""
        );
      })
      .catch(error => {
        if (!mounted || shown.current) return;
        shown.current = true;
        toast({
          title: "WhatsApp indisponible",
          description: error?.message,
          variant: "destructive",
        });
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [toast]);

  async function submit() {
    if (!number.trim()) return;
    if (
      verified &&
      changed &&
      !approvedChange &&
      !changeVerificationPending &&
      !showReason
    ) {
      setShowReason(true);
      return;
    }

    setRequesting(true);
    try {
      const response = await fetch("/api/users/whatsapp", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ whatsappNumber: number, changeReason: reason }),
      });
      const json = await readJson(response);
      if (!response.ok) {
        throw new Error(json?.error || "Vérification WhatsApp impossible");
      }

      const current = unwrap(json);
      setData((existing: any) => ({ ...existing, ...current }));
      if (current?.changeRequestCreated) {
        setShowReason(false);
        toast({
          title: "Demande transmise",
          description:
            "Votre ancien numéro reste valide. Le Super Admin doit autoriser le changement avant la vérification du nouveau numéro.",
        });
        return;
      }

      if (current?.whatsappUrl) {
        window.open(current.whatsappUrl, "_blank", "noopener,noreferrer");
      }
      toast({
        title: "Vérification demandée",
        description:
          "Envoyez réellement le message WhatsApp prérempli au numéro officiel E-IMMO.",
      });
    } catch (error: any) {
      toast({
        title: "Opération WhatsApp impossible",
        description: error?.message || "Réessayez.",
        variant: "destructive",
      });
    } finally {
      setRequesting(false);
    }
  }

  const inputLocked = ["pending", "approved", "verification_pending"].includes(
    changeStatus
  );
  const buttonLabel = requesting
    ? "Traitement…"
    : changeStatus === "pending"
      ? "En attente d'autorisation"
      : approvedChange
        ? "Vérifier le nouveau numéro"
        : changeVerificationPending
          ? "Renvoyer le message"
          : verified
            ? changed
              ? "Demander le changement"
              : "Numéro vérifié"
            : status === "pending"
              ? "Renvoyer le message"
              : "Vérifier mon WhatsApp";

  return (
    <div
      id="whatsapp-eimmo"
      className="mt-5 scroll-mt-24 rounded-2xl border bg-white p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <MessageCircle className="mt-0.5 h-5 w-5 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">WhatsApp E-IMMO</h3>
          <p className="mt-1 text-sm text-slate-600">
            Avant la première validation, le numéro reste modifiable. Le changement
            d'un numéro déjà vérifié exige une justification et l'autorisation du
            Super Administrateur E-IMMO.
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={number}
              onChange={event => setNumber(event.target.value)}
              placeholder="0197719198"
              disabled={loading || requesting || inputLocked}
            />
            <Button
              type="button"
              disabled={
                loading ||
                requesting ||
                !number.trim() ||
                changeStatus === "pending" ||
                (verified && !changed && !approvedChange && !changeVerificationPending)
              }
              onClick={submit}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {buttonLabel}
            </Button>
          </div>

          {verified && changed && showReason && !approvedChange && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <label className="text-sm font-semibold">
                Pourquoi souhaitez-vous changer votre numéro WhatsApp ?
              </label>
              <textarea
                value={reason}
                onChange={event => setReason(event.target.value)}
                maxLength={1000}
                rows={4}
                className="mt-2 w-full rounded-lg border bg-white p-3 text-sm outline-none"
                placeholder="Ex. perte de la SIM, ancien numéro inaccessible, changement de numéro professionnel…"
              />
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  onClick={submit}
                  disabled={requesting || reason.trim().length < 10}
                >
                  Envoyer la demande
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowReason(false);
                    setNumber(data?.whatsappNumber || "");
                    setReason("");
                  }}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {changeStatus === "pending" && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">
                Changement de numéro en attente d'autorisation E-IMMO
              </p>
              <p className="mt-1">
                Numéro actuel : {data?.whatsappNumber || "—"}
                <br />
                Nouveau numéro demandé : {data?.whatsappChangeRequestedNumber || "—"}
                <br />
                Motif : {data?.whatsappChangeReason || "—"}
              </p>
            </div>
          )}

          {approvedChange && (
            <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
              <b>Changement autorisé.</b> Cliquez sur « Vérifier le nouveau numéro »,
              puis envoyez réellement le message à E-IMMO. L'ancien numéro reste
              vérifié jusqu'à la confirmation finale.
            </div>
          )}

          {changeVerificationPending && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="flex items-center gap-2 font-medium">
                <Clock3 className="h-4 w-4" />
                Vérification du nouveau numéro en attente
              </p>
              <p className="mt-1">
                Le Super Admin doit comparer le numéro expéditeur et le code reçu.
                Votre ancien numéro reste valide jusque-là.
              </p>
            </div>
          )}

          {changeStatus === "rejected" && verified && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="flex items-center gap-2 font-medium">
                <XCircle className="h-4 w-4" />
                Changement refusé
              </p>
              <p className="mt-1">Votre numéro WhatsApp vérifié reste inchangé.</p>
            </div>
          )}

          {status === "pending" && !changeVerificationPending && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="flex items-center gap-2 font-medium">
                <Clock3 className="h-4 w-4" />
                Vérification demandée
              </p>
              <p className="mt-1">
                Envoyez réellement le message WhatsApp prérempli. Le Super Admin
                confirmera ensuite le numéro et le code reçus.
              </p>
            </div>
          )}

          {status === "verified" &&
            !changed &&
            !["pending", "approved", "verification_pending"].includes(changeStatus) && (
              <p className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Numéro vérifié par E-IMMO
                {data?.whatsappVerifiedAt
                  ? ` le ${new Date(data.whatsappVerifiedAt).toLocaleDateString("fr-FR")}`
                  : ""}
                .
              </p>
            )}

          {status === "rejected" && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="flex items-center gap-2 font-medium">
                <XCircle className="h-4 w-4" />
                Vérification refusée
              </p>
              <p className="mt-1">
                Corrigez votre numéro puis envoyez une nouvelle demande.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

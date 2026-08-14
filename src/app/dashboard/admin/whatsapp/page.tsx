"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  MessageCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

const unwrap = (j: any) => j?.data ?? j;

const digits = (v: string) =>
  String(v || "").replace(/\D/g, "");

function userName(user: any) {
  return (
    user.businessName ||
    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
    user.email
  );
}

export default function AdminWhatsAppContactsPage() {
  const { toast } = useToast();

  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(
    null
  );
  const [numbers, setNumbers] = useState<
    Record<string, string>
  >({});
  const [receivedCodes, setReceivedCodes] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);

    try {
      const response = await fetch(
        "/api/admin/whatsapp/contacts",
        { cache: "no-store" }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "Chargement des vérifications impossible"
        );
      }

      const rows = unwrap(json) || [];
      setContacts(rows);
      setNumbers(
        Object.fromEntries(
          rows.map((item: any) => [
            item._id,
            item.whatsappNumber || item.phone || "",
          ])
        )
      );
    } catch (error: any) {
      toast({
        title: "Chargement impossible",
        description: error?.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pending = useMemo(
    () =>
      contacts.filter(
        c => c.whatsappVerificationStatus === "pending"
      ),
    [contacts]
  );

  const verified = useMemo(
    () =>
      contacts.filter(
        c => c.whatsappVerificationStatus === "verified"
      ),
    [contacts]
  );

  const rejected = useMemo(
    () =>
      contacts.filter(
        c => c.whatsappVerificationStatus === "rejected"
      ),
    [contacts]
  );

  const pendingChanges = useMemo(
    () => contacts.filter(c => c.whatsappChangeStatus === "pending"),
    [contacts]
  );

  async function process(
    contact: any,
    action: "verify" | "reject"
  ) {
    const id = contact._id;
    setProcessing(id);

    try {
      const response = await fetch(
        `/api/admin/whatsapp/verify/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            requestId: contact.requestId,
            whatsappNumber: numbers[id],
            receivedCode: receivedCodes[id] || "",
            messageReceived: action === "verify",
          }),
        }
      );

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || "Opération impossible");
      }

      toast({
        title: action === "verify" ? "WhatsApp vérifié" : "Vérification refusée",
        description: action === "verify"
          ? "Le code reçu sur WhatsApp correspond. Le numéro est officiellement vérifié."
          : "L'utilisateur pourra corriger son numéro et refaire une demande.",
      });

      setReceivedCodes(current => ({ ...current, [id]: "" }));
      await load();
    } catch (error: any) {
      toast({
        title: "Opération impossible",
        description: error?.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  }

  async function processChange(
    contact: any,
    action: "approve" | "reject"
  ) {
    const id = contact._id;
    setProcessing(`change-${id}`);

    try {
      const response = await fetch(
        `/api/admin/whatsapp/change/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || "Opération impossible");
      }

      toast({
        title: action === "approve"
          ? "Changement autorisé"
          : "Changement refusé",
        description: action === "approve"
          ? "L'utilisateur peut maintenant vérifier le nouveau numéro. L'ancien reste actif jusqu'à la confirmation finale."
          : "Le numéro actuellement vérifié reste inchangé.",
      });
      await load();
    } catch (error: any) {
      toast({
        title: "Opération impossible",
        description: error?.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-3 sm:p-5 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-red-600">
            E-IMMO • ADMINISTRATION
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            Vérifications WhatsApp
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Comparez le code reçu sur le WhatsApp officiel
            E-IMMO avec le code affiché ici. Confirmez ensuite
            le numéro depuis lequel l'utilisateur a réellement
            envoyé son message.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualiser
        </Button>
      </div>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Clock3 className="h-5 w-5 text-blue-600" />
          Changements de numéro à autoriser ({pendingChanges.length})
        </h2>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {pendingChanges.map(contact => (
            <div
              key={`change-${contact._id}`}
              className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm"
            >
              <b className="break-words">{userName(contact)}</b>
              <p className="mt-1 break-all text-sm text-slate-600">
                {contact.email}
              </p>
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
                <p>
                  <span className="text-slate-500">Numéro vérifié actuel :</span>{" "}
                  <strong>{contact.whatsappNumber || "—"}</strong>
                </p>
                <p className="mt-1">
                  <span className="text-slate-500">Nouveau numéro demandé :</span>{" "}
                  <strong>{contact.whatsappChangeRequestedNumber || "—"}</strong>
                </p>
                <p className="mt-3 font-medium">Justification de l'utilisateur</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-slate-700">
                  {contact.whatsappChangeReason || "Aucune justification fournie"}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Demande :{" "}
                  {contact.whatsappChangeRequestedAt
                    ? new Date(contact.whatsappChangeRequestedAt).toLocaleString("fr-FR")
                    : "—"}
                </p>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <ConfirmationDialog
                  title="Autoriser ce changement WhatsApp"
                  description="L'utilisateur pourra vérifier le nouveau numéro. L'ancien restera valide jusqu'à la confirmation du code reçu."
                  confirmText="Autoriser"
                  loading={processing === `change-${contact._id}`}
                  onConfirm={() => processChange(contact, "approve")}
                >
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    disabled={processing === `change-${contact._id}`}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Autoriser
                  </Button>
                </ConfirmationDialog>

                <ConfirmationDialog
                  title="Refuser ce changement WhatsApp"
                  description="Le numéro actuellement vérifié restera inchangé."
                  confirmText="Refuser"
                  loading={processing === `change-${contact._id}`}
                  onConfirm={() => processChange(contact, "reject")}
                >
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={processing === `change-${contact._id}`}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Refuser
                  </Button>
                </ConfirmationDialog>
              </div>
            </div>
          ))}
        </div>

        {!loading && !pendingChanges.length && (
          <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            Aucune demande de changement WhatsApp en attente.
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Clock3 className="h-5 w-5 text-amber-600" />
          En attente ({pending.length})
        </h2>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {pending.map(contact => (
            <div
              key={contact._id}
              className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0">
                <b className="break-words">
                  {userName(contact)}
                </b>

                <p className="mt-1 break-all text-sm text-slate-600">
                  {contact.email}
                </p>

                <p className="mt-2 text-sm">
                  Code reçu attendu :{" "}
                  <strong>
                    {contact.whatsappVerificationCode ||
                      "Non disponible"}
                  </strong>
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Demande :{" "}
                  {contact.whatsappVerificationRequestedAt
                    ? new Date(
                        contact.whatsappVerificationRequestedAt
                      ).toLocaleString("fr-FR")
                    : "—"}
                </p>
              </div>

              <div className="mt-4">
                <label className="text-xs font-medium text-slate-600">
                  Numéro WhatsApp constaté / à confirmer
                </label>
                <Input
                  className="mt-1"
                  value={numbers[contact._id] || ""}
                  onChange={event =>
                    setNumbers(current => ({
                      ...current,
                      [contact._id]: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="mt-3">
                <label className="text-xs font-medium text-slate-600">
                  Code réellement reçu sur WhatsApp
                </label>
                <Input
                  className="mt-1 font-mono uppercase"
                  value={receivedCodes[contact._id] || ""}
                  onChange={event =>
                    setReceivedCodes(current => ({
                      ...current,
                      [contact._id]: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Ex. WA-66A547"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Saisissez uniquement le code lu dans le message effectivement reçu sur le WhatsApp officiel E-IMMO.
                </p>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <ConfirmationDialog
                  title="Confirmer ce numéro WhatsApp"
                  description={`Avez-vous bien reçu le code ${
                    contact.whatsappVerificationCode || ""
                  } depuis ce numéro WhatsApp ?`}
                  confirmText="Confirmer le numéro"
                  loading={processing === contact._id}
                  onConfirm={() =>
                    process(contact, "verify")
                  }
                >
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    disabled={
                      processing === contact._id ||
                      !(receivedCodes[contact._id] || "").trim()
                    }
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirmer
                  </Button>
                </ConfirmationDialog>

                <ConfirmationDialog
                  title="Refuser cette vérification"
                  description="L'utilisateur devra corriger son numéro ou renvoyer une nouvelle demande."
                  confirmText="Refuser"
                  loading={processing === contact._id}
                  onConfirm={() =>
                    process(contact, "reject")
                  }
                >
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={processing === contact._id}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Refuser
                  </Button>
                </ConfirmationDialog>
              </div>
            </div>
          ))}
        </div>

        {!loading && !pending.length && (
          <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            Aucune vérification WhatsApp en attente.
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          Numéros vérifiés ({verified.length})
        </h2>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {verified.map(contact => {
            const name = userName(contact);

            const url =
              `https://wa.me/${digits(
                contact.whatsappNumber
              )}?text=` +
              encodeURIComponent(
                `Bonjour ${name},\n\nMessage de GESTION E-IMMO.BJ.`
              );

            return (
              <div
                key={contact._id}
                className="rounded-2xl border bg-white p-4 shadow-sm"
              >
                <b>{name}</b>

                <p className="mt-1 break-all text-sm text-slate-600">
                  {contact.email}
                </p>

                <p className="text-sm text-slate-600">
                  {contact.whatsappNumber}
                </p>

                <p className="mt-1 text-xs text-emerald-700">
                  Vérifié le{" "}
                  {contact.whatsappVerifiedAt
                    ? new Date(
                        contact.whatsappVerifiedAt
                      ).toLocaleString("fr-FR")
                    : "—"}
                </p>

                <Button
                  asChild
                  className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Ouvrir WhatsApp
                  </a>
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {!!rejected.length && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">
            Vérifications refusées ({rejected.length})
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Ces utilisateurs peuvent renvoyer une nouvelle demande
            depuis leur profil.
          </p>
        </section>
      )}
    </div>
  );
}

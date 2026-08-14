"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock3, MessageCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const unwrap = (j: any) => j?.data ?? j;

type WhatsAppStatus =
  | "not_requested"
  | "pending"
  | "verified"
  | "rejected";

export function WhatsAppVerificationBanner() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);

  useEffect(() => {
    let mounted = true;

    fetch("/api/users/whatsapp", { cache: "no-store" })
      .then(async response => {
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) return null;

        const json = await response.json();
        if (!response.ok) return null;

        return unwrap(json);
      })
      .then(data => {
        if (!mounted || !data) return;

        setStatus(
          (data.whatsappVerificationStatus ||
            (data.whatsappVerifiedAt ? "verified" : "not_requested")) as WhatsAppStatus
        );
      })
      .catch(() => {
        // L'alerte WhatsApp ne doit jamais bloquer le Dashboard.
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!status || status === "verified") return null;

  const href = "/dashboard/settings/profile#whatsapp-eimmo";

  if (status === "pending") {
    return (
      <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
            <div className="min-w-0">
              <p className="font-semibold text-blue-950">
                Vérification WhatsApp en attente de validation par E-IMMO
              </p>
              <p className="mt-1 text-sm text-blue-800">
                Si vous n'avez pas encore envoyé le message WhatsApp avec votre code,
                vous pouvez le renvoyer depuis votre profil.
              </p>
            </div>
          </div>

          <Button asChild variant="outline" className="shrink-0 bg-white">
            <Link href={href}>Voir le statut</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
            <div className="min-w-0">
              <p className="font-semibold text-red-950">
                Votre vérification WhatsApp n'a pas été validée
              </p>
              <p className="mt-1 text-sm text-red-800">
                Vérifiez le numéro utilisé puis envoyez une nouvelle demande à E-IMMO.
              </p>
            </div>
          </div>

          <Button asChild variant="outline" className="shrink-0 bg-white">
            <Link href={href}>Recommencer</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-950">
              Votre numéro WhatsApp n'est pas encore vérifié
            </p>
            <p className="mt-1 text-sm text-slate-700">
              Vérifiez-le pour recevoir les communications et documents E-IMMO
              par WhatsApp lorsque cette option est disponible.
            </p>
          </div>
        </div>

        <Button asChild className="shrink-0 bg-emerald-600 hover:bg-emerald-700">
          <Link href={href}>Vérifier maintenant</Link>
        </Button>
      </div>
    </div>
  );
}

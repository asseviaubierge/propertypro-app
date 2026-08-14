"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Mail, MessageCircle, } from "lucide-react";

type Status = "validating" | "ready" | "confirming" | "success" | "error";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("validating");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [adminWhatsappNumber, setAdminWhatsappNumber] = useState("");
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [companyName, setCompanyName] = useState("GESTION E-IMMO");
  const [userWhatsappNumber, setUserWhatsappNumber] = useState("");
  const [whatsappVerificationCode, setWhatsappVerificationCode] = useState("");
  const [whatsappStatus, setWhatsappStatus] = useState<
    "not_requested" | "pending" | "verified" | "rejected"
  >("not_requested");
  const [openingWhatsApp, setOpeningWhatsApp] = useState(false);

useEffect(() => {
  (async () => {
    try {
      const res = await fetch("/api/branding/public");
      const data = await res.json();

      if (res.ok && data?.success && data?.data) {
        setAdminWhatsappNumber(data.data.whatsappNumber || "");
        setWhatsappEnabled(data.data.whatsappEnabled ?? false);
        setCompanyName(data.data.companyName || "GESTION E-IMMO");
      }
    } catch {
      // WhatsApp reste simplement indisponible si le branding ne peut pas être chargé.
    }
  })();
}, []);

const openWhatsApp = async () => {
  if (!whatsappVerificationCode || !email) return;

  setOpeningWhatsApp(true);
  try {
    const response = await fetch("/api/user/request-whatsapp-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        code: whatsappVerificationCode,
        whatsappNumber: userWhatsappNumber,
      }),
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(
        "Le serveur n'a pas pu démarrer la vérification WhatsApp."
      );
    }

    const data = await response.json();
    if (!response.ok || data?.success === false) {
      throw new Error(
        data?.error || "Impossible de démarrer la vérification WhatsApp."
      );
    }

    const payload = data?.data || data;
    if (payload?.alreadyVerified) {
      setWhatsappStatus("verified");
      return;
    }

    setWhatsappStatus("pending");

    if (payload?.whatsappUrl) {
      window.open(payload.whatsappUrl, "_blank", "noopener,noreferrer");
    }
  } catch (error) {
    setMessage(
      error instanceof Error
        ? error.message
        : "Impossible de démarrer la vérification WhatsApp."
    );
  } finally {
    setOpeningWhatsApp(false);
  }
};

  // Validate the token on load.
  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Aucun jeton de vérification n'a été fourni.");
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `/api/user/confirm-email-verification?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();
        if (!res.ok || data?.success === false) {
          throw new Error(data?.error || "Ce lien est invalide ou a expiré.");
        }
        setEmail(data?.data?.email || "");
        setStatus("ready");
      } catch (err) {
        setStatus("error");
        setMessage(
          err instanceof Error ? err.message : "Ce lien est invalide ou a expiré."
        );
      }
    })();
  }, [token]);

  const handleConfirm = async () => {
    setStatus("confirming");
    try {
      const res = await fetch("/api/user/confirm-email-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "Impossible de vérifier votre adresse e-mail.");
      }
      const payload = data?.data || data;
      setUserWhatsappNumber(
        payload?.whatsappNumber || payload?.phone || ""
      );
      setWhatsappVerificationCode(
        payload?.whatsappVerificationCode || ""
      );
      setWhatsappStatus(
        payload?.whatsappVerificationStatus || "not_requested"
      );
      setStatus("success");
      setMessage("Votre adresse e-mail a été confirmée avec succès.");
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Impossible de vérifier votre adresse e-mail."
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {status === "success" ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : status === "error" ? (
              <XCircle className="h-6 w-6 text-red-600" />
            ) : (
              <Mail className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle>Vérifiez votre adresse e-mail</CardTitle>
          <CardDescription>
            {status === "validating" && "Vérification de votre lien en cours…"}
            {status === "ready" && `Confirmez que ${email} est bien votre adresse e-mail.`}
            {status === "confirming" && "Confirmation de votre adresse e-mail…"}
            {(status === "success" || status === "error") && message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "validating" && (
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {status === "ready" && (
            <Button className="w-full" onClick={handleConfirm}>
              Confirmer mon adresse e-mail
            </Button>
          )}

          {status === "confirming" && (
            <Button className="w-full" disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
              Vérification…
            </Button>
          )}

          {status === "success" && (
  <div className="space-y-3">
    {whatsappEnabled && adminWhatsappNumber && (
      <>
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p>Votre adresse e-mail est maintenant confirmée.</p>
          <p className="mt-2">
            Étape suivante : envoyez le message de vérification au WhatsApp
            officiel de{" "}
            <strong className="text-foreground">{companyName}</strong>.
            Le Super Administrateur confirmera ensuite votre numéro.
          </p>

          {userWhatsappNumber && (
            <p className="mt-2 font-medium text-foreground">
              Numéro proposé : {userWhatsappNumber}
            </p>
          )}

          {whatsappVerificationCode && (
            <p className="mt-1 text-xs">
              Code : {whatsappVerificationCode}
            </p>
          )}
        </div>

        {whatsappStatus === "verified" ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
            Votre numéro WhatsApp est déjà vérifié par E-IMMO.
          </div>
        ) : whatsappStatus === "pending" ? (
          <div className="space-y-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Vérification demandée. Après l'envoi du message WhatsApp,
              E-IMMO confirmera votre numéro depuis l'administration.
            </div>

            <Button
              type="button"
              onClick={openWhatsApp}
              disabled={openingWhatsApp}
              className="w-full bg-green-600 text-white hover:bg-green-700"
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              {openingWhatsApp ? "Ouverture de WhatsApp…" : "Rouvrir WhatsApp"}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            onClick={openWhatsApp}
            disabled={openingWhatsApp || !whatsappVerificationCode}
            className="w-full bg-green-600 text-white hover:bg-green-700"
          >
            <MessageCircle className="mr-2 h-5 w-5" />
            {openingWhatsApp ? "Préparation…" : "Vérifier mon WhatsApp"}
          </Button>
        )}
      </>
    )}

    <Button variant="outline" className="w-full" asChild>
      <Link href="/auth/signin">
        Se connecter
      </Link>
    </Button>
  </div>
)}

          {status === "error" && (
            <Button variant="outline" className="w-full" asChild>
              <Link href="/dashboard/settings/security">
                Retour aux paramètres de sécurité
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}

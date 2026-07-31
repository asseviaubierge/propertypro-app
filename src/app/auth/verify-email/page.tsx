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
  const [whatsappNumber, setWhatsappNumber] = useState("");
const [whatsappEnabled, setWhatsappEnabled] = useState(false);
const [companyName, setCompanyName] = useState("GESTION E-IMMO");

useEffect(() => {
  (async () => {
    try {
      const res = await fetch("/api/branding/public");
      const data = await res.json();

      if (res.ok && data?.success && data?.data) {
        setWhatsappNumber(data.data.whatsappNumber || "");
        setWhatsappEnabled(data.data.whatsappEnabled ?? false);
        setCompanyName(data.data.companyName || "GESTION E-IMMO");
      }
    } catch {
      // WhatsApp reste simplement indisponible si le branding ne peut pas être chargé.
    }
  })();
}, []);

const openWhatsApp = () => {
  const cleanNumber = whatsappNumber.replace(/\D/g, "");
  if (!cleanNumber) return;

  const whatsappMessage = encodeURIComponent(
    `Bonjour ${companyName}, je viens de confirmer mon adresse e-mail ${email} sur E-IMMO et je souhaite confirmer mon numéro WhatsApp.`
  );

  window.open(
    `https://wa.me/${cleanNumber}?text=${whatsappMessage}`,
    "_blank",
    "noopener,noreferrer"
  );
};

  // Validate the token on load.
  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token was provided.");
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `/api/user/confirm-email-verification?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();
        if (!res.ok || data?.success === false) {
          throw new Error(data?.error || "This link is invalid or has expired.");
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
        throw new Error(data?.error || "Failed to verify your email.");
      }
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
              Verifying…
            </Button>
          )}

          {status === "success" && (
  <div className="space-y-3">
    {whatsappEnabled && whatsappNumber && (
      <>
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          Votre adresse e-mail est maintenant confirmée.
          Vous pouvez également confirmer votre numéro WhatsApp auprès de{" "}
          <strong className="text-foreground">{companyName}</strong>.
        </div>

        <Button
          type="button"
          onClick={openWhatsApp}
          className="w-full bg-green-600 text-white hover:bg-green-700"
        >
          <MessageCircle className="mr-2 h-5 w-5" />
          Confirmer mon WhatsApp
        </Button>
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

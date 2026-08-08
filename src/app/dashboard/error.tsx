"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  RefreshCw,
  Home,
  ArrowLeft,
  LayoutDashboard,
  Shield,
  Database,
  Wifi,
  Settings,
  MessageSquare,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

function getErrorContext(error: Error) {
  const message = error.message.toLowerCase();

  if (message.includes("unauthorized") || message.includes("session")) {
    return {
      type: "auth",
      icon: Shield,
      title: "Session expirée",
      description:
        "Votre session a expiré ou vous n’êtes pas autorisé à accéder à ce tableau de bord.",
      action: "Reconnectez-vous pour continuer.",
      color: "orange",
    };
  }

  if (message.includes("network") || message.includes("fetch")) {
    return {
      type: "network",
      icon: Wifi,
      title: "Problème de connexion",
      description: "Les données du tableau de bord ne peuvent pas être chargées à cause d’une erreur réseau.",
      action: "Vérifiez votre connexion puis réessayez.",
      color: "blue",
    };
  }

  if (message.includes("database") || message.includes("data")) {
    return {
      type: "database",
      icon: Database,
      title: "Erreur de chargement des données",
      description: "Le chargement des données du tableau de bord a rencontré un problème.",
      action: "Ce problème est généralement temporaire. Réessayez.",
      color: "purple",
    };
  }

  return {
    type: "unknown",
    icon: AlertCircle,
    title: "Erreur du tableau de bord",
    description: "Une erreur inattendue est survenue pendant le chargement du tableau de bord.",
    action: "Actualisez la page ou contactez l’assistance si le problème persiste.",
    color: "red",
  };
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  const router = useRouter();
  const errorContext = getErrorContext(error);
  const ErrorIcon = errorContext.icon;

  useEffect(() => {
    const dashboardErrorDetails = {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      type: errorContext.type,
      timestamp: new Date().toISOString(),
    };

    // Avoid showing an extra Next.js dev overlay panel for our own logger
    if (process.env.NODE_ENV === "development") {
      console.warn("Erreur du tableau de bord:", dashboardErrorDetails);
    } else {
      console.error("Erreur du tableau de bord:", dashboardErrorDetails);
    }

    // Track error in analytics
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "exception", {
        description: `Erreur du tableau de bord: ${error.message}`,
        fatal: false,
      });
    }
  }, [error.message, error.stack, error.digest, errorContext.type]);

  return (
    <div className="flex items-center justify-center bg-linear-to-br from-background via-background to-muted/20">
      <Card className="max-w-2xl w-full border-border/60 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto relative">
            <div
              className={`absolute inset-0 bg-${errorContext.color}-500/20 blur-2xl rounded-full`}
            />
            <div
              className={`relative bg-${errorContext.color}-500/10 rounded-full inline-block`}
            >
              <ErrorIcon className={`size-12 text-${errorContext.color}-600`} />
            </div>
          </div>
          <CardTitle className="text-2xl md:text-3xl font-bold">
            {errorContext.title}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Error Description */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Que s’est-il passé ?</AlertTitle>
            <AlertDescription className="mt-2">
              {errorContext.description}
            </AlertDescription>
          </Alert>

          {/* Action Suggestion */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <Link href="mailto:support@e-immo.bj" target="_blank">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Settings className="size-4" />
                Action recommandée
              </p>
              <p className="text-sm text-muted-foreground">
                {errorContext.action}
              </p>
            </Link>
          </div>

          {/* Development Details */}
          {process.env.NODE_ENV === "development" && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors list-none">
                <div className="flex items-center gap-2">
                  <div className="transition-transform group-open:rotate-90">
                    ▶
                  </div>
                  Détails techniques (développement)
                </div>
              </summary>
              <div className="mt-3 p-4 bg-muted/50 rounded-lg border border-border space-y-3">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                    Type d’erreur
                  </div>
                  <code className="text-xs bg-background px-2 py-1 rounded border">
                    {errorContext.type}
                  </code>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                    Message d’erreur
                  </div>
                  <code className="text-xs bg-background px-2 py-1 rounded border block">
                    {error.message}
                  </code>
                </div>
                {error.digest && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                      Identifiant de l’erreur
                    </div>
                    <code className="text-xs bg-background px-2 py-1 rounded border block">
                      {error.digest}
                    </code>
                  </div>
                )}
                {error.stack && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                      Trace technique
                    </div>
                    <pre className="text-xs bg-background p-3 rounded border overflow-auto max-h-48">
                      {error.stack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Production Error Reference */}
          {process.env.NODE_ENV === "production" && error.digest && (
            <div className="text-center text-xs text-muted-foreground">
              <p>
                Identifiant de l’erreur :{" "}
                <code className="font-mono bg-muted px-2 py-1 rounded">
                  {error.digest}
                </code>
              </p>
              <p className="mt-1">Communiquez cet identifiant à l’assistance</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button onClick={() => reset()} className="flex-1 gap-2" size="lg">
              <RefreshCw className="size-4" />
              Réessayer
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1 gap-2 bg-blue-50 hover:bg-blue-100"
            >
              <Link
                href="mailto:support@e-immo.bj"
                target="_blank"
                className="flex gap-2 items-center"
              >
                <MessageSquare className="size-4" />
                Contacter E-IMMO
              </Link>
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="flex-1 gap-2"
            >
              <ArrowLeft className="size-4" />
              Retour
            </Button>
            <Button
              onClick={() => router.push("/dashboard")}
              variant="outline"
              className="flex-1 gap-2"
            >
              <LayoutDashboard className="size-4" />
              Tableau de bord
            </Button>
          </div>

          {/* Quick Links */}
          <div className="pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground text-center mb-3">
              Accès rapide aux autres rubriques :
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button asChild variant="outline" size="sm" className="text-xs">
                <Link href="/dashboard/properties">Propriétés</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="text-xs">
                <Link href="/dashboard/tenants">Locataires</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="text-xs">
                <Link href="/dashboard/maintenance">Maintenance</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="text-xs">
                <Link href="/dashboard/settings">Paramètres</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

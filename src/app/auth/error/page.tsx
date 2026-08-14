"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  Shield,
  Key,
  UserX,
  Mail,
  RefreshCw,
  Home,
  ArrowLeft,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get("error");

  // Map error codes to user-friendly messages
  const getErrorDetails = (errorCode: string | null) => {
    switch (errorCode) {
      case "Configuration":
        return {
          icon: AlertCircle,
          title: "Erreur de configuration",
          description: "La configuration du serveur présente un problème.",
          suggestion: "Contactez l’administrateur.",
          color: "red",
        };
      case "AccessDenied":
        return {
          icon: UserX,
          title: "Accès refusé",
          description: "Vous n’avez pas l’autorisation de vous connecter.",
          suggestion: "Contactez votre administrateur si vous pensez qu’il s’agit d’une erreur.",
          color: "orange",
        };
      case "Verification":
        return {
          icon: Mail,
          title: "Vérification requise",
          description: "Le lien de vérification a expiré ou a déjà été utilisé.",
          suggestion: "Demandez un nouvel e-mail de vérification.",
          color: "blue",
        };
      case "OAuthSignin":
        return {
          icon: Shield,
          title: "Erreur de connexion externe",
          description: "Une erreur est survenue pendant la connexion au service externe.",
          suggestion: "Réessayez ou utilisez un autre mode de connexion.",
          color: "purple",
        };
      case "OAuthCallback":
        return {
          icon: Shield,
          title: "Erreur de retour de connexion",
          description: "Une erreur est survenue lors du retour du service de connexion.",
          suggestion: "Essayez de vous connecter à nouveau.",
          color: "purple",
        };
      case "OAuthCreateAccount":
        return {
          icon: Shield,
          title: "Erreur de création du compte",
          description: "Le compte n’a pas pu être créé avec ce service externe.",
          suggestion: "Cette adresse e-mail est peut-être déjà utilisée. Essayez de vous connecter.",
          color: "purple",
        };
      case "EmailCreateAccount":
        return {
          icon: Mail,
          title: "Erreur du compte e-mail",
          description: "Le compte n’a pas pu être créé avec l’adresse fournie.",
          suggestion: "Cette adresse e-mail est peut-être déjà utilisée. Essayez de vous connecter.",
          color: "blue",
        };
      case "Callback":
        return {
          icon: AlertCircle,
          title: "Erreur de retour d’authentification",
          description: "Une erreur est survenue pendant le retour d’authentification.",
          suggestion: "Essayez de vous connecter à nouveau.",
          color: "red",
        };
      case "OAuthAccountNotLinked":
        return {
          icon: Shield,
          title: "Compte non associé",
          description: "Cette adresse e-mail est déjà associée à un autre compte.",
          suggestion: "Connectez-vous avec votre mode de connexion initial.",
          color: "orange",
        };
      case "EmailSignin":
        return {
          icon: Mail,
          title: "Erreur de connexion par e-mail",
          description: "Le lien de connexion est invalide ou a expiré.",
          suggestion: "Demandez un nouveau lien de connexion.",
          color: "blue",
        };
      case "CredentialsSignin":
        return {
          icon: Key,
          title: "Identifiants incorrects",
          description: "L’adresse e-mail ou le mot de passe est incorrect.",
          suggestion: "Vérifiez vos identifiants et réessayez.",
          color: "red",
        };
      case "SessionRequired":
        return {
          icon: Shield,
          title: "Connexion requise",
          description: "Vous devez être connecté pour accéder à cette page.",
          suggestion: "Connectez-vous pour continuer.",
          color: "orange",
        };
      default:
        return {
          icon: AlertCircle,
          title: "Erreur d’authentification",
          description: "Une erreur inattendue est survenue pendant l’authentification.",
          suggestion: "Réessayez ou contactez l’assistance si le problème persiste.",
          color: "red",
        };
    }
  };

  const errorDetails = getErrorDetails(error);
  const ErrorIcon = errorDetails.icon;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
      <Card className="max-w-lg w-full border-border/60 shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 relative">
            <div className={`absolute inset-0 bg-${errorDetails.color}-500/20 blur-2xl rounded-full`} />
            <div className={`relative bg-${errorDetails.color}-500/10 p-4 rounded-full inline-block`}>
              <ErrorIcon className={`size-12 text-${errorDetails.color}-600`} />
            </div>
          </div>
          <CardTitle className="text-2xl md:text-3xl font-bold">
            {errorDetails.title}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Error Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Que s’est-il passé ?</AlertTitle>
            <AlertDescription className="mt-2">
              {errorDetails.description}
            </AlertDescription>
          </Alert>

          {/* Suggestion */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <p className="text-sm font-medium mb-2">Que dois-je faire ?</p>
            <p className="text-sm text-muted-foreground">
              {errorDetails.suggestion}
            </p>
          </div>

          {/* Error Code (for debugging) */}
          {error && (
            <div className="text-center text-xs text-muted-foreground">
              <p>Code d’erreur : <code className="font-mono bg-muted px-2 py-1 rounded">{error}</code></p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={() => router.push("/auth/signin")}
              className="w-full gap-2"
              size="lg"
            >
              <RefreshCw className="size-4" />
              Réessayer de se connecter
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => router.back()}
                variant="outline"
                className="gap-2"
              >
                <ArrowLeft className="size-4" />
                Retour
              </Button>
              <Button
                onClick={() => router.push("/")}
                variant="outline"
                className="gap-2"
              >
                <Home className="size-4" />
                Accueil
              </Button>
            </div>
          </div>

          {/* Additional Help */}
          <div className="pt-4 border-t border-border/50 text-center">
            <p className="text-xs text-muted-foreground mb-3">
              Besoin d’aide ?
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                <a href="/auth/forgot-password">Réinitialiser le mot de passe</a>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                <a href="/auth/signup">Créer un compte</a>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                <a href="mailto:support@e-immo.bj">Contacter l’assistance</a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSettings, type BrandingSettings } from "@/components/providers/SettingsProvider";
import {
  Loader2,
  Building2,
  Mail,
  Lock,
  AlertCircle,
} from "lucide-react";

const DEFAULT_BRANDING: BrandingSettings = {
  logoLight: "/images/logo-light.png",
  logoDark: "/images/logo-dark.png",
  favicon: "/favicon.ico",
  primaryColor: "#3B82F6",
  secondaryColor: "#64748B",
  companyName: "E-IMMO",
};

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { settings, isLoading: settingsLoading } = useSettings();
  const branding = settings.branding;
  const [logoError, setLogoError] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("/dashboard");


  useEffect(() => {
    const nextCallbackUrl =
      new URLSearchParams(window.location.search).get("callbackUrl") ||
      "/dashboard";
    setCallbackUrl(nextCallbackUrl);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError("Identifiants incorrects");
        setIsLoading(false);
      } else if (result?.ok) {
        router.replace(result.url || callbackUrl);
        router.refresh();
      }
    } catch (error) {
      console.error("Sign in error:", error);
      setError("An error occurred during sign in");
      setIsLoading(false);
    }
  };

  // Branding is fully DB-backed; nothing ships as a static file. When no custom
  // logo is uploaded the stored value is just a placeholder path
  // (e.g. "/images/logo-light.png") that 404s, so treat those as "no logo" and
  // fall back to the dynamic company-name wordmark instead of fetching a file
  // that doesn't exist. Mirrors the sidebar's isMissingLogoAsset guard.
  const companyName = (branding.companyName ?? "").trim();
  const isMissingLogoAsset = (url?: string) =>
    !url || url.startsWith("/images/logo");
  const lightLogo = !isMissingLogoAsset(branding.logoLight)
    ? branding.logoLight
    : branding.logoDark;
  const darkLogo = !isMissingLogoAsset(branding.logoDark)
    ? branding.logoDark
    : branding.logoLight;
  const showLogo = !isMissingLogoAsset(lightLogo) && !logoError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center items-center">
            {showLogo ? (
              <>
                <Image
                  src={lightLogo}
                  alt={companyName}
                  width={200}
                  height={64}
                  style={{ width: "auto" }}
                  className="h-16 w-auto max-w-50 object-contain dark:hidden"
                  onError={() => setLogoError(true)}
                />
                <Image
                  src={darkLogo}
                  alt={companyName}
                  width={200}
                  height={64}
                  style={{ width: "auto" }}
                  className="h-16 w-auto max-w-50 object-contain hidden dark:block"
                  onError={() => setLogoError(true)}
                />
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Building2 className="h-12 w-12 text-red-700 dark:text-red-500" />
                <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                  {companyName}
                </span>
              </div>
            )}
          </div>
          <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
            GESTION E-IMMO
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Votre bail dans la poche.
          </p>
        </div>

        {/* Sign In Form */}
        <Card>
          <CardHeader>
            <CardTitle>Rebonjour</CardTitle>
            <CardDescription>
              Identifiez-vous pour accéder à votre compte.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
          
              <div className="space-y-2">
                <Label htmlFor="email">Adresse e-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Votre adresse e-mail"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Votre mot de passe"
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Connexion"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        <div className="mt-8 pt-5 border-t border-gray-200 dark:border-gray-700">
  <p className="text-center text-sm text-gray-500">
    © {new Date().getFullYear()} GESTION E-IMMO.BJ Tous droits réservés.
  </p>
</div>
      </div>
    </div>
  );
}

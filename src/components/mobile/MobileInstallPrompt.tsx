"use client";

import { useEffect, useState } from "react";
import { Download, Share2, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "gestion-e-immo-installation-masquee";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function MobileInstallPrompt() {
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone() || sessionStorage.getItem(DISMISSED_KEY) === "1") {
      return;
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const timer = window.setTimeout(() => setShowIosHelp(isIos), 1200);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setInstallPrompt(null);
    setShowIosHelp(false);
  };

  if (!installPrompt && !showIosHelp) return null;

  return (
    <aside
      className="mobile-install-prompt"
      role="dialog"
      aria-label="Installer l’application GESTION E-IMMO"
    >
      <button
        type="button"
        className="mobile-install-prompt__close"
        onClick={dismiss}
        aria-label="Fermer"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="mobile-install-prompt__icon" aria-hidden="true">
        {showIosHelp ? (
          <Share2 className="h-5 w-5" />
        ) : (
          <Download className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">GESTION E-IMMO sur votre téléphone</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {showIosHelp
            ? "Touchez Partager, puis Sur l’écran d’accueil."
            : "Installez l’application pour un accès rapide et sécurisé."}
        </p>
      </div>
      {installPrompt && (
        <button
          type="button"
          className="mobile-install-prompt__button"
          onClick={async () => {
            await installPrompt.prompt();
            await installPrompt.userChoice;
            dismiss();
          }}
        >
          Installer
        </button>
      )}
    </aside>
  );
}

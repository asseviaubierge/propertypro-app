"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function PushToggle() {
  const { status, busy, subscribe, unsubscribe } = usePushNotifications();

  if (status === "unsupported") {
    return (
      <p className="text-xs text-muted-foreground">
        Les notifications push ne sont pas prises en charge par ce navigateur.
      </p>
    );
  }

  if (status === "loading") {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        Vérification…
      </Button>
    );
  }

  if (status === "denied") {
    return (
      <p className="text-xs text-muted-foreground">
        Les notifications sont bloquées. Veuillez les autoriser dans les paramètres de votre navigateur.
      </p>
    );
  }

  if (status === "granted-subscribed") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => void unsubscribe()}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : (
          <BellOff className="mr-2 h-3.5 w-3.5" />
        )}
        Désactiver
      </Button>
    );
  }

  return (
    <Button size="sm" onClick={() => void subscribe()} disabled={busy}>
      {busy ? (
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Bell className="mr-2 h-3.5 w-3.5" />
      )}
      Activer
    </Button>
  );
}

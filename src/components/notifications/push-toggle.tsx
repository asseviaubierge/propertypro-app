"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function PushToggle() {
  const { status, busy, subscribe, unsubscribe } = usePushNotifications();

  if (status === "unsupported") {
    return (
      <p className="text-xs text-muted-foreground">
        Push notifications aren&apos;t supported in this browser.
      </p>
    );
  }

  if (status === "loading") {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        Checking…
      </Button>
    );
  }

  if (status === "denied") {
    return (
      <p className="text-xs text-muted-foreground">
        Notifications are blocked. Enable them in your browser site settings.
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
        Disable push
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
      Enable push notifications
    </Button>
  );
}

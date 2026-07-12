"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function ServiceWorkerProvider() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const unregisterAll = async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));

      if ("caches" in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
      }
    };

    if (process.env.NODE_ENV !== "production") {
      void unregisterAll();
      return;
    }

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "activated" &&
              navigator.serviceWorker.controller
            ) {
              toast("A new version is available", {
                action: {
                  label: "Reload",
                  onClick: () => window.location.reload(),
                },
                duration: Infinity,
              });
            }
          });
        });
      } catch (error) {
        console.error("Service worker registration failed", error);
      }
    };

    void register();
  }, []);

  return null;
}

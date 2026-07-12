/**
 * PropertyPro - Global Settings Provider
 *
 * Single source of truth for the user's display settings (branding colors,
 * logos, favicon, language, currency, theme prefs). Replaces the previously
 * scattered fetches in BrandingProvider, LocalizationProvider, the sidebar's
 * useDisplaySettingsSync hook, and SettingsLayout.
 *
 * - Fetches `/api/settings/display` ONCE when authenticated (no polling, no
 *   refetch-on-focus).
 * - Applies branding side-effects centrally (CSS variables + favicon).
 * - Propagates changes instantly in-tab and lightly cross-tab via
 *   BroadcastChannel (with a storage-event fallback).
 */

"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { applyBrandingCssVariables, applyFavicon } from "@/lib/utils/branding";
import { logClientWarn } from "@/utils/logger";

export interface BrandingSettings {
  primaryColor: string;
  secondaryColor: string;
  logoLight: string;
  logoDark: string;
  favicon: string;
  companyName?: string;
  companyAddress?: string;
  r2?: Record<string, any>;
}

export interface DisplaySettings {
  theme?: "light" | "dark" | "system";
  language?: string;
  currency?: string;
  dateFormat?: string;
  timeFormat?: string;
  // Quick appearance preferences (Preferences drawer)
  contrast?: boolean;
  compact?: boolean;
  rtl?: boolean;
  navColor?: "integrate" | "apparent";
  branding: BrandingSettings;
  [key: string]: any;
}

/** Language codes that render right-to-left. */
const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

interface UpdateSettingsOptions {
  /**
   * Mirror the change to other open tabs. Defaults to true (use for persisted
   * saves). Pass false for transient in-tab previews (e.g. live color picking)
   * so unsaved changes don't leak across tabs.
   */
  broadcast?: boolean;
}

interface SettingsContextValue {
  settings: DisplaySettings;
  isLoading: boolean;
  /** Optimistic merge into the global settings (+ optional cross-tab broadcast). Does not POST. */
  updateSettings: (
    patch: Partial<DisplaySettings>,
    options?: UpdateSettingsOptions,
  ) => void;
  /** Force a re-fetch from the server. */
  refresh: () => Promise<void>;
}

const defaultBranding: BrandingSettings = {
  primaryColor: "#3B82F6",
  secondaryColor: "#64748B",
  logoLight: "/images/logo-light.png",
  logoDark: "/images/logo-dark.png",
  favicon: "/favicon.ico",
};

const defaultSettings: DisplaySettings = {
  theme: "system",
  contrast: false,
  compact: false,
  rtl: false,
  navColor: "integrate",
  branding: { ...defaultBranding },
};

const BROADCAST_CHANNEL = "propertypro:settings";
const STORAGE_FALLBACK_KEY = "propertypro:settings-broadcast";

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

/** Merge an arbitrary settings object onto the defaults (branding deep-merged). */
function mergeWithDefaults(settings: any): DisplaySettings {
  return {
    ...settings,
    branding: {
      ...defaultBranding,
      ...(settings?.branding || {}),
    },
  };
}

/** Normalize the various `/api/settings/display` response shapes into settings. */
function normalizeResponse(raw: any): DisplaySettings | null {
  const payload = raw?.data ?? raw;
  const settings =
    payload?.settings ?? payload?.display ?? payload?.data ?? payload;
  if (!settings || typeof settings !== "object") return null;
  return mergeWithDefaults(settings);
}

interface SettingsProviderProps {
  children: React.ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;

  const [settings, setSettings] = useState<DisplaySettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Fetch settings from the server (used on auth and for manual refresh)
  const fetchSettings = useCallback(async () => {
    if (!userId) return;
    try {
      setIsLoading(true);
      const res = await fetch("/api/settings/display?includeDefaults=false", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) return;
      const raw = await res.json();
      const normalized = normalizeResponse(raw);
      if (normalized) setSettings(normalized);
    } catch (error) {
      logClientWarn("Failed to load display settings", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Fetch once when the user becomes authenticated. Depending on the stable
  // `userId` (not the session object) avoids re-fetching on every focus refetch.
  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated" && userId) {
      fetchSettings();
    } else if (status === "unauthenticated") {
      setIsLoading(false);
    }
  }, [status, userId, fetchSettings]);

  // Optimistic in-tab update + optional cross-tab broadcast
  const updateSettings = useCallback(
    (patch: Partial<DisplaySettings>, options?: UpdateSettingsOptions) => {
      const prev = settingsRef.current;
      const next: DisplaySettings = {
        ...prev,
        ...patch,
        branding: {
          ...prev.branding,
          ...(patch.branding || {}),
        },
      };
      setSettings(next);

      if (options?.broadcast === false) return;

      if (channelRef.current) {
        try {
          channelRef.current.postMessage({ settings: next });
        } catch {
          // ignore broadcast failures
        }
      } else if (typeof window !== "undefined") {
        // Fallback for browsers without BroadcastChannel
        try {
          localStorage.setItem(
            STORAGE_FALLBACK_KEY,
            JSON.stringify({ settings: next, ts: Date.now() }),
          );
        } catch {
          // ignore storage failures
        }
      }
    },
    [],
  );

  // Set up the cross-tab BroadcastChannel
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined")
      return;

    const channel = new BroadcastChannel(BROADCAST_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent) => {
      const incoming = event.data?.settings;
      if (incoming) setSettings(mergeWithDefaults(incoming));
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  // Storage-event fallback for browsers without BroadcastChannel
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel !== "undefined")
      return;

    const handler = (event: StorageEvent) => {
      if (event.key !== STORAGE_FALLBACK_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue);
        if (parsed?.settings) setSettings(mergeWithDefaults(parsed.settings));
      } catch {
        // ignore malformed payloads
      }
    };

    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Apply branding colors as CSS variables whenever they change
  useEffect(() => {
    applyBrandingCssVariables(settings.branding);
  }, [settings.branding.primaryColor, settings.branding.secondaryColor]);

  // Keep the document favicon in sync with branding
  useEffect(() => {
    applyFavicon(settings.branding.favicon);
  }, [settings.branding.favicon]);

  // Compact density (tightens spacing app-wide)
  useEffect(() => {
    document.documentElement.classList.toggle("compact", !!settings.compact);
  }, [settings.compact]);

  // High-contrast mode
  useEffect(() => {
    document.documentElement.classList.toggle(
      "high-contrast",
      !!settings.contrast,
    );
  }, [settings.contrast]);

  // Text direction: manual RTL toggle or a right-to-left language
  useEffect(() => {
    const lang = settings.language?.toLowerCase().split("-")[0];
    const localeIsRtl = lang ? RTL_LANGUAGES.has(lang) : false;
    document.documentElement.setAttribute(
      "dir",
      settings.rtl || localeIsRtl ? "rtl" : "ltr",
    );
  }, [settings.rtl, settings.language]);

  // Nav color style (consumed by globals.css via the attribute)
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-nav-color",
      settings.navColor || "integrate",
    );
  }, [settings.navColor]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      isLoading,
      updateSettings,
      refresh: fetchSettings,
    }),
    [settings, isLoading, updateSettings, fetchSettings],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

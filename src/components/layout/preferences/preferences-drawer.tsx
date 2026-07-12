"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Settings,
  X,
  RotateCcw,
  Moon,
  Contrast,
  AlignLeft,
  Minimize2,
  Info,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import { useAuthorization } from "@/hooks/useAuthorization";
import { PRESET_COLORS, matchPreset } from "@/lib/preferences/presets";
import {
  SettingCard,
  SectionContainer,
  NavColorCard,
  PresetColorCard,
} from "./appearance-cards";

const LANGUAGE_FLAGS: Record<string, string> = {
  en: "🇺🇸",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
  ar: "🇸🇦",
  bn: "🇧🇩",
  hi: "🇮🇳",
  nl: "🇳🇱",
  zh: "🇨🇳",
  pt: "🇵🇹",
};

// Languages exposed in the drawer (kept in sync with the appearance page).
const ALLOWED_LANGUAGES = ["en", "es", "fr", "de", "ar"];
const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);
const RTL_LANGUAGE_LOCK_MESSAGE =
  "Please change Arabic language first, then try RTL mode.";

export function PreferencesDrawer() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { settings, updateSettings } = useSettings();
  const { setTheme, resolvedTheme } = useTheme();
  const localization = useLocalizationContext();
  const { isAdmin } = useAuthorization();

  useEffect(() => setMounted(true), []);

  // Debounced persistence to the display-settings API (cross-tab handled by the provider).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Record<string, unknown>>({});

  const persist = useCallback(
    (patch: Record<string, unknown>) => {
      // Display & branding is a global, admin-managed setting. Non-admins still
      // get live in-tab changes (and per-browser theme via next-themes), but we
      // skip the server write so they can't alter the shared global document.
      if (!isAdmin) return;

      pendingRef.current = { ...pendingRef.current, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const body = pendingRef.current;
        pendingRef.current = {};
        void fetch("/api/settings/display", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).catch(() => {
          /* best-effort; provider state is already applied */
        });
      }, 700);
    },
    [isAdmin],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const activeLanguage = (
    settings.language ??
    localization.language ??
    "en"
  )
    .split("-")[0]
    .toLowerCase();
  const rtlLockedByLanguage = RTL_LANGUAGES.has(activeLanguage);
  const isRtl = !!settings.rtl || rtlLockedByLanguage;
  const navColor = settings.navColor ?? "integrate";
  const activePreset = matchPreset(settings.branding.primaryColor);

  const languageOptions = useMemo(() => {
    const map = new Map<string, { code: string; label: string }>();
    for (const loc of localization.allLocales) {
      const base = loc.code.split("-")[0].toLowerCase();
      if (ALLOWED_LANGUAGES.includes(base) && !map.has(base)) {
        map.set(base, { code: base, label: base.toUpperCase() });
      }
    }
    return ALLOWED_LANGUAGES.filter((c) => map.has(c)).map((c) => map.get(c)!);
  }, [localization.allLocales]);

  useEffect(() => {
    if (!rtlLockedByLanguage || settings.rtl) return;

    updateSettings({ rtl: true });
    persist({ rtl: true });
  }, [persist, rtlLockedByLanguage, settings.rtl, updateSettings]);

  const handleMode = (checked: boolean) => {
    const theme = checked ? "dark" : "light";
    setTheme(theme);
    updateSettings({ theme });
    persist({ theme });
  };

  const handleContrast = (checked: boolean) => {
    updateSettings({ contrast: checked });
    persist({ contrast: checked });
  };

  const handleRtl = (checked: boolean) => {
    if (rtlLockedByLanguage) {
      toast.warning(RTL_LANGUAGE_LOCK_MESSAGE);
      return;
    }

    updateSettings({ rtl: checked });
    persist({ rtl: checked });
  };

  const handleCompact = (checked: boolean) => {
    updateSettings({ compact: checked });
    persist({ compact: checked });
  };

  const handleNavColor = (color: "integrate" | "apparent") => {
    updateSettings({ navColor: color });
    persist({ navColor: color });
  };

  const handlePreset = (hex: string) => {
    // Send the full branding object so partial-update defaults don't clobber logos.
    const nextBranding = { ...settings.branding, primaryColor: hex };
    updateSettings({ branding: nextBranding });
    persist({ branding: nextBranding });
  };

  const handleLanguage = (code: string) => {
    const nextLanguage = code.split("-")[0].toLowerCase();
    const languageIsRtl = RTL_LANGUAGES.has(nextLanguage);
    const patch = {
      language: code,
      ...(languageIsRtl ? { rtl: true } : {}),
    };

    updateSettings(patch);
    persist(patch);
  };

  const handleReset = () => {
    setTheme("system");
    const defaults = {
      theme: "system" as const,
      contrast: false,
      compact: false,
      rtl: false,
      navColor: "integrate" as const,
    };
    updateSettings(defaults);
    persist(defaults);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Preferences"
          className="text-muted-foreground hover:text-primary"
        >
          <Settings className="h-[1.2rem] w-[1.2rem]" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side={isRtl ? "left" : "right"}
        showCloseButton={false}
        className={cn(
          "w-[340px] sm:w-[380px] p-0 shadow-2xl bg-background",
          isRtl ? "border-r-0" : "border-l-0",
        )}
      >
        <SheetHeader className="px-5 py-4 flex flex-row items-center justify-between sticky top-0 z-10 bg-background border-b border-border/30">
          <SheetTitle className="text-lg font-bold tracking-tight">
            Preferences
          </SheetTitle>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              className="relative h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
              title="Reset to defaults"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
            </Button>
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-65px)]">
          <div className="p-5 space-y-6">
            {/* Top grid: Mode, Contrast, RTL, Compact */}
            <div className="grid grid-cols-2 gap-3">
              <SettingCard
                icon={<Moon className="h-5 w-5" strokeWidth={1.5} />}
                label="Mode"
                checked={isDark}
                onCheckedChange={handleMode}
              />
              <SettingCard
                icon={<Contrast className="h-5 w-5" strokeWidth={1.5} />}
                label="Contrast"
                checked={!!settings.contrast}
                onCheckedChange={handleContrast}
              />
              <SettingCard
                icon={<AlignLeft className="h-5 w-5" strokeWidth={1.5} />}
                label="Right to left"
                checked={isRtl}
                onCheckedChange={handleRtl}
                disabled={rtlLockedByLanguage}
                disabledReason={RTL_LANGUAGE_LOCK_MESSAGE}
                onDisabledClick={() => toast.warning(RTL_LANGUAGE_LOCK_MESSAGE)}
              />
              <SettingCard
                icon={<Minimize2 className="h-5 w-5" strokeWidth={1.5} />}
                label="Compact"
                checked={!!settings.compact}
                onCheckedChange={handleCompact}
                hasInfo
              />
            </div>

            {/* Nav color */}
            <SectionContainer label="NAV" icon={<Info className="h-2.5 w-2.5" />}>
              <div className="space-y-3">
                <span className="text-xs text-muted-foreground font-medium">
                  Color
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <NavColorCard
                    label="Integrate"
                    isActive={navColor === "integrate"}
                    onClick={() => handleNavColor("integrate")}
                  />
                  <NavColorCard
                    label="Apparent"
                    isActive={navColor === "apparent"}
                    onClick={() => handleNavColor("apparent")}
                  />
                </div>
              </div>
            </SectionContainer>

            {/* Presets */}
            <SectionContainer
              label="PRESETS"
              icon={<RefreshCw className="h-2.5 w-2.5" />}
            >
              <div className="grid grid-cols-3 gap-2.5">
                {PRESET_COLORS.map((preset) => (
                  <PresetColorCard
                    key={preset.key}
                    color={preset.hex}
                    isActive={activePreset === preset.key}
                    onClick={() => handlePreset(preset.hex)}
                  />
                ))}
              </div>
            </SectionContainer>

            {/* Language */}
            <SectionContainer label="LANGUAGE">
              <div className="grid grid-cols-3 gap-2">
                {languageOptions.map((opt) => (
                  <button
                    key={opt.code}
                    onClick={() => handleLanguage(opt.code)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl transition-all",
                      activeLanguage === opt.code
                        ? "bg-background border border-border shadow-sm"
                        : "bg-transparent border border-transparent hover:bg-muted/50",
                    )}
                  >
                    <span className="text-base">
                      {LANGUAGE_FLAGS[opt.code] ?? "🌐"}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground uppercase">
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </SectionContainer>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

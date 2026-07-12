"use client";

import { useEffect } from "react";
import { Palette } from "lucide-react";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { DisplaySettings } from "@/components/settings/display-settings";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useAuthorization } from "@/hooks/useAuthorization";

export default function DisplaySettingsPage() {
  const { t } = useLocalizationContext();
  const router = useRouter();
  const { status } = useSession();
  const { isAdmin, isLoading: authzLoading } = useAuthorization();

  // Display & branding is a global, admin-only setting. Send every non-admin
  // (managers and tenants) to their personal profile instead.
  useEffect(() => {
    if (status === "authenticated" && !authzLoading && !isAdmin) {
      router.replace("/dashboard/settings/profile");
    }
  }, [status, authzLoading, isAdmin, router]);

  if (status === "loading" || authzLoading || !isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SettingsLayout
      title={t("settings.display.pageTitle")}
      description={t("settings.display.pageDescription")}
      icon={Palette}
      section="display"
    >
      {({ userSettings, onUpdate, onAlert }) => (
        <DisplaySettings
          settings={userSettings?.display}
          onUpdate={onUpdate}
          onAlert={onAlert}
        />
      )}
    </SettingsLayout>
  );
}

"use client";

import { Shield } from "lucide-react";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { SecuritySettings } from "@/components/settings/security-settings";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

export default function SecuritySettingsPage() {
  const { t } = useLocalizationContext();

  return (
    <SettingsLayout
      title={t("settings.security.pageTitle")}
      description={t("settings.security.pageDescription")}
      icon={Shield}
      section="security"
      showRefresh={false}
    >
      {({ userProfile, onAlert }) => (
        <SecuritySettings user={userProfile} onAlert={onAlert} />
      )}
    </SettingsLayout>
  );
}

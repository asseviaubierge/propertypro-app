"use client";

import { User } from "lucide-react";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

export default function ProfileSettingsPage() {
  const { t } = useLocalizationContext();

  return (
    <SettingsLayout
      title={t("settings.profile.pageTitle")}
      description={t("settings.profile.pageDescription")}
      icon={User}
      section="profile"
      showRefresh={true}
    >
      {({ userProfile, onUpdate, onAlert }) => (
        <ProfileSettings
          user={userProfile}
          onUpdate={onUpdate}
          onAlert={onAlert}
        />
      )}
    </SettingsLayout>
  );
}

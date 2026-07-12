"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { LocalizationProvider } from "@/components/providers/LocalizationProvider";
import { SettingsProvider } from "@/components/providers/SettingsProvider";
import { UserAvatarProvider } from "@/components/providers/UserAvatarProvider";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <SettingsProvider>
          <LocalizationProvider>
            <UserAvatarProvider>{children}</UserAvatarProvider>
          </LocalizationProvider>
        </SettingsProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}

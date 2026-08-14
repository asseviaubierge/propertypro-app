"use client";

import { useState, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Settings as SettingsIcon,
  AlertCircle,
  CheckCircle,
  Info,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { logClientError, logClientWarn } from "@/utils/logger";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useAuthorization } from "@/hooks/useAuthorization";

interface UserSettings {
  _id?: string;
  userId?: string;
  profile?: any;
  notifications?: any;
  security?: any;
  display?: any;
  privacy?: any;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

interface UserProfile {
  _id?: string;
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  image?: string;
  phone?: string;
  role: string;
  avatar?: string;
  bio?: string;
  location?: string;
  city?: string;
  website?: string;
  isActive: boolean;
  emailVerified?: string | Date | null;
  createdAt?: string;
  updatedAt?: string;
}

interface SettingsLayoutProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children:
    | ReactNode
    | ((props: {
        userSettings: UserSettings | null;
        userProfile: UserProfile | null;
        onUpdate: (data: any) => Promise<void>;
        onAlert: (type: "success" | "error" | "info", message: string) => void;
        isLoading: boolean;
      }) => ReactNode);
  section: string;
  showRefresh?: boolean;
  adminOnly?: boolean;
}

export function SettingsLayout({
  title,
  description,
  icon: Icon,
  children,
  section,
  showRefresh = false,
  adminOnly = false,
}: SettingsLayoutProps) {
  const { t } = useLocalizationContext();
  const { data: session, status } = useSession();
  const { settings: globalSettings, isLoading: settingsLoading } = useSettings();
  const { isAdmin, isManager } = useAuthorization();
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [alert, setAlert] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const hasAdminAccess = isAdmin || isManager;

  // Check admin access for admin-only sections
  if (adminOnly && !hasAdminAccess) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Alert className="border-red-500 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Access denied. This section is only available to administrators and
            managers.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  useEffect(() => {
    // Only fetch data when session is loaded and authenticated.
    // Depend on the stable user id (not the whole session object) so a
    // next-auth window-focus refetch does not re-trigger a full reload.
    if (status === "authenticated" && session?.user?.id) {
      fetchUserData();
      setAlert(null);
    } else if (status === "unauthenticated") {
      setIsLoading(false);
      showAlert("error", "Authentication required");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.id]);

  const fetchUserData = async () => {
    try {
      setIsLoading(true);

      // Check if user is authenticated
      if (!session?.user?.id) {
        throw new Error("Authentication required");
      }

      // For profile section, we need to merge user profile data with profile settings
      if (section === "profile") {
        try {
          // Start with session data as fallback
          let mergedUserData: any = session?.user ? { ...session.user } : null;

          // Try to fetch user profile data
          try {
            const profileResponse = await fetch("/api/user/profile", {
              cache: "no-store",
              headers: {
                "Cache-Control": "no-cache",
              },
            });

            if (profileResponse.ok) {
              const profileData = await profileResponse.json();
              const fetchedUser =
                profileData?.data?.user ?? profileData?.user ?? null;
              if (fetchedUser) {
                mergedUserData = { ...fetchedUser };
              }
            }

          } catch (profileError) {
            logClientWarn("Failed to fetch user profile:", profileError);
          }

          // Try to fetch profile settings and merge if they exist
          try {
            const settingsResponse = await fetch("/api/settings/profile", {
              cache: "no-store",
              headers: {
                "Cache-Control": "no-cache",
              },
            });

            if (settingsResponse.ok) {
              const settingsData = await settingsResponse.json();
              const profileSettings =
                settingsData?.data?.settings ?? settingsData?.settings;

              if (profileSettings && mergedUserData) {
                // Merge profile settings into user data, giving priority to profile settings for extended fields
                // but preserving critical user data like avatar, email, role, etc.
                mergedUserData = {
                  ...mergedUserData,
                  ...profileSettings,
                  // Always keep the original user ID, email, role, and avatar from user profile
                  _id: mergedUserData._id ?? mergedUserData.id,
                  email: mergedUserData.email,
                  role: mergedUserData.role,
                  isActive: mergedUserData.isActive,
                  avatar: mergedUserData.avatar, // Preserve avatar from user profile
                  image: mergedUserData.image, // Preserve image from user profile
                  createdAt: mergedUserData.createdAt,
                  updatedAt: mergedUserData.updatedAt,
                };
              }
            }
          } catch (settingsError) {
            logClientWarn("Failed to fetch profile settings:", settingsError);
          }

          // Ensure we have some user data
          if (!mergedUserData && session?.user) {
            mergedUserData = { ...session.user };
          }

          setUserProfile(mergedUserData as UserProfile | null);
          setUserSettings({ profile: mergedUserData });
        } catch (profileError) {
          logClientError("Profile section error:", profileError);
          // Fallback to session data
          if (session?.user) {
            setUserProfile({ ...(session.user as any) });
            setUserSettings({ profile: { ...session.user } });
          } else {
            throw profileError;
          }
        }
      } else {
        // For other sections, fetch user profile and section-specific settings separately
        const profileResponse = await fetch("/api/user/profile", {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
          },
        });

        if (!profileResponse.ok) {
          throw new Error("Failed to fetch profile");
        }

        const profileData = await profileResponse.json();
        // Our API helper wraps payloads under `data`, so prefer data.user
        // and fall back to a top-level user for older shapes.
        const fetchedUser =
          profileData?.data?.user ?? profileData?.user ?? null;
        setUserProfile(fetchedUser as UserProfile | null);

        // Fetch section-specific settings. The display section is served by the
        // global SettingsProvider, so its (redundant) fetch is skipped here and
        // the provider value flows in via `effectiveUserSettings` below.
        if (section !== "display") {
          let settingsData = null;
          try {
            let settingsEndpoint = "/api/settings/user"; // fallback to unified settings

            // Use specific endpoints for new architecture
            switch (section) {
              case "notifications":
                settingsEndpoint = "/api/settings/notifications";
                break;
              case "security":
                settingsEndpoint = "/api/settings/security";
                break;
              case "privacy":
                settingsEndpoint = "/api/settings/privacy";
                break;
              case "system":
                settingsEndpoint = "/api/settings/system";
                break;
            }

            const settingsResponse = await fetch(settingsEndpoint, {
              cache: "no-store",
              headers: {
                "Cache-Control": "no-cache",
              },
            });

            if (settingsResponse.ok) {
              const payload = await settingsResponse.json();

              // Normalize common API response shapes
              const normalized = payload?.data ?? payload; // our helpers wrap under data

              // Handle different response structures
              if (
                section === "notifications" ||
                section === "security" ||
                section === "privacy" ||
                section === "system"
              ) {
                // Separate endpoints often return { success, data: { settings } }
                const value =
                  normalized?.settings ?? normalized?.[section] ?? normalized;
                settingsData = { [section]: value };
              } else {
                // Unified endpoint returns nested structure
                settingsData = normalized?.settings ?? normalized;
              }
            }
          } catch (error) {
            logClientWarn(
              `Failed to fetch ${section} settings, falling back to unified endpoint:`,
              error,
            );

            // Fallback to unified settings endpoint
            try {
              const fallbackResponse = await fetch("/api/settings/user", {
                cache: "no-store",
                headers: {
                  "Cache-Control": "no-cache",
                },
              });

              if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                settingsData = fallbackData?.settings;
              }
            } catch (fallbackError) {
              logClientError("Fallback settings fetch failed:", fallbackError);
            }
          }

          if (settingsData) {
            setUserSettings(settingsData);
          }
        }
      }
    } catch (error) {
      logClientError("Fetch user data error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Impossible de charger les données du compte";
      showAlert("error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const showAlert = (type: "success" | "error" | "info", message: string) => {
    if (type === "success") {
      toast.success(message);
      setAlert(null);
      return;
    } else if (type === "error") {
      toast.error(message);
    } else {
      toast(message);
    }

    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const clearAlert = () => {
    setAlert(null);
  };

  const handleSettingsUpdate = async (data: any) => {
    // Update local state optimistically without causing form reload
    if (section === "profile" && userProfile) {
      const updatedProfile = {
        ...userProfile,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      setUserProfile(updatedProfile);
      setUserSettings({ profile: updatedProfile });
    } else if (userSettings) {
      // For other settings, update the specific section without full reload
      setUserSettings((prevSettings) => ({
        ...prevSettings,
        [section]: {
          ...prevSettings?.[section as keyof UserSettings],
          ...data,
        },
        updatedAt: new Date().toISOString(),
      }));
    }

    // No need to refetch - optimistic updates are sufficient
    // The form components handle their own state management
  };

  if (
    isLoading ||
    status === "loading" ||
    (section === "display" && settingsLoading)
  ) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // For the display section, surface the global SettingsProvider value so the
  // form stays in sync with live (same-tab/cross-tab) changes.
  const effectiveUserSettings =
    section === "display"
      ? { ...userSettings, display: globalSettings }
      : userSettings;

  return (
    <div className="mobile-settings-page mx-auto min-w-0 max-w-6xl space-y-3 sm:p-6">
      <div className="mb-4 sm:mb-8">
        <div className="mb-1 flex items-center gap-2 sm:mb-2 sm:gap-3">
          <SettingsIcon className="h-6 w-6 text-primary sm:h-8 sm:w-8" />
          <h1 className="text-xl font-bold sm:text-3xl">{t("settings.pageTitle")}</h1>
        </div>
        <p className="text-muted-foreground">{t("settings.pageDescription")}</p>
      </div>

      <Card className="settings-shell gap-2">
        <CardHeader>
          <CardTitle className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              {title}
            </div>
            {showRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={fetchUserData}
                disabled={isLoading}
                className="w-full whitespace-nowrap text-xs sm:w-auto"
              >
                <RefreshCw
                  className={`h-3 w-3 mr-1 ${isLoading ? "animate-spin" : ""}`}
                />
                {t("settings.refreshButton")}
              </Button>
            )}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {alert && (
            <Alert
              className={`mb-4 ${
                alert.type === "success"
                  ? "border-green-500 bg-green-50"
                  : alert.type === "error"
                    ? "border-red-500 bg-red-50"
                    : "border-blue-500 bg-blue-50"
              }`}
            >
              {alert.type === "success" && (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              {alert.type === "error" && (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              {alert.type === "info" && (
                <Info className="h-4 w-4 text-blue-600" />
              )}
              <AlertDescription
                className={`flex items-center justify-between ${
                  alert.type === "success"
                    ? "text-green-800"
                    : alert.type === "error"
                      ? "text-red-800"
                      : "text-blue-800"
                }`}
              >
                <span>{alert.message}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAlert}
                  className="h-6 w-6 p-0 ml-2"
                >
                  ×
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Pass data and handlers to children */}
          {typeof children === "function"
            ? children({
                userSettings: effectiveUserSettings,
                userProfile: userProfile || ((session?.user as any) ?? null),
                onUpdate: handleSettingsUpdate,
                onAlert: showAlert,
                isLoading,
              })
            : children}
        </CardContent>
      </Card>
    </div>
  );
}

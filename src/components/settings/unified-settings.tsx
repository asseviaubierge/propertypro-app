"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUpload } from "@/components/ui/file-upload";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Bell,
  Shield,
  Palette,
  Lock,
  Settings as SettingsIcon,
  Upload,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Search,
  X,
} from "lucide-react";
import {
  searchSettings,
  type SettingsSearchResult,
  type SettingsSearchFilters,
} from "@/lib/settings-search";
import { logClientError } from "@/utils/logger";
import { useAuthorization } from "@/hooks/useAuthorization";

interface UnifiedSettingsProps {
  initialTab?: string;
}

interface SettingsState {
  profile?: any;
  notifications?: any;
  security?: any;
  display?: any;
  privacy?: any;
  system?: any;
  [key: string]: any;
}

export function UnifiedSettings({
  initialTab = "profile",
}: UnifiedSettingsProps) {
  const { data: session } = useSession();
  const { isAdmin } = useAuthorization();
  const [settings, setSettings] = useState<SettingsState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [hasChanges, setHasChanges] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SettingsSearchResult[]>(
    [],
  );
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Load settings
  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/settings");

      if (!response.ok) {
        throw new Error("Failed to load settings");
      }

      const data = await response.json();
      setSettings(data?.settings ?? {});
    } catch (error) {
      logClientError("Error loading settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  // Save settings
  const saveSettings = async (category: string, data: any) => {
    try {
      setIsSaving(true);
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          data,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      const result = await response.json();

      // Update local state
      setSettings((prev) => ({
        ...prev,
        [category]: result?.setting,
      }));

      setHasChanges(false);
      toast.success("Settings saved successfully");
    } catch (error) {
      logClientError("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  // Update setting field
  const updateSetting = (category: string, field: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev?.[category],
        [field]: value,
      },
    }));
    setHasChanges(true);
  };

  // Handle file upload
  const handleFileUpload = (category: string, field: string, url: string) => {
    updateSetting(category, field, url);
  };

  // Reset settings to default
  const resetSettings = async (category: string) => {
    try {
      const response = await fetch(`/api/settings?category=${category}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to reset settings");
      }

      await loadSettings();
      toast.success(`${category} settings reset to defaults`);
    } catch (error) {
      logClientError("Error resetting settings:", error);
      toast.error("Failed to reset settings");
    }
  };

  // Search functionality
  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);

    try {
      const filters: SettingsSearchFilters = {
        userRole: session?.user?.role,
        includeAdminOnly: isAdmin,
      };

      const results = await searchSettings(query, filters);
      setSearchResults(results);
    } catch (error) {
      logClientError("Search failed:", error);
      toast.error("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchResultClick = (result: SettingsSearchResult) => {
    // Extract tab from path or use category
    const tabMap: Record<string, string> = {
      Profile: "profile",
      Notifications: "notifications",
      Security: "security",
      Display: "display",
      Privacy: "privacy",
      System: "system",
    };

    const targetTab = tabMap[result.category] || "profile";
    setActiveTab(targetTab);
    setShowSearchResults(false);
    setSearchQuery("");

    // Scroll to specific section if path has hash
    if (result.path.includes("#")) {
      const hash = result.path.split("#")[1];
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowSearchResults(false);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Chargement des paramètres…</span>
      </div>
    );
  }

  const tabs = [
    {
      value: "profile",
      label: "Profile",
      icon: User,
      description: "Manage your personal information",
    },
    {
      value: "notifications",
      label: "Notifications",
      icon: Bell,
      description: "Configure notification preferences",
    },
    {
      value: "security",
      label: "Sécurité",
      icon: Shield,
      description: "Security and authentication settings",
    },
    {
      value: "display",
      label: "Display",
      icon: Palette,
      description: "Customize appearance and layout",
    },
    {
      value: "privacy",
      label: "Privacy",
      icon: Lock,
      description: "Control your privacy and data sharing",
    },
  ];

  // Add system settings tab for admin users
  if (isAdmin) {
    tabs.push({
      value: "system",
      label: "Système",
      icon: SettingsIcon,
      description: "System configuration and administration",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Paramètres</h1>
          <p className="text-muted-foreground">
            Manage your account and application preferences
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge
              variant="secondary"
              className="bg-orange-100 text-orange-800"
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Unsaved changes
            </Badge>
          )}

          {/* NOTE: temporary inline reset controls until SettingsComparison is reintroduced */}
          <Button
            variant="outline"
            onClick={() => resetSettings(activeTab)}
            disabled={isSaving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset {activeTab}
          </Button>
          {/* Keep legacy callback typings explicit for strict TS */}
          {/* <SettingsComparison
            currentSettings={settings}
            onResetToDefault={(category: string, field: string) => {
              // Handle individual field reset
              const categorySettings = { ...settings[category] };
              const fieldPath = field.split(".");
              let current: any = categorySettings;

              // Navigate to the nested field
              for (let i = 0; i < fieldPath.length - 1; i++) {
                if (!current[fieldPath[i]]) current[fieldPath[i]] = {};
                current = current[fieldPath[i]];
              }

              // Reset the field (this would need default values)
              // For now, we'll trigger a reload
              loadSettings();
            }}
            onResetAllToDefault={(category: string) => {
              // Handle category reset
              resetSettings(category);
            }}
          /> */}

          {hasChanges && (
            <Button
              onClick={() => saveSettings(activeTab, settings[activeTab])}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans les paramètres…"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Search Results */}
        {showSearchResults && (
          <Card className="absolute top-full left-0 right-0 z-50 mt-2 max-h-96 overflow-y-auto">
            <CardContent className="p-0">
              {isSearching ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">
                    Searching...
                  </span>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="divide-y">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleSearchResultClick(result)}
                      className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <SettingsIcon className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm">
                              {result.title}
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {result.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {result.description}
                          </p>
                          {result.matchedTerms.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {result.matchedTerms
                                .slice(0, 3)
                                .map((term, index) => (
                                  <Badge
                                    key={index}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {term}
                                  </Badge>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No settings found for "{searchQuery}"
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Settings Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className={`grid w-full grid-cols-${tabs.length}`}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your personal information and profile settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Upload */}
              <div className="space-y-2">
                <Label>Photo de profil</Label>
                <FileUpload
                  onFilesSelected={(files) => {
                    if (files.length > 0) {
                      // Handle avatar upload
                      const formData = new FormData();
                      formData.append("file", files[0]);
                      formData.append("type", "avatar");

                      fetch("/api/upload", {
                        method: "POST",
                        body: formData,
                      })
                        .then((res) => res.json())
                        .then((data) => {
                          handleFileUpload("profile", "avatar", data.url);
                        })
                        .catch((err) => {
                          toast.error("Failed to upload avatar");
                        });
                    }
                  }}
                  acceptedFileTypes={["image/jpeg", "image/png", "image/webp"]}
                  maxFileSize={5}
                  maxFiles={1}
                  existingFiles={
                    settings.profile?.avatar
                      ? [
                          {
                            id: "avatar",
                            name: "Photo de profil",
                            size: 0,
                            type: "image",
                            url: settings.profile.avatar,
                            status: "completed" as const,
                          },
                        ]
                      : []
                  }
                />
              </div>

              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    value={settings.profile?.firstName ?? ""}
                    onChange={(e) =>
                      updateSetting("profile", "firstName", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    value={settings.profile?.lastName ?? ""}
                    onChange={(e) =>
                      updateSetting("profile", "lastName", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Adresse e-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.profile?.email ?? ""}
                  onChange={(e) =>
                    updateSetting("profile", "email", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Numéro de téléphone</Label>
                <Input
                  id="phone"
                  value={settings.profile?.phone ?? ""}
                  onChange={(e) =>
                    updateSetting("profile", "phone", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Présentation</Label>
                <Textarea
                  id="bio"
                  value={settings.profile?.bio ?? ""}
                  onChange={(e) =>
                    updateSetting("profile", "bio", e.target.value)
                  }
                  placeholder="Tell us about yourself..."
                  rows={3}
                />
              </div>

              {/* Professional Information */}
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-medium">
                  Professional Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">Intitulé du poste</Label>
                    <Input
                      id="jobTitle"
                      value={settings.profile?.jobTitle ?? ""}
                      onChange={(e) =>
                        updateSetting("profile", "jobTitle", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Entreprise</Label>
                    <Input
                      id="company"
                      value={settings.profile?.company ?? ""}
                      onChange={(e) =>
                        updateSetting("profile", "company", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Contact d’urgence</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyName">Nom du contact</Label>
                    <Input
                      id="emergencyName"
                      value={settings.profile?.emergencyContact?.name ?? ""}
                      onChange={(e) =>
                        updateSetting("profile", "emergencyContact", {
                          ...settings.profile?.emergencyContact,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyPhone">Téléphone du contact</Label>
                    <Input
                      id="emergencyPhone"
                      value={settings.profile?.emergencyContact?.phone ?? ""}
                      onChange={(e) =>
                        updateSetting("profile", "emergencyContact", {
                          ...settings.profile?.emergencyContact,
                          phone: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyRelationship">Lien</Label>
                  <Input
                    id="emergencyRelationship"
                    value={
                      settings.profile?.emergencyContact?.relationship ?? ""
                    }
                    onChange={(e) =>
                      updateSetting("profile", "emergencyContact", {
                        ...settings.profile?.emergencyContact,
                        relationship: e.target.value,
                      })
                    }
                    placeholder="e.g., Spouse, Parent, Sibling"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => resetSettings("profile")}
                  className="text-red-600 hover:text-red-700"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Defaults
                </Button>

                <Button
                  onClick={() => saveSettings("profile", settings.profile)}
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Configure how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Notifications */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Notifications par e-mail</h3>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifications?.email?.enabled ?? true}
                    onCheckedChange={(checked) =>
                      updateSetting("notifications", "email", {
                        ...settings.notifications?.email,
                        enabled: checked,
                      })
                    }
                  />
                </div>

                {settings.notifications?.email?.enabled !== false && (
                  <div className="ml-4 space-y-3 border-l-2 border-muted pl-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="paymentReminders">
                        Rappels de paiement
                      </Label>
                      <Switch
                        id="paymentReminders"
                        checked={
                          settings.notifications?.email?.paymentReminders ??
                          true
                        }
                        onCheckedChange={(checked) =>
                          updateSetting("notifications", "email", {
                            ...settings.notifications?.email,
                            paymentReminders: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="maintenanceUpdates">
                        Maintenance Updates
                      </Label>
                      <Switch
                        id="maintenanceUpdates"
                        checked={
                          settings.notifications?.email?.maintenanceUpdates ??
                          true
                        }
                        onCheckedChange={(checked) =>
                          updateSetting("notifications", "email", {
                            ...settings.notifications?.email,
                            maintenanceUpdates: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="leaseReminders">Rappels de bail</Label>
                      <Switch
                        id="leaseReminders"
                        checked={
                          settings.notifications?.email?.leaseReminders ?? true
                        }
                        onCheckedChange={(checked) =>
                          updateSetting("notifications", "email", {
                            ...settings.notifications?.email,
                            leaseReminders: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="systemAlerts">Alertes système</Label>
                      <Switch
                        id="systemAlerts"
                        checked={
                          settings.notifications?.email?.systemAlerts ?? true
                        }
                        onCheckedChange={(checked) =>
                          updateSetting("notifications", "email", {
                            ...settings.notifications?.email,
                            systemAlerts: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="marketingEmails">E-mails commerciaux</Label>
                      <Switch
                        id="marketingEmails"
                        checked={
                          settings.notifications?.email?.marketingEmails ??
                          false
                        }
                        onCheckedChange={(checked) =>
                          updateSetting("notifications", "email", {
                            ...settings.notifications?.email,
                            marketingEmails: checked,
                          })
                        }
                      />
                    </div>

                    {/* Email Frequency */}
                    <div className="space-y-2">
                      <Label htmlFor="emailFrequency">Fréquence des e-mails</Label>
                      <Select
                        value={
                          settings.notifications?.email?.frequency ??
                          "immediate"
                        }
                        onValueChange={(value) =>
                          updateSetting("notifications", "email", {
                            ...settings.notifications?.email,
                            frequency: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner la fréquence" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Immédiate</SelectItem>
                          <SelectItem value="daily">Résumé quotidien</SelectItem>
                          <SelectItem value="weekly">Résumé hebdomadaire</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Quiet Hours */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="emailQuietHours">Heures silencieuses</Label>
                        <Switch
                          id="emailQuietHours"
                          checked={
                            settings.notifications?.email?.quietHours
                              ?.enabled ?? false
                          }
                          onCheckedChange={(checked) =>
                            updateSetting("notifications", "email", {
                              ...settings.notifications?.email,
                              quietHours: {
                                ...settings.notifications?.email?.quietHours,
                                enabled: checked,
                              },
                            })
                          }
                        />
                      </div>
                      {settings.notifications?.email?.quietHours?.enabled && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="emailQuietStart">Heure de début</Label>
                            <Input
                              id="emailQuietStart"
                              type="time"
                              value={
                                settings.notifications?.email?.quietHours
                                  ?.startTime ?? "22:00"
                              }
                              onChange={(e) =>
                                updateSetting("notifications", "email", {
                                  ...settings.notifications?.email,
                                  quietHours: {
                                    ...settings.notifications?.email
                                      ?.quietHours,
                                    startTime: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="emailQuietEnd">Heure de fin</Label>
                            <Input
                              id="emailQuietEnd"
                              type="time"
                              value={
                                settings.notifications?.email?.quietHours
                                  ?.endTime ?? "08:00"
                              }
                              onChange={(e) =>
                                updateSetting("notifications", "email", {
                                  ...settings.notifications?.email,
                                  quietHours: {
                                    ...settings.notifications?.email
                                      ?.quietHours,
                                    endTime: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* SMS Notifications */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Notifications par SMS</h3>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via text message
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifications?.sms?.enabled ?? false}
                    onCheckedChange={(checked) =>
                      updateSetting("notifications", "sms", {
                        ...settings.notifications?.sms,
                        enabled: checked,
                      })
                    }
                  />
                </div>

                {settings.notifications?.sms?.enabled && (
                  <div className="ml-4 space-y-3 border-l-2 border-muted pl-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="smsEmergencyOnly">Emergency Only</Label>
                      <Switch
                        id="smsEmergencyOnly"
                        checked={
                          settings.notifications?.sms?.emergencyOnly ?? true
                        }
                        onCheckedChange={(checked) =>
                          updateSetting("notifications", "sms", {
                            ...settings.notifications?.sms,
                            emergencyOnly: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="smsPaymentReminders">
                        Rappels de paiement
                      </Label>
                      <Switch
                        id="smsPaymentReminders"
                        checked={
                          settings.notifications?.sms?.paymentReminders ?? false
                        }
                        onCheckedChange={(checked) =>
                          updateSetting("notifications", "sms", {
                            ...settings.notifications?.sms,
                            paymentReminders: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="smsSystemAlerts">Alertes système</Label>
                      <Switch
                        id="smsSystemAlerts"
                        checked={
                          settings.notifications?.sms?.systemAlerts ?? false
                        }
                        onCheckedChange={(checked) =>
                          updateSetting("notifications", "sms", {
                            ...settings.notifications?.sms,
                            systemAlerts: checked,
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Push Notifications */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Notifications instantanées</h3>
                    <p className="text-sm text-muted-foreground">
                      Receive browser push notifications
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifications?.push?.enabled ?? true}
                    onCheckedChange={(checked) =>
                      updateSetting("notifications", "push", {
                        ...settings.notifications?.push,
                        enabled: checked,
                      })
                    }
                  />
                </div>

                {settings.notifications?.push?.enabled !== false && (
                  <div className="ml-4 space-y-3 border-l-2 border-muted pl-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pushPaymentReminders">
                        Rappels de paiement
                      </Label>
                      <Switch
                        id="pushPaymentReminders"
                        checked={
                          settings.notifications?.push?.paymentReminders ?? true
                        }
                        onCheckedChange={(checked) =>
                          updateSetting("notifications", "push", {
                            ...settings.notifications?.push,
                            paymentReminders: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pushMaintenanceUpdates">
                        Maintenance Updates
                      </Label>
                      <Switch
                        id="pushMaintenanceUpdates"
                        checked={
                          settings.notifications?.push?.maintenanceUpdates ??
                          true
                        }
                        onCheckedChange={(checked) =>
                          updateSetting("notifications", "push", {
                            ...settings.notifications?.push,
                            maintenanceUpdates: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pushTenantMessages">
                        Tenant Messages
                      </Label>
                      <Switch
                        id="pushTenantMessages"
                        checked={
                          settings.notifications?.push?.tenantMessages ?? true
                        }
                        onCheckedChange={(checked) =>
                          updateSetting("notifications", "push", {
                            ...settings.notifications?.push,
                            tenantMessages: checked,
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => resetSettings("notifications")}
                  className="text-red-600 hover:text-red-700"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Defaults
                </Button>

                <Button
                  onClick={() =>
                    saveSettings("notifications", settings.notifications)
                  }
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Notifications
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Security settings component will be implemented here.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="display" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>
                Personnalisez l’apparence de Gestion E-Immo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme Selection */}
              <div className="space-y-3">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={settings.display?.theme ?? "system"}
                  onValueChange={(value) =>
                    updateSetting("display", "theme", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le thème" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">Système</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred color scheme. System will match your
                  device settings.
                </p>
              </div>

              <Separator />

              {/* Language & Region */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Language & Region</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select
                      value={settings.display?.language ?? "en"}
                      onValueChange={(value) =>
                        updateSetting("display", "language", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner la langue" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="it">Italiano</SelectItem>
                        <SelectItem value="pt">Português</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={settings.display?.timezone ?? "America/New_York"}
                      onValueChange={(value) =>
                        updateSetting("display", "timezone", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le fuseau horaire" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">
                          Eastern Time (ET)
                        </SelectItem>
                        <SelectItem value="America/Chicago">
                          Central Time (CT)
                        </SelectItem>
                        <SelectItem value="America/Denver">
                          Mountain Time (MT)
                        </SelectItem>
                        <SelectItem value="America/Los_Angeles">
                          Pacific Time (PT)
                        </SelectItem>
                        <SelectItem value="Europe/London">
                          London (GMT)
                        </SelectItem>
                        <SelectItem value="Europe/Paris">
                          Paris (CET)
                        </SelectItem>
                        <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                        <SelectItem value="Australia/Sydney">
                          Sydney (AEST)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Date & Time Format */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Format de date et d’heure</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateFormat">Format de date</Label>
                    <Select
                      value={settings.display?.dateFormat ?? "MM/DD/YYYY"}
                      onValueChange={(value) =>
                        updateSetting("display", "dateFormat", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le format de date" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MM/DD/YYYY">
                          MM/DD/YYYY (12/31/2024)
                        </SelectItem>
                        <SelectItem value="DD/MM/YYYY">
                          DD/MM/YYYY (31/12/2024)
                        </SelectItem>
                        <SelectItem value="YYYY-MM-DD">
                          YYYY-MM-DD (2024-12-31)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timeFormat">Time Format</Label>
                    <Select
                      value={settings.display?.timeFormat ?? "12h"}
                      onValueChange={(value) =>
                        updateSetting("display", "timeFormat", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le format d’heure" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12h">12-hour (2:30 PM)</SelectItem>
                        <SelectItem value="24h">24-hour (14:30)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Layout & Density */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Layout & Density</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="density">Interface Density</Label>
                    <Select
                      value={settings.display?.density ?? "comfortable"}
                      onValueChange={(value) =>
                        updateSetting("display", "density", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner la densité" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compact">Compact</SelectItem>
                        <SelectItem value="comfortable">Comfortable</SelectItem>
                        <SelectItem value="spacious">Spacious</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fontSize">Font Size</Label>
                    <Select
                      value={settings.display?.fontSize ?? "medium"}
                      onValueChange={(value) =>
                        updateSetting("display", "fontSize", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner la taille du texte" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Moyenne</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Interface Options */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Options de l’interface</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="compactMode">Mode compact</Label>
                      <p className="text-sm text-muted-foreground">
                        Reduce spacing and padding for more content
                      </p>
                    </div>
                    <Switch
                      id="compactMode"
                      checked={settings.display?.compactMode ?? false}
                      onCheckedChange={(checked) =>
                        updateSetting("display", "compactMode", checked)
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="sidebarCollapsed">Réduire le menu latéral</Label>
                      <p className="text-sm text-muted-foreground">
                        Start with sidebar collapsed by default
                      </p>
                    </div>
                    <Switch
                      id="sidebarCollapsed"
                      checked={settings.display?.sidebarCollapsed ?? false}
                      onCheckedChange={(checked) =>
                        updateSetting("display", "sidebarCollapsed", checked)
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="animationsEnabled">Animations</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable smooth transitions and animations
                      </p>
                    </div>
                    <Switch
                      id="animationsEnabled"
                      checked={settings.display?.animationsEnabled ?? true}
                      onCheckedChange={(checked) =>
                        updateSetting("display", "animationsEnabled", checked)
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="highContrast">Contraste élevé</Label>
                      <p className="text-sm text-muted-foreground">
                        Increase contrast for better accessibility
                      </p>
                    </div>
                    <Switch
                      id="highContrast"
                      checked={settings.display?.highContrast ?? false}
                      onCheckedChange={(checked) =>
                        updateSetting("display", "highContrast", checked)
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Dashboard Layout */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Disposition du tableau de bord</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dashboardLayout">Disposition par défaut</Label>
                    <Select
                      value={settings.display?.dashboardLayout ?? "grid"}
                      onValueChange={(value) =>
                        updateSetting("display", "dashboardLayout", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner la disposition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grid">Vue en grille</SelectItem>
                        <SelectItem value="list">Vue en liste</SelectItem>
                        <SelectItem value="card">Vue en cartes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="itemsPerPage">Éléments par page</Label>
                    <Select
                      value={String(settings.display?.itemsPerPage ?? 25)}
                      onValueChange={(value) =>
                        updateSetting(
                          "display",
                          "itemsPerPage",
                          parseInt(value),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le nombre d’éléments par page" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 items</SelectItem>
                        <SelectItem value="25">25 items</SelectItem>
                        <SelectItem value="50">50 items</SelectItem>
                        <SelectItem value="100">100 items</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => resetSettings("display")}
                  className="text-red-600 hover:text-red-700"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Defaults
                </Button>

                <Button
                  onClick={() => saveSettings("display", settings.display)}
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Display Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy">
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Privacy settings component will be implemented here.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* System Settings - Admin Only */}
        {isAdmin && (
          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  System Configuration
                </CardTitle>
                <CardDescription>
                  Manage system-wide settings and configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Branding Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Identité visuelle</CardTitle>
                      <CardDescription>
                        Configure company branding and logos
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nom de l’entreprise</Label>
                        <Input
                          placeholder="Gestion E-Immo"
                          value={settings.system?.branding?.companyName ?? ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              system: {
                                ...settings.system,
                                branding: {
                                  ...settings.system?.branding,
                                  companyName: e.target.value,
                                },
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Logo de l’entreprise</Label>
                        <FileUpload
                          acceptedFileTypes={[
                            "image/jpeg",
                            "image/png",
                            "image/webp",
                            "image/svg+xml",
                          ]}
                          maxFileSize={5}
                          maxFiles={1}
                          onFilesSelected={(files) => {
                            const file = files?.[0];
                            if (!file) return;

                            const formData = new FormData();
                            formData.append("file", file);
                            formData.append("type", "logo");

                            fetch("/api/upload", {
                              method: "POST",
                              body: formData,
                            })
                              .then((res) => res.json())
                              .then((data) => {
                                const uploadedUrl =
                                  data?.url ?? data?.data?.url;
                                if (!uploadedUrl) return;
                                setSettings({
                                  ...settings,
                                  system: {
                                    ...settings.system,
                                    branding: {
                                      ...settings.system?.branding,
                                      logo: uploadedUrl,
                                    },
                                  },
                                });
                              })
                              .catch(() =>
                                toast.error("Failed to upload logo"),
                              );
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Email Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Email Configuration
                      </CardTitle>
                      <CardDescription>
                        Configure SMTP settings for system emails
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Serveur SMTP</Label>
                        <Input
                          placeholder="smtp.gmail.com"
                          value={settings.system?.email?.smtpHost ?? ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              system: {
                                ...settings.system,
                                email: {
                                  ...settings.system?.email,
                                  smtpHost: e.target.value,
                                },
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Port SMTP</Label>
                        <Input
                          type="number"
                          placeholder="587"
                          value={settings.system?.email?.smtpPort ?? ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              system: {
                                ...settings.system,
                                email: {
                                  ...settings.system?.email,
                                  smtpPort: parseInt(e.target.value),
                                },
                              },
                            })
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Security Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Sécurité</CardTitle>
                      <CardDescription>
                        System-wide security configuration
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Imposer la double authentification aux administrateurs</Label>
                          <p className="text-sm text-muted-foreground">
                            Require two-factor authentication for admin users
                          </p>
                        </div>
                        <Switch
                          checked={
                            settings.system?.security?.force2FAForAdmins ??
                            false
                          }
                          onCheckedChange={(checked) =>
                            setSettings({
                              ...settings,
                              system: {
                                ...settings.system,
                                security: {
                                  ...settings.system?.security,
                                  force2FAForAdmins: checked,
                                },
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Expiration de session (minutes)</Label>
                        <Input
                          type="number"
                          placeholder="30"
                          value={
                            settings.system?.security?.sessionTimeout ?? ""
                          }
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              system: {
                                ...settings.system,
                                security: {
                                  ...settings.system?.security,
                                  sessionTimeout: parseInt(e.target.value),
                                },
                              },
                            })
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Maintenance Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Maintenance</CardTitle>
                      <CardDescription>
                        System maintenance and backup settings
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Mode maintenance</Label>
                          <p className="text-sm text-muted-foreground">
                            Enable maintenance mode for system updates
                          </p>
                        </div>
                        <Switch
                          checked={
                            settings.system?.maintenance?.enabled ?? false
                          }
                          onCheckedChange={(checked) =>
                            setSettings({
                              ...settings,
                              system: {
                                ...settings.system,
                                maintenance: {
                                  ...settings.system?.maintenance,
                                  enabled: checked,
                                },
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fréquence des sauvegardes</Label>
                        <Select
                          value={
                            settings.system?.maintenance?.backupFrequency ??
                            "daily"
                          }
                          onValueChange={(value) =>
                            setSettings({
                              ...settings,
                              system: {
                                ...settings.system,
                                maintenance: {
                                  ...settings.system?.maintenance,
                                  backupFrequency: value,
                                },
                              },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly">Toutes les heures</SelectItem>
                            <SelectItem value="daily">Quotidienne</SelectItem>
                            <SelectItem value="weekly">Hebdomadaire</SelectItem>
                            <SelectItem value="monthly">Mensuelle</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button
                    onClick={() => saveSettings("system", settings.system)}
                    disabled={isSaving}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save System Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

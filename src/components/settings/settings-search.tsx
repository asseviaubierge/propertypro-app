"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Search,
  Settings,
  User,
  Bell,
  Shield,
  Palette,
  Eye,
  Database,
  ChevronRight,
  Filter,
} from "lucide-react";

interface SettingsItem {
  id: string;
  title: string;
  description: string;
  category: string;
  path: string;
  keywords: string[];
  icon: any;
}

interface SettingsSearchProps {
  onNavigate?: (path: string) => void;
}

export default function SettingsSearch({ onNavigate }: SettingsSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const router = useRouter();

  // Define all searchable settings
  const allSettings: SettingsItem[] = [
    // Profile Settings
    {
      id: "profile-basic",
      title: "Basic Information",
      description: "Update your name, email, and contact details",
      category: "Profile",
      path: "/dashboard/settings?tab=profile",
      keywords: ["name", "email", "phone", "contact", "personal"],
      icon: User,
    },
    {
      id: "profile-emergency",
      title: "Emergency Contact",
      description: "Set up emergency contact information",
      category: "Profile",
      path: "/dashboard/settings?tab=profile&section=emergency",
      keywords: ["emergency", "contact", "family", "relationship"],
      icon: User,
    },
    {
      id: "profile-social",
      title: "Social Links",
      description: "Connect your social media profiles",
      category: "Profile",
      path: "/dashboard/settings?tab=profile&section=social",
      keywords: ["social", "linkedin", "twitter", "facebook", "instagram"],
      icon: User,
    },

    // Notification Settings
    {
      id: "notifications-email",
      title: "Email Notifications",
      description: "Configure email notification preferences",
      category: "Notifications",
      path: "/dashboard/settings?tab=notifications&section=email",
      keywords: ["email", "notifications", "alerts", "reminders", "frequency"],
      icon: Bell,
    },
    {
      id: "notifications-sms",
      title: "SMS Notifications",
      description: "Set up text message notifications",
      category: "Notifications",
      path: "/dashboard/settings?tab=notifications&section=sms",
      keywords: ["sms", "text", "phone", "mobile", "alerts"],
      icon: Bell,
    },
    {
      id: "notifications-push",
      title: "Push Notifications",
      description: "Manage browser and app push notifications",
      category: "Notifications",
      path: "/dashboard/settings?tab=notifications&section=push",
      keywords: ["push", "browser", "app", "desktop", "mobile"],
      icon: Bell,
    },
    {
      id: "notifications-quiet",
      title: "Quiet Hours",
      description: "Set quiet hours for notifications",
      category: "Notifications",
      path: "/dashboard/settings?tab=notifications&section=quiet",
      keywords: ["quiet", "hours", "sleep", "do not disturb", "schedule"],
      icon: Bell,
    },

    // Security Settings
    {
      id: "security-password",
      title: "Password & Authentication",
      description: "Change password and security settings",
      category: "Security",
      path: "/dashboard/settings?tab=security&section=password",
      keywords: ["password", "authentication", "login", "security"],
      icon: Shield,
    },
    {
      id: "security-2fa",
      title: "Two-Factor Authentication",
      description: "Enable two-factor authentication for extra security",
      category: "Security",
      path: "/dashboard/settings?tab=security&section=2fa",
      keywords: ["2fa", "two factor", "authentication", "security", "totp"],
      icon: Shield,
    },
    {
      id: "security-devices",
      title: "Device Management",
      description: "Manage devices that have access to your account",
      category: "Security",
      path: "/dashboard/settings?tab=security&section=devices",
      keywords: ["devices", "sessions", "login", "access", "security"],
      icon: Shield,
    },
    {
      id: "security-audit",
      title: "Security Audit",
      description: "Review your account security status",
      category: "Security",
      path: "/dashboard/settings?tab=security&section=audit",
      keywords: ["audit", "security", "review", "status", "report"],
      icon: Shield,
    },

    // Display Settings
    {
      id: "display-theme",
      title: "Theme & Appearance",
      description: "Choose between light, dark, or system theme",
      category: "Display",
      path: "/dashboard/settings?tab=display&section=theme",
      keywords: ["theme", "dark", "light", "appearance", "mode"],
      icon: Palette,
    },
    {
      id: "display-language",
      title: "Language & Region",
      description: "Set your language, timezone, and date format",
      category: "Display",
      path: "/dashboard/settings?tab=display&section=language",
      keywords: ["language", "timezone", "date", "format", "region"],
      icon: Palette,
    },
    {
      id: "display-layout",
      title: "Layout & Typography",
      description: "Customize interface layout and text size",
      category: "Display",
      path: "/dashboard/settings?tab=display&section=layout",
      keywords: ["layout", "typography", "font", "size", "density"],
      icon: Palette,
    },
    {
      id: "display-colors",
      title: "Color Scheme",
      description: "Customize the color palette",
      category: "Display",
      path: "/dashboard/settings?tab=display&section=colors",
      keywords: ["colors", "palette", "primary", "secondary", "accent"],
      icon: Palette,
    },

    // Privacy Settings
    {
      id: "privacy-profile",
      title: "Profile Visibility",
      description: "Control who can see your profile information",
      category: "Privacy",
      path: "/dashboard/settings?tab=privacy&section=profile",
      keywords: ["privacy", "profile", "visibility", "public", "private"],
      icon: Eye,
    },
    {
      id: "privacy-data",
      title: "Data & Analytics",
      description: "Manage data collection and sharing preferences",
      category: "Privacy",
      path: "/dashboard/settings?tab=privacy&section=data",
      keywords: ["data", "analytics", "collection", "sharing", "usage"],
      icon: Eye,
    },
    {
      id: "privacy-cookies",
      title: "Cookie Preferences",
      description: "Manage cookie and tracking preferences",
      category: "Privacy",
      path: "/dashboard/settings?tab=privacy&section=cookies",
      keywords: ["cookies", "tracking", "analytics", "marketing", "essential"],
      icon: Eye,
    },

    // System Settings (Admin only)
    {
      id: "system-branding",
      title: "Branding & Logo",
      description: "Customize system branding and appearance",
      category: "System",
      path: "/dashboard/settings?tab=system&section=branding",
      keywords: ["branding", "logo", "company", "colors", "favicon"],
      icon: Database,
    },
    {
      id: "system-email",
      title: "Email Configuration",
      description: "Configure SMTP settings for system emails",
      category: "System",
      path: "/dashboard/settings?tab=system&section=email",
      keywords: ["smtp", "email", "configuration", "server", "mail"],
      icon: Database,
    },
    {
      id: "system-payment",
      title: "Payment Settings",
      description: "Configure payment gateways and billing",
      category: "System",
      path: "/dashboard/settings?tab=system&section=payment",
      keywords: ["payment", "stripe", "paypal", "billing", "gateway"],
      icon: Database,
    },
  ];

  // Filter settings based on search query and category
  const filteredSettings = useMemo(() => {
    let filtered = allSettings;

    if (selectedCategory) {
      filtered = filtered.filter(setting => setting.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(setting =>
        setting.title.toLowerCase().includes(query) ||
        setting.description.toLowerCase().includes(query) ||
        setting.keywords.some(keyword => keyword.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [searchQuery, selectedCategory]);

  // Group settings by category
  const groupedSettings = useMemo(() => {
    const groups: Record<string, SettingsItem[]> = {};
    filteredSettings.forEach(setting => {
      if (!groups[setting.category]) {
        groups[setting.category] = [];
      }
      groups[setting.category].push(setting);
    });
    return groups;
  }, [filteredSettings]);

  const categories = ["Profile", "Notifications", "Security", "Display", "Privacy", "System"];

  const handleSettingClick = (setting: SettingsItem) => {
    setIsOpen(false);
    setSearchQuery("");
    if (onNavigate) {
      onNavigate(setting.path);
    } else {
      router.push(setting.path);
    }
  };

  return (
    <div className="relative">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-muted-foreground"
          >
            <Search className="h-4 w-4 mr-2" />
            Search settings...
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search settings..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            
            {/* Category Filter */}
            <div className="flex items-center gap-2 p-3 border-b">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-wrap gap-1">
                <Badge
                  variant={selectedCategory === null ? "default" : "secondary"}
                  className="cursor-pointer text-xs"
                  onClick={() => setSelectedCategory(null)}
                >
                  All
                </Badge>
                {categories.map(category => (
                  <Badge
                    key={category}
                    variant={selectedCategory === category ? "default" : "secondary"}
                    className="cursor-pointer text-xs"
                    onClick={() => setSelectedCategory(
                      selectedCategory === category ? null : category
                    )}
                  >
                    {category}
                  </Badge>
                ))}
              </div>
            </div>

            <CommandList>
              <CommandEmpty>No settings found.</CommandEmpty>
              
              {Object.entries(groupedSettings).map(([category, settings]) => (
                <CommandGroup key={category} heading={category}>
                  {settings.map(setting => {
                    const Icon = setting.icon;
                    return (
                      <CommandItem
                        key={setting.id}
                        onSelect={() => handleSettingClick(setting)}
                        className="flex items-center gap-3 p-3 cursor-pointer"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">{setting.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {setting.description}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

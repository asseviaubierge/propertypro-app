"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { usePathname, useRouter } from "next/navigation";
import { useAuthorization } from "@/hooks/useAuthorization";
import {
  User,
  Bell,
  Shield,
  Palette,
  Eye,
  Database,
  FileText,
  History,
  Search,
  Settings,
  ChevronRight,
} from "lucide-react";

interface NavigationItem {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: any;
  badge?: string;
  adminOnly?: boolean;
  sections?: {
    id: string;
    title: string;
    href: string;
  }[];
}

interface SettingsNavigationProps {
  userRole?: string;
  className?: string;
  onNavigate?: (href: string) => void;
}

export default function SettingsNavigation({ 
  className,
  onNavigate 
}: SettingsNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin } = useAuthorization();

  const navigationItems: NavigationItem[] = [
    {
      id: "profile",
      title: "Profile Settings",
      description: "Manage your personal information and account details",
      href: "/dashboard/settings/profile",
      icon: User,
      sections: [
        { id: "basic", title: "Basic Information", href: "/dashboard/settings/profile#basic" },
        { id: "emergency", title: "Emergency Contact", href: "/dashboard/settings/profile#emergency" },
        { id: "social", title: "Social Links", href: "/dashboard/settings/profile#social" },
        { id: "account", title: "Account Information", href: "/dashboard/settings/profile#account" },
      ],
    },
    {
      id: "notifications",
      title: "Notification Settings",
      description: "Configure how and when you receive notifications",
      href: "/dashboard/settings/notifications",
      icon: Bell,
      sections: [
        { id: "email", title: "Email Notifications", href: "/dashboard/settings/notifications#email" },
        { id: "sms", title: "SMS Notifications", href: "/dashboard/settings/notifications#sms" },
        { id: "push", title: "Push Notifications", href: "/dashboard/settings/notifications#push" },
        { id: "in-app", title: "In-App Notifications", href: "/dashboard/settings/notifications#in-app" },
      ],
    },
    {
      id: "security",
      title: "Security Settings",
      description: "Protect your account with security features",
      href: "/dashboard/settings/security",
      icon: Shield,
      badge: "Important",
      sections: [
        { id: "password", title: "Password & Authentication", href: "/dashboard/settings/security#password" },
        { id: "2fa", title: "Two-Factor Authentication", href: "/dashboard/settings/security#2fa" },
        { id: "devices", title: "Device Management", href: "/dashboard/settings/security#devices" },
        { id: "audit", title: "Security Audit", href: "/dashboard/settings/security#audit" },
      ],
    },
    {
      id: "display",
      title: "Display Settings",
      description: "Customize the appearance and layout",
      href: "/dashboard/settings/appearance",
      icon: Palette,
      sections: [
        { id: "theme", title: "Theme & Appearance", href: "/dashboard/settings/appearance#theme" },
        { id: "language", title: "Language & Region", href: "/dashboard/settings/appearance#language" },
        { id: "layout", title: "Layout & Typography", href: "/dashboard/settings/appearance#layout" },
        { id: "colors", title: "Color Scheme", href: "/dashboard/settings/appearance#colors" },
      ],
    },
    {
      id: "privacy",
      title: "Privacy Settings",
      description: "Control your privacy and data sharing preferences",
      href: "/dashboard/settings/privacy",
      icon: Eye,
      sections: [
        { id: "profile", title: "Profile Visibility", href: "/dashboard/settings/privacy#profile" },
        { id: "data", title: "Data & Analytics", href: "/dashboard/settings/privacy#data" },
        { id: "cookies", title: "Cookie Preferences", href: "/dashboard/settings/privacy#cookies" },
        { id: "rights", title: "Data Rights", href: "/dashboard/settings/privacy#rights" },
      ],
    },
    {
      id: "system",
      title: "System Settings",
      description: "Configure system-wide settings and integrations",
      href: "/dashboard/settings/system",
      icon: Database,
      adminOnly: true,
      badge: "Admin",
      sections: [
        { id: "branding", title: "Branding & Logo", href: "/dashboard/settings/system#branding" },
        { id: "email", title: "Email Configuration", href: "/dashboard/settings/system#email" },
        { id: "payment", title: "Payment Settings", href: "/dashboard/settings/system#payment" },
        { id: "maintenance", title: "Maintenance Mode", href: "/dashboard/settings/system#maintenance" },
      ],
    },
    {
      id: "import-export",
      title: "Import/Export",
      description: "Backup and restore your settings",
      href: "/dashboard/settings/import-export",
      icon: FileText,
      sections: [
        { id: "export", title: "Export Settings", href: "/dashboard/settings/import-export#export" },
        { id: "import", title: "Import Settings", href: "/dashboard/settings/import-export#import" },
      ],
    },
    {
      id: "history",
      title: "Settings History",
      description: "View audit logs and change history",
      href: "/dashboard/settings/history",
      icon: History,
      sections: [
        { id: "recent", title: "Recent Changes", href: "/dashboard/settings/history#recent" },
        { id: "audit", title: "Audit Logs", href: "/dashboard/settings/history#audit" },
      ],
    },
  ];

  // Filter items based on user role
  const filteredItems = navigationItems.filter(item => 
    !item.adminOnly || isAdmin
  );

  const handleNavigation = (href: string) => {
    if (onNavigate) {
      onNavigate(href);
    } else {
      router.push(href);
    }
  };

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/");
  };

  const getActiveSection = (item: NavigationItem) => {
    if (!item.sections) return null;
    const hash = window.location.hash.slice(1);
    return item.sections.find(section => section.id === hash);
  };

  return (
    <nav className={cn("space-y-2", className)}>
      {/* Search */}
      <div className="mb-4">
        <Button
          variant="outline"
          className="w-full justify-start text-muted-foreground"
          onClick={() => handleNavigation("/dashboard/settings?search=true")}
        >
          <Search className="h-4 w-4 mr-2" />
          Search settings...
        </Button>
      </div>

      <Separator />

      {/* Navigation Items */}
      <div className="space-y-1">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const activeSection = active ? getActiveSection(item) : null;

          return (
            <div key={item.id} className="space-y-1">
              <Button
                variant={active ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start h-auto p-3",
                  active && "bg-secondary"
                )}
                onClick={() => handleNavigation(item.href)}
              >
                <div className="flex items-start gap-3 w-full">
                  <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      {item.badge && (
                        <Badge 
                          variant={item.badge === "Important" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight className={cn(
                    "h-4 w-4 transition-transform flex-shrink-0 mt-1",
                    active && "rotate-90"
                  )} />
                </div>
              </Button>

              {/* Sub-sections */}
              {active && item.sections && (
                <div className="ml-8 space-y-1">
                  {item.sections.map((section) => (
                    <Button
                      key={section.id}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "w-full justify-start text-sm",
                        activeSection?.id === section.id && "bg-muted"
                      )}
                      onClick={() => handleNavigation(section.href)}
                    >
                      {section.title}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Quick Actions */}
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground px-3 py-2">
          Quick Actions
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => handleNavigation("/dashboard/settings/export")}
        >
          <FileText className="h-4 w-4 mr-2" />
          Export All Settings
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => handleNavigation("/dashboard/settings/history")}
        >
          <History className="h-4 w-4 mr-2" />
          View Recent Changes
        </Button>
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => handleNavigation("/dashboard/settings/system")}
          >
            <Settings className="h-4 w-4 mr-2" />
            System Configuration
          </Button>
        )}
      </div>
    </nav>
  );
}

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
      title: "Profil",
      description: "Gérez vos informations personnelles",
      href: "/dashboard/settings/profile",
      icon: User,
      sections: [
        { id: "basic", title: "Informations générales", href: "/dashboard/settings/profile#basic" },
        { id: "emergency", title: "Contact d’urgence", href: "/dashboard/settings/profile#emergency" },
        { id: "social", title: "Réseaux sociaux", href: "/dashboard/settings/profile#social" },
        { id: "account", title: "Informations du compte", href: "/dashboard/settings/profile#account" },
      ],
    },
    {
      id: "notifications",
      title: "Paramètres des notifications",
      description: "Configurez la réception des notifications",
      href: "/dashboard/settings/notifications",
      icon: Bell,
      sections: [
        { id: "email", title: "Notifications par e-mail", href: "/dashboard/settings/notifications#email" },
        { id: "sms", title: "Notifications par SMS", href: "/dashboard/settings/notifications#sms" },
        { id: "push", title: "Notifications instantanées", href: "/dashboard/settings/notifications#push" },
        { id: "in-app", title: "Notifications internes", href: "/dashboard/settings/notifications#in-app" },
      ],
    },
    {
      id: "security",
      title: "Sécurité",
      description: "Protégez votre compte",
      href: "/dashboard/settings/security",
      icon: Shield,
      badge: "Important",
      sections: [
        { id: "password", title: "Mot de passe", href: "/dashboard/settings/security#password" },
        { id: "2fa", title: "Double authentification", href: "/dashboard/settings/security#2fa" },
        { id: "devices", title: "Appareils connectés", href: "/dashboard/settings/security#devices" },
        { id: "audit", title: "Contrôle de sécurité", href: "/dashboard/settings/security#audit" },
      ],
    },
    {
      id: "display",
      title: "Affichage",
      description: "Personnalisez l’apparence",
      href: "/dashboard/settings/appearance",
      icon: Palette,
      sections: [
        { id: "theme", title: "Thème et apparence", href: "/dashboard/settings/appearance#theme" },
        { id: "language", title: "Langue et région", href: "/dashboard/settings/appearance#language" },
        { id: "layout", title: "Mise en page", href: "/dashboard/settings/appearance#layout" },
        { id: "colors", title: "Palette de couleurs", href: "/dashboard/settings/appearance#colors" },
      ],
    },
    {
      id: "privacy",
      title: "Confidentialité",
      description: "Contrôlez vos données et leur partage",
      href: "/dashboard/settings/privacy",
      icon: Eye,
      sections: [
        { id: "profile", title: "Visibilité du profil", href: "/dashboard/settings/privacy#profile" },
        { id: "data", title: "Données et analyses", href: "/dashboard/settings/privacy#data" },
        { id: "cookies", title: "Préférences des cookies", href: "/dashboard/settings/privacy#cookies" },
        { id: "rights", title: "Droits sur les données", href: "/dashboard/settings/privacy#rights" },
      ],
    },
    {
      id: "system",
      title: "Système",
      description: "Configuration générale et intégrations",
      href: "/dashboard/settings/system",
      icon: Database,
      adminOnly: true,
      badge: "Admin",
      sections: [
        { id: "branding", title: "Identité et logo", href: "/dashboard/settings/system#branding" },
        { id: "email", title: "Configuration des e-mails", href: "/dashboard/settings/system#email" },
        { id: "payment", title: "Paramètres des paiements", href: "/dashboard/settings/system#payment" },
        { id: "maintenance", title: "Mode maintenance", href: "/dashboard/settings/system#maintenance" },
      ],
    },
    {
      id: "import-export",
      title: "Importation et exportation",
      description: "Sauvegardez et restaurez vos paramètres",
      href: "/dashboard/settings/import-export",
      icon: FileText,
      sections: [
        { id: "export", title: "Exporter les paramètres", href: "/dashboard/settings/import-export#export" },
        { id: "import", title: "Importer les paramètres", href: "/dashboard/settings/import-export#import" },
      ],
    },
    {
      id: "history",
      title: "Historique",
      description: "Consultez les modifications",
      href: "/dashboard/settings/history",
      icon: History,
      sections: [
        { id: "recent", title: "Modifications récentes", href: "/dashboard/settings/history#recent" },
        { id: "audit", title: "Journal de contrôle", href: "/dashboard/settings/history#audit" },
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
          Rechercher dans les paramètres…
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
          Actions rapides
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

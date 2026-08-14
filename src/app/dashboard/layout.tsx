"use client";

import { cn } from "@/lib/utils";
import { redirect, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { GlobalSearch } from "@/components/layout/global-search";
import Link from "next/link";
import {
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  MessageCircle,
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Grid3X3,
  FileText,
  Wrench,
  Inbox,
  Calendar,
  Settings,
} from "lucide-react";
import { useUserAvatar } from "@/components/providers/UserAvatarProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useSidebarCounts } from "@/hooks/useSidebarCounts";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session, status } = useSession();
  const { avatarUrl } = useUserAvatar();
  const { settings } = useSettings();
  const pathname = usePathname();
  const { counts } = useSidebarCounts({ refreshInterval: 30000 });
  const mobileMenuCount = counts.inbox;

  const whatsappEnabled = settings.branding?.whatsappEnabled ?? false;
  const whatsappNumber = settings.branding?.whatsappNumber ?? "";

  const openWhatsApp = () => {
    const cleanNumber = whatsappNumber.replace(/\D/g, "");
    if (!cleanNumber) return;
    const message = encodeURIComponent(
      "Bonjour GESTION E-IMMO, je vous contacte depuis mon espace E-IMMO."
    );
    window.open(
      `https://wa.me/${cleanNumber}?text=${message}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const user = session?.user;
  const normalizedRole = String(user?.role || "").toLowerCase();
  const isSuperAdmin = normalizedRole === "admin" || normalizedRole === "super_admin";
  const isTenant = user?.role === "TENANT" || user?.role === "locataire";

  // Fermeture automatique instantanée de la modale dès que le chemin change (navigation fluide)
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    document.documentElement.classList.add("dashboard-layout");
    document.body.classList.add("dashboard-layout");
    return () => {
      document.documentElement.classList.remove("dashboard-layout");
      document.body.classList.remove("dashboard-layout");
    };
  }, []);

  // Conservation des preuves E-IMMO :
  // les actions de suppression ne sont visibles que par le Super Administrateur.
  // Le contrôle serveur DELETE reste obligatoire en seconde barrière de sécurité.
  useEffect(() => {
    if (status !== "authenticated" || isSuperAdmin) return;

    const hideDeleteActions = (rootNode: ParentNode = document) => {
      const candidates = rootNode.querySelectorAll<HTMLElement>(
        'button, [role="menuitem"], a, [data-radix-collection-item]'
      );

      candidates.forEach((element) => {
        const text = (element.textContent || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();

        const ariaLabel = (element.getAttribute("aria-label") || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();

        const hasTrashIcon = Boolean(
          element.querySelector(
            'svg.lucide-trash, svg.lucide-trash-2, [data-lucide="trash"], [data-lucide="trash-2"]'
          )
        );

        const isDeleteAction =
          hasTrashIcon ||
          /\b(supprimer|suppression|delete|deleting|deleted)\b/.test(text) ||
          /\b(supprimer|suppression|delete)\b/.test(ariaLabel);

        if (isDeleteAction && !element.dataset.eimmoDeleteHidden) {
          element.dataset.eimmoDeleteHidden = "true";
          element.dataset.eimmoPreviousDisplay = element.style.display || "";
          element.style.setProperty("display", "none", "important");
        }
      });
    };

    hideDeleteActions();

    const observer = new MutationObserver(() => hideDeleteActions());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document
        .querySelectorAll<HTMLElement>('[data-eimmo-delete-hidden="true"]')
        .forEach((element) => {
          element.style.display = element.dataset.eimmoPreviousDisplay || "";
          delete element.dataset.eimmoDeleteHidden;
          delete element.dataset.eimmoPreviousDisplay;
        });
    };
  }, [status, isSuperAdmin]);


  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    redirect("/auth/signin");
  }

  // Bottom Navigation : Gestionnaire / Propriétaire (Réparation)
  const mobileNavItems = [
    { label: "Accueil", href: "/dashboard", icon: LayoutDashboard },
    { label: "Réparation", href: "/dashboard/maintenance", icon: Wrench },
    { label: "Baux", href: "/dashboard/leases", icon: FileText },
    { label: "Paiements", href: "/dashboard/payments", icon: CreditCard },
  ];

  // Bottom Navigation : Locataire (Réparation)
  const tenantMobileNavItems = [
    { label: "Accueil", href: "/dashboard", icon: LayoutDashboard },
    { label: "Bail", href: "/dashboard/leases", icon: FileText },
    { label: "Réparation", href: "/dashboard/maintenance", icon: Wrench },
    { label: "Paiements", href: "/dashboard/payments", icon: CreditCard },
  ];

  // Liste stricte et exclusive du Menu Popup pour le Locataire
  const tenantMenuItems = [
    { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
    { label: "Mon bail", href: "/dashboard/leases", icon: FileText },
    { label: "Paiements", href: "/dashboard/payments", icon: CreditCard },
    { label: "Réparation", href: "/dashboard/maintenance", icon: Wrench },
    { label: "Messages", href: "/dashboard/messages", icon: Inbox },
    { label: "Calendrier", href: "/dashboard/calendar", icon: Calendar },
    { label: "Paramètres", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen w-screen bg-background relative overflow-hidden">
      {/* MODAL DU BOUTON MENU */}
      {isMobileMenuOpen && (
        <div className="mobile-navigation-layer fixed inset-0 z-[80] md:hidden">
          <button
            type="button"
            className="mobile-navigation-overlay absolute inset-0"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Fermer le menu de navigation"
          />
          <aside
            className="mobile-navigation-drawer absolute inset-y-0 left-0 flex w-[90vw] max-w-[340px] flex-col overflow-hidden bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
          >
            <div className="mobile-navigation-header flex shrink-0 items-center justify-between border-b px-5 py-4">
              <div className="min-w-0">
                <div className="text-[17px] font-extrabold tracking-tight text-slate-950">
                  GESTION E-IMMO
                </div>
                <div className="mt-0.5 text-[11px] font-medium text-slate-600">
                  Plateforme de gestion immobilière
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsMobileMenuOpen(false)}
                className="h-10 w-10 shrink-0 rounded-full bg-white"
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="mobile-navigation-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white px-3 py-3">
              {isTenant ? (
                <div className="space-y-1.5">
                  {tenantMenuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium",
                          isActive
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-foreground/80 hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {Icon && <Icon className="h-5 w-5" />}
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="mobile-navigation-sidebar w-full bg-white">
                  <Sidebar
                    isCollapsed={false}
                    hideHeader
                    onNavigate={() => setIsMobileMenuOpen(false)}
                  />
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Sidebar Desktop classique */}
      <div className="hidden md:flex md:flex-col md:shrink-0">
        <Sidebar isCollapsed={isSidebarCollapsed} />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 h-full relative">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-border/30 glass-md px-4 lg:px-6 shrink-0 relative z-10">
          <div className="flex items-center gap-3 lg:gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex h-10 w-10 rounded-lg border border-border/50 bg-transparent hover:bg-transparent"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              aria-label={
                isSidebarCollapsed ? "Déployer le menu latéral" : "Réduire le menu latéral"
              }
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="size-5 text-muted-foreground" />
              ) : (
                <PanelLeftClose className="size-5 text-muted-foreground" />
              )}
            </Button>

            <GlobalSearch />
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            {whatsappEnabled && whatsappNumber && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openWhatsApp}
                  className="hidden sm:inline-flex items-center gap-2"
                  aria-label="Contacter GESTION E-IMMO sur WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>WhatsApp</span>
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={openWhatsApp}
                  className="sm:hidden"
                  aria-label="Contacter GESTION E-IMMO sur WhatsApp"
                >
                  <MessageCircle className="h-5 w-5" />
                </Button>
              </>
            )}

            <div className="hidden sm:flex">
              <NotificationBell />
            </div>
            <div className="sm:hidden">
              <NotificationBell />
            </div>


            <UserMenu>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={avatarUrl || user?.avatar || ""}
                    alt={user?.firstName || ""}
                  />
                  <AvatarFallback>
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </UserMenu>
          </div>
        </header>

        {/* Page Content */}
        <main
          data-dashboard-page={pathname === "/dashboard" ? "home" : "module"}
          className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 min-h-0 scrollbar-thin bg-linear-to-br from-background via-background to-muted/25"
        >
          <div className="min-w-0">{children}</div>
        </main>
      </div>

      {/* Bottom Navigation moderne et tactile */}
      <nav className="fixed bottom-0 left-0 right-0 h-[70px] bg-background border-t border-border/20 z-40 md:hidden flex items-center justify-around px-2 shadow-lg">
        {(isTenant ? tenantMobileNavItems : mobileNavItems).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center flex-1 h-full py-1",
                isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-8 rounded-xl",
                  isActive && "bg-primary/10"
                )}
              >
                <Icon className={cn("h-6 w-6", isActive && "text-primary")} />
              </div>
              <span className="text-[10px] leading-tight mt-0.5">{item.label}</span>
            </Link>
          );
        })}

        {/* Bouton Menu universel */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className={cn(
            "relative flex flex-col items-center justify-center flex-1 h-full py-1",
            isMobileMenuOpen ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
          )}
          aria-label="Ouvrir le menu complet"
        >
          <div
            className={cn(
              "relative flex items-center justify-center w-10 h-8 rounded-xl",
              isMobileMenuOpen && "bg-primary/10"
            )}
          >
            <Grid3X3 className={cn("h-6 w-6", isMobileMenuOpen && "text-primary")} />
            {mobileMenuCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-bold leading-4 text-center">
                {mobileMenuCount > 99 ? "99+" : mobileMenuCount}
              </span>
            )}
          </div>
          <span className="text-[10px] leading-tight mt-0.5">Menu</span>
        </button>
      </nav>
    </div>
  );
}

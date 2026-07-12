"use client";

import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { GlobalSearch } from "@/components/layout/global-search";
import { Menu, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useUserAvatar } from "@/components/providers/UserAvatarProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { PreferencesDrawer } from "@/components/layout/preferences/preferences-drawer";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session, status } = useSession();
  const { avatarUrl } = useUserAvatar();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Add dashboard-layout class to html and body when this layout is mounted
  useEffect(() => {
    document.documentElement.classList.add("dashboard-layout");
    document.body.classList.add("dashboard-layout");

    // Cleanup when component unmounts
    return () => {
      document.documentElement.classList.remove("dashboard-layout");
      document.body.classList.remove("dashboard-layout");
    };
  }, []);

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

  const user = session?.user;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Show on medium screens and above, or when mobile menu is open */}
      <div
        className={cn(
          "fixed md:relative inset-y-0 left-0 z-50 md:z-auto",
          "transition-transform duration-300 ease-in-out",
          "md:flex md:flex-col md:shrink-0",
          isMobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0",
        )}
      >
        <Sidebar isCollapsed={isSidebarCollapsed} />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Header with Glass Effect */}
        <header className="flex h-16 items-center justify-between border-b border-border/30 glass-md px-4 lg:px-6 shrink-0 relative z-10">
          {/* Mobile Menu Button & Search */}
          <div className="flex items-center gap-3 lg:gap-4">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>

            {/* Sidebar Collapse Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex h-10 w-10 rounded-lg border border-border/50 bg-transparent hover:bg-transparent transition-colors"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              aria-label={
                isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
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

          {/* Right Side */}
          <div className="flex items-center gap-2 lg:gap-4">
            {/* Notifications */}
            <div className="hidden sm:flex">
              <NotificationBell />
            </div>
            <div className="sm:hidden">
              <NotificationBell />
            </div>

            {/* Preferences */}
            <PreferencesDrawer />
            
            {/* User Menu */}
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
        <main className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0 scrollbar-thin bg-linear-to-br from-background via-background to-muted/20">
          <div className="animate-fade-in-up">{children}</div>
        </main>
      </div>
    </div>
  );
}

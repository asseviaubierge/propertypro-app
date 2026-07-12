"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import React from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Users, CreditCard, Home } from "lucide-react";
import { UserRole } from "@/types";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import {
  createAccessProfile,
  hasAnyPermission,
  hasRequiredRole,
  matchesRequiredRoles,
} from "@/lib/role-utils";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useMemo } from "react";

interface MobileNavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  roles: UserRole[];
  requiredPermissions?: string[];
  isQuickAction?: boolean;
}

// Bottom tab navigation items (most important/frequent actions)
const bottomTabItems: MobileNavItem[] = [
  {
    title: "nav.dashboard",
    href: "/dashboard",
    icon: Home,
    roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TENANT],
  },
  {
    title: "nav.properties",
    href: "/dashboard/properties",
    icon: Building2,
    roles: [UserRole.ADMIN, UserRole.MANAGER],
    requiredPermissions: ["property_management", "property_view"],
  },
  {
    title: "nav.tenants",
    href: "/dashboard/tenants",
    icon: Users,
    roles: [UserRole.ADMIN, UserRole.MANAGER],
    requiredPermissions: ["tenant_management", "tenant_view"],
  },
  {
    title: "nav.payments",
    href: "/dashboard/payments",
    icon: CreditCard,
    roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TENANT],
    requiredPermissions: ["financial_management", "payment_processing", "payment_portal"],
  },
];

interface MobileNavigationProps {
  className?: string;
}

export function MobileNavigation({ className }: MobileNavigationProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { t } = useLocalizationContext();

  const userRole = session?.user?.role;
  const { permissions: rolePermissions, isLoading: rolePermissionsLoading } =
    useRolePermissions();

  const accessProfile = useMemo(
    () => createAccessProfile(userRole, rolePermissions),
    [rolePermissions, userRole]
  );

  // Filter items based on user role and permissions
  const filteredBottomTabs = bottomTabItems.filter((item) => {
    if (!userRole) return false;

    if (rolePermissionsLoading && rolePermissions.length === 0) {
      return hasRequiredRole(userRole, item.roles);
    }

    if (accessProfile.isSystemRole) {
      return matchesRequiredRoles(accessProfile, item.roles);
    }

    // Custom roles: check role-level compatibility first, then actual permissions
    if (!matchesRequiredRoles(accessProfile, item.roles)) {
      return false;
    }

    if (item.requiredPermissions && item.requiredPermissions.length > 0) {
      return hasAnyPermission(accessProfile.permissions, item.requiredPermissions);
    }

    return true;
  });

  return (
    <>
      {/* Bottom Tab Navigation */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/50",
          "safe-area-pb", // Respect safe area on devices with home indicator
          className
        )}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {filteredBottomTabs.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "#" && pathname.startsWith(item.href));
            const isMoreButton = item.title === "More";

            // Skip the "More" button since Sheet component is removed
            if (isMoreButton) {
              return null;
            }

            return (
              <Link key={item.title} href={item.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "flex flex-col items-center gap-1 h-auto py-2 px-3 min-w-0 flex-1",
                    "transition-colors duration-200",
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="relative">
                    <Icon className="h-5 w-5" />
                    {item.badge && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-4 w-4 p-0 text-xs flex items-center justify-center"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs font-medium truncate">
                    {t(item.title)}
                  </span>
                </Button>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Spacer for bottom navigation */}
      <div className="h-16 lg:hidden" />
    </>
  );
}

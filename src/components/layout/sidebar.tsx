/**
 * PropertyPro - Sidebar Navigation
 * Role-based navigation sidebar for the dashboard
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserMenu } from "@/components/layout/user-menu";
import { useUserAvatar } from "@/components/providers/UserAvatarProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Building2,
  Users,
  FileText,
  CreditCard,
  Wrench,
  Settings,
  Home,
  UserPlus,
  Calendar,
  Bell,
  DollarSign,
  Key,
  Shield,
  ChevronRight,
  User,
  Palette,
  Megaphone,
  Inbox,
  MessageSquare,
  Grid3X3,
  TicketCheck,
  TrendingUp,
  Wallet,
  PieChart,
  ArrowLeftRight,
  ClipboardCheck,
  Mail,
  MessageCircle,
} from "lucide-react";
import { UserRole } from "@/types";
import { useTheme } from "next-themes";
import { useSidebarCounts, type SidebarCounts } from "@/hooks/useSidebarCounts";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import {
  createAccessProfile,
  hasAnyPermission,
  hasRequiredRole,
  matchesRequiredRoles,
} from "@/lib/role-utils";
import { useRolePermissions } from "@/hooks/useRolePermissions";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  countKey?: keyof SidebarCounts;
  roles: UserRole[];
  /** For custom roles: at least one of these permissions is required to see this item */
  requiredPermissions?: string[];
  children?: NavItem[];
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navigationSections: NavSection[] = [
  {
    items: [
      {
        title: "nav.dashboard",
        href: "/dashboard",
        icon: Home,
        roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TENANT],
      },
    ],
  },
  {
    title: "nav.section.management",
    items: [
      {
        title: "nav.properties",
        href: "/dashboard/properties",
        icon: Building2,
        roles: [UserRole.ADMIN, UserRole.MANAGER],
        requiredPermissions: ["property_management", "property_view"],
        children: [
          {
            title: "nav.properties.all",
            href: "/dashboard/properties",
            icon: Building2,
            roles: [UserRole.ADMIN, UserRole.MANAGER],
            requiredPermissions: ["property_management", "property_view"],
          },
          {
            title: "nav.properties.new",
            href: "/dashboard/properties/new",
            icon: Building2,
            roles: [UserRole.ADMIN, UserRole.MANAGER],
            requiredPermissions: ["property_create"],
          },
          {
            title: "nav.properties.available",
            href: "/dashboard/properties/available",
            icon: Key,
            roles: [UserRole.ADMIN, UserRole.MANAGER],
            requiredPermissions: ["property_management", "property_view"],
          },
          {
            title: "nav.properties.allUnits",
            href: "/dashboard/properties/units",
            icon: Grid3X3,
            roles: [UserRole.ADMIN, UserRole.MANAGER],
            requiredPermissions: ["property_management", "property_view"],
          },
        ],
      },
      {
        title: "nav.tenants",
        href: "/dashboard/tenants",
        icon: Users,
        roles: [UserRole.ADMIN, UserRole.MANAGER],
        requiredPermissions: ["tenant_management", "tenant_view"],
        children: [
          {
            title: "nav.tenants.all",
            href: "/dashboard/tenants",
            icon: Users,
            roles: [UserRole.ADMIN, UserRole.MANAGER],
            requiredPermissions: ["tenant_management", "tenant_view"],
          },
          {
            title: "nav.tenants.new",
            href: "/dashboard/tenants/new",
            icon: UserPlus,
            roles: [UserRole.ADMIN, UserRole.MANAGER],
            requiredPermissions: ["tenant_create"],
          },
          {
            title: "nav.tenants.applications",
            href: "/dashboard/tenants/applications",
            icon: UserPlus,
            countKey: "applications",
            roles: [UserRole.ADMIN, UserRole.MANAGER],
            requiredPermissions: ["application_processing"],
          },
        ],
      },
      {
        title: "nav.leases",
        href: "/dashboard/leases",
        icon: FileText,
        roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TENANT],
        requiredPermissions: ["lease_management", "lease_view"],
        children: [
          {
            title: "nav.leases.all",
            href: "/dashboard/leases",
            icon: FileText,
            roles: [UserRole.ADMIN, UserRole.MANAGER],
            requiredPermissions: ["lease_management", "lease_view"],
          },
          {
            title: "nav.leases.new",
            href: "/dashboard/leases/new",
            icon: UserPlus,
            roles: [UserRole.ADMIN, UserRole.MANAGER],
            requiredPermissions: ["lease_create"],
          },
          {
            title: "nav.leases.active",
            href: "/dashboard/leases/active",
            icon: FileText,
            roles: [UserRole.ADMIN, UserRole.MANAGER],
            requiredPermissions: ["lease_management", "lease_view"],
          },
          {
            title: "nav.leases.expiring",
            href: "/dashboard/leases/expiring",
            icon: Calendar,
            countKey: "expiringLeases",
            roles: [UserRole.ADMIN, UserRole.MANAGER],
            requiredPermissions: ["lease_management", "lease_view"],
          },
          {
            title: "nav.leases.my",
            href: "/dashboard/leases/my-leases",
            icon: Home,
            roles: [UserRole.TENANT],
            requiredPermissions: ["lease_view"],
          },
          {
            title: "nav.leases.documents",
            href: "/dashboard/leases/documents",
            icon: FileText,
            roles: [UserRole.TENANT],
            requiredPermissions: ["document_access"],
          },
        ],
      },
      {
        title: "nav.maintenance",
        href: "/dashboard/maintenance",
        icon: Wrench,
        roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TENANT],
        requiredPermissions: [
          "maintenance_management",
          "maintenance_view",
          "maintenance_requests",
        ],
        children: [
          {
            title: "nav.maintenance.all",
            href: "/dashboard/maintenance",
            icon: Wrench,
            roles: [UserRole.ADMIN, UserRole.MANAGER],
            requiredPermissions: ["maintenance_management", "maintenance_view"],
          },
          {
            title: "nav.maintenance.emergency",
            href: "/dashboard/maintenance/emergency",
            icon: Bell,
            countKey: "emergencyMaintenance",
            roles: [UserRole.ADMIN, UserRole.MANAGER],
            requiredPermissions: ["maintenance_management"],
          },
          {
            title: "nav.maintenance.submit",
            href: "/dashboard/maintenance/new",
            icon: Wrench,
            roles: [UserRole.TENANT],
            requiredPermissions: ["maintenance_requests"],
          },
          {
            title: "nav.maintenance.mine",
            href: "/dashboard/maintenance/my-requests",
            icon: Wrench,
            roles: [UserRole.TENANT],
            requiredPermissions: ["maintenance_requests"],
          },
        ],
      },
      {
        title: "nav.inspections",
        href: "/dashboard/inspections",
        icon: ClipboardCheck,
        roles: [UserRole.ADMIN, UserRole.MANAGER],
        requiredPermissions: ["maintenance_management"],
        children: [
          {
            title: "nav.inspections.all",
            href: "/dashboard/inspections",
            icon: ClipboardCheck,
            roles: [UserRole.ADMIN, UserRole.MANAGER],
            requiredPermissions: ["maintenance_management"],
          },
          {
            title: "nav.inspections.schedule",
            href: "/dashboard/inspections/new",
            icon: Calendar,
            roles: [UserRole.ADMIN, UserRole.MANAGER],
            requiredPermissions: ["maintenance_management"],
          },
        ],
      },
    ],
  },
  {
    title: "nav.section.financials",
    items: [
      {
        title: "nav.accounting.payRent",
        href: "/dashboard/payments/pay-rent",
        icon: CreditCard,
        roles: [UserRole.TENANT],
        requiredPermissions: ["payment_portal"],
      },
      {
        title: "nav.accounting.transactions",
        href: "/dashboard/accounting/transactions",
        icon: ArrowLeftRight,
        roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TENANT],
        requiredPermissions: [
          "financial_management",
          "payment_processing",
          "payment_history",
        ],
      },
      {
        title: "nav.accounting.invoices",
        href: "/dashboard/accounting/invoices",
        icon: FileText,
        roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TENANT],
        requiredPermissions: [
          "financial_management",
          "payment_processing",
          "payment_portal",
        ],
      },
      {
        title: "nav.accounting.revenues",
        href: "/dashboard/accounting/revenues",
        icon: TrendingUp,
        roles: [UserRole.ADMIN, UserRole.MANAGER],
        requiredPermissions: ["financial_management", "financial_reports"],
      },
      {
        title: "nav.accounting.expenses",
        href: "/dashboard/accounting/expenses",
        icon: Wallet,
        roles: [UserRole.ADMIN, UserRole.MANAGER],
        requiredPermissions: ["financial_management", "financial_reports"],
      },
      {
        title: "nav.accounting.reports",
        href: "/dashboard/accounting/reports",
        icon: PieChart,
        roles: [UserRole.ADMIN, UserRole.MANAGER],
        requiredPermissions: ["financial_reports", "reports_all"],
      },
    ],
  },
  {
    title: "nav.section.communication",
    items: [
      {
        title: "nav.inbox",
        href: "/dashboard/messages",
        icon: Inbox,
        countKey: "inbox",
        roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TENANT],
        children: [
          {
            title: "nav.messages",
            href: "/dashboard/messages",
            icon: MessageSquare,
            countKey: "messages",
            roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TENANT],
          },
          {
            title: "nav.notifications",
            href: "/dashboard/notifications",
            icon: Bell,
            countKey: "notifications",
            roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TENANT],
          },
          {
            title: "nav.announcements",
            href: "/dashboard/announcements",
            icon: Megaphone,
            countKey: "announcements",
            roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TENANT],
          },
          {
            title: "nav.tickets",
            href: "/dashboard/tickets",
            icon: TicketCheck,
            countKey: "tickets",
            roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TENANT],
          },
        ],
      },
      {
        title: "nav.calendar",
        href: "/dashboard/calendar",
        icon: Calendar,
        roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TENANT],
      },
    ],
  },
  {
    title: "nav.section.administration",
    items: [
      {
        title: "nav.admin",
        href: "/dashboard/admin",
        icon: Shield,
        roles: [UserRole.ADMIN],
        requiredPermissions: ["user_management", "role_management"],
        children: [
          {
            title: "nav.admin.overview",
            href: "/dashboard/admin",
            icon: Shield,
            roles: [UserRole.ADMIN],
            requiredPermissions: ["user_management"],
          },
          {
            title: "nav.admin.users",
            href: "/dashboard/admin/users",
            icon: Users,
            roles: [UserRole.ADMIN],
            requiredPermissions: ["user_management", "user_view"],
          },
          {
            title: "nav.admin.users.new",
            href: "/dashboard/admin/users/new",
            icon: UserPlus,
            roles: [UserRole.ADMIN],
            requiredPermissions: ["user_management"],
          },
          {
            title: "nav.admin.users.roles",
            href: "/dashboard/admin/users/roles",
            icon: Shield,
            roles: [UserRole.ADMIN],
            requiredPermissions: ["role_management"],
          },
          {
            title: "nav.admin.subscriptions",
            href: "/dashboard/admin/subscriptions",
            icon: CreditCard,
            roles: [UserRole.ADMIN],
            requiredPermissions: ["system_settings"],
          },
          {
            title: "WhatsApp utilisateurs",
            href: "/dashboard/admin/whatsapp",
            icon: MessageCircle,
            roles: [UserRole.ADMIN],
            requiredPermissions: ["system_settings"],
          },
        ],
      },
      {
        title: "nav.settings",
        href: "/dashboard/settings",
        icon: Settings,
        roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TENANT],
        children: [
          {
            title: "nav.settings.profile",
            href: "/dashboard/settings/profile",
            icon: User,
            roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TENANT],
          },
          {
            title: "nav.settings.security",
            href: "/dashboard/settings/security",
            icon: Shield,
            roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.TENANT],
          },
          {
            // Display & branding is a single global setting managed by admins
            // only; every account inherits it.
            title: "nav.settings.display",
            href: "/dashboard/settings/appearance",
            icon: Palette,
            roles: [UserRole.ADMIN],
            requiredPermissions: ["system_settings"],
          },
          {
            title: "nav.settings.email",
            href: "/dashboard/settings/email",
            icon: Mail,
            roles: [UserRole.ADMIN],
            requiredPermissions: ["system_settings"],
          },
          {
            title: "nav.settings.payment",
            href: "/dashboard/settings/payment",
            icon: CreditCard,
            roles: [UserRole.ADMIN],
            requiredPermissions: ["system_settings"],
          },
        ],
      },
    ],
  },
];

interface SidebarProps {
  className?: string;
  isCollapsed?: boolean;
  hideHeader?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ className, isCollapsed = false, hideHeader = false, onNavigate }: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openFlyout = useCallback((href: string) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setHoveredItem(href);
  }, []);

  const scheduleCloseFlyout = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setHoveredItem(null), 120);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);
  const pathname = usePathname();
  const { avatarUrl } = useUserAvatar();

  const { data: session } = useSession();
  const { resolvedTheme } = useTheme();
  const { t } = useLocalizationContext();
  // Branding (logo/favicon) + nav color come from the global SettingsProvider.
  const { settings } = useSettings();
  const branding = settings.branding;
  const navColor = settings.navColor ?? "integrate";
  const whatsappEnabled = branding?.whatsappEnabled ?? false;
  const whatsappNumber = branding?.whatsappNumber ?? "";

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

  // Get dynamic sidebar counts
  const { counts } = useSidebarCounts({
    refreshInterval: 30000, // Refresh every 30 seconds
    enabled: !!session?.user, // Only fetch when user is logged in
  });

  const userRole = session?.user?.role;
  const { permissions: rolePermissions, isLoading: rolePermissionsLoading } =
    useRolePermissions();

  const accessProfile = useMemo(
    () => createAccessProfile(userRole, rolePermissions),
    [rolePermissions, userRole],
  );

  const canAccessItem = useCallback(
    (item: NavItem): boolean => {
      if (!userRole) {
        return false;
      }

      // Keep legacy role-based checks during initial permission load to avoid
      // temporary blank navigation flicker on initial render.
      if (rolePermissionsLoading && rolePermissions.length === 0) {
        return hasRequiredRole(userRole, item.roles);
      }

      // For system roles (ADMIN, MANAGER, TENANT), use existing role-based check
      if (accessProfile.isSystemRole) {
        return matchesRequiredRoles(accessProfile, item.roles);
      }

      // For custom roles: first check role-level compatibility, then actual permissions.
      // This ensures a custom manager-level role doesn't see tenant-only items
      // (like "My Leases") even if they have overlapping permissions.
      if (!matchesRequiredRoles(accessProfile, item.roles)) {
        return false;
      }

      // Check actual permissions when requiredPermissions is defined
      if (item.requiredPermissions && item.requiredPermissions.length > 0) {
        return hasAnyPermission(
          accessProfile.permissions,
          item.requiredPermissions,
        );
      }

      // Items without requiredPermissions are accessible if role check passed
      return true;
    },
    [accessProfile, rolePermissions.length, rolePermissionsLoading, userRole],
  );

  const getVisibleChildren = useCallback(
    (children?: NavItem[]): NavItem[] =>
      (children ?? []).filter((child) => canAccessItem(child)),
    [canAccessItem],
  );

  const toggleExpanded = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href)
        ? prev.filter((item) => item !== href)
        : [...prev, href],
    );
  };

  // Function to get dynamic badge for navigation items
  const formatCountBadge = (count?: number): string | undefined =>
    (count ?? 0) > 0 ? String(count) : undefined;

  const getDynamicBadge = (item: NavItem): string | undefined => {
    if (item.countKey) {
      return formatCountBadge(counts?.[item.countKey]);
    }

    switch (item.href) {
      case "/dashboard/tenants/applications":
        return formatCountBadge(counts.applications);
      case "/dashboard/leases/expiring":
        return formatCountBadge(counts.expiringLeases);
      case "/dashboard/maintenance/emergency":
        return formatCountBadge(counts.emergencyMaintenance);
      case "/dashboard/payments/overdue":
        return formatCountBadge(counts.overduePayments);
      default:
        return undefined;
    }
  };

  // Update navigation sections with dynamic badges
  const updateItemWithDynamicBadge = (item: NavItem): NavItem => {
    const dynamicBadge = getDynamicBadge(item);
    const updatedItem = {
      ...item,
      badge: dynamicBadge ?? item.badge, // Use dynamic badge when available; preserve explicit empty string values
      children: item.children?.map(updateItemWithDynamicBadge),
    };
    return updatedItem;
  };

  const filteredSections = navigationSections
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => {
          if (!canAccessItem(item)) {
            return false;
          }

          if (!item.children || item.children.length === 0) {
            return true;
          }

          return getVisibleChildren(item.children).length > 0;
        })
        .map(updateItemWithDynamicBadge),
    }))
    .filter((section) => section.items.length > 0);

  const renderNavItem = (item: NavItem, level = 0, isLastChild = false) => {
    const isActive = pathname === item.href;
    const filteredChildren = getVisibleChildren(item.children);
    const hasChildren = filteredChildren.length > 0;
    const isSubItem = level > 0;

    // Check if any child is active (for parent highlighting)
    const hasActiveChild =
      hasChildren && filteredChildren.some((child) => pathname === child.href);
    const isParentActive = hasActiveChild && level === 0;
    const isChildActive = isActive && level > 0;

    // Auto-expand parent if child is active
    const shouldExpand = expandedItems.includes(item.href) || hasActiveChild;
    const isExpanded = shouldExpand;

    // Collapsed top-level rendering: vertical icon+label tile, optional flyout
    if (isCollapsed && level === 0) {
      const isOpen = hoveredItem === item.href;

      const tile = (
        <Link
          href={hasChildren ? "#" : item.href}
          data-sidebar-item={isSubItem ? "sub" : "root"}
          data-active={isActive || isParentActive ? "true" : undefined}
          data-expanded={isExpanded && level === 0 ? "true" : undefined}
          onClick={(e) => {
            if (hasChildren) {
              e.preventDefault();
              openFlyout(item.href);
            }
          }}
          onMouseEnter={() => hasChildren && openFlyout(item.href)}
          onMouseLeave={() => hasChildren && scheduleCloseFlyout()}
          className={cn(
            "relative flex flex-col items-center justify-center gap-1.5 px-1 py-3 rounded-lg transition-colors group",
            "hover:bg-sidebar-accent/60",
            (isActive || isParentActive) && "bg-primary/10 text-primary",
          )}
        >
          <item.icon
            className={cn(
              "h-5.5 w-5.5 stroke-[2.35] transition-colors",
              isActive || isParentActive
                ? "text-primary"
                : "text-gray-600 dark:text-gray-400",
            )}
          />
          <span
            className={cn(
              "text-[10px] font-medium leading-tight text-center w-full px-0.5 wrap-break-word",
              isActive || isParentActive
                ? "text-primary"
                : "text-gray-700 dark:text-gray-300",
            )}
          >
            {t(item.title)}
          </span>
          {hasChildren && (
            <ChevronRight
              className={cn(
                "absolute right-1 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors",
                isActive || isParentActive
                  ? "text-primary"
                  : "text-gray-400 dark:text-gray-500",
              )}
            />
          )}
          {item.badge && (
            <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-4 h-4 px-1 text-[9px] font-semibold bg-primary text-primary-foreground rounded-full">
              {item.badge}
            </span>
          )}
        </Link>
      );

      if (!hasChildren) return <div key={item.href}>{tile}</div>;

      return (
        <Popover key={item.href} open={isOpen}>
          <PopoverTrigger asChild>{tile}</PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={8}
            className="w-56 p-1"
            onMouseEnter={() => openFlyout(item.href)}
            onMouseLeave={scheduleCloseFlyout}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="px-3 py-2 border-b border-border/60 mb-1">
              <p className="text-xs font-semibold text-foreground">
                {t(item.title)}
              </p>
            </div>
            <div className="space-y-0.5">
              {filteredChildren.map((child) => {
                const childActive = pathname === child.href;
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={() => setHoveredItem(null)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                      childActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-accent/60",
                    )}
                  >
                    <child.icon
                      className={cn(
                        "h-4 w-4 shrink-0 stroke-[2.35]",
                        childActive ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {t(child.title)}
                    </span>
                    {child.badge && (
                      <span className="inline-flex items-center justify-center rounded-full border border-primary/15 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {child.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <div key={item.href} className={cn(isSubItem && "relative min-h-10")}>
        {isSubItem && (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-[19px] top-0 h-10 w-6 overflow-visible text-gray-200 dark:text-gray-700"
            viewBox="0 0 24 40"
            fill="none"
            preserveAspectRatio="none"
          >
            <path
              d={isLastChild ? "M1 0V10" : "M1 0V40"}
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="butt"
            />
            <path
              d="M1 10C1 14.4 4.6 18 9 18H18"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        <Link
          href={hasChildren ? "#" : item.href}
          data-sidebar-item={isSubItem ? "sub" : "root"}
          data-active={isActive || isParentActive ? "true" : undefined}
          data-expanded={isExpanded && level === 0 ? "true" : undefined}
          onClick={(e) => {
            if (hasChildren) {
              e.preventDefault();
              toggleExpanded(item.href);
              return;
            }
            onNavigate?.();
          }}
          className={cn(
            "relative group flex items-center text-sm font-medium transition-all duration-200 rounded-lg",
            "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            isSubItem
              ? navColor === "apparent"
                ? "ml-8 h-9 gap-2 px-2 text-white/80 hover:bg-white/[0.12] hover:text-white"
                : "ml-8 h-9 gap-2 px-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100/80 hover:text-gray-900 dark:hover:bg-gray-800/70 dark:hover:text-gray-100"
              : "h-10 gap-3 px-3",
            // Main parent active state (full primary styling)
            isActive &&
              level === 0 &&
              (navColor === "apparent"
                ? "bg-white/[0.18] text-white"
                : "bg-primary/10 text-primary"),
            // Parent with active child (subtle primary styling)
            isParentActive &&
              (navColor === "apparent"
                ? "bg-white/[0.18] text-white"
                : "bg-primary/10 text-primary"),
            isExpanded &&
              level === 0 &&
              !isActive &&
              !isParentActive &&
              (navColor === "apparent"
                ? "bg-white/[0.14] text-white"
                : "bg-gray-50 text-gray-900 dark:bg-gray-800/60 dark:text-gray-100"),
            // Child active state (lighter styling)
            isChildActive &&
              (navColor === "apparent"
                ? "bg-white/[0.16] text-white font-semibold"
                : "bg-gray-100 text-gray-950 font-semibold dark:bg-gray-800 dark:text-gray-50"),
            isCollapsed && "justify-center px-2",
          )}
        >
          {!isSubItem && (
            <item.icon
              className={cn(
                "h-4 w-4 shrink-0 stroke-[2.35] transition-colors",
                isCollapsed && "h-5 w-5",
                navColor === "apparent"
                  ? "text-white"
                  : isActive || isParentActive
                  ? "text-primary"
                  : "text-gray-600 dark:text-gray-400",
              )}
            />
          )}
          {!isCollapsed && (
            <>
              <span
                className={cn(
                  "flex-1 truncate font-medium",
                  isSubItem
                    ? isChildActive
                      ? navColor === "apparent"
                        ? "text-white"
                        : "text-gray-950 dark:text-gray-50"
                      : navColor === "apparent"
                        ? "text-white/80"
                        : "text-gray-500 dark:text-gray-400"
                    : navColor === "apparent"
                      ? "text-white"
                      : isActive || isParentActive
                      ? "text-primary"
                      : "text-gray-700 dark:text-gray-300",
                )}
              >
                {t(item.title)}
              </span>
              {item.badge && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/15 rounded-full">
                  {item.badge}
                </span>
              )}
              {hasChildren && (
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    navColor === "apparent"
                      ? "text-white/75"
                      : "text-gray-400 dark:text-gray-500",
                    isExpanded && "rotate-90",
                  )}
                />
              )}
            </>
          )}
        </Link>

        {hasChildren && isExpanded && !isCollapsed && (
          <div className="mt-1">
            {filteredChildren.map((child, index) =>
              renderNavItem(
                child,
                level + 1,
                index === filteredChildren.length - 1,
              ),
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSection = (section: NavSection): React.ReactNode => {
    return (
      <div key={section.title || "default"} className="space-y-1">
        {section.title && !isCollapsed && (
          <div className="px-3 pt-2 pb-1">
            <h3 className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {t(section.title)}
            </h3>
          </div>
        )}
        <div className="space-y-0.5">
          {section.items.map((item) => renderNavItem(item))}
        </div>
      </div>
    );
  };

  // Compute current logo URL from branding and theme (favicon is applied
  // centrally by the SettingsProvider). Apparent nav has a dark/colored
  // background, so use the dark-theme (light) logo there regardless of theme.
  const currentLogoUrl = useMemo(() => {
    const light = branding.logoLight || "/images/logo-light.png";
    const dark = branding.logoDark || "/images/logo-dark.png";
    const useDarkLogo = resolvedTheme === "dark" || navColor === "apparent";
    return useDarkLogo ? dark : light;
  }, [branding.logoLight, branding.logoDark, resolvedTheme, navColor]);

  const currentIconUrl = useMemo(
    () => branding.favicon || "/favicon.ico",
    [branding.favicon],
  );

  // Branding is sourced centrally from the SettingsProvider. When no custom
  // logo has been uploaded the stored value is just a default placeholder path
  // (e.g. "/images/logo-light.png") that isn't shipped as a file, so rendering
  // it through next/image 400s and shows a broken image. In that case fall back
  // to a dynamic text wordmark built from the central company name instead.
  const companyName = (branding.companyName ?? "").trim() || "GESTION E-IMMO";
  const isMissingLogoAsset = (url?: string) =>
    !url || url.startsWith("/images/logo");
  const [logoError, setLogoError] = useState(false);
  useEffect(() => setLogoError(false), [currentLogoUrl]);
  const showLogoImage = !isMissingLogoAsset(currentLogoUrl) && !logoError;

  return (
    <div
      data-sidebar="root"
      className={cn(
        "flex h-full flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-hidden relative transition-[width] duration-300 ease-in-out",
        isCollapsed ? "w-28" : "w-64",
        className,
      )}
    >
      {/* Header */}
      {!hideHeader && (
        <div
          className={cn(
            "flex h-16 items-center flex-shrink-0 border-b border-gray-200 dark:border-gray-800 gap-2",
            isCollapsed ? "px-2 justify-center" : "px-4",
          )}
        >
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center hover:opacity-80 transition-opacity duration-150",
              isCollapsed ? "justify-center gap-0" : "flex-1 gap-3",
            )}
          >
            <div className="flex items-center justify-center">
              {isCollapsed ? (
                <Image
                  src={currentIconUrl}
                  loading="lazy"
                  alt={companyName}
                  width={32}
                  height={32}
                  className="h-8 w-8 object-contain"
                />
              ) : showLogoImage ? (
                <Image
                  src={currentLogoUrl}
                  loading="lazy"
                  alt={companyName}
                  width={140}
                  height={36}
                  onError={() => setLogoError(true)}
                  className="h-8 w-auto max-w-[140px] object-contain"
                />
              ) : (
                <span
                  className={cn(
                    "truncate text-lg font-bold tracking-tight",
                    navColor === "apparent"
                      ? "text-white"
                      : "text-gray-900 dark:text-white",
                  )}
                >
                  {companyName}
                </span>
              )}
            </div>
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav
        className={cn(
          "flex-1 space-y-4 overflow-y-auto min-h-0 sidebar-scroll",
          isCollapsed ? "p-3" : "p-4",
        )}
      >
        {filteredSections.map((section) => renderSection(section))}
      </nav>
      
            {/* WhatsApp GESTION E-IMMO */}
      {whatsappEnabled && whatsappNumber && (
        <div
          className={cn(
            "shrink-0 px-3 pb-3",
            isCollapsed && "px-2"
          )}
        >
          <button
            type="button"
            onClick={openWhatsApp}
            className={cn(
              "w-full bg-green-600 hover:bg-green-700 text-white",
              "rounded-xl transition-colors shadow-sm",
              "flex items-center",
              isCollapsed
                ? "justify-center h-11"
                : "gap-3 px-3 py-3 text-left"
            )}
            aria-label="Contacter GESTION E-IMMO sur WhatsApp"
            title="WhatsApp GESTION E-IMMO"
          >
            <MessageCircle className="h-5 w-5 shrink-0" />

            {!isCollapsed && (
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  WhatsApp
                </div>
                <div className="text-xs text-white/80 truncate">
                  Contacter GESTION E-IMMO
                </div>
              </div>
            )}
          </button>
        </div>
      )}

      {/* User Info */}

      {/* User Info */}
      {session?.user && (
        <div
          className={cn(
            "border-t border-gray-200 dark:border-gray-800 shrink-0",
            isCollapsed ? "p-2" : "p-4",
          )}
        >
          <UserMenu
            side="top"
            align={isCollapsed ? "center" : "start"}
            sideOffset={8}
          >
            <button
              type="button"
              className={cn(
                "flex items-center w-full rounded-lg transition-colors hover:bg-sidebar-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                isCollapsed ? "justify-center p-1" : "gap-3 p-2 text-left",
              )}
              aria-label="Ouvrir le menu utilisateur"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={
                    avatarUrl || session.user.avatar || session.user.image || ""
                  }
                  alt={`${session.user.firstName} ${session.user.lastName}`}
                />
                <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium">
                  {session.user.firstName?.[0]}
                  {session.user.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {session.user.firstName} {session.user.lastName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {userRole?.replace("_", " ")}
                  </p>
                </div>
              )}
            </button>
          </UserMenu>
        </div>
      )}
    </div>
  );
}

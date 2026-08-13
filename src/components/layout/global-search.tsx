"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

interface SearchRoute {
  label: string;
  href: string;
  badge?: string;
  keywords?: string[];
}

interface SearchGroup {
  heading: string;
  items: SearchRoute[];
}

const searchGroups: SearchGroup[] = [
  {
    heading: "Aperçu",
    items: [
      { label: "Tableau de bord", href: "/dashboard", badge: "Aperçu" },
      { label: "Calendrier", href: "/dashboard/calendar", badge: "Aperçu" },
    ],
  },
  {
    heading: "Gestion",
    items: [
      { label: "Propriétés", href: "/dashboard/properties", badge: "Aperçu" },
      { label: "Unités", href: "/dashboard/properties/units", badge: "Liste" },
      { label: "Locataires", href: "/dashboard/tenants", badge: "Aperçu" },
      {
        label: "Demandes",
        href: "/dashboard/tenants/applications",
        badge: "Liste",
      },
      { label: "Baux", href: "/dashboard/leases", badge: "Aperçu" },
      {
        label: "Maintenance",
        href: "/dashboard/maintenance",
        badge: "Aperçu",
      },
      {
        label: "Inspections",
        href: "/dashboard/inspections",
        badge: "Aperçu",
      },
    ],
  },
  {
    heading: "Finances",
    items: [
      { label: "Paiements", href: "/dashboard/payments", badge: "Paiements" },
      {
        label: "Transactions",
        href: "/dashboard/accounting/transactions",
        badge: "Liste",
      },
      {
        label: "Factures",
        href: "/dashboard/accounting/invoices",
        badge: "Liste",
      },
      {
        label: "Revenus",
        href: "/dashboard/accounting/revenues",
        badge: "Rapport",
      },
      {
        label: "Dépenses",
        href: "/dashboard/accounting/expenses",
        badge: "Rapport",
      },
      {
        label: "Rapports",
        href: "/dashboard/accounting/reports",
        badge: "Rapport",
      },
    ],
  },
  {
    heading: "Communication",
    items: [
      { label: "Messages", href: "/dashboard/messages", badge: "Messagerie" },
      {
        label: "Notifications",
        href: "/dashboard/notifications",
        badge: "Messagerie",
      },
      {
        label: "Annonces",
        href: "/dashboard/announcements",
        badge: "Messagerie",
      },
      { label: "Tickets", href: "/dashboard/tickets", badge: "Messagerie" },
    ],
  },
  {
    heading: "Administration",
    items: [
      { label: "Admin", href: "/dashboard/admin", badge: "Aperçu" },
      { label: "Utilisateurs", href: "/dashboard/admin/users", badge: "Liste" },
      {
        label: "Rôles et permissions",
        href: "/dashboard/admin/users/roles",
        badge: "Paramètres",
      },
      {
        label: "Profil",
        href: "/dashboard/settings/profile",
        badge: "Paramètres",
      },
      {
        label: "Apparence",
        href: "/dashboard/settings/appearance",
        badge: "Paramètres",
      },
    ],
  },
];

interface GlobalSearchProps {
  className?: string;
}

export function GlobalSearch({ className }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const normalizedRole = String(session?.user?.role || "").toLowerCase();
  const isAdmin = normalizedRole === "admin" || normalizedRole === "super_admin";
  const isTenant = normalizedRole === "tenant" || normalizedRole === "locataire";

  const tenantAllowedHrefs = new Set([
    "/dashboard",
    "/dashboard/calendar",
    "/dashboard/leases",
    "/dashboard/payments",
    "/dashboard/maintenance",
    "/dashboard/messages",
    "/dashboard/settings/profile",
  ]);

  const visibleGroups = searchGroups
    .filter((group) => group.heading !== "Administration" || isAdmin)
    .map((group) => ({
      ...group,
      items: isTenant
        ? group.items.filter((item) => tenantAllowedHrefs.has(item.href))
        : group.items,
    }))
    .filter((group) => group.items.length > 0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full border border-border/60 bg-muted/80 pl-3 pr-1.5 text-foreground shadow-sm transition-colors hover:bg-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border/70 dark:bg-muted/70 dark:hover:bg-accent/70",
          className
        )}
        aria-label="Ouvrir la recherche"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <kbd className="hidden md:inline-flex items-center gap-1 rounded-full border border-border/50 bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm">
          <span>⌘</span>
          <span>K</span>
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Rechercher..." />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
          {visibleGroups.map((group, idx) => (
            <div key={group.heading}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={group.heading}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`${item.label} ${item.href} ${(item.keywords ?? []).join(" ")}`}
                    onSelect={() => handleSelect(item.href)}
                    className="flex items-center justify-between gap-3 px-3 py-3 cursor-pointer hover:bg-accent/60"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {item.label}
                      </span>

                    </div>
                    {item.badge && (
                      <span className="shrink-0 inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground">
                        {item.badge}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}

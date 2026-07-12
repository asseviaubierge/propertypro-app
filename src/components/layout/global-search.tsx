"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
    heading: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", badge: "Overview" },
      { label: "Calendar", href: "/dashboard/calendar", badge: "Overview" },
    ],
  },
  {
    heading: "Management",
    items: [
      { label: "Properties", href: "/dashboard/properties", badge: "Overview" },
      { label: "Units", href: "/dashboard/properties/units", badge: "List" },
      { label: "Tenants", href: "/dashboard/tenants", badge: "Overview" },
      {
        label: "Applications",
        href: "/dashboard/tenants/applications",
        badge: "List",
      },
      { label: "Leases", href: "/dashboard/leases", badge: "Overview" },
      {
        label: "Maintenance",
        href: "/dashboard/maintenance",
        badge: "Overview",
      },
      {
        label: "Inspections",
        href: "/dashboard/inspections",
        badge: "Overview",
      },
    ],
  },
  {
    heading: "Financials",
    items: [
      {
        label: "Transactions",
        href: "/dashboard/accounting/transactions",
        badge: "List",
      },
      {
        label: "Invoices",
        href: "/dashboard/accounting/invoices",
        badge: "List",
      },
      {
        label: "Revenues",
        href: "/dashboard/accounting/revenues",
        badge: "Report",
      },
      {
        label: "Expenses",
        href: "/dashboard/accounting/expenses",
        badge: "Report",
      },
      {
        label: "Reports",
        href: "/dashboard/accounting/reports",
        badge: "Report",
      },
    ],
  },
  {
    heading: "Communication",
    items: [
      { label: "Messages", href: "/dashboard/messages", badge: "Inbox" },
      {
        label: "Notifications",
        href: "/dashboard/notifications",
        badge: "Inbox",
      },
      {
        label: "Announcements",
        href: "/dashboard/announcements",
        badge: "Inbox",
      },
      { label: "Tickets", href: "/dashboard/tickets", badge: "Inbox" },
    ],
  },
  {
    heading: "Administration",
    items: [
      { label: "Admin", href: "/dashboard/admin", badge: "Overview" },
      { label: "Users", href: "/dashboard/admin/users", badge: "List" },
      {
        label: "Roles & Permissions",
        href: "/dashboard/admin/users/roles",
        badge: "Settings",
      },
      {
        label: "Profile",
        href: "/dashboard/settings/profile",
        badge: "Settings",
      },
      {
        label: "Appearance",
        href: "/dashboard/settings/appearance",
        badge: "Settings",
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
        aria-label="Open search"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <kbd className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm dark:bg-background/80">
          <span>⌘</span>
          <span>K</span>
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search..." />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>No results found.</CommandEmpty>
          {searchGroups.map((group, idx) => (
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
                      <span className="text-xs text-muted-foreground truncate">
                        {item.href}
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

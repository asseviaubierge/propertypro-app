"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale"; // Import de la locale française
import { Bell, Loader2, Check, AlertTriangle, RotateCcw } from "lucide-react";
import { useSession } from "next-auth/react";

import { useNotifications } from "@/hooks/useNotifications";
import type { NotificationItem } from "@/types/notifications";
import { cn } from "@/lib/utils";
import { useAuthorization } from "@/hooks/useAuthorization";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

function getPriorityVariant(priority: NotificationItem["priority"]) {
  switch (priority) {
    case "critical":
      return "destructive" as const;
    case "high":
      return "warning" as const;
    case "medium":
      return "info" as const;
    case "low":
      return "secondary" as const;
    default:
      return "default" as const;
  }
}

function getPriorityLabel(priority: NotificationItem["priority"]) {
  switch (priority) {
    case "critical":
      return "Critique";
    case "high":
      return "Haute";
    case "medium":
      return "Moyenne";
    case "low":
      return "Basse";
    default:
      return "Normale";
  }
}

export function NotificationBell() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { isAdmin, isManager, isTenant } = useAuthorization();
  const [open, setOpen] = useState(false);
  const isAuthorizedRole = isAdmin || isManager || isTenant;
  const canUseNotifications = status === "authenticated" && isAuthorizedRole;
  const isRoleRestricted = status === "authenticated" && !isAuthorizedRole;
  const {
    notifications,
    unreadCount,
    metrics,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    refresh,
  } = useNotifications({
    limit: 12,
    includeRead: true,
    pollInterval: 60000,
    enabled: canUseNotifications,
  });

  const hasNotifications = notifications.length > 0;

  const unreadIds = useMemo(
    () => notifications.filter((notification) => !notification.read).map((n) => n.id),
    [notifications]
  );

  const handleNotificationClick = useCallback(
    (notification: NotificationItem) => {
      if (!canUseNotifications) return;

      if (!notification.read) {
        void markAsRead([notification.id]);
      }

      if (notification.actionUrl) {
        router.push(notification.actionUrl);
        setOpen(false);
      }
    },
    [canUseNotifications, markAsRead, router]
  );

  const handleMarkAll = useCallback(() => {
    if (!canUseNotifications || unreadIds.length === 0) return;
    void markAllAsRead();
  }, [canUseNotifications, markAllAsRead, unreadIds.length]);

  const isButtonLoading = status === "loading" || (canUseNotifications && isLoading);
  const showRestrictedState = isRoleRestricted || error === "Notifications are unavailable for your role.";
  const notificationsLink = "/dashboard/notifications";

  // Helper pour formater les dates en français
  const formatRelativeDate = (date: Date) => 
    formatDistanceToNow(date, { addSuffix: true, locale: fr });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative"
          aria-label={
            canUseNotifications && unreadCount > 0
              ? `${unreadCount} notification(s) non lue(s)`
              : "Notifications"
          }
        >
          {isButtonLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {canUseNotifications && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {showRestrictedState
                ? "Notifications non disponibles pour votre rôle."
                : unreadCount > 0
                  ? `${unreadCount} non lue(s) · ${metrics.highPriority} prioritaire(s)`
                  : "Vous êtes à jour"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => void refresh()}
              disabled={!canUseNotifications}
              aria-label="Actualiser les notifications"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleMarkAll}
              disabled={!canUseNotifications || unreadIds.length === 0}
              aria-label="Tout marquer comme lu"
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-80">
          {showRestrictedState ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center text-muted-foreground">
              <AlertTriangle className="h-8 w-8 text-warning" />
              <p className="text-sm font-medium text-foreground">Notifications indisponibles</p>
              <p className="text-xs">Vous n'avez pas accès aux notifications sur ce compte.</p>
            </div>
          ) : isButtonLoading && !hasNotifications ? (
            <div className="space-y-3 px-4 py-4">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              ))}
            </div>
          ) : hasNotifications ? (
            <div className="divide-y">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition",
                    notification.read ? "bg-background hover:bg-muted/60" : "bg-primary/5 hover:bg-primary/10"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="mt-1">
                    {["critical", "high"].includes(notification.priority) ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Bell className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{notification.title}</h3>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {formatRelativeDate(new Date(notification.createdAt))}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant={getPriorityVariant(notification.priority)}>
                        {getPriorityLabel(notification.priority)}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {notification.type.replace(/_/g, " ")}
                      </Badge>
                      {!notification.read && (
                        <span className="text-[11px] font-semibold text-primary">Nouveau</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-muted-foreground">
              <Bell className="h-8 w-8" />
              <p className="text-sm font-medium text-foreground">Aucune notification</p>
              <p className="text-xs">Les notifications que vous recevrez s'afficheront ici.</p>
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs">
          <Link
            href={notificationsLink}
            className={cn("font-medium text-primary hover:underline", !canUseNotifications && "pointer-events-none opacity-60")}
            onClick={() => canUseNotifications && setOpen(false)}
          >
            Voir toutes les notifications
          </Link>
          <span className="text-muted-foreground">
            Mis à jour {metrics.lastUpdated ? formatRelativeDate(new Date(metrics.lastUpdated)) : "à l'instant"}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBell;

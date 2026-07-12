"use client";

import { ReactNode } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LogOut, Settings, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthorization } from "@/hooks/useAuthorization";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

interface UserMenuProps {
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
}

export function UserMenu({
  children,
  align = "end",
  side,
  sideOffset,
}: UserMenuProps) {
  const { data: session } = useSession();
  const { isAdmin } = useAuthorization();
  const { t } = useLocalizationContext();
  const router = useRouter();

  const user = session?.user;
  // Display & branding is a global, admin-only setting.
  const canAccessDisplaySettings = isAdmin;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56"
        align={align}
        side={side}
        sideOffset={sideOffset}
        forceMount
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
            <p className="text-xs leading-none text-muted-foreground capitalize">
              {user?.role?.replace("_", " ")}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push("/dashboard/settings/profile")}
        >
          <User className="mr-2 h-4 w-4" />
          <span>{t("header.menu.profile")}</span>
        </DropdownMenuItem>
        {canAccessDisplaySettings && (
          <DropdownMenuItem
            onClick={() => router.push("/dashboard/settings/appearance")}
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>{t("header.menu.settings")}</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-600"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t("header.menu.logout")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

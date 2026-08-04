"use client";

import { useTheme } from "next-themes";
import { useTransition } from "react";
import Link from "next/link";
import { LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { logoutAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils";
import type { UserDTO } from "@/server/queries";

export function UserMenu({
  user,
  collapsed,
}: {
  user: UserDTO;
  collapsed: boolean;
}) {
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition hover:bg-sidebar-accent",
            collapsed && "justify-center px-0",
          )}
        >
          <UserAvatar user={user} showTooltip={false} className="size-7" />
          {!collapsed && (
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-[13px] font-medium leading-tight">
                {user.name}
              </p>
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                {user.email}
              </p>
            </div>
          )}
        </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem render={<Link href="/settings" />}>
            <Settings className="size-4" />
            Configurações
          </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Tema
        </DropdownMenuLabel>
        {(
          [
            { value: "light", label: "Claro", icon: Sun },
            { value: "dark", label: "Escuro", icon: Moon },
            { value: "system", label: "Sistema", icon: Monitor },
          ] as const
        ).map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setTheme(option.value)}
            className={cn(theme === option.value && "bg-accent")}
          >
            <option.icon className="size-4" />
            {option.label}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onClick={() => startTransition(() => void logoutAction())}
        >
          <LogOut className="size-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

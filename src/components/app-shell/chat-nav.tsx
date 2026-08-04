"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { unreadTotals } from "@/server/actions/chat";
import { cn } from "@/lib/utils";

/**
 * Item "Chat" da barra lateral com selo de não lidas.
 * Acompanha o fluxo SSE para atualizar o número em tempo real.
 */
export function ChatNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname.startsWith("/chat");
  const [totals, setTotals] = useState({ unread: 0, mentions: 0 });

  useEffect(() => {
    let alive = true;
    const load = () => {
      unreadTotals().then((t) => alive && setTotals(t));
    };
    load();

    const source = new EventSource("/api/chat/stream");
    source.onmessage = () => load();

    return () => {
      alive = false;
      source.close();
    };
  }, [pathname]);

  const badge = totals.mentions > 0 ? `@${totals.mentions}` : totals.unread || null;

  const content = (
    <Link
      href="/chat"
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <span className="relative">
        <MessageSquare className="size-4 shrink-0" />
        {collapsed && badge && (
          <span className="absolute -right-1.5 -top-1 size-2 rounded-full bg-destructive" />
        )}
      </span>
      {!collapsed && (
        <>
          <span className="truncate">Chat</span>
          {badge && (
            <span
              className={cn(
                "ml-auto rounded-full px-1.5 text-[10px] font-semibold",
                totals.mentions > 0
                  ? "bg-destructive text-white"
                  : "bg-primary text-primary-foreground",
              )}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  );

  if (!collapsed) return content;
  return (
    <Tooltip>
      <TooltipTrigger render={content} />
      <TooltipContent side="right">Chat</TooltipContent>
    </Tooltip>
  );
}

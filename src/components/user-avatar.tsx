"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, initials, readableOn } from "@/lib/utils";
import type { UserDTO } from "@/server/queries";
import { UserRound } from "lucide-react";

export function UserAvatar({
  user,
  className,
  showTooltip = true,
}: {
  user: Pick<UserDTO, "name" | "avatarColor"> | null | undefined;
  className?: string;
  showTooltip?: boolean;
}) {
  const content = user ? (
    <Avatar className={cn("size-6 border border-background", className)}>
      <AvatarFallback
        className="text-[10px] font-semibold"
        style={{
          backgroundColor: user.avatarColor,
          color: readableOn(user.avatarColor),
        }}
      >
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  ) : (
    <span
      className={cn(
        "flex size-6 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground",
        className,
      )}
    >
      <UserRound className="size-3" />
    </span>
  );

  if (!showTooltip) return content;

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        {content}
      </TooltipTrigger>
      <TooltipContent>{user ? user.name : "Sem responsável"}</TooltipContent>
    </Tooltip>
  );
}

export function AvatarStack({
  users,
  max = 3,
  className,
}: {
  users: Pick<UserDTO, "id" | "name" | "avatarColor">[];
  max?: number;
  className?: string;
}) {
  const visible = users.slice(0, max);
  const rest = users.length - visible.length;
  return (
    <div className={cn("flex -space-x-1.5", className)}>
      {visible.map((u) => (
        <UserAvatar key={u.id} user={u} className="size-6" />
      ))}
      {rest > 0 && (
        <span className="flex size-6 items-center justify-center rounded-full border border-background bg-muted text-[10px] font-medium text-muted-foreground">
          +{rest}
        </span>
      )}
    </div>
  );
}

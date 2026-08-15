"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppOptional } from "@/components/app-shell/app-context";
import { urlDoMascote } from "@/lib/avatares";
import { withBase } from "@/lib/base-path";
import { cn, initials, readableOn } from "@/lib/utils";
import type { UserDTO } from "@/server/queries";
import { UserRound } from "lucide-react";

type Pessoa = Pick<UserDTO, "name" | "avatarColor"> &
  Partial<Pick<UserDTO, "id" | "avatarMascot" | "avatarFoto">>;

/**
 * Decide o que desenhar: foto, mascote ou iniciais.
 *
 * A maioria das telas monta o objeto de usuário com nome e cor apenas — são
 * quase vinte lugares. Em vez de mexer em todos, o avatar procura a pessoa
 * pelo id na lista de membros que o app já carregou; quem passar os campos
 * direto tem preferência, e fora do app autenticado sobram as iniciais.
 */
function resolver(user: Pessoa, membros: Pessoa[] | undefined) {
  const doContexto =
    user.avatarMascot === undefined && user.avatarFoto === undefined && user.id
      ? membros?.find((m) => m.id === user.id)
      : undefined;

  return {
    foto: user.avatarFoto ?? doContexto?.avatarFoto ?? null,
    mascote: user.avatarMascot ?? doContexto?.avatarMascot ?? null,
  };
}

export function UserAvatar({
  user,
  className,
  showTooltip = true,
}: {
  user: Pessoa | null | undefined;
  className?: string;
  showTooltip?: boolean;
}) {
  const app = useAppOptional();
  const { foto, mascote } = user
    ? resolver(user, app?.members)
    : { foto: null, mascote: null };

  const content = user ? (
    <Avatar className={cn("size-6 border border-background", className)}>
      {foto && <AvatarImage src={withBase(foto)} alt="" />}
      {!foto && mascote && (
        <AvatarImage
          src={withBase(urlDoMascote(mascote))}
          alt=""
          className="bg-muted object-contain"
        />
      )}
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
  users: (Pessoa & { id: string })[];
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

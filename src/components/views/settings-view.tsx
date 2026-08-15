"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { LogOut, Monitor, Moon, Plus, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/user-avatar";
import { AvatarCard } from "@/components/settings/avatar-card";
import { TagChip } from "@/components/task/task-badges";
import { PALETTE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  createTag,
  deleteTag,
  updateProfile,
  updateWorkspaceName,
} from "@/server/actions/projects";
import { logoutAction } from "@/server/actions/auth";
import { ApiTokensCard } from "@/components/settings/api-tokens-card";
import { EmailPrefsCard } from "@/components/settings/email-prefs-card";
import { GithubTokenCard } from "@/components/views/github-token-card";
import type { UserDTO } from "@/server/queries";

export function SettingsView({
  user,
  workspace,
  members,
  tags,
  projectCount,
  githubTokenPreview,
}: {
  user: UserDTO;
  workspace: { id: string; name: string; slug: string };
  members: (UserDTO & { role: string })[];
  tags: { id: string; name: string; color: string }[];
  projectCount: number;
  githubTokenPreview: string | null;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [, startTransition] = useTransition();
  // o tema só é conhecido no cliente — evita divergência de hidratação
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // sincronização com fonte externa (URL, localStorage, servidor) — intencional
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const [name, setName] = useState(user.name);
  const [avatarColor, setAvatarColor] = useState(user.avatarColor);
  const [wsName, setWsName] = useState(workspace.name);
  const [newTag, setNewTag] = useState("");
  const [newTagColor, setNewTagColor] = useState(PALETTE[0]);

  return (
    <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Perfil, workspace e preferências de aparência.
          </p>
        </div>

        {/* perfil */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Seu perfil</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Como você aparece para o time.
          </p>

          <AvatarCard user={user} />

          <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="u-name">Nome</Label>
                <Input
                  id="u-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() =>
                    name.trim() &&
                    name !== user.name &&
                    startTransition(async () => {
                      await updateProfile({ name });
                      toast.success("Perfil atualizado");
                      router.refresh();
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input value={user.email} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Cor das iniciais</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Cor ${c}`}
                      onClick={() => {
                        setAvatarColor(c);
                        startTransition(async () => {
                          await updateProfile({ avatarColor: c });
                          router.refresh();
                        });
                      }}
                      className={cn(
                        "size-6 rounded-full ring-offset-2 ring-offset-background transition",
                        avatarColor === c && "ring-2 ring-foreground",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
          </div>
        </section>

        {/* aparência */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Aparência</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Beni acompanha o tema do sistema por padrão.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: "light", label: "Claro", icon: Sun },
                { value: "dark", label: "Escuro", icon: Moon },
                { value: "system", label: "Sistema", icon: Monitor },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border py-4 text-xs transition hover:bg-accent",
                  mounted &&
                    theme === option.value &&
                    "border-primary bg-primary/5 text-primary-strong",
                )}
              >
                <option.icon className="size-5" />
                {option.label}
              </button>
            ))}
          </div>
        </section>

        {/* workspace */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Workspace</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {projectCount} {projectCount === 1 ? "projeto" : "projetos"} ·{" "}
            {members.length} {members.length === 1 ? "pessoa" : "pessoas"}
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Nome do workspace</Label>
            <Input
              id="ws-name"
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              onBlur={() =>
                wsName.trim() &&
                wsName !== workspace.name &&
                startTransition(async () => {
                  await updateWorkspaceName(wsName);
                  toast.success("Workspace atualizado");
                  router.refresh();
                })
              }
            />
          </div>

          <Separator className="my-4" />

          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pessoas
          </h3>
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-2.5">
                <UserAvatar user={m} showTooltip={false} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{m.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {m.email}
                  </p>
                </div>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                  {roleLabel(m.role)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* etiquetas */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Etiquetas</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Usadas para classificar tarefas em qualquer projeto.
          </p>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <TagChip
                key={t.id}
                name={t.name}
                color={t.color}
                onRemove={() =>
                  startTransition(async () => {
                    await deleteTag(t.id);
                    router.refresh();
                  })
                }
              />
            ))}
            {tags.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma etiqueta ainda.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <div className="flex flex-wrap gap-1">
              {PALETTE.slice(0, 8).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Cor ${c}`}
                  onClick={() => setNewTagColor(c)}
                  className={cn(
                    "size-6 rounded-full ring-offset-2 ring-offset-background transition",
                    newTagColor === c && "ring-2 ring-foreground",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Nova etiqueta"
              className="h-9 flex-1"
            />
            <Button
              variant="outline"
              disabled={!newTag.trim()}
              onClick={() => {
                const value = newTag.trim();
                setNewTag("");
                startTransition(async () => {
                  await createTag({ name: value, color: newTagColor });
                  router.refresh();
                });
              }}
            >
              <Plus className="size-4" />
              Criar
            </Button>
          </div>
        </section>

        <GithubTokenCard preview={githubTokenPreview} />

        <EmailPrefsCard />

        <ApiTokensCard />

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Sessão</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Encerrar a sessão neste dispositivo.
          </p>
          <Button
            variant="outline"
            onClick={() => startTransition(() => void logoutAction())}
          >
            <LogOut className="size-4" />
            Sair da conta
          </Button>
        </section>
      </div>
    </div>
  );
}

function roleLabel(role: string) {
  return (
    { OWNER: "dono", ADMIN: "admin", MEMBER: "membro", GUEST: "convidado" }[
      role
    ] ?? role.toLowerCase()
  );
}

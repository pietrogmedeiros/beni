"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DynamicIcon } from "@/components/dynamic-icon";
import { PALETTE, PROJECT_ICONS } from "@/lib/constants";
import { cn, projectKeyFrom } from "@/lib/utils";
import { createProject } from "@/server/actions/projects";

export function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* montado só enquanto aberto: o formulário sempre começa limpo */}
      {open && <NewProjectForm onOpenChange={onOpenChange} />}
    </Dialog>
  );
}

function NewProjectForm({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(
    () => PALETTE[Math.floor(Math.random() * 12)],
  );
  const [icon, setIcon] = useState(PROJECT_ICONS[0]);

  function submit() {
    if (!name.trim()) {
      toast.error("Informe o nome do projeto");
      return;
    }
    startTransition(async () => {
      try {
        const project = await createProject({
          name: name.trim(),
          description: description.trim() || null,
          color,
          icon,
          key: key.trim() || null,
        });
        toast.success("Projeto criado");
        onOpenChange(false);
        router.push(`/p/${project.id}/board`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao criar projeto");
      }
    });
  }

  return (
    <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo projeto</DialogTitle>
          <DialogDescription>
            Cada projeto vem com um fluxo padrão de status que você pode ajustar
            depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${color}22` }}
            >
              <DynamicIcon name={icon} className="size-6" style={{ color }} />
            </span>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="project-name">Nome</Label>
              <Input
                id="project-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Plataforma Web"
              />
            </div>
            <div className="w-24 space-y-1.5">
              <Label htmlFor="project-key">Sigla</Label>
              <Input
                id="project-key"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder={name ? projectKeyFrom(name) : "WEB"}
                maxLength={6}
                className="font-mono uppercase"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-desc">Descrição</Label>
            <Textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Do que trata este projeto?"
              className="min-h-16"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Cor ${c}`}
                  className={cn(
                    "size-6 rounded-full ring-offset-2 ring-offset-background transition",
                    color === c && "ring-2 ring-foreground",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Ícone</Label>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  aria-label={`Ícone ${i}`}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md border transition hover:bg-accent",
                    icon === i && "border-primary bg-primary/10 text-primary-strong",
                  )}
                >
                  <DynamicIcon name={i} className="size-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={pending} onClick={submit}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Criar projeto
          </Button>
      </DialogFooter>
    </DialogContent>
  );
}

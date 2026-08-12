"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, ListPlus, Loader2, Sparkles } from "lucide-react";
import {
  createBulkTasks,
  previewBulkTasks,
  type BulkPreview,
} from "@/server/actions/bulk-tasks";
import { MAX_BULK_TASKS, type BulkMode } from "@/lib/bulk-parse";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITY_META, TASK_TYPE_META } from "@/lib/constants";
import { cn, formatDate, pluralize } from "@/lib/utils";

/** Quantos cartões a prévia desenha; o resto é criado do mesmo jeito. */
const VISIVEIS = 60;

const EXEMPLO = `Corrigir login quebrado !alta @ana #bug 14/08 ~3h
  - Reproduzir o erro
  - Escrever teste de regressão
Refatorar cabeçalho !baixa sexta
Publicar release em 10 dias *5`;

/**
 * Criação de várias tarefas a partir de texto colado.
 *
 * Não há modelo de linguagem por trás: as regras são fixas, então o mesmo
 * texto sempre vira as mesmas tarefas. Em troca da flexibilidade, você vê
 * exatamente o que será criado antes de confirmar — nada é inventado, e um
 * texto colado errado vira uma correção em vez de vinte tarefas para apagar.
 */
export function BulkCreateDialog({
  open,
  onOpenChange,
  projects,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projects: { id: string; name: string; key: string }[];
  defaultProjectId?: string;
}) {
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const [text, setText] = useState("");
  // "auto" deixa o Beni decidir pelo formato do texto; a pessoa pode discordar
  const [mode, setMode] = useState<BulkMode | "auto">("auto");
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    let alive = true;
    // um respiro antes de interpretar: reagir a cada tecla seria barulho, e
    // toda mudança de estado acontece aqui dentro, fora do corpo do efeito
    const timer = setTimeout(() => {
      if (!alive) return;
      if (!open || !projectId || !text.trim()) {
        setPreview(null);
        setErro(null);
        return;
      }
      setLoading(true);
      previewBulkTasks(projectId, text, mode)
        .then((result) => {
          if (!alive) return;
          setPreview(result);
          setErro(null);
        })
        .catch((e: Error) => {
          if (!alive) return;
          setPreview(null);
          // Engolir esta falha deixava a tela dizendo "nada para criar" com o
          // texto colado à vista — parecia que o Beni não entendeu o conteúdo,
          // quando na verdade a leitura nem chegou a acontecer.
          setErro(
            /Server Action|deployment/i.test(e.message)
              ? "Esta aba é de uma versão anterior do Beni. Recarregue a página (⌘R) e cole de novo."
              : e.message || "Não consegui ler o texto.",
          );
        })
        .finally(() => alive && setLoading(false));
    }, 350);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, projectId, text, mode]);

  const total = preview?.tasks.length ?? 0;
  const subtotal = preview?.tasks.reduce((sum, t) => sum + t.subtasks.length, 0) ?? 0;

  function confirm() {
    startSaving(async () => {
      try {
        const { created, subtasks } = await createBulkTasks(projectId, text, mode);
        toast.success(
          pluralize(created, "tarefa criada", "tarefas criadas") +
            (subtasks ? ` e ${pluralize(subtasks, "subtarefa", "subtarefas")}` : ""),
        );
        setText("");
        setPreview(null);
        onOpenChange(false);
      } catch {
        toast.error("Não consegui criar as tarefas");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88dvh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="size-4" />
            Criar tarefas em massa
          </DialogTitle>
          <DialogDescription>
            Cole a lista — de uma ata, de um chat, de onde vier. Uma tarefa por
            linha; linhas indentadas viram subtarefas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto sm:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Projeto</Label>
              <Select
                value={projectId}
                onValueChange={(v) => v && setProjectId(v)}
                // sem este mapa o Base UI mostra o valor cru — no caso, o id
                items={Object.fromEntries(
                  projects.map((p) => [p.id, `${p.key} · ${p.name}`]),
                )}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha o projeto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.key} · {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="bulk-text">Texto</Label>
                <div className="flex gap-0.5 rounded-lg border p-0.5">
                  {(
                    [
                      { id: "auto", label: "Automático" },
                      { id: "linha", label: "Por linha" },
                      { id: "titulo", label: "Por título" },
                      { id: "bloco", label: "Por parágrafo" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setMode(option.id)}
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] transition",
                        mode === option.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                id="bulk-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={EXEMPLO}
                className="max-h-[34vh] min-h-40 resize-y overflow-y-auto font-mono text-xs"
              />
            </div>

            <details className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">
                O que o Beni reconhece
              </summary>
              <ul className="mt-2 space-y-1">
                <li>
                  <code>!alta</code> <code>!média</code> <code>!baixa</code>{" "}
                  <code>!urgente</code> — prioridade
                </li>
                <li>
                  <code>#bug</code> <code>#história</code> <code>#épico</code> —
                  tipo. Qualquer outro <code>#</code> vira etiqueta
                </li>
                <li>
                  <code>@nome</code> — responsável, casado com o time
                </li>
                <li>
                  <code>14/08</code> <code>hoje</code> <code>amanhã</code>{" "}
                  <code>sexta</code> <code>em 10 dias</code> — prazo
                </li>
                <li>
                  <code>~3h</code> estimativa · <code>*5</code> pontos
                </li>
                <li>
                  Marcadores (<code>-</code>, <code>1.</code>,{" "}
                  <code>[ ]</code>) são ignorados — cole a ata como está
                </li>
                <li className="pt-1">
                  <strong className="text-foreground">Formato:</strong> lista
                  curta vira uma tarefa por linha. Documento com cabeçalhos
                  numerados (<code>TAREFA 1:</code>, <code>Etapa 2 -</code>) abre
                  uma tarefa por cabeçalho e usa o texto abaixo como descrição.
                  Blocos separados por linha em branco viram uma tarefa cada.
                  O Beni escolhe sozinho e diz o que escolheu — se errar, troque
                  no seletor ao lado.
                </li>
              </ul>
            </details>
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="mb-1.5 flex items-center justify-between">
              <Label>
                Pré-visualização
                {preview && mode === "auto" && (
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    ·{" "}
                    {preview.mode === "titulo"
                      ? "li por títulos"
                      : preview.mode === "bloco"
                        ? "li por parágrafos"
                        : "li por linha"}
                  </span>
                )}
              </Label>
              {loading && (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              )}
            </div>

            <div className="thin-scrollbar max-h-[34vh] min-h-40 flex-1 space-y-1.5 overflow-y-auto rounded-lg border p-2">
              {erro ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-8 text-center">
                  <AlertTriangle className="size-5 text-destructive" />
                  <p className="text-sm text-destructive">{erro}</p>
                </div>
              ) : !preview || total === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
                  <Sparkles className="size-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    O que você colar aparece aqui, já separado —
                    <br />
                    antes de qualquer coisa ser criada.
                  </p>
                </div>
              ) : (
                preview.tasks.slice(0, VISIVEIS).map((task, i) => (
                  <div key={i} className="rounded-md border bg-card px-2.5 py-2">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-[10px] text-muted-foreground">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{task.title}</p>

                        <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                          {task.type && (
                            <span
                              className="rounded px-1.5 py-0.5"
                              style={{
                                backgroundColor: `${TASK_TYPE_META[task.type].color}22`,
                                color: TASK_TYPE_META[task.type].color,
                              }}
                            >
                              {TASK_TYPE_META[task.type].label}
                            </span>
                          )}
                          {task.priority && (
                            <span
                              className="rounded px-1.5 py-0.5"
                              style={{
                                backgroundColor: `${PRIORITY_META[task.priority].color}22`,
                                color: PRIORITY_META[task.priority].color,
                              }}
                            >
                              {PRIORITY_META[task.priority].label}
                            </span>
                          )}
                          {task.assigneeName && (
                            <span className="rounded bg-muted px-1.5 py-0.5">
                              {task.assigneeName}
                            </span>
                          )}
                          {task.assigneeHint && !task.assigneeName && (
                            <span className="rounded bg-warning/15 px-1.5 py-0.5 text-warning-foreground">
                              @{task.assigneeHint} não encontrado
                            </span>
                          )}
                          {task.dueDate && (
                            <span className="rounded bg-muted px-1.5 py-0.5">
                              {formatDate(task.dueDate)}
                            </span>
                          )}
                          {task.estimateHours !== null && (
                            <span className="rounded bg-muted px-1.5 py-0.5">
                              {task.estimateHours}h
                            </span>
                          )}
                          {task.points !== null && (
                            <span className="rounded bg-muted px-1.5 py-0.5">
                              {task.points} pts
                            </span>
                          )}
                          {task.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-muted px-1.5 py-0.5"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>

                        {task.description && (
                          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                            {task.description}
                          </p>
                        )}

                        {task.subtasks.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5 border-l pl-2.5 text-xs text-muted-foreground">
                            {task.subtasks.map((sub, j) => (
                              <li key={j}>{sub}</li>
                            ))}
                          </ul>
                        )}

                        {task.warnings.map((warning, j) => (
                          <p
                            key={j}
                            className="mt-1 flex items-center gap-1 text-[10px] text-warning-foreground"
                          >
                            <AlertTriangle className="size-3" />
                            {warning}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {preview && total > VISIVEIS && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Mostrando as {VISIVEIS} primeiras. Todas as {total} serão criadas.
              </p>
            )}

            {preview && preview.ignored > 0 && (
              <p className="mt-2 flex items-start gap-1.5 rounded-md bg-warning/10 px-2 py-1.5 text-[11px] text-warning-foreground">
                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                O texto tem mais linhas do que o limite de {MAX_BULK_TASKS} por
                importação. As {preview.ignored} últimas ficaram de fora — crie
                em duas levas se forem mesmo necessárias.
              </p>
            )}

            {preview && preview.unknownPeople.length > 0 && (
              <p className="mt-2 flex items-start gap-1.5 rounded-md bg-warning/10 px-2 py-1.5 text-[11px] text-warning-foreground">
                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                Sem responsável para {preview.unknownPeople.map((p) => `@${p}`).join(", ")}.
                As tarefas são criadas mesmo assim.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {total > 0
              ? `${pluralize(total, "tarefa", "tarefas")}` +
                (subtotal ? ` e ${pluralize(subtotal, "subtarefa", "subtarefas")}` : "") +
                (total === 1 && !subtotal ? " será criada" : " serão criadas")
              : "Nada para criar ainda"}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={total === 0 || saving || !projectId} onClick={confirm}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Criar {total > 0 ? total : ""}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

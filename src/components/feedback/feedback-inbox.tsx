"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Loader2,
  Mail,
  MessageSquareHeart,
  Send,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { RichText } from "@/components/rich-text";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  anotar,
  mudarStatus,
  responderAoAutor,
  virarTarefa,
  type FeedbackDTO,
} from "@/server/actions/feedback";
import {
  FEEDBACK_KINDS,
  FEEDBACK_STATUSES,
  kindLabel,
  statusColor,
  statusLabel,
  type FeedbackStatusValue,
} from "@/lib/feedback";
import { cn, formatDate } from "@/lib/utils";

type Projeto = { id: string; name: string; key: string };

/**
 * Caixa de entrada do feedback.
 *
 * A tela existe para uma coisa só: transformar recado em decisão sem sair
 * dela. Por isso as três ações que importam — mudar status, virar tarefa e
 * responder — moram no próprio cartão, e não atrás de um clique para "abrir".
 */
export function FeedbackInbox({
  itens,
  projetos,
}: {
  itens: FeedbackDTO[];
  projetos: Projeto[];
}) {
  const [filtroStatus, setFiltroStatus] = useState<string>("ABERTOS");
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");

  const visiveis = useMemo(() => {
    return itens.filter((i) => {
      const statusOk =
        filtroStatus === "TODOS"
          ? true
          : filtroStatus === "ABERTOS"
            ? i.status !== "FEITO" && i.status !== "RECUSADO"
            : i.status === filtroStatus;
      const tipoOk = filtroTipo === "TODOS" || i.kind === filtroTipo;
      return statusOk && tipoOk;
    });
  }, [itens, filtroStatus, filtroTipo]);

  const novos = itens.filter((i) => i.status === "NOVO").length;

  return (
    <>
      <PageHeader
        title="Feedback recebido"
        subtitle={
          itens.length === 0
            ? "Nada ainda"
            : `${itens.length} no total · ${novos} sem leitura`
        }
        icon={<MessageSquareHeart className="size-5 text-primary" />}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={filtroTipo}
              onValueChange={(v) => v && setFiltroTipo(v)}
              items={{
                TODOS: "Todos os tipos",
                ...Object.fromEntries(FEEDBACK_KINDS.map((k) => [k.value, k.label])),
              }}
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos os tipos</SelectItem>
                {FEEDBACK_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filtroStatus}
              onValueChange={(v) => v && setFiltroStatus(v)}
              items={{
                ABERTOS: "Em aberto",
                TODOS: "Tudo",
                ...Object.fromEntries(FEEDBACK_STATUSES.map((s) => [s.value, s.label])),
              }}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ABERTOS">Em aberto</SelectItem>
                <SelectItem value="TODOS">Tudo</SelectItem>
                {FEEDBACK_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 p-5">
          {visiveis.length === 0 ? (
            <EmptyState
              pose="beni"
              titulo={
                itens.length === 0 ? "Nenhum recado ainda" : "Nada com esses filtros"
              }
              descricao={
                itens.length === 0
                  ? "Quando alguém mandar feedback pelo app, ele cai aqui — com print, página e versão."
                  : undefined
              }
              className="rounded-xl border border-dashed"
            />
          ) : (
            visiveis.map((item) => (
              <Cartao key={item.id} item={item} projetos={projetos} />
            ))
          )}
        </div>
      </div>
    </>
  );
}

function Cartao({ item, projetos }: { item: FeedbackDTO; projetos: Projeto[] }) {
  const router = useRouter();
  const [salvando, startSalvar] = useTransition();
  const [resposta, setResposta] = useState("");
  const [respondendo, setRespondendo] = useState(false);
  const [nota, setNota] = useState(item.adminNote ?? "");
  const [projetoId, setProjetoId] = useState(projetos[0]?.id ?? "");

  const tipo = FEEDBACK_KINDS.find((k) => k.value === item.kind);

  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium"
          style={{
            color: statusColor(item.status),
            background: `${statusColor(item.status)}1a`,
          }}
        >
          <span aria-hidden>{tipo?.emoji}</span>
          {kindLabel(item.kind)} · {statusLabel(item.status)}
        </span>
        <span className="font-medium text-foreground">{item.autor.nome}</span>
        <span>{item.autor.email}</span>
        {item.workspaceNome && <span>· {item.workspaceNome}</span>}
        <span className="ml-auto">{formatDate(item.createdAt)}</span>
      </header>

      <p className="mt-3 text-sm whitespace-pre-wrap text-foreground">
        <RichText text={item.message} />
      </p>

      {item.imagens.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.imagens.map((img) => (
            <a key={img.id} href={img.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.name}
                className="max-h-40 rounded-md border object-cover transition hover:opacity-90"
              />
            </a>
          ))}
        </div>
      )}

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {item.pageUrl && (
          <div className="flex gap-1">
            <dt>Estava em</dt>
            <dd className="font-mono text-foreground/70">{item.pageUrl}</dd>
          </div>
        )}
        {item.appBuild && (
          <div className="flex gap-1">
            <dt>Build</dt>
            <dd className="font-mono text-foreground/70">{item.appBuild}</dd>
          </div>
        )}
        {item.userAgent && (
          <div className="flex max-w-full gap-1">
            <dt>Navegador</dt>
            <dd className="truncate font-mono text-foreground/70">{item.userAgent}</dd>
          </div>
        )}
        {item.respondedAt && (
          <div className="flex items-center gap-1 text-primary">
            <Mail className="size-3" />
            <dd>respondido em {formatDate(item.respondedAt)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <Select
          value={item.status}
          items={Object.fromEntries(FEEDBACK_STATUSES.map((s) => [s.value, s.label]))}
          onValueChange={(v) =>
            v &&
            startSalvar(async () => {
              await mudarStatus(item.id, v as FeedbackStatusValue);
              router.refresh();
            })
          }
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FEEDBACK_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {item.taskId ? (
          <a
            href={`/t/${item.taskId}`}
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition hover:bg-muted"
          >
            {item.taskRef ?? "Ver tarefa"}
            <ArrowUpRight className="size-3" />
          </a>
        ) : (
          <>
            <Select
              value={projetoId}
              onValueChange={(v) => v && setProjetoId(v)}
              items={Object.fromEntries(projetos.map((p) => [p.id, p.name]))}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="Projeto" />
              </SelectTrigger>
              <SelectContent>
                {projetos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={salvando || !projetoId}
              onClick={() =>
                startSalvar(async () => {
                  try {
                    await virarTarefa(item.id, projetoId);
                    toast.success("Virou tarefa.");
                    router.refresh();
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                })
              }
            >
              {salvando ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Virar tarefa
            </Button>
          </>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          onClick={() => setRespondendo((r) => !r)}
        >
          <Send className="size-3.5" />
          Responder
        </Button>
      </div>

      {respondendo && (
        <div className="mt-2 flex flex-col gap-2">
          <Textarea
            autoFocus
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            placeholder={`O que você quer contar para ${item.autor.nome.split(" ")[0]}?`}
            className="min-h-20 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setRespondendo(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={salvando}
              onClick={() =>
                startSalvar(async () => {
                  const r = await responderAoAutor(item.id, resposta);
                  if (!r.ok) {
                    toast.error(r.erro);
                    return;
                  }
                  toast.success(`E-mail enviado para ${item.autor.email}.`);
                  setResposta("");
                  setRespondendo(false);
                  router.refresh();
                })
              }
            >
              Enviar e-mail
            </Button>
          </div>
        </div>
      )}

      <Textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        onBlur={() => {
          if (nota === (item.adminNote ?? "")) return;
          startSalvar(async () => {
            await anotar(item.id, nota);
            router.refresh();
          });
        }}
        placeholder="Anotação sua (só você vê)"
        className={cn(
          "mt-2 min-h-0 resize-y border-dashed bg-transparent text-xs",
          nota ? "h-auto" : "h-8",
        )}
      />
    </article>
  );
}

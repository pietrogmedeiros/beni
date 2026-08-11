"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BASE_PATH } from "@/lib/base-path";
import {
  CheckCircle2,
  Clock,
  Copy,
  Link2,
  Loader2,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cancelApproval, requestApproval } from "@/server/actions/approvals";
import { RelativeTime } from "@/components/relative-time";
import { cn, formatDateTime } from "@/lib/utils";

export type ApprovalDTO = {
  id: string;
  token: string;
  status: string;
  message: string | null;
  approverName: string | null;
  approverEmail: string | null;
  approverComment: string | null;
  decidedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  requestedBy: { name: string } | null;
};

export function ApprovalPanel({
  taskId,
  approvals,
  onRefresh,
}: {
  taskId: string;
  approvals: ApprovalDTO[];
  onRefresh: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openRequest = approvals.find((a) => a.status === "PENDING");
  const history = approvals.filter((a) => a.status !== "PENDING");

  function copy(url: string) {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado — envie ao aprovador");
  }

  function create() {
    startTransition(async () => {
      try {
        const { url } = await requestApproval({ taskId, message });
        setLink(url);
        setMessage("");
        copy(url);
        await onRefresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao gerar o link");
      }
    });
  }

  return (
    <div className="space-y-4">
      {openRequest ? (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Clock className="size-4 text-primary-strong" />
            Aguardando aprovação
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Solicitada <RelativeTime date={openRequest.createdAt} />
            {openRequest.requestedBy && ` por ${openRequest.requestedBy.name}`}
            {openRequest.expiresAt &&
              ` · expira em ${formatDateTime(openRequest.expiresAt)}`}
          </p>

          {openRequest.message && (
            <p className="mt-2 rounded border-l-2 border-primary/40 bg-background/60 px-2 py-1 text-xs">
              {openRequest.message}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <Input
              readOnly
              value={link ?? `${origin()}/aprovar/${openRequest.token}`}
              className="h-8 font-mono text-[11px]"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0"
              onClick={() => copy(link ?? `${origin()}/aprovar/${openRequest.token}`)}
            >
              <Copy className="size-3.5" />
              Copiar
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Cancelar pedido"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await cancelApproval(openRequest.id);
                  setLink(null);
                  toast.success("Pedido cancelado");
                  await onRefresh();
                })
              }
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>

          <p className="mt-2 text-[11px] text-muted-foreground">
            Quem abrir o link não precisa de conta: informa o nome e registra a
            decisão.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 text-muted-foreground" />
            Pedir aprovação a um stakeholder
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Gera um link público. O aprovador se identifica pelo nome ao decidir.
          </p>

          <div className="mt-3 space-y-2">
            <Label htmlFor="approval-message" className="text-xs">
              Mensagem para o aprovador (opcional)
            </Label>
            <Textarea
              id="approval-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex.: Segue a proposta final para seu aceite antes de irmos a campo."
              className="min-h-16 text-sm"
            />
            <Button size="sm" disabled={pending} onClick={create}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Link2 className="size-4" />
              )}
              Gerar link de aprovação
            </Button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Histórico de decisões
          </p>
          <div className="space-y-2">
            {history.map((a) => {
              const approved = a.status === "APPROVED";
              return (
                <div
                  key={a.id}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    approved
                      ? "border-success/40 bg-success/8"
                      : "border-destructive/40 bg-destructive/8",
                  )}
                >
                  <p className="flex items-center gap-2 font-medium">
                    {approved ? (
                      <CheckCircle2 className="size-4 text-success" />
                    ) : (
                      <XCircle className="size-4 text-destructive" />
                    )}
                    {approved ? "Aprovado" : "Reprovado"} por{" "}
                    {a.approverName ?? "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {a.decidedAt && formatDateTime(a.decidedAt)}
                    {a.approverEmail && ` · ${a.approverEmail}`}
                  </p>
                  {a.approverComment && (
                    <p className="mt-1.5 whitespace-pre-wrap border-t pt-1.5 text-[13px]">
                      “{a.approverComment}”
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function origin() {
  return typeof window === "undefined" ? "" : `${window.location.origin}${BASE_PATH}`;
}

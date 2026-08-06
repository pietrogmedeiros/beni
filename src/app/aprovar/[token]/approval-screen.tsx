"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { BeniLogo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  decideApproval,
  type DecisionState,
  type PublicApproval,
} from "@/server/actions/approvals";
import { PRIORITY_META, type PriorityValue } from "@/lib/constants";
import { RelativeTime } from "@/components/relative-time";
import { cn, formatFullDate } from "@/lib/utils";

export function ApprovalScreen({
  token,
  approval,
}: {
  token: string;
  approval: PublicApproval;
}) {
  const [state, formAction] = useActionState<DecisionState, FormData>(
    decideApproval,
    undefined,
  );
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");

  const decided = approval.status !== "PENDING" || state?.ok;
  const priority =
    PRIORITY_META[
      (approval.task.priority in PRIORITY_META
        ? approval.task.priority
        : "NONE") as PriorityValue
    ];

  return (
    <div className="min-h-svh bg-muted/40 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <BeniLogo className="mb-6 justify-center" />

        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          {/* faixa de status */}
          <div
            className={cn(
              "px-6 py-4",
              approval.status === "APPROVED" || state?.ok
                ? "bg-success/10"
                : approval.status === "REJECTED"
                  ? "bg-destructive/10"
                  : "bg-primary/8",
            )}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {approval.task.project.name} · {approval.task.project.key}-
              {approval.task.number}
            </p>
            <h1 className="mt-1 text-xl font-semibold leading-snug">
              {approval.task.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: approval.task.statusColor }}
                />
                {approval.task.statusName}
              </span>
              <span className={priority.className}>
                Prioridade: {priority.label}
              </span>
              {approval.task.dueDate && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-3.5" />
                  Prazo: {formatFullDate(approval.task.dueDate)}
                </span>
              )}
              {approval.task.assignee && (
                <span>Responsável: {approval.task.assignee.name}</span>
              )}
            </div>
          </div>

          <div className="space-y-5 p-6">
            {approval.requestedBy && (
              <p className="text-sm text-muted-foreground">
                <strong className="font-medium text-foreground">
                  {approval.requestedBy.name}
                </strong>{" "}
                pediu sua aprovação <RelativeTime date={approval.createdAt} />.
              </p>
            )}

            {approval.message && (
              <blockquote className="rounded-lg border-l-2 border-primary/50 bg-muted/60 px-4 py-3 text-sm">
                {approval.message}
              </blockquote>
            )}

            {approval.task.description && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Detalhes da entrega
                </p>
                <p className="whitespace-pre-wrap text-sm text-foreground/90">
                  {approval.task.description}
                </p>
              </div>
            )}

            <Separator />

            {/* já respondido */}
            {decided ? (
              <Decided approval={approval} justApproved={state?.ok ? decision : null} />
            ) : approval.expired ? (
              <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
                <Clock className="size-4 shrink-0 text-warning" />
                Este link de aprovação expirou. Peça um novo a quem solicitou.
              </div>
            ) : (
              <form action={formAction} className="space-y-4">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="decision" value={decision} />

                <div>
                  <p className="mb-2 text-sm font-medium">
                    Para registrar sua decisão, identifique-se:
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="approverName">Seu nome completo *</Label>
                      <Input
                        id="approverName"
                        name="approverName"
                        required
                        minLength={2}
                        placeholder="Ex.: Ana Ribeiro"
                        autoComplete="name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="approverEmail">E-mail (opcional)</Label>
                      <Input
                        id="approverEmail"
                        name="approverEmail"
                        type="email"
                        placeholder="voce@empresa.com"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="approverComment">Comentário (opcional)</Label>
                  <Textarea
                    id="approverComment"
                    name="approverComment"
                    placeholder="Alguma ressalva ou orientação para o time?"
                    className="min-h-20"
                  />
                </div>

                {state?.error && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="size-4 shrink-0" />
                    {state.error}
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <SubmitButton
                    variant="approve"
                    onSelect={() => setDecision("APPROVED")}
                  />
                  <SubmitButton
                    variant="reject"
                    onSelect={() => setDecision("REJECTED")}
                  />
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  Sua decisão fica registrada com nome e data e hora, e é visível
                  para o time do projeto.
                </p>
              </form>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Enviado por Beni · gestão de projetos e tarefas
        </p>
      </div>
    </div>
  );
}

function SubmitButton({
  variant,
  onSelect,
}: {
  variant: "approve" | "reject";
  onSelect: () => void;
}) {
  const { pending } = useFormStatus();
  const approve = variant === "approve";

  return (
    <Button
      type="submit"
      disabled={pending}
      onClick={onSelect}
      className={cn(
        "flex-1",
        approve
          ? "bg-success text-success-foreground hover:bg-success/90"
          : "border border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10",
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : approve ? (
        <ThumbsUp className="size-4" />
      ) : (
        <ThumbsDown className="size-4" />
      )}
      {approve ? "Aprovar" : "Reprovar"}
    </Button>
  );
}

function Decided({
  approval,
  justApproved,
}: {
  approval: PublicApproval;
  justApproved: "APPROVED" | "REJECTED" | null;
}) {
  const status = justApproved ?? approval.status;
  const approved = status === "APPROVED";

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-4 text-sm",
        approved
          ? "border-success/40 bg-success/10"
          : "border-destructive/40 bg-destructive/10",
      )}
    >
      <p className="flex items-center gap-2 font-medium">
        {approved ? (
          <CheckCircle2 className="size-5 text-success" />
        ) : (
          <XCircle className="size-5 text-destructive" />
        )}
        {approved ? "Entrega aprovada" : "Entrega reprovada"}
      </p>

      <p className="mt-2 text-muted-foreground">
        {approval.approverName ? (
          <>
            Registrado por{" "}
            <strong className="font-medium text-foreground">
              {approval.approverName}
            </strong>
            {approval.decidedAt && <> em {formatFullDate(approval.decidedAt)}</>}.
          </>
        ) : (
          "Decisão registrada. Obrigado!"
        )}
      </p>

      {approval.approverComment && (
        <p className="mt-2 whitespace-pre-wrap border-t pt-2 text-foreground/90">
          “{approval.approverComment}”
        </p>
      )}
    </div>
  );
}

"use client";

import { useFormStatus } from "react-dom";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { autorizar, recusar } from "./actions";
import { BeniMark } from "@/components/logo";
import { Button } from "@/components/ui/button";

function Submit({
  children,
  variant,
  formAction,
}: {
  children: React.ReactNode;
  variant?: "outline";
  formAction: (formData: FormData) => void;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} formAction={formAction} disabled={pending} className="flex-1">
      {pending ? <Loader2 className="size-4 animate-spin" /> : children}
    </Button>
  );
}

/**
 * Tela de consentimento.
 *
 * O texto é específico de propósito: dizer "acesso ao workspace" esconde o que
 * importa. Quem lê precisa saber que o cliente vai poder **criar e apagar**
 * tarefas, não só olhar.
 */
export function AuthorizeScreen({
  clientName,
  clientId,
  redirectUri,
  state,
  codeChallenge,
  scope,
  userName,
  workspaceName,
}: {
  clientName: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope: string;
  userName: string;
  workspaceName: string;
}) {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form className="w-full max-w-md rounded-xl border bg-card p-6">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="state" value={state} />
        <input type="hidden" name="code_challenge" value={codeChallenge} />
        <input type="hidden" name="scope" value={scope} />

        <div className="flex items-center gap-3">
          <BeniMark className="size-10" />
          <div>
            <h1 className="text-lg font-semibold">Autorizar {clientName}</h1>
            <p className="text-xs text-muted-foreground">
              no workspace {workspaceName}, como {userName}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary-strong" />
            <span>
              Vai poder <strong>ler</strong> seus projetos, tarefas, comentários e anexos —
              e também <strong>criar, alterar e apagar</strong> tarefas em seu nome.
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Você pode revogar a qualquer momento em Configurações → Chaves de acesso.
            O acesso cai na hora, sem trocar sua senha.
          </p>
        </div>

        <div className="mt-5 flex gap-2">
          <Submit variant="outline" formAction={recusar}>
            <X className="size-4" />
            Recusar
          </Submit>
          <Submit formAction={autorizar}>
            <Check className="size-4" />
            Autorizar
          </Submit>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, MailWarning, X } from "lucide-react";
import { reenviarConfirmacao } from "@/server/actions/account";

const ADIADO = "beni:confirmacao-adiada";

/**
 * Aviso de e-mail não confirmado.
 *
 * Não bloqueia nada: a conta funciona igual. Ele existe porque endereço
 * errado só aparece quando já é tarde — quando a pessoa precisa recuperar a
 * senha e o link vai para um lugar que não existe.
 *
 * Dá para adiar pela sessão do navegador (`sessionStorage`, não `localStorage`):
 * some agora e volta na próxima visita, até ser resolvido de verdade.
 */
export function ConfirmarEmailAviso({ email }: { email: string }) {
  const [oculto, setOculto] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(ADIADO) === "1",
  );
  const [enviando, startEnvio] = useTransition();

  if (oculto) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-xs">
      <MailWarning className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="text-foreground">
        Confirme <strong>{email}</strong> para garantir que você consiga recuperar
        a senha e receber os avisos.
      </span>
      <button
        type="button"
        disabled={enviando}
        onClick={() =>
          startEnvio(async () => {
            const r = await reenviarConfirmacao();
            if (r.ok) toast.success(`Link enviado para ${email}.`);
            else toast.error(r.erro);
          })
        }
        className="inline-flex items-center gap-1 font-medium text-amber-700 underline-offset-2 hover:underline disabled:opacity-60 dark:text-amber-300"
      >
        {enviando && <Loader2 className="size-3 animate-spin" />}
        Reenviar o link
      </button>
      <button
        type="button"
        aria-label="Adiar"
        onClick={() => {
          sessionStorage.setItem(ADIADO, "1");
          setOculto(true);
        }}
        className="ml-auto rounded p-0.5 text-muted-foreground transition hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

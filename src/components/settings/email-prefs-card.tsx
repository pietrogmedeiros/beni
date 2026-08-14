"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Send } from "lucide-react";
import {
  getEmailPrefs,
  sendTestEmail,
  setEmailPref,
  type EmailPrefs,
} from "@/server/actions/email-prefs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const OPCOES = [
  {
    campo: "emailOnAssign" as const,
    titulo: "Quando me atribuírem uma tarefa",
    detalhe: "Chega na hora, com projeto, prioridade e prazo.",
  },
  {
    campo: "emailOnApproval" as const,
    titulo: "Quando responderem uma aprovação que pedi",
    detalhe: "Com a decisão e o comentário de quem aprovou.",
  },
  {
    campo: "emailDailyDigest" as const,
    titulo: "Resumo diário do que vence",
    detalhe: "Um e-mail por dia com o que está atrasado e o que vence hoje.",
  },
];

/** Preferências de e-mail — cada pessoa escolhe o que quer receber. */
export function EmailPrefsCard() {
  const [prefs, setPrefs] = useState<EmailPrefs | null>(null);
  const [testando, setTestando] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let vivo = true;
    getEmailPrefs().then((p) => vivo && setPrefs(p));
    return () => {
      vivo = false;
    };
  }, []);

  function alternar(campo: (typeof OPCOES)[number]["campo"], valor: boolean) {
    setPrefs((atual) => (atual ? { ...atual, [campo]: valor } : atual));
    startTransition(async () => {
      await setEmailPref(campo, valor);
      toast.success(valor ? "Aviso ligado" : "Aviso desligado");
    });
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Mail className="size-4" />
        Avisos por e-mail
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        O que você quer receber na caixa de entrada.
      </p>

      {prefs === null ? (
        <Loader2 className="mx-auto my-3 size-4 animate-spin text-muted-foreground" />
      ) : (
        <>
          {!prefs.ativo && (
            <p className="mb-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
              O envio de e-mails ainda não está configurado no servidor. Estas
              escolhas ficam salvas e passam a valer quando estiver.
            </p>
          )}

          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm">Enviar um e-mail de teste</p>
              <p className="text-xs text-muted-foreground">
                Confirma que o servidor consegue mesmo falar com a sua caixa.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={testando}
              onClick={async () => {
                setTestando(true);
                const r = await sendTestEmail();
                setTestando(false);
                if (r.ok) toast.success("Enviado — confira sua caixa de entrada");
                else toast.error(r.erro);
              }}
            >
              {testando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Testar
            </Button>
          </div>

          <div className="divide-y rounded-lg border">
            {OPCOES.map((o) => (
              <div key={o.campo} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <Label htmlFor={o.campo} className="cursor-pointer text-sm font-normal">
                    {o.titulo}
                  </Label>
                  <p className="text-xs text-muted-foreground">{o.detalhe}</p>
                </div>
                <Switch
                  id={o.campo}
                  checked={prefs[o.campo]}
                  onCheckedChange={(v) => alternar(o.campo, v)}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

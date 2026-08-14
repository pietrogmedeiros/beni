"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { appUrl, emailEnabled, enviar } from "@/server/email";

export type EmailPrefs = {
  emailOnAssign: boolean;
  emailOnApproval: boolean;
  emailDailyDigest: boolean;
  /** Se o servidor tem envio configurado — sem isso os controles não fazem nada. */
  ativo: boolean;
};

export async function getEmailPrefs(): Promise<EmailPrefs> {
  const user = await requireUser();
  const dados = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { emailOnAssign: true, emailOnApproval: true, emailDailyDigest: true },
  });
  return { ...dados, ativo: emailEnabled() };
}

export async function setEmailPref(campo: keyof Omit<EmailPrefs, "ativo">, valor: boolean) {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { [campo]: valor } });
  revalidatePath("/settings");
}

/**
 * Manda um e-mail de teste para quem pediu.
 *
 * Existe porque a única forma de saber se o envio está de pé era esperar um
 * evento real acontecer — ou disparar rotina por linha de comando com um
 * segredo na mão. Um botão resolve, e quem configurou o servidor consegue
 * conferir sozinho.
 *
 * Não passa pela trava de envio único: o objetivo aqui é justamente poder
 * repetir.
 */
export async function sendTestEmail() {
  const user = await requireUser();

  if (!emailEnabled()) {
    return { ok: false as const, erro: "O servidor não tem RESEND_API_KEY configurada." };
  }

  const enviado = await enviar({
    para: user.email,
    assunto: "Teste de envio do Beni",
    titulo: "Deu certo",
    corpo: [
      `Se você está lendo isto, o Beni consegue enviar e-mail para <strong>${user.email}</strong>.`,
      "Os avisos de tarefa atribuída, aprovação respondida e o resumo diário vão chegar por aqui.",
    ],
    botao: { texto: "Abrir o Beni", url: appUrl() },
    rodape: "Enviado por você, no botão de teste em Configurações.",
  });

  return enviado
    ? { ok: true as const }
    : {
        ok: false as const,
        erro: "O Resend recusou o envio. Confira a chave e o domínio verificado.",
      };
}

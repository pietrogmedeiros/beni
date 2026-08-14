import { NextResponse } from "next/server";
import { enviarResumoDiario } from "@/server/notify";
import { emailEnabled } from "@/server/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Dispara o resumo diário.
 *
 * Existe além do agendamento interno para que se possa forçar de fora — de um
 * cron externo, ou da mão, quando se quer conferir sem esperar o horário.
 *
 * Protegida por `CRON_SECRET`: sem segredo configurado, a rota fica fechada.
 * Uma rota que dispara e-mail para o time inteiro não pode ficar aberta na
 * internet só porque ninguém lembrou de configurar.
 */
export async function POST(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  }

  const enviado =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    new URL(request.url).searchParams.get("secret");

  if (enviado !== segredo) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!emailEnabled()) {
    return NextResponse.json({ error: "RESEND_API_KEY não configurado" }, { status: 503 });
  }

  const resultado = await enviarResumoDiario();
  return NextResponse.json(resultado);
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { withBase } from "@/lib/base-path";

/**
 * Entrada por envio nativo de formulário.
 *
 * A entrada era uma Server Action, e o React intercepta o envio para mandar
 * por fetch. O gerenciador de senhas do navegador — e o do sistema — depende
 * de ver um formulário com campo de senha ser **enviado de verdade** e a
 * página navegar em seguida; sem isso ele nunca oferece salvar, e quem usa o
 * Beni digita a senha toda vez.
 *
 * Um Route Handler resolve porque é o fluxo que a web sempre teve: POST,
 * cookie, 303. De brinde, a entrada passa a funcionar com JavaScript
 * desligado.
 */
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Volta para a entrada preservando o destino e dizendo o que houve. */
function recusar(next: string, email: string) {
  const params = new URLSearchParams({ erro: "1" });
  if (next && next !== "/") params.set("next", next);
  // o e-mail volta preenchido: errar a senha não deveria custar digitar tudo
  if (email) params.set("email", email);
  return new NextResponse(null, {
    status: 303,
    headers: { Location: withBase(`/login?${params}`) },
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const next = String(form.get("next") ?? "/");

  const parsed = schema.safeParse({
    email,
    password: String(form.get("password") ?? ""),
  });
  if (!parsed.success) return recusar(next, email);

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return recusar(next, email);
  }

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    epoch: user.sessionEpoch,
  });

  // 303 força GET no destino, que é o que faz o navegador tratar isto como
  // "login concluído" e oferecer guardar a senha
  return new NextResponse(null, {
    status: 303,
    headers: { Location: withBase(next.startsWith("/") ? next : "/") },
  });
}

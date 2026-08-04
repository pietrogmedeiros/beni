import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

/**
 * Limpa a sessão e devolve o usuário ao login.
 *
 * Existe para quebrar um laço de redirecionamento: o `proxy` só valida a
 * assinatura do JWT, então um token válido de um usuário que não existe mais
 * (banco recriado, conta removida) faria `/` mandar para `/login` e `/login`
 * mandar de volta para `/`. Route Handlers podem apagar cookies — layouts não.
 *
 * O `Location` é relativo de propósito: atrás de proxy o host interno
 * (0.0.0.0) não é o host que o navegador conhece.
 */
export async function GET() {
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: "/login" },
  });
  response.cookies.delete(COOKIE_NAME);
  return response;
}

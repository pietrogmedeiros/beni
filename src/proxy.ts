import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "beni_session";

/** Rotas de entrada: quem já está logado é levado para o app. */
const AUTH_PATHS = ["/login", "/register"];

/** Rotas abertas: acessíveis sem conta (link de aprovação do stakeholder). */
const OPEN_PATHS = [
  "/aprovar",
  "/compartilhar",
  "/nota",
  // descoberta e troca de token do OAuth: o cliente que chama aqui não tem
  // sessão nenhuma — é justamente o que ele vem buscar
  "/.well-known",
  "/api/oauth/register",
  "/api/oauth/token",
];

async function isValid(token: string | undefined) {
  if (!token || !process.env.AUTH_SECRET) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (OPEN_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const authed = await isValid(request.cookies.get(COOKIE_NAME)?.value);
  const isAuthPath = AUTH_PATHS.some((p) => pathname.startsWith(p));

  if (!authed && !isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (authed && isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

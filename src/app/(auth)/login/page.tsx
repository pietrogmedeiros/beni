import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";
  // o erro chega pela URL porque a entrada é envio nativo de formulário —
  // ver o comentário em login-form.tsx
  const erro = params.erro === "1";
  const email = typeof params.email === "string" ? params.email : undefined;
  // A conta de demonstração só existe quando o seed roda. Em produção
  // (`SEED_ON_START=false`) mostrar essas credenciais seria oferecer ao
  // cliente um login que não funciona — e expor uma senha padrão de brinde.
  const demo = process.env.SEED_ON_START === "true";

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Entre para continuar de onde parou.
      </p>

      <LoginForm next={next} demo={demo} erro={erro} email={email} />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link
          href="/register"
          className="font-medium text-primary-strong hover:underline"
        >
          Criar conta
        </Link>
      </p>
    </div>
  );
}

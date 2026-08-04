import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Entre para continuar de onde parou.
      </p>

      <LoginForm next={next} />

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

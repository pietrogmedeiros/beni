import Link from "next/link";
import { EsqueciForm } from "./esqueci-form";

export const metadata = { title: "Recuperar senha" };

export default function EsqueciPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Esqueceu a senha?</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Diga o e-mail da sua conta e mandamos um link para você escolher outra.
      </p>

      <EsqueciForm />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Lembrou?{" "}
        <Link
          href="/login"
          className="font-medium text-primary-strong hover:underline"
        >
          Voltar para entrar
        </Link>
      </p>
    </div>
  );
}

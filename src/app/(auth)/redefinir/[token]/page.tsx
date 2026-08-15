import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { conferirToken } from "@/server/auth-tokens";
import { RedefinirForm } from "./redefinir-form";

export const metadata = { title: "Nova senha" };

export default async function RedefinirPage({
  params,
}: PageProps<"/redefinir/[token]">) {
  const { token } = await params;
  // confere sem gastar: o token só é consumido quando a senha for enviada,
  // senão abrir o link duas vezes queimaria o pedido antes de servir
  const valido = await conferirToken(decodeURIComponent(token), "RESET_SENHA");

  if (!valido) {
    return (
      <div>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-5" />
          <h1 className="text-xl font-semibold tracking-tight">
            Este link não vale mais
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Links de recuperação valem por uma hora e só funcionam uma vez. Peça
          outro — leva alguns segundos.
        </p>
        <Link
          href="/esqueci"
          className="mt-6 inline-block text-sm font-medium text-primary-strong hover:underline"
        >
          Pedir um link novo
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Escolha a nova senha</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Para a conta <strong className="text-foreground">{valido.user.email}</strong>.
      </p>
      <RedefinirForm token={decodeURIComponent(token)} />
    </div>
  );
}

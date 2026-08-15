import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { confirmarEmail } from "@/server/actions/account";
import { conferirToken } from "@/server/auth-tokens";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Confirmar e-mail" };

/**
 * O clique no link de confirmação.
 *
 * A confirmação em si acontece num botão, não ao abrir a página: cliente de
 * e-mail e antivírus corporativo visitam links sozinhos para checar segurança,
 * e um token de uso único morreria antes de a pessoa chegar nele.
 */
export default async function ConfirmarPage({
  params,
}: PageProps<"/confirmar/[token]">) {
  const { token } = await params;
  const bruto = decodeURIComponent(token);
  const valido = await conferirToken(bruto, "CONFIRMAR_EMAIL");

  if (!valido) {
    return (
      <div>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-5" />
          <h1 className="text-xl font-semibold tracking-tight">
            Link inválido ou já usado
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Se você já confirmou, está tudo certo — é só entrar. Se não, entre na
          sua conta e peça um link novo pelo aviso no topo.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-primary-strong hover:underline"
        >
          Ir para a entrada
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Confirmar {valido.user.email}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Um clique e a gente sabe que esta caixa de entrada é sua.
      </p>

      <form
        action={async () => {
          "use server";
          await confirmarEmail(bruto);
        }}
        className="mt-8"
      >
        <Button type="submit" className="w-full">
          Confirmar e entrar
        </Button>
      </form>
    </div>
  );
}

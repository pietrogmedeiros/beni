import { notFound } from "next/navigation";
import { BeniLogo, BeniMascote } from "@/components/logo";
import { conviteAberto } from "@/server/actions/convidados";
import { getSession } from "@/lib/auth";
import { AceiteDoConvite } from "./aceite";

export const metadata = { title: "Convite" };
export const dynamic = "force-dynamic";

/**
 * Aceite de um convite de projeto.
 *
 * Rota aberta: quem chega aqui, por definição, ainda não tem conta neste
 * workspace. Precisa estar em `OPEN_PATHS` no `proxy.ts`, senão o convidado é
 * mandado para o login e o convite morre no caminho.
 */
export default async function ConvitePage({
  params,
}: PageProps<"/convite/[token]">) {
  const { token } = await params;
  const convite = await conviteAberto(token);
  if (!convite) notFound();

  // quem já está logado não precisa criar conta de novo
  const sessao = await getSession();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-12">
      <BeniLogo className="mb-8" />

      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        <BeniMascote pose="beni" pequeno className="mx-auto mb-4 w-16" />

        <p className="text-center text-sm text-muted-foreground">
          Você foi convidado para o projeto
        </p>
        <h1 className="mt-1 text-center text-xl font-semibold tracking-tight">
          {convite.projeto}
        </h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          em {convite.workspace}
        </p>

        <AceiteDoConvite
          token={token}
          email={convite.email}
          logadoComo={sessao?.email ?? null}
        />

        <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
          Você entra apenas neste projeto. O resto do espaço de quem convidou
          continua fora do seu alcance.
        </p>
      </div>
    </div>
  );
}

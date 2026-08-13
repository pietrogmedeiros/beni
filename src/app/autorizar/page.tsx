import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentWorkspace, requireUser } from "@/lib/auth";
import { AuthorizeScreen } from "./authorize-screen";

export const metadata = { title: "Autorizar acesso", robots: { index: false } };

/**
 * Fora do grupo (app) de propósito: uma tela de consentimento não deve vir
 * embrulhada na barra lateral e no chat do produto. Ela é um momento de
 * decisão, não uma tela de trabalho.
 */
export default async function AutorizarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const clientId = typeof params.client_id === "string" ? params.client_id : "";
  const redirectUri = typeof params.redirect_uri === "string" ? params.redirect_uri : "";

  const [client, user, workspace] = await Promise.all([
    db.oAuthClient.findUnique({ where: { clientId } }),
    requireUser(),
    currentWorkspace(),
  ]);

  if (!client || !client.redirectUris.includes(redirectUri)) notFound();

  return (
    <AuthorizeScreen
      clientName={client.name}
      clientId={clientId}
      redirectUri={redirectUri}
      state={typeof params.state === "string" ? params.state : ""}
      codeChallenge={typeof params.code_challenge === "string" ? params.code_challenge : ""}
      scope={typeof params.scope === "string" ? params.scope : "beni"}
      userName={user.name}
      workspaceName={workspace.name}
    />
  );
}

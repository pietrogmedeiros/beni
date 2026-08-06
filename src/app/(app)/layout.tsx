import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/server/queries";
import { AppShell } from "@/components/app-shell/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const isDesktop = (await headers())
    .get("user-agent")
    ?.includes("BeniDesktop");

  let ctx;
  try {
    ctx = await getWorkspaceContext();
  } catch {
    // A sessão é criptograficamente válida, mas o usuário não existe mais
    // (ou não tem workspace). Limpa o cookie antes de voltar ao login —
    // se apenas redirecionássemos, o `proxy` mandaria de volta para cá.
    redirect("/api/session/clear");
  }

  return (
    <AppShell
      user={ctx.user}
      workspace={ctx.workspace}
      projects={ctx.projects}
      members={ctx.members}
      tags={ctx.tags}
      desktop={isDesktop}
    >
      {children}
    </AppShell>
  );
}

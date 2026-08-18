import { notFound } from "next/navigation";
import { getProject } from "@/server/queries";
import { podeVerCobrancas } from "@/server/cobrancas";
import { ProjectHeader } from "@/components/project/project-header";

export default async function ProjectLayout({
  children,
  params,
}: LayoutProps<"/p/[projectId]">) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  // decidido no servidor: a aba nem chega ao HTML de quem não administra
  const mostrarCobrancas = await podeVerCobrancas();

  return (
    <>
      <ProjectHeader project={project} mostrarCobrancas={mostrarCobrancas} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </>
  );
}

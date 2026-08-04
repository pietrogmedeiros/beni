import { notFound } from "next/navigation";
import { getProject } from "@/server/queries";
import { ProjectHeader } from "@/components/project/project-header";

export default async function ProjectLayout({
  children,
  params,
}: LayoutProps<"/p/[projectId]">) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  return (
    <>
      <ProjectHeader project={project} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </>
  );
}

import { notFound } from "next/navigation";
import { getProject, getWorkspaceContext } from "@/server/queries";
import { ProjectSettings } from "@/components/project/project-settings";

export default async function ProjectSettingsPage({
  params,
}: PageProps<"/p/[projectId]/settings">) {
  const { projectId } = await params;
  const [project, ctx] = await Promise.all([
    getProject(projectId),
    getWorkspaceContext(),
  ]);
  if (!project) notFound();

  return <ProjectSettings project={project} tags={ctx.tags} />;
}

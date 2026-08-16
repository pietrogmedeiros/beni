import { notFound } from "next/navigation";
import { getProject, getProjectTasks } from "@/server/queries";
import { RegistrarVisao } from "@/components/registrar-visao";
import { ProjectDashboard } from "@/components/views/project-dashboard";

export default async function ProjectDashboardPage({
  params,
}: PageProps<"/p/[projectId]/dashboard">) {
  const { projectId } = await params;
  const [project, tasks] = await Promise.all([
    getProject(projectId),
    getProjectTasks(projectId),
  ]);
  if (!project) notFound();

  return (
    <>
      <RegistrarVisao evento="visao.painel" />
      <ProjectDashboard
        statuses={project.statuses}
        sprints={project.sprints}
        tasks={tasks}
      />
    </>
  );
}

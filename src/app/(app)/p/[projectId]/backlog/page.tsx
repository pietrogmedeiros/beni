import { notFound } from "next/navigation";
import { getProject, getProjectTasks } from "@/server/queries";
import { RegistrarVisao } from "@/components/registrar-visao";
import { BacklogView } from "@/components/views/backlog-view";

export default async function BacklogPage({
  params,
}: PageProps<"/p/[projectId]/backlog">) {
  const { projectId } = await params;
  const [project, tasks] = await Promise.all([
    getProject(projectId),
    getProjectTasks(projectId),
  ]);
  if (!project) notFound();

  return (
    <>
      <RegistrarVisao evento="visao.backlog" />
      <BacklogView
        projectId={project.id}
        statuses={project.statuses}
        sprints={project.sprints}
        tasks={tasks}
      />
    </>
  );
}

import { notFound } from "next/navigation";
import { getProject, getProjectTasks } from "@/server/queries";
import { RegistrarVisao } from "@/components/registrar-visao";
import { ListView } from "@/components/views/list-view";

export default async function ListPage({
  params,
}: PageProps<"/p/[projectId]/list">) {
  const { projectId } = await params;
  const [project, tasks] = await Promise.all([
    getProject(projectId),
    getProjectTasks(projectId),
  ]);
  if (!project) notFound();

  return (
    <>
      <RegistrarVisao evento="visao.lista" />
      <ListView
        projectId={project.id}
        statuses={project.statuses}
        sprints={project.sprints}
        tasks={tasks}
      />
    </>
  );
}

import { notFound } from "next/navigation";
import { getProject, getProjectTasks } from "@/server/queries";
import { RegistrarVisao } from "@/components/registrar-visao";
import { BoardView } from "@/components/views/board-view";

export default async function BoardPage({
  params,
}: PageProps<"/p/[projectId]/board">) {
  const { projectId } = await params;
  const [project, tasks] = await Promise.all([
    getProject(projectId),
    getProjectTasks(projectId),
  ]);
  if (!project) notFound();

  return (
    <>
      <RegistrarVisao evento="visao.quadro" />
      <BoardView
        projectId={project.id}
        statuses={project.statuses}
        tasks={tasks}
      />
    </>
  );
}

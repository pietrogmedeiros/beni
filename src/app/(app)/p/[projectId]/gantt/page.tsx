import { notFound } from "next/navigation";
import {
  getProject,
  getProjectDependencies,
  getProjectTasks,
} from "@/server/queries";
import { RegistrarVisao } from "@/components/registrar-visao";
import { GanttView } from "@/components/views/gantt-view";
import { ShareGanttButton } from "@/components/project/share-gantt-button";

export default async function GanttPage({
  params,
}: PageProps<"/p/[projectId]/gantt">) {
  const { projectId } = await params;
  const [project, tasks, dependencies] = await Promise.all([
    getProject(projectId),
    getProjectTasks(projectId),
    getProjectDependencies(projectId),
  ]);
  if (!project) notFound();

  return (
    <>
      <RegistrarVisao evento="visao.gantt" />
      <GanttView
        tasks={tasks}
        dependencies={dependencies}
        toolbarExtra={<ShareGanttButton projectId={project.id} />}
      />
    </>
  );
}

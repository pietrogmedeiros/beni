import { notFound } from "next/navigation";
import { getProject, getProjectTasks } from "@/server/queries";
import { CalendarView } from "@/components/views/calendar-view";
import { RegistrarVisao } from "@/components/registrar-visao";

export default async function CalendarPage({
  params,
}: PageProps<"/p/[projectId]/calendar">) {
  const { projectId } = await params;
  const [project, tasks] = await Promise.all([
    getProject(projectId),
    getProjectTasks(projectId),
  ]);
  if (!project) notFound();

  return (
    <>
      <RegistrarVisao evento="visao.calendario" />
      <CalendarView projectId={project.id} tasks={tasks} />
    </>
  );
}

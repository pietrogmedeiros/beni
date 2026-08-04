import { notFound, redirect } from "next/navigation";
import { getTaskDetail } from "@/server/queries";

/** Link permanente para uma tarefa: abre o projeto e o painel de detalhe. */
export default async function TaskPermalinkPage({
  params,
}: PageProps<"/t/[taskId]">) {
  const { taskId } = await params;
  const task = await getTaskDetail(taskId);
  if (!task) notFound();
  redirect(`/p/${task.projectId}/list?task=${task.id}`);
}

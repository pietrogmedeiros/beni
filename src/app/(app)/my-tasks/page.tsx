import { getMyTasks } from "@/server/queries";
import { MyTasksView } from "@/components/views/my-tasks-view";

export const metadata = { title: "Minhas tarefas" };

export default async function MyTasksPage() {
  const tasks = await getMyTasks();
  return <MyTasksView tasks={tasks} />;
}

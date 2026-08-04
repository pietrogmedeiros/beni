import { getWorkspaceContext, getWorkspaceOverview } from "@/server/queries";
import { HomeView } from "@/components/views/home-view";

export const metadata = { title: "Início" };

export default async function HomePage() {
  const [overview, ctx] = await Promise.all([
    getWorkspaceOverview(),
    getWorkspaceContext(),
  ]);

  return (
    <HomeView
      userId={overview.userId}
      userName={ctx.user.name}
      tasks={overview.tasks}
      projects={overview.projects}
      activity={overview.activity}
    />
  );
}

import { getWorkspaceOverview } from "@/server/queries";
import { DashboardsView } from "@/components/views/dashboards-view";

export const metadata = { title: "Painéis" };

export default async function DashboardsPage() {
  const overview = await getWorkspaceOverview();
  return (
    <DashboardsView
      userId={overview.userId}
      tasks={overview.tasks}
      projects={overview.projects}
    />
  );
}

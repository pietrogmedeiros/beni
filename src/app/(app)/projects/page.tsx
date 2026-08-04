import { getWorkspaceOverview } from "@/server/queries";
import { ProjectsView } from "@/components/views/projects-view";

export const metadata = { title: "Projetos" };

export default async function ProjectsPage() {
  const overview = await getWorkspaceOverview();
  return <ProjectsView projects={overview.projects} />;
}

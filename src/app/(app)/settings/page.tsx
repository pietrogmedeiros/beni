import { getWorkspaceContext } from "@/server/queries";
import { getGithubTokenPreview } from "@/server/actions/github";
import { SettingsView } from "@/components/views/settings-view";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const [ctx, githubTokenPreview] = await Promise.all([
    getWorkspaceContext(),
    getGithubTokenPreview(),
  ]);
  return (
    <SettingsView
      user={ctx.user}
      workspace={ctx.workspace}
      members={ctx.members}
      tags={ctx.tags}
      projectCount={ctx.projects.length}
      githubTokenPreview={githubTokenPreview}
    />
  );
}

import { redirect } from "next/navigation";

export default async function ProjectIndexPage({
  params,
}: PageProps<"/p/[projectId]">) {
  const { projectId } = await params;
  redirect(`/p/${projectId}/board`);
}

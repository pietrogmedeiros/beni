import { listNotes } from "@/server/actions/notes";
import { NotesView } from "@/components/views/notes-view";

export const metadata = { title: "Anotações" };

export default async function NotasPage({ params }: PageProps<"/p/[projectId]/notas">) {
  const { projectId } = await params;
  const notes = await listNotes(projectId);
  return <NotesView projectId={projectId} initialNotes={notes} />;
}

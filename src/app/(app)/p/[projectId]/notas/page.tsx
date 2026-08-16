import { listNotes } from "@/server/actions/notes";
import { NotesView } from "@/components/views/notes-view";
import { RegistrarVisao } from "@/components/registrar-visao";

export const metadata = { title: "Anotações" };

export default async function NotasPage({ params }: PageProps<"/p/[projectId]/notas">) {
  const { projectId } = await params;
  const notes = await listNotes(projectId);
  return (
    <>
      <RegistrarVisao evento="visao.anotacoes" />
      <NotesView projectId={projectId} initialNotes={notes} />
    </>
  );
}

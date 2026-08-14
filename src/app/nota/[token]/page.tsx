import { notFound } from "next/navigation";
import { loadPublicNote } from "@/server/actions/notes";
import { NoteRender } from "@/components/notes/note-render";
import { BeniLogo } from "@/components/logo";
import { formatFullDate } from "@/lib/utils";

export const metadata = {
  title: "Anotação",
  robots: { index: false, follow: false },
};

/**
 * Anotação publicada por link.
 *
 * Modo leitura, sem sessão e sem nada do produto em volta: quem chega aqui
 * veio pelo link que alguém mandou, não para trabalhar no Beni.
 */
export default async function NotaPublicaPage({ params }: PageProps<"/nota/[token]">) {
  const { token } = await params;
  const nota = await loadPublicNote(token);
  if (!nota) notFound();

  return (
    <div className="min-h-svh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <BeniLogo />
          <span
            className="rounded px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: `${nota.project.color}22`, color: nota.project.color }}
          >
            {nota.project.key}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <article className="rounded-xl border bg-card p-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            {nota.icon && <span className="mr-2">{nota.icon}</span>}
            {nota.title}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {nota.project.name}
            {nota.author && ` · por ${nota.author}`} · atualizada em{" "}
            {formatFullDate(nota.updatedAt)}
          </p>

          <div className="mt-6">
            <NoteRender blocks={nota.blocks} tokenImagem={token} />
          </div>
        </article>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Somente leitura · publicado pelo Beni
        </p>
      </main>
    </div>
  );
}

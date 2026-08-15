"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Check,
  Copy,
  FileText,
  Globe,
  Loader2,
  Lock,
  Plus,
  Trash2,
} from "lucide-react";
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  revokeNoteShare,
  saveNote,
  shareNote,
  type NoteDetail,
  type NoteSummary,
} from "@/server/actions/notes";
import { NoteEditor, NoteHints } from "@/components/notes/note-editor";
import { RelativeTime } from "@/components/relative-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Block } from "@/lib/notes";
import { cn } from "@/lib/utils";

const DICA_KEY = "beni:notas-dica";

/**
 * Anotações do projeto: lista à esquerda, documento à direita.
 *
 * O documento salva sozinho, com um respiro depois da última tecla — pedir
 * "salvar" a quem está escrevendo é a forma mais fácil de perder texto.
 */
export function NotesView({
  projectId,
  initialNotes,
}: {
  projectId: string;
  initialNotes: NoteSummary[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [abertaId, setAbertaId] = useState<string | null>(initialNotes[0]?.id ?? null);
  const [aberta, setAberta] = useState<NoteDetail | null>(null);
  /**
   * O título como está na tela agora.
   *
   * O campo é não controlado e o salvamento é adiado, então `aberta.title`
   * fica velho enquanto a pessoa digita. Isso não aparecia em lugar nenhum
   * até a confirmação de exclusão nomear a anotação — e nomear errado é pior
   * do que não nomear: dá para apagar a anotação achando que é outra.
   */
  const [tituloNaTela, setTituloNaTela] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [dica, setDica] = useState(false);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendente = useRef<{ title?: string; blocks?: Block[] }>({});

  useEffect(() => {
    // a preferência mora no navegador; só dá para lê-la depois de montar
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDica(localStorage.getItem(DICA_KEY) !== "0");
  }, []);

  // busca no servidor ao trocar de anotação; as mudanças de estado acontecem
  // no callback, não no corpo do efeito
  useEffect(() => {
    let vivo = true;
    const id = requestAnimationFrame(() => {
      if (!vivo) return;
      // o título digitado pertence à anotação anterior; sem zerar, ele vazaria
      // para a confirmação de exclusão da próxima
      setTituloNaTela("");
      if (!abertaId) {
        setAberta(null);
        return;
      }
      setCarregando(true);
      getNote(abertaId)
        .then((n) => vivo && setAberta(n))
        .finally(() => vivo && setCarregando(false));
    });
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
    };
  }, [abertaId]);

  /**
   * Salva sozinho, com um respiro depois da última tecla.
   *
   * As alterações são **acumuladas**: com um patch só por timer, escrever no
   * corpo logo depois de mexer no título descartava o título silenciosamente —
   * a segunda chamada cancelava o timer e substituía o que ia ser gravado.
   */
  const agendarSalvar = useCallback(
    (patch: { title?: string; blocks?: Block[] }) => {
      if (!abertaId) return;
      pendente.current = { ...pendente.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      setSalvando(true);
      timer.current = setTimeout(async () => {
        const enviar = pendente.current;
        pendente.current = {};
        await saveNote(abertaId, enviar);
        setSalvando(false);
        setNotes(await listNotes(projectId));
      }, 700);
    },
    [abertaId, projectId],
  );

  /**
   * Grava agora o que está esperando o timer.
   *
   * Trocar de anotação recarregava do servidor antes do salvamento adiado
   * acontecer — e o último trecho digitado sumia da tela como se nunca tivesse
   * sido escrito. Qualquer saída do documento passa por aqui primeiro.
   */
  const descarregar = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const enviar = pendente.current;
    pendente.current = {};
    if (!abertaId || Object.keys(enviar).length === 0) return;
    await saveNote(abertaId, enviar);
    setSalvando(false);
  }, [abertaId]);

  function abrir(id: string) {
    void descarregar().then(() => setAbertaId(id));
  }

  /**
   * Avisa antes de fechar a aba com texto ainda não gravado.
   *
   * Não dá para garantir uma escrita no servidor durante o fechamento — o
   * navegador corta a requisição. Então o honesto é avisar, em vez de fingir
   * que salvou.
   */
  useEffect(() => {
    const aoSair = (e: BeforeUnloadEvent) => {
      if (Object.keys(pendente.current).length > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, []);

  // sair da tela de anotações também grava o que estava pendente
  useEffect(() => () => void descarregar(), [descarregar]);

  function nova() {
    startTransition(async () => {
      await descarregar();
      const { id } = await createNote(projectId);
      setNotes(await listNotes(projectId));
      setAbertaId(id);
    });
  }

  function excluir(id: string) {
    startTransition(async () => {
      await deleteNote(id);
      const restantes = await listNotes(projectId);
      setNotes(restantes);
      if (abertaId === id) setAbertaId(restantes[0]?.id ?? null);
      toast.success("Anotação excluída");
    });
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-72 shrink-0 flex-col border-r">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            {notes.length} {notes.length === 1 ? "anotação" : "anotações"}
          </span>
          <Button size="sm" variant="ghost" onClick={nova}>
            <Plus className="size-4" />
            Nova
          </Button>
        </div>

        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
          {notes.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhuma anotação ainda.
            </p>
          ) : (
            notes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => abrir(n.id)}
                className={cn(
                  "block w-full border-b px-3 py-2.5 text-left transition hover:bg-muted/60",
                  abertaId === n.id && "bg-muted",
                )}
              >
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  {n.title}
                  {n.shared && <Globe className="size-3 shrink-0 text-primary-strong" />}
                </p>
                {n.excerpt && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.excerpt}</p>
                )}
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  <RelativeTime date={n.updatedAt} />
                </p>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="thin-scrollbar min-w-0 flex-1 overflow-y-auto">
        {!abertaId ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
            <FileText className="size-6 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              Anotações do projeto: decisões, roteiros de reunião, o que for. Dá para
              colar prints e publicar por link.
            </p>
            <Button onClick={nova}>
              <Plus className="size-4" />
              Criar a primeira
            </Button>
          </div>
        ) : carregando || !aberta ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-6 py-6">
            <div className="mb-3 flex items-start gap-2">
              <Input
                defaultValue={aberta.title}
                onChange={(e) => {
                  setTituloNaTela(e.target.value);
                  agendarSalvar({ title: e.target.value });
                }}
                placeholder="Sem título"
                className="h-auto flex-1 border-0 bg-transparent px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
              />
              <div className="flex shrink-0 items-center gap-1 pt-2">
                <span className="text-[10px] text-muted-foreground">
                  {salvando ? "salvando…" : "salvo"}
                </span>
                <CompartilharNota
                  noteId={aberta.id}
                  shareUrl={aberta.shareUrl}
                  onChange={async () => {
                    setAberta(await getNote(aberta.id));
                    setNotes(await listNotes(projectId));
                  }}
                />
                {/* anotação é texto longo e não tem desfazer; excluir tarefa
                    já pedia confirmação, e isto aqui tinha ficado de fora */}
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Excluir anotação"
                      />
                    }
                  >
                    <Trash2 className="size-4" />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Excluir “{tituloNaTela || aberta.title || "Sem título"}”?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        A anotação e as imagens dentro dela são apagadas, e não dá
                        para desfazer.
                        {aberta.shareUrl
                          ? " O link público que você compartilhou para de funcionar."
                          : ""}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => excluir(aberta.id)}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {dica && (
              <div className="mb-4">
                <NoteHints
                  onClose={() => {
                    localStorage.setItem(DICA_KEY, "0");
                    setDica(false);
                  }}
                />
              </div>
            )}

            <NoteEditor
              key={aberta.id}
              noteId={aberta.id}
              initialBlocks={aberta.blocks}
              onChange={(blocks) => agendarSalvar({ blocks })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CompartilharNota({
  noteId,
  shareUrl,
  onChange,
}: {
  noteId: string;
  shareUrl: string | null;
  onChange: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Popover>
      <PopoverTrigger
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
        aria-label="Compartilhar anotação"
      >
        {shareUrl ? <Globe className="size-4 text-primary-strong" /> : <Lock className="size-4" />}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96">
        <p className="text-sm font-semibold">Compartilhar por link</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Quem tiver o link lê a anotação sem precisar de conta. Ninguém edita por ali.
        </p>

        {shareUrl ? (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <Input readOnly value={shareUrl} className="h-8 font-mono text-[11px]" />
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  toast.success("Link copiado");
                }}
              >
                <Copy className="size-3.5" />
                Copiar
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await revokeNoteShare(noteId);
                  await onChange();
                  toast.success("Link revogado");
                })
              }
            >
              Revogar link
            </Button>
          </div>
        ) : (
          <Button
            className="mt-3 w-full"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const { url } = await shareNote(noteId);
                await onChange();
                navigator.clipboard.writeText(url).catch(() => {});
                toast.success("Link criado e copiado");
              })
            }
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Gerar link público
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

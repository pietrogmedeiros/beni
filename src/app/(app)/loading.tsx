import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueleto exibido enquanto a próxima tela é montada no servidor.
 *
 * Vale mais do que parece: sem uma fronteira de carregamento o navegador fica
 * parado na tela antiga até a resposta inteira chegar — o que, com o servidor
 * do outro lado do oceano, são centenas de milissegundos de nada acontecendo.
 * Com ela o app responde na hora e o Next ainda passa a pré-carregar rotas
 * dinâmicas, que sem isso ele nem tenta.
 */
export default function Loading() {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-6 w-52" />
        <Skeleton className="ml-auto h-8 w-28 rounded-lg" />
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>

      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton
            key={i}
            className="h-11 w-full rounded-lg"
            style={{ opacity: 1 - i * 0.1 }}
          />
        ))}
      </div>
    </div>
  );
}

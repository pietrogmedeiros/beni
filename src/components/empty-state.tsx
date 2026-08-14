import { BeniMascote, type Pose } from "@/components/logo";
import { cn } from "@/lib/utils";

/**
 * Tela vazia com o mascote.
 *
 * Vazio é o primeiro estado de quase tudo — projeto novo, caixa de feedback,
 * dia sem tarefa. Em vez de um retângulo tracejado com um sinal de mais, a
 * pessoa encontra alguém. Cada tela usa uma pose diferente de propósito: repetir
 * a mesma imagem em quatro lugares faz o produto parecer menor do que é.
 */
export function EmptyState({
  pose = "parado",
  titulo,
  descricao,
  acao,
  className,
}: {
  pose?: Pose;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 px-6 py-12 text-center",
        className,
      )}
    >
      <BeniMascote pose={pose} pequeno className="mb-1 h-32 w-auto opacity-95" />
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      {descricao && (
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
          {descricao}
        </p>
      )}
      {acao && <div className="mt-3">{acao}</div>}
    </div>
  );
}

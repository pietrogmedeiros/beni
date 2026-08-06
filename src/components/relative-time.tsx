import { formatRelative } from "@/lib/utils";

/**
 * Texto de tempo relativo ("há 3 minutos").
 *
 * O valor é calculado no servidor e recalculado na hidratação; se o minuto
 * virar nesse intervalo, o texto muda e o React reclama. `suppressHydrationWarning`
 * existe exatamente para este caso — conteúdo dependente do relógio.
 */
export function RelativeTime({
  date,
  className,
}: {
  date: string | Date;
  className?: string;
}) {
  return (
    <span className={className} suppressHydrationWarning>
      {formatRelative(date)}
    </span>
  );
}

import { cn } from "@/lib/utils";
import { withBase } from "@/lib/base-path";

/**
 * Marca do Beni.
 *
 * É uma imagem simples, e não `next/image`, de propósito: o otimizador de
 * imagens do Next processaria a marca a cada tamanho pedido, e ela aparece em
 * toda tela. Num servidor de CPU compartilhada isso é trabalho recorrente para
 * entregar sempre o mesmo arquivo.
 *
 * O arquivo aqui é o webp de 256px (10 KB). O PNG de 512 continua em
 * `/beni.png` porque o OAuth e o MCP pedem PNG por especificação — mas quem
 * paga por ele é só quem instala o conector, não quem abre a tela.
 */
export function BeniMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={withBase("/beni-marca.webp")}
      alt=""
      aria-hidden
      className={cn("size-8 object-contain", className)}
    />
  );
}

export function BeniLogo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BeniMark />
      {showText && (
        <span className="text-lg font-semibold tracking-tight">Beni</span>
      )}
    </div>
  );
}

/** As poses de corpo inteiro do mascote. */
export const POSES = {
  parado: "parado",
  andando: "andando",
  apresentando: "apresentando",
  prancheta: "prancheta",
} as const;

export type Pose = keyof typeof POSES;

/**
 * O mascote de corpo inteiro.
 *
 * Duas versões de cada pose: a grande para entrada e tela vazia, a pequena
 * para quando ele é enfeite ao lado de um texto. `sizes` não resolveria porque
 * não passamos pelo otimizador — então a escolha é explícita.
 */
export function BeniMascote({
  pose = "parado",
  pequeno = false,
  className,
}: {
  pose?: Pose;
  pequeno?: boolean;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={withBase(`/mascote/${pose}${pequeno ? "@small" : ""}.webp`)}
      alt=""
      aria-hidden
      draggable={false}
      className={cn("object-contain select-none", className)}
    />
  );
}

import { cn } from "@/lib/utils";
import { withBase } from "@/lib/base-path";

/**
 * Marca do Beni.
 *
 * É uma imagem simples, e não `next/image`, de propósito: o otimizador de
 * imagens do Next processaria a marca a cada tamanho pedido, e ela aparece em
 * toda tela. Num servidor de CPU compartilhada isso é trabalho recorrente para
 * entregar sempre o mesmo arquivo de 40 KB.
 */
export function BeniMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={withBase("/beni.png")}
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

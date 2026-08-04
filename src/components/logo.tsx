import { cn } from "@/lib/utils";

/**
 * Marca do Beni: um "B" desenhado com traços, sem fundo — o glifo vive
 * direto sobre a superfície da página.
 */
export function BeniMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("size-8", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="beni-grad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="55%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>

      <g
        stroke="url(#beni-grad)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* haste */}
        <path d="M8.5 5.5V26.5" />
        {/* barriga de cima */}
        <path d="M8.5 5.5h6.2a5.2 5.2 0 0 1 0 10.4H8.5" />
        {/* barriga de baixo */}
        <path d="M8.5 15.9h7a5.3 5.3 0 0 1 0 10.6h-7" />
      </g>

      {/* ponto de destaque */}
      <circle cx="26.4" cy="7.4" r="2.6" fill="url(#beni-grad)" />
    </svg>
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

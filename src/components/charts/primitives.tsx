"use client";

import { cn } from "@/lib/utils";

/** Tile de estatística — número herói + rótulo, sem gráfico. */
export function StatTile({
  label,
  value,
  hint,
  accent,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        {icon && (
          <span
            className="flex size-7 items-center justify-center rounded-md"
            style={{ backgroundColor: accent ? `${accent}1f` : undefined, color: accent }}
          >
            {icon}
          </span>
        )}
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Cartão com título usado para envolver gráficos. */
export function ChartCard({
  title,
  description,
  children,
  className,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-4", className)}>
      <div className="mb-3 flex items-start gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/**
 * Barras horizontais em HTML puro — mais legíveis que um gráfico de pizza
 * para comparar magnitudes, com rótulo direto em cada barra.
 */
export function BarList({
  items,
  emptyLabel = "Sem dados",
  valueSuffix = "",
}: {
  items: { id: string; label: string; value: number; color?: string; extra?: string }[];
  emptyLabel?: string;
  valueSuffix?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));

  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <div className="mb-1 flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[13px]">{item.label}</span>
            <span className="text-[13px] font-medium tabular-nums">
              {item.value}
              {valueSuffix}
            </span>
            {item.extra && (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {item.extra}
              </span>
            )}
          </div>
          <div className="h-2 overflow-hidden rounded-sm bg-muted">
            <div
              className="h-full rounded-sm transition-all"
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.color ?? "var(--chart-1)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Legenda compartilhada — identidade nunca fica só na cor. */
export function ChartLegend({
  items,
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="size-2.5 rounded-sm"
            style={{ backgroundColor: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

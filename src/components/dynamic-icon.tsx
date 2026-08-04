"use client";

import * as Icons from "lucide-react";
import type { LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

type IconName = keyof typeof Icons;

/** Renderiza um ícone lucide pelo nome (usado para ícones salvos no banco). */
export function DynamicIcon({
  name,
  className,
  ...props
}: { name: string; className?: string } & Omit<LucideProps, "ref">) {
  const Comp = (Icons[name as IconName] ??
    Icons.Circle) as React.ComponentType<LucideProps>;
  return <Comp className={cn("size-4", className)} {...props} />;
}

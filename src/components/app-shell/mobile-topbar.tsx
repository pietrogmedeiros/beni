"use client";

import { Menu, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeniMark } from "@/components/logo";

/** Barra superior exibida apenas em telas pequenas, onde a sidebar vira gaveta. */
export function MobileTopBar({
  onMenu,
  onSearch,
  onNewTask,
}: {
  onMenu: () => void;
  onSearch: () => void;
  onNewTask: () => void;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-2 lg:hidden">
      <Button
        variant="ghost"
        size="icon"
        className="size-9"
        onClick={onMenu}
        aria-label="Abrir menu"
      >
        <Menu className="size-5" />
      </Button>

      <BeniMark className="size-6" />
      <span className="text-sm font-semibold">Beni</span>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          onClick={onSearch}
          aria-label="Buscar"
        >
          <Search className="size-4" />
        </Button>
        <Button
          size="icon"
          className="size-9"
          onClick={onNewTask}
          aria-label="Nova tarefa"
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}

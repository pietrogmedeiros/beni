/**
 * Metadados de domínio compartilhados entre server e client.
 * Espelha os enums do Prisma sem importar o client gerado (que é server-only).
 */

export const PRIORITIES = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type PriorityValue = (typeof PRIORITIES)[number];

export const PRIORITY_META: Record<
  PriorityValue,
  { label: string; color: string; className: string; rank: number }
> = {
  URGENT: {
    label: "Urgente",
    color: "#ef4444",
    className: "text-red-600 dark:text-red-400",
    rank: 4,
  },
  HIGH: {
    label: "Alta",
    color: "#f97316",
    className: "text-orange-600 dark:text-orange-400",
    rank: 3,
  },
  MEDIUM: {
    label: "Média",
    color: "#eab308",
    className: "text-yellow-600 dark:text-yellow-400",
    rank: 2,
  },
  LOW: {
    label: "Baixa",
    color: "#3b82f6",
    className: "text-blue-600 dark:text-blue-400",
    rank: 1,
  },
  NONE: {
    label: "Nenhuma",
    color: "#94a3b8",
    className: "text-muted-foreground",
    rank: 0,
  },
};

export const TASK_TYPES = ["TASK", "BUG", "STORY", "EPIC", "CHORE"] as const;
export type TaskTypeValue = (typeof TASK_TYPES)[number];

export const TASK_TYPE_META: Record<
  TaskTypeValue,
  { label: string; icon: string; color: string }
> = {
  TASK: { label: "Tarefa", icon: "CheckSquare", color: "#eab308" },
  BUG: { label: "Bug", icon: "Bug", color: "#ef4444" },
  STORY: { label: "História", icon: "BookOpen", color: "#22c55e" },
  EPIC: { label: "Épico", icon: "Zap", color: "#f97316" },
  CHORE: { label: "Manutenção", icon: "Wrench", color: "#64748b" },
};

export const STATUS_CATEGORIES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "CANCELED",
] as const;
export type StatusCategoryValue = (typeof STATUS_CATEGORIES)[number];

export const STATUS_CATEGORY_META: Record<
  StatusCategoryValue,
  { label: string }
> = {
  BACKLOG: { label: "Backlog" },
  TODO: { label: "A fazer" },
  IN_PROGRESS: { label: "Em andamento" },
  DONE: { label: "Concluído" },
  CANCELED: { label: "Cancelado" },
};

export const SPRINT_STATUSES = ["PLANNED", "ACTIVE", "COMPLETED"] as const;
export type SprintStatusValue = (typeof SPRINT_STATUSES)[number];

export const SPRINT_STATUS_META: Record<
  SprintStatusValue,
  { label: string; className: string }
> = {
  PLANNED: {
    label: "Planejada",
    className: "bg-muted text-muted-foreground",
  },
  ACTIVE: {
    label: "Ativa",
    className: "bg-primary/15 text-primary-strong border-primary/30",
  },
  COMPLETED: {
    label: "Concluída",
    className: "bg-success/15 text-success border-success/30",
  },
};

export const DEPENDENCY_TYPES = [
  "FINISH_TO_START",
  "START_TO_START",
  "FINISH_TO_FINISH",
  "START_TO_FINISH",
] as const;
export type DependencyTypeValue = (typeof DEPENDENCY_TYPES)[number];

export const DEPENDENCY_TYPE_META: Record<
  DependencyTypeValue,
  { label: string; short: string }
> = {
  FINISH_TO_START: { label: "Fim → Início", short: "FS" },
  START_TO_START: { label: "Início → Início", short: "SS" },
  FINISH_TO_FINISH: { label: "Fim → Fim", short: "FF" },
  START_TO_FINISH: { label: "Início → Fim", short: "SF" },
};

/** Paleta usada em projetos, tags e status */
export const PALETTE = [
  "#eab308",
  "#f59e0b",
  "#f97316",
  "#facc15",
  "#ef4444",
  "#ec4899",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#78716c",
  "#64748b",
  "#0f172a",
];

/** Ícones (lucide) disponíveis para projeto */
export const PROJECT_ICONS = [
  "Rocket",
  "Target",
  "Flame",
  "Sparkles",
  "Layers",
  "Package",
  "Code2",
  "Palette",
  "Megaphone",
  "ShoppingCart",
  "Building2",
  "Globe",
  "Cpu",
  "LineChart",
];

export const DEFAULT_STATUSES = [
  { name: "Backlog", color: "#94a3b8", category: "BACKLOG" as const },
  { name: "A fazer", color: "#eab308", category: "TODO" as const },
  { name: "Em andamento", color: "#f59e0b", category: "IN_PROGRESS" as const },
  { name: "Em revisão", color: "#06b6d4", category: "IN_PROGRESS" as const },
  { name: "Concluído", color: "#22c55e", category: "DONE" as const },
];

export const PROJECT_VIEWS = [
  { slug: "list", label: "Lista", icon: "List" },
  { slug: "board", label: "Quadro", icon: "KanbanSquare" },
  { slug: "gantt", label: "Gantt", icon: "GanttChartSquare" },
  { slug: "backlog", label: "Backlog", icon: "Layers" },
  { slug: "calendar", label: "Calendário", icon: "CalendarDays" },
  { slug: "dashboard", label: "Painel", icon: "PieChart" },
] as const;

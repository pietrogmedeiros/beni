"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  ListTodo,
} from "lucide-react";
import {
  BarList,
  ChartCard,
  ChartLegend,
  StatTile,
} from "@/components/charts/primitives";
import { UserAvatar } from "@/components/user-avatar";
import { PRIORITY_META, type PriorityValue } from "@/lib/constants";
import { isOverdue } from "@/lib/utils";
import { useApp } from "@/components/app-shell/app-context";
import type { SprintDTO, StatusDTO, TaskDTO } from "@/server/queries";

const SERIES = {
  created: { label: "Criadas", color: "var(--chart-1)" },
  completed: { label: "Concluídas", color: "var(--chart-2)" },
  ideal: { label: "Ideal", color: "var(--chart-3)" },
  remaining: { label: "Restante", color: "var(--chart-1)" },
};

export function ProjectDashboard({
  statuses,
  sprints,
  tasks,
}: {
  statuses: StatusDTO[];
  sprints: SprintDTO[];
  tasks: TaskDTO[];
}) {
  const { members } = useApp();

  const root = tasks.filter((t) => !t.parentId);
  const done = root.filter((t) => t.statusCategory === "DONE");
  const inProgress = root.filter((t) => t.statusCategory === "IN_PROGRESS");
  const overdue = root.filter((t) =>
    isOverdue(t.dueDate, t.statusCategory === "DONE"),
  );

  const byStatus = statuses.map((s) => ({
    id: s.id,
    label: s.name,
    value: root.filter((t) => t.statusId === s.id).length,
    color: s.color,
  }));

  const byPriority = (["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"] as const)
    .map((p) => ({
      id: p,
      label: PRIORITY_META[p as PriorityValue].label,
      value: root.filter((t) => t.priority === p).length,
      color: PRIORITY_META[p as PriorityValue].color,
    }))
    .filter((p) => p.value > 0);

  const byAssignee = useMemo(() => {
    const rows = members
      .map((m) => {
        const items = root.filter((t) => t.assignee?.id === m.id);
        const finished = items.filter((t) => t.statusCategory === "DONE").length;
        return {
          id: m.id,
          label: m.name,
          value: items.length,
          extra: items.length ? `${finished} concluídas` : undefined,
          color: "var(--chart-1)",
        };
      })
      .filter((r) => r.value > 0);

    const none = root.filter((t) => !t.assignee).length;
    if (none > 0) {
      rows.push({
        id: "none",
        label: "Sem responsável",
        value: none,
        extra: undefined,
        color: "var(--chart-4)",
      });
    }
    return rows.sort((a, b) => b.value - a.value);
  }, [members, root]);

  /* fluxo cumulativo dos últimos 30 dias */
  const flow = useMemo(() => {
    const today = startOfDay(new Date());
    const days = Array.from({ length: 30 }, (_, i) => addDays(today, -29 + i));
    return days.map((day) => {
      const end = addDays(day, 1);
      return {
        date: format(day, "dd/MM"),
        created: root.filter((t) => new Date(t.createdAt) < end).length,
        completed: root.filter(
          (t) => t.completedAt && new Date(t.completedAt) < end,
        ).length,
      };
    });
  }, [root]);

  /* burndown da sprint ativa */
  const activeSprint = sprints.find((s) => s.status === "ACTIVE");
  const burndown = useMemo(() => {
    if (!activeSprint?.startDate || !activeSprint?.endDate) return null;
    const start = startOfDay(new Date(activeSprint.startDate));
    const end = startOfDay(new Date(activeSprint.endDate));
    const total = differenceInCalendarDays(end, start);
    if (total <= 0) return null;

    const items = root.filter((t) => t.sprintId === activeSprint.id);
    const totalPoints = items.reduce((s, t) => s + (t.points ?? 1), 0);
    if (totalPoints === 0) return null;

    return Array.from({ length: total + 1 }, (_, i) => {
      const day = addDays(start, i);
      const burned = items
        .filter((t) => t.completedAt && new Date(t.completedAt) <= addDays(day, 1))
        .reduce((s, t) => s + (t.points ?? 1), 0);
      const future = day > new Date();
      return {
        date: format(day, "dd/MM"),
        ideal: Math.round((totalPoints * (1 - i / total)) * 10) / 10,
        remaining: future ? null : totalPoints - burned,
      };
    });
  }, [activeSprint, root]);

  const completionRate = root.length
    ? Math.round((done.length / root.length) * 100)
    : 0;

  return (
    <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total de tarefas"
          value={root.length}
          hint={`${completionRate}% concluído`}
          accent="var(--chart-1)"
          icon={<ListTodo className="size-4" />}
        />
        <StatTile
          label="Em andamento"
          value={inProgress.length}
          hint="tarefas ativas agora"
          accent="var(--chart-3)"
          icon={<CircleDot className="size-4" />}
        />
        <StatTile
          label="Concluídas"
          value={done.length}
          hint={`de ${root.length} tarefas`}
          accent="var(--chart-2)"
          icon={<CheckCircle2 className="size-4" />}
        />
        <StatTile
          label="Atrasadas"
          value={overdue.length}
          hint={overdue.length ? "precisam de atenção" : "nenhum atraso 🎉"}
          accent="var(--destructive)"
          icon={<AlertTriangle className="size-4" />}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Fluxo cumulativo"
          description="Tarefas criadas x concluídas nos últimos 30 dias"
          action={
            <ChartLegend
              items={[
                { label: SERIES.created.label, color: SERIES.created.color },
                { label: SERIES.completed.label, color: SERIES.completed.color },
              ]}
            />
          }
        >
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={flow} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="grad-created" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES.created.color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={SERIES.created.color} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-completed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES.completed.color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={SERIES.completed.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                interval={6}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={38}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="created"
                name={SERIES.created.label}
                stroke={SERIES.created.color}
                strokeWidth={2}
                fill="url(#grad-created)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="completed"
                name={SERIES.completed.label}
                stroke={SERIES.completed.color}
                strokeWidth={2}
                fill="url(#grad-completed)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={
            burndown
              ? `Burndown · ${activeSprint?.name}`
              : "Burndown da sprint"
          }
          description={
            burndown
              ? "Pontos restantes x linha ideal"
              : "Inicie uma sprint com datas e pontos para ver o burndown"
          }
          action={
            burndown ? (
              <ChartLegend
                items={[
                  { label: SERIES.remaining.label, color: SERIES.remaining.color },
                  { label: SERIES.ideal.label, color: SERIES.ideal.color },
                ]}
              />
            ) : undefined
          }
        >
          {burndown ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={burndown} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={38}
                />
                <Tooltip content={<ChartTooltip suffix=" pts" />} />
                <Line
                  type="linear"
                  dataKey="ideal"
                  name={SERIES.ideal.label}
                  stroke={SERIES.ideal.color}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="remaining"
                  name={SERIES.remaining.label}
                  stroke={SERIES.remaining.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Nenhuma sprint ativa com datas definidas.
            </p>
          )}
        </ChartCard>

        <ChartCard title="Tarefas por status" description="Distribuição atual do fluxo">
          <BarList items={byStatus} />
        </ChartCard>

        <ChartCard title="Carga do time" description="Tarefas atribuídas por pessoa">
          <BarList items={byAssignee} emptyLabel="Nenhuma tarefa atribuída" />
        </ChartCard>

        <ChartCard
          title="Distribuição por prioridade"
          description="Onde está a urgência do projeto"
          className="lg:col-span-2"
        >
          <BarList items={byPriority} />
        </ChartCard>
      </div>

      {/* alternativa em tabela — identidade nunca depende só da cor */}
      <details className="mt-3 rounded-xl border bg-card p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Ver dados em tabela
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-4 font-medium">Responsável</th>
                <th className="py-1.5 pr-4 font-medium">Total</th>
                <th className="py-1.5 pr-4 font-medium">Concluídas</th>
                <th className="py-1.5 font-medium">Atrasadas</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const items = root.filter((t) => t.assignee?.id === m.id);
                if (items.length === 0) return null;
                return (
                  <tr key={m.id} className="border-b border-border/50">
                    <td className="py-1.5 pr-4">
                      <span className="flex items-center gap-2">
                        <UserAvatar user={m} showTooltip={false} className="size-5" />
                        {m.name}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4 tabular-nums">{items.length}</td>
                    <td className="py-1.5 pr-4 tabular-nums">
                      {items.filter((t) => t.statusCategory === "DONE").length}
                    </td>
                    <td className="py-1.5 tabular-nums">
                      {
                        items.filter((t) =>
                          isOverdue(t.dueDate, t.statusCategory === "DONE"),
                        ).length
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  suffix = "",
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-sm"
            style={{ backgroundColor: entry.stroke ?? entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="ml-auto font-medium tabular-nums">
            {entry.value ?? "—"}
            {suffix}
          </span>
        </p>
      ))}
    </div>
  );
}

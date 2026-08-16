"use client";

import Link from "next/link";
import { PageHeader } from "@/components/app-shell/page-header";
import { cn } from "@/lib/utils";
import { BarChart3 } from "lucide-react";
import type { Painel } from "@/server/telemetria";

const ORIGENS: Record<string, string> = {
  app: "App de Mac",
  navegador: "Navegador",
  celular: "Celular",
  desconhecida: "Antes da medição",
};

const ROTULOS: Record<string, string> = {
  "visao.lista": "Lista",
  "visao.quadro": "Quadro",
  "visao.gantt": "Gantt",
  "visao.backlog": "Backlog",
  "visao.calendario": "Calendário",
  "visao.painel": "Painel do projeto",
  "visao.anotacoes": "Anotações",
  "visao.chat": "Chat",
  "tarefa.criar": "Criou tarefa",
  "tarefa.massa": "Criou em massa",
  "anotacao.criar": "Criou anotação",
  "link.criar": "Criou link público",
  "aprovacao.pedir": "Pediu aprovação",
  "feedback.enviar": "Mandou feedback",
  "avatar.trocar": "Trocou o avatar",
  "api.chamada": "Usou a API",
  "mcp.chamada": "Usou o conector do Claude",
};

/**
 * Painel de telemetria.
 *
 * Não é um painel genérico de métricas: cada bloco existe para responder uma
 * pergunta específica da divisão entre grátis e pago. Se um bloco não decide
 * nada, ele não deveria estar aqui.
 */
export function TelemetriaPainel({
  dados,
  internos,
}: {
  dados: Painel;
  /** Está mostrando também quem administra? O padrão é não. */
  internos: boolean;
}) {
  const maiorDia = Math.max(1, ...dados.ativosPorDia.map((d) => d.pessoas));

  return (
    <>
      <PageHeader
        title="Telemetria"
        subtitle={
          internos
            ? "Todo mundo, inclusive você"
            : "Só quem é de fora — seus próprios dados estão fora da conta"
        }
        icon={<BarChart3 className="size-5 text-primary" />}
        actions={
          <div className="flex rounded-lg border p-0.5 text-xs">
            <Link
              href="/telemetria"
              className={cn(
                "rounded-md px-2.5 py-1 transition",
                internos
                  ? "text-muted-foreground hover:text-foreground"
                  : "bg-muted font-medium text-foreground",
              )}
            >
              Sem os meus
            </Link>
            <Link
              href="/telemetria?internos=1"
              className={cn(
                "rounded-md px-2.5 py-1 transition",
                internos
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Tudo
            </Link>
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Numero titulo="Ativos hoje" valor={dados.ativos.hoje} />
            <Numero titulo="Ativos em 7 dias" valor={dados.ativos.semana} />
            <Numero titulo="Ativos em 30 dias" valor={dados.ativos.mes} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Numero titulo="Contas" valor={dados.contas.total} />
            <Numero
              titulo="E-mail confirmado"
              valor={dados.contas.confirmadas}
              nota={`${pct(dados.contas.confirmadas, dados.contas.total)} do total`}
            />
            <Numero titulo="Novas na semana" valor={dados.contas.novasNaSemana} />
          </div>

          <Bloco
            titulo="Pessoas por workspace"
            pergunta="Decide o teto de 3 pessoas do plano grátis: quantos passariam dele hoje?"
          >
            <Barras
              itens={dados.tamanhoDosWorkspaces.map((t) => ({
                rotulo: t.faixa,
                valor: t.quantidade,
              }))}
            />
          </Bloco>

          <Bloco
            titulo="Links públicos por workspace"
            pergunta="Decide o teto de 1 link ativo: quantos já usam mais de um?"
          >
            <Barras
              itens={dados.linksPorWorkspace.map((t) => ({
                rotulo: t.faixa,
                valor: t.quantidade,
              }))}
            />
          </Bloco>

          <Bloco
            titulo="Uso por recurso, últimos 30 dias"
            pergunta="Decide o que não pode ser gateado: o que quase todo mundo usa é o que cria hábito."
          >
            {dados.usoPorRecurso.length === 0 ? (
              <Vazio />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="pb-1.5 font-medium">Recurso</th>
                      <th className="pb-1.5 text-right font-medium">Workspaces</th>
                      <th className="pb-1.5 text-right font-medium">Vezes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.usoPorRecurso.map((r) => (
                      <tr key={r.evento} className="border-t border-border/50">
                        <td className="py-1.5">{ROTULOS[r.evento] ?? r.evento}</td>
                        <td className="py-1.5 text-right font-medium tabular-nums">
                          {r.workspaces}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                          {r.vezes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Bloco>

          <Bloco
            titulo="Por onde acessam"
            pergunta="Quem usa o app de Mac, quem usa o navegador e quem entra do celular — decide onde vale investir."
          >
            {dados.porOrigem.length === 0 ? (
              <Vazio />
            ) : (
              <>
                <Barras
                  itens={dados.porOrigem.map((o) => ({
                    rotulo: ORIGENS[o.origem] ?? o.origem,
                    valor: o.pessoas,
                  }))}
                />
                {dados.usamOApp.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <p className="mb-1.5 text-xs text-muted-foreground">
                      Usaram o app de Mac nos últimos 30 dias
                    </p>
                    <ul className="flex flex-col gap-1 text-sm">
                      {dados.usamOApp.map((u) => (
                        <li key={u.email} className="flex justify-between gap-3">
                          <span className="truncate">
                            {u.nome}{" "}
                            <span className="text-muted-foreground">{u.email}</span>
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {u.ultimoUso.slice(0, 10)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </Bloco>

          <Bloco
            titulo="Anexos por workspace"
            pergunta="Decide o teto de armazenamento — e é o único custo que cresce de verdade por cliente."
          >
            {dados.armazenamento.every((a) => a.megabytes === 0) ? (
              <Vazio />
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {dados.armazenamento.map((a) => (
                  <li key={a.workspace} className="flex justify-between gap-3">
                    <span className="truncate">{a.workspace}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {a.megabytes} MB
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Bloco>

          <Bloco
            titulo="Pessoas ativas por dia"
            pergunta="Decide quando ligar a cobrança: sem gente voltando, plano pago é conversa adiantada."
          >
            {dados.ativosPorDia.length === 0 ? (
              <Vazio />
            ) : (
              <div className="flex h-24 items-end gap-1">
                {dados.ativosPorDia.map((d) => (
                  <div key={d.dia} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-primary/70"
                      style={{ height: `${(d.pessoas / maiorDia) * 100}%` }}
                      title={`${d.dia}: ${d.pessoas}`}
                    />
                    <span className="text-[9px] text-muted-foreground">
                      {d.dia.slice(8)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Bloco>

          <p className="pb-4 text-xs text-muted-foreground">
            Os eventos guardam só o fato, nunca o conteúdo: que alguém abriu o
            Gantt, não o que estava nele. São apagados depois de 180 dias.
          </p>
        </div>
      </div>
    </>
  );
}

function pct(parte: number, total: number) {
  return total === 0 ? "0%" : `${Math.round((parte / total) * 100)}%`;
}

function Numero({
  titulo,
  valor,
  nota,
}: {
  titulo: string;
  valor: number;
  nota?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">{valor}</p>
      {nota && <p className="text-[11px] text-muted-foreground">{nota}</p>}
    </div>
  );
}

function Bloco({
  titulo,
  pergunta,
  children,
}: {
  titulo: string;
  pergunta: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{pergunta}</p>
      {children}
    </section>
  );
}

function Barras({ itens }: { itens: { rotulo: string; valor: number }[] }) {
  const maior = Math.max(1, ...itens.map((i) => i.valor));
  if (itens.length === 0) return <Vazio />;
  return (
    <ul className="flex flex-col gap-1.5">
      {itens.map((i) => (
        <li key={i.rotulo} className="flex items-center gap-2 text-sm">
          <span className="w-24 shrink-0 text-muted-foreground">{i.rotulo}</span>
          <span className="h-4 flex-1 overflow-hidden rounded bg-muted">
            <span
              className="block h-full rounded bg-primary/70"
              style={{ width: `${(i.valor / maior) * 100}%` }}
            />
          </span>
          <span className="w-8 text-right font-medium tabular-nums">{i.valor}</span>
        </li>
      ))}
    </ul>
  );
}

function Vazio() {
  return (
    <p className="py-4 text-center text-xs text-muted-foreground">
      Ainda sem dados suficientes.
    </p>
  );
}

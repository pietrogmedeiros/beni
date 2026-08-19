"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUpRight,
  CircleDollarSign,
  MoreHorizontal,
  Plus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ROTULO_SITUACAO,
  formatarValor,
  prazoEmPalavras,
  type Situacao,
} from "@/lib/cobrancas";
import type { Filtro, Painel, ParcelaNaLista } from "@/server/cobrancas";
import {
  arquivarCliente,
  cancelarParcela,
  encerrarCobranca,
  excluirCliente,
  excluirCobranca,
  reabrirParcela,
} from "@/server/actions/cobrancas";
import {
  DialogoAjuste,
  DialogoBaixa,
  DialogoCliente,
  DialogoCobranca,
} from "./dialogos";

/**
 * Cobranças de um projeto.
 *
 * A tela responde uma pergunta só: **quem tem que pagar por este trabalho, e
 * quando**. Por isso a lista chega ordenada por vencimento e já filtrada no
 * que está em aberto — quem abre isso está atrás do que vem agora, não do
 * histórico.
 *
 * Os quatro números do topo não seguem o filtro da lista, de propósito. Se
 * seguissem, filtrar por "pagas" zeraria o cartão de atrasado, escondendo
 * justamente o que a tela existe para mostrar.
 */

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "abertas", rotulo: "Em aberto" },
  { valor: "atrasadas", rotulo: "Atrasadas" },
  { valor: "pagas", rotulo: "Pagas" },
  { valor: "todas", rotulo: "Todas" },
];

const COR_SITUACAO: Record<Situacao, string> = {
  ATRASADO: "bg-red-500/10 text-red-600 dark:text-red-400",
  HOJE: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  A_VENCER: "bg-muted text-muted-foreground",
  PAGO: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  CANCELADO: "bg-muted text-muted-foreground line-through",
};

export function CobrancasPainel({
  dados,
  projeto,
}: {
  dados: Painel;
  projeto: { id: string; name: string; key: string };
}) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const [aba, setAba] = useState<"parcelas" | "clientes">("parcelas");

  const [novoCliente, setNovoCliente] = useState<{ id?: string } | null>(null);
  const [novaCobranca, setNovaCobranca] = useState(false);
  const [baixando, setBaixando] = useState<ParcelaNaLista | null>(null);
  const [ajustando, setAjustando] = useState<ParcelaNaLista | null>(null);

  const clientesAtivos = useMemo(
    () => dados.clientes.filter((c) => !c.arquivado),
    [dados.clientes],
  );

  function agir(promessa: Promise<{ ok: boolean; erro?: string }>, sucesso: string) {
    startTransition(async () => {
      const r = await promessa;
      if (r.ok) {
        toast.success(sucesso);
        router.refresh();
      } else {
        toast.error(r.erro ?? "Não deu certo");
      }
    });
  }

  function irPara(filtro: Filtro, clienteId: string | null) {
    const p = new URLSearchParams();
    if (filtro !== "abertas") p.set("filtro", filtro);
    if (clienteId) p.set("cliente", clienteId);
    router.push(`/p/${dados.projectId}/cobrancas${p.size ? `?${p}` : ""}`);
  }

  return (
    <>
      <PageHeader
        title="Cobranças"
        subtitle={`${projeto.name} — só você vê esta aba`}
        icon={<CircleDollarSign className="size-5 text-primary" />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNovoCliente({})}
              className="h-8"
            >
              <Users className="size-3.5" />
              Novo cliente
            </Button>
            <Button
              size="sm"
              className="h-8"
              disabled={clientesAtivos.length === 0}
              onClick={() => setNovaCobranca(true)}
            >
              <Plus className="size-3.5" />
              Nova cobrança
            </Button>
          </div>
        }
      />

      <div className="thin-scrollbar flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl space-y-5 p-5">
          {/* os quatro números que decidem a semana */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Numero
              titulo="Atrasado"
              bloco={dados.resumo.atrasado}
              tom="ruim"
              aoClicar={() => irPara("atrasadas", dados.clienteId)}
            />
            <Numero titulo="Vence em 7 dias" bloco={dados.resumo.vence7} tom="atencao" />
            <Numero titulo="A receber no mês" bloco={dados.resumo.aReceberMes} />
            <Numero titulo="Recebido no mês" bloco={dados.resumo.recebidoMes} tom="bom" />
          </div>

          {/* abas */}
          <div className="flex flex-wrap items-center gap-2 border-b pb-2">
            <div className="flex rounded-lg border p-0.5 text-xs">
              {(["parcelas", "clientes"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAba(v)}
                  className={cn(
                    "rounded-md px-2.5 py-1 capitalize transition",
                    aba === v
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>

            {aba === "parcelas" && (
              <>
                <div className="flex rounded-lg border p-0.5 text-xs">
                  {FILTROS.map((f) => (
                    <button
                      key={f.valor}
                      type="button"
                      onClick={() => irPara(f.valor, dados.clienteId)}
                      className={cn(
                        "rounded-md px-2.5 py-1 transition",
                        dados.filtro === f.valor
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {f.rotulo}
                    </button>
                  ))}
                </div>

                <Select
                  value={dados.clienteId ?? "TODOS"}
                  onValueChange={(v) =>
                    v && irPara(dados.filtro, v === "TODOS" ? null : v)
                  }
                  items={{
                    TODOS: "Todos os clientes",
                    ...Object.fromEntries(dados.clientes.map((c) => [c.id, c.nome])),
                  }}
                >
                  <SelectTrigger className="h-8 w-48 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos os clientes</SelectItem>
                    {dados.clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {aba === "parcelas" ? (
            <ListaParcelas
              dados={dados}
              pendente={pendente}
              aoReceber={setBaixando}
              aoAjustar={setAjustando}
              aoAgir={agir}
              semClientes={dados.clientes.length === 0}
              aoCriarCliente={() => setNovoCliente({})}
            />
          ) : (
            <ListaClientes
              dados={dados}
              aoEditar={(id) => setNovoCliente({ id })}
              aoAgir={agir}
              aoVerParcelas={(id) => {
                setAba("parcelas");
                irPara("abertas", id);
              }}
            />
          )}
        </div>
      </div>

      {novoCliente && (
        <DialogoCliente
          open
          onOpenChange={(v) => !v && setNovoCliente(null)}
          cliente={
            novoCliente.id
              ? (dados.clientes.find((c) => c.id === novoCliente.id) ?? null)
              : null
          }
        />
      )}
      {novaCobranca && (
        <DialogoCobranca
          open
          onOpenChange={setNovaCobranca}
          clientes={clientesAtivos}
          projectId={dados.projectId}
        />
      )}
      {ajustando && (
        <DialogoAjuste
          open
          onOpenChange={(v) => !v && setAjustando(null)}
          parcela={ajustando}
        />
      )}
      {baixando && (
        <DialogoBaixa
          open
          onOpenChange={(v) => !v && setBaixando(null)}
          parcela={baixando}
          hoje={dados.hoje}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Numero({
  titulo,
  bloco,
  tom,
  aoClicar,
}: {
  titulo: string;
  bloco: { centavos: number; qtd: number };
  tom?: "ruim" | "atencao" | "bom";
  aoClicar?: () => void;
}) {
  const cor =
    tom === "ruim" && bloco.centavos > 0
      ? "text-red-600 dark:text-red-400"
      : tom === "bom"
        ? "text-emerald-600 dark:text-emerald-400"
        : tom === "atencao" && bloco.centavos > 0
          ? "text-amber-600 dark:text-amber-400"
          : "text-foreground";

  const conteudo = (
    <>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", cor)}>
        {formatarValor(bloco.centavos)}
      </p>
      <p className="text-xs text-muted-foreground">
        {bloco.qtd === 0
          ? "nenhuma parcela"
          : `${bloco.qtd} parcela${bloco.qtd > 1 ? "s" : ""}`}
      </p>
    </>
  );

  return aoClicar ? (
    <button
      type="button"
      onClick={aoClicar}
      className="rounded-xl border p-3 text-left transition hover:border-primary/40 hover:bg-muted/30"
    >
      {conteudo}
    </button>
  ) : (
    <div className="rounded-xl border p-3">{conteudo}</div>
  );
}

function ListaParcelas({
  dados,
  pendente,
  aoReceber,
  aoAjustar,
  aoAgir,
  semClientes,
  aoCriarCliente,
}: {
  dados: Painel;
  pendente: boolean;
  aoReceber: (p: ParcelaNaLista) => void;
  aoAjustar: (p: ParcelaNaLista) => void;
  aoAgir: (p: Promise<{ ok: boolean; erro?: string }>, s: string) => void;
  semClientes: boolean;
  aoCriarCliente: () => void;
}) {
  if (dados.parcelas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="text-sm text-muted-foreground">
          {semClientes
            ? "Comece cadastrando um cliente — depois a cobrança dele."
            : dados.filtro === "abertas"
              ? "Nada em aberto. Tudo em dia."
              : "Nada por aqui com esse filtro."}
        </p>
        {semClientes && (
          <Button size="sm" className="mt-3" onClick={aoCriarCliente}>
            <Users className="size-3.5" />
            Cadastrar cliente
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      {dados.parcelas.map((p, i) => (
        <div
          key={p.id}
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm",
            i > 0 && "border-t",
            p.situacao === "ATRASADO" && "bg-red-500/[0.03]",
          )}
        >
          {/* vencimento */}
          <div className="w-28 shrink-0">
            <p className="font-medium tabular-nums">{formatarDia(p.vencimento)}</p>
            <p className="text-xs text-muted-foreground">
              {p.situacao === "PAGO" && p.pagoEm
                ? `pago ${formatarDia(p.pagoEm)}`
                : prazoEmPalavras(p.vencimento, new Date(`${dados.hoje}T00:00:00Z`))}
            </p>
          </div>

          {/* quem e o quê */}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{p.clienteNome}</p>
            <p className="truncate text-xs text-muted-foreground">
              {p.cobrancaTitulo}
              {p.cobrancaTipo === "PARCELADO" && p.parcelasTotal
                ? ` · ${p.numero}/${p.parcelasTotal}`
                : p.cobrancaTipo === "MENSAL"
                  ? " · mensalidade"
                  : ""}

            </p>
          </div>

          {/* situação */}
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
              COR_SITUACAO[p.situacao],
            )}
          >
            {ROTULO_SITUACAO[p.situacao]}
          </span>

          {/* valor */}
          <div className="w-28 shrink-0 text-right">
            <p className="font-semibold tabular-nums">
              {formatarValor(p.valorCentavos)}
            </p>
            {p.valorPagoCentavos != null &&
              p.valorPagoCentavos !== p.valorCentavos && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  entrou {formatarValor(p.valorPagoCentavos)}
                </p>
              )}
          </div>

          {/* ações */}
          <div className="flex shrink-0 items-center gap-1">
            {p.status === "PENDENTE" ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={pendente}
                onClick={() => aoReceber(p)}
              >
                Receber
              </Button>
            ) : p.status === "PAGO" ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground"
                disabled={pendente}
                onClick={() => aoAgir(reabrirParcela(p.id), "Parcela reaberta")}
              >
                Reabrir
              </Button>
            ) : null}

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button size="icon" variant="ghost" className="size-7">
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => aoAjustar(p)}>
                  Ajustar data e valor
                </DropdownMenuItem>
                {p.status === "PENDENTE" && (
                  <DropdownMenuItem
                    onClick={() =>
                      aoAgir(cancelarParcela(p.id, true), "Parcela cancelada")
                    }
                  >
                    Cancelar parcela
                  </DropdownMenuItem>
                )}
                {p.status === "CANCELADO" && (
                  <DropdownMenuItem
                    onClick={() =>
                      aoAgir(cancelarParcela(p.id, false), "Parcela reativada")
                    }
                  >
                    Reativar parcela
                  </DropdownMenuItem>
                )}
                {p.cobrancaTipo === "MENSAL" && (
                  <DropdownMenuItem
                    onClick={() =>
                      aoAgir(
                        encerrarCobranca(p.cobrancaId, true),
                        "Mensalidade encerrada — o que já venceu continua aqui",
                      )
                    }
                  >
                    Encerrar mensalidade
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() =>
                    aoAgir(excluirCobranca(p.cobrancaId), "Cobrança excluída")
                  }
                >
                  Excluir a cobrança inteira
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  );
}

function ListaClientes({
  dados,
  aoEditar,
  aoAgir,
  aoVerParcelas,
}: {
  dados: Painel;
  aoEditar: (id: string) => void;
  aoAgir: (p: Promise<{ ok: boolean; erro?: string }>, s: string) => void;
  aoVerParcelas: (id: string) => void;
}) {
  if (dados.clientes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Nenhum cliente ainda.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      {dados.clientes.map((c, i) => (
        <div
          key={c.id}
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm",
            i > 0 && "border-t",
            c.arquivado && "opacity-55",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {c.nome}
              {c.arquivado && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  arquivado
                </span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {[c.contato, c.documento].filter(Boolean).join(" · ") || "sem contato"}
            </p>
          </div>

          <div className="w-32 shrink-0 text-right">
            <p className="font-semibold tabular-nums">
              {formatarValor(c.emAbertoCentavos)}
            </p>
            <p className="text-xs text-muted-foreground">em aberto</p>
          </div>

          {c.atrasadoCentavos > 0 && (
            <span className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
              {formatarValor(c.atrasadoCentavos)} atrasado
            </span>
          )}

          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => aoVerParcelas(c.id)}
            >
              Parcelas
              <ArrowUpRight className="size-3" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button size="icon" variant="ghost" className="size-7">
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => aoEditar(c.id)}>
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    aoAgir(
                      arquivarCliente(c.id, !c.arquivado),
                      c.arquivado ? "Cliente reativado" : "Cliente arquivado",
                    )
                  }
                >
                  {c.arquivado ? "Reativar" : "Arquivar"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => aoAgir(excluirCliente(c.id), "Cliente excluído")}
                >
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  );
}

/** "2026-08-25" -> "25/08". O ano só aparece quando não é o corrente. */
function formatarDia(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  const atual = String(new Date().getUTCFullYear());
  return ano === atual ? `${dia}/${mes}` : `${dia}/${mes}/${ano.slice(2)}`;
}

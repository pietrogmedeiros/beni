"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CADENCIAS,
  ROTULO_TIPO,
  formatarValor,
  lerValor,
  planoDeParcelas,
  valorParaCampo,
} from "@/lib/cobrancas";
import {
  ajustarParcela,
  criarCobranca,
  marcarPago,
  salvarCliente,
} from "@/server/actions/cobrancas";
import type { ClienteNaLista, ParcelaNaLista } from "@/server/cobrancas";

/* -------------------------------------------------------------------------- */
/* Cliente                                                                     */
/* -------------------------------------------------------------------------- */

export function DialogoCliente({
  open,
  onOpenChange,
  cliente,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente: ClienteNaLista | null;
}) {
  const router = useRouter();
  const [salvando, start] = useTransition();
  const [nome, setNome] = useState(cliente?.nome ?? "");
  const [contato, setContato] = useState(cliente?.contato ?? "");
  const [documento, setDocumento] = useState(cliente?.documento ?? "");
  const [observacao, setObservacao] = useState(cliente?.observacao ?? "");

  function salvar() {
    start(async () => {
      const r = await salvarCliente({
        id: cliente?.id,
        nome,
        contato,
        documento,
        observacao,
      });
      if (r.ok) {
        toast.success(cliente ? "Cliente atualizado" : "Cliente cadastrado");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(r.erro);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            Só o nome é obrigatório. O resto é o que ajuda na hora de cobrar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Campo rotulo="Nome">
            <Input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do cliente ou da empresa"
            />
          </Campo>
          <Campo rotulo="Contato" dica="e-mail, telefone, o que você usa para cobrar">
            <Input
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              placeholder="financeiro@cliente.com"
            />
          </Campo>
          <Campo rotulo="Documento" dica="CNPJ ou CPF, se precisar emitir nota">
            <Input
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
            />
          </Campo>
          <Campo rotulo="Observação">
            <Textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Combinados, prazo de pagamento, quem aprova…"
            />
          </Campo>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || !nome.trim()}>
            {salvando && <Loader2 className="size-3.5 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Cobrança                                                                    */
/* -------------------------------------------------------------------------- */

export function DialogoCobranca({
  open,
  onOpenChange,
  clientes,
  projectId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientes: ClienteNaLista[];
  /** A cobrança nasce dentro deste projeto — não há escolha a fazer. */
  projectId: string;
}) {
  const router = useRouter();
  const [salvando, start] = useTransition();

  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? "");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<"PARCELADO" | "MENSAL" | "AVULSO">("PARCELADO");
  const [valor, setValor] = useState("");
  const [parcelas, setParcelas] = useState("3");
  const [cadencia, setCadencia] = useState("MES");
  const [diasCustom, setDiasCustom] = useState("15");
  const [vencimento, setVencimento] = useState(() => proximoDia30());
  const [observacao, setObservacao] = useState("");

  const centavos = lerValor(valor);
  const qtd = Number(parcelas) || 0;

  const intervaloDias =
    cadencia === "PERSONALIZADO"
      ? Number(diasCustom) || null
      : (CADENCIAS.find((c) => c.valor === cadencia)?.dias ?? null);

  /**
   * Prévia do que vai ser criado.
   *
   * Usa exatamente a mesma função da geração no servidor — se a prévia mostra
   * "28/02", é 28/02 que entra no banco. Prévia calculada por outro caminho
   * mente cedo ou tarde.
   */
  const previa = useMemo(() => {
    if (!centavos || centavos <= 0 || !vencimento) return [];
    try {
      return planoDeParcelas({
        tipo,
        valorCentavos: centavos,
        parcelasTotal: tipo === "PARCELADO" ? qtd : null,
        primeiroVencimento: `${vencimento}T00:00:00Z`,
        diaVencimento: null,
        intervaloDias,
      }).slice(0, 4);
    } catch {
      return [];
    }
  }, [tipo, centavos, qtd, vencimento, intervaloDias]);

  const totalParcelado =
    tipo === "PARCELADO" && centavos ? centavos : null;

  function salvar() {
    if (!centavos || centavos <= 0) {
      toast.error("Informe o valor");
      return;
    }
    start(async () => {
      const r = await criarCobranca({
        clienteId,
        titulo,
        tipo,
        valorCentavos: centavos,
        parcelasTotal: tipo === "PARCELADO" ? qtd : null,
        intervaloDias: tipo === "PARCELADO" ? intervaloDias : null,
        primeiroVencimento: vencimento,
        diaVencimento: null,
        projectId,
        observacao,
      });
      if (r.ok) {
        toast.success("Cobrança criada");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(r.erro);
      }
    });
  }

  const nomesClientes = Object.fromEntries(clientes.map((c) => [c.id, c.nome]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova cobrança</DialogTitle>
          <DialogDescription>
            As parcelas são criadas na hora, já com as datas certas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Cliente">
              <Select
                value={clienteId}
                onValueChange={(v) => v && setClienteId(v)}
                items={nomesClientes}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo rotulo="Tipo">
              <Select
                value={tipo}
                onValueChange={(v) => v && setTipo(v as typeof tipo)}
                items={ROTULO_TIPO}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PARCELADO">Parcelado</SelectItem>
                  <SelectItem value="MENSAL">Mensalidade</SelectItem>
                  <SelectItem value="AVULSO">Avulso</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
          </div>

          <Campo rotulo="Descrição">
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Site institucional, sustentação mensal…"
            />
          </Campo>

          <div className="grid gap-3 sm:grid-cols-3">
            <Campo
              rotulo={
                tipo === "PARCELADO"
                  ? "Valor total"
                  : tipo === "MENSAL"
                    ? "Valor mensal"
                    : "Valor"
              }
            >
              <Input
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
            </Campo>

            {tipo === "PARCELADO" && (
              <Campo rotulo="Parcelas">
                <Input
                  inputMode="numeric"
                  value={parcelas}
                  onChange={(e) => setParcelas(e.target.value.replace(/\D/g, ""))}
                />
              </Campo>
            )}

            <Campo
              rotulo={tipo === "AVULSO" ? "Vencimento" : "1º vencimento"}
              className={tipo === "PARCELADO" ? "" : "sm:col-span-2"}
            >
              <Input
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
              />
            </Campo>
          </div>


          {tipo === "PARCELADO" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo
                rotulo="A cada"
                dica="mês respeita o dia combinado; dias contam corrido"
                className="sm:col-span-2"
              >
                <Select
                  value={cadencia}
                  onValueChange={(v) => v && setCadencia(v)}
                  items={Object.fromEntries(CADENCIAS.map((c) => [c.valor, c.rotulo]))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CADENCIAS.map((c) => (
                      <SelectItem key={c.valor} value={c.valor}>
                        {c.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>

              {cadencia === "PERSONALIZADO" && (
                <Campo rotulo="Dias">
                  <Input
                    inputMode="numeric"
                    value={diasCustom}
                    onChange={(e) => setDiasCustom(e.target.value.replace(/\D/g, ""))}
                  />
                </Campo>
              )}
            </div>
          )}

          <Campo rotulo="Observação">
            <Textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </Campo>

          {previa.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-2.5 text-xs">
              <p className="mb-1 font-medium">
                {tipo === "MENSAL"
                  ? "Vai gerar todo mês, a partir de:"
                  : `Vai gerar ${tipo === "PARCELADO" ? qtd : 1} parcela${qtd > 1 && tipo === "PARCELADO" ? "s" : ""}:`}
              </p>
              <ul className="space-y-0.5 text-muted-foreground">
                {previa.map((p) => (
                  <li key={p.numero} className="flex justify-between tabular-nums">
                    <span>
                      {p.numero}ª · {p.vencimento.toISOString().slice(0, 10).split("-").reverse().join("/")}
                    </span>
                    <span>{formatarValor(p.valorCentavos)}</span>
                  </li>
                ))}
                {tipo === "MENSAL" && <li>…e assim por diante</li>}
                {tipo === "PARCELADO" && qtd > 4 && (
                  <li>…mais {qtd - 4}, somando {formatarValor(totalParcelado ?? 0)}</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={salvar}
            disabled={salvando || !titulo.trim() || !clienteId || !centavos}
          >
            {salvando && <Loader2 className="size-3.5 animate-spin" />}
            Criar cobrança
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Baixa                                                                       */
/* -------------------------------------------------------------------------- */

export function DialogoBaixa({
  open,
  onOpenChange,
  parcela,
  hoje,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  parcela: ParcelaNaLista;
  hoje: string;
}) {
  const router = useRouter();
  const [salvando, start] = useTransition();
  const [data, setData] = useState(hoje);
  const [valor, setValor] = useState(valorParaCampo(parcela.valorCentavos));

  useEffect(() => {
    // sincroniza com a parcela que abriu o diálogo
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(hoje);
    setValor(valorParaCampo(parcela.valorCentavos));
  }, [parcela.id, parcela.valorCentavos, hoje]);

  const centavos = lerValor(valor);
  const diferente = centavos != null && centavos !== parcela.valorCentavos;

  function receber() {
    start(async () => {
      const r = await marcarPago({
        parcelaId: parcela.id,
        pagoEm: data,
        // guarda o valor pago só quando ele diverge do combinado — igual não
        // acrescenta informação nenhuma
        valorPagoCentavos: diferente ? centavos : null,
      });
      if (r.ok) {
        toast.success("Recebimento registrado");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(r.erro);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar recebimento</DialogTitle>
          <DialogDescription>
            {parcela.clienteNome} · {parcela.cobrancaTitulo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Campo rotulo="Recebido em">
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </Campo>
          <Campo
            rotulo="Valor que entrou"
            dica={
              diferente
                ? `combinado era ${formatarValor(parcela.valorCentavos)}`
                : undefined
            }
          >
            <Input
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </Campo>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={receber} disabled={salvando || centavos == null}>
            {salvando && <Loader2 className="size-3.5 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */

function Campo({
  rotulo,
  dica,
  className,
  children,
}: {
  rotulo: string;
  dica?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs text-muted-foreground">{rotulo}</Label>
      {children}
      {dica && <p className="mt-1 text-[11px] text-muted-foreground">{dica}</p>}
    </div>
  );
}

/** Sugestão de primeiro vencimento: daqui a 30 dias, que é o combinado padrão. */
function proximoDia30() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/* Ajuste de uma parcela                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Muda data, valor e observação de **uma** parcela.
 *
 * É a saída para o que nenhuma cadência resolve: o cliente que pediu para
 * empurrar a terceira parcela, o desconto combinado só naquela, a entrada
 * maior. Sem isto, qualquer combinado fora do padrão obrigaria a apagar a
 * cobrança e refazer — e refazer perde o que já foi pago.
 */
export function DialogoAjuste({
  open,
  onOpenChange,
  parcela,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  parcela: ParcelaNaLista;
}) {
  const router = useRouter();
  const [salvando, start] = useTransition();
  const [vencimento, setVencimento] = useState(parcela.vencimento);
  const [valor, setValor] = useState(valorParaCampo(parcela.valorCentavos));
  const [observacao, setObservacao] = useState(parcela.observacao ?? "");

  useEffect(() => {
    // sincroniza com a parcela que abriu o diálogo
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVencimento(parcela.vencimento);
    setValor(valorParaCampo(parcela.valorCentavos));
    setObservacao(parcela.observacao ?? "");
  }, [parcela.id, parcela.vencimento, parcela.valorCentavos, parcela.observacao]);

  const centavos = lerValor(valor);

  function salvar() {
    if (!centavos || centavos <= 0) {
      toast.error("Informe o valor");
      return;
    }
    start(async () => {
      const r = await ajustarParcela({
        parcelaId: parcela.id,
        vencimento,
        valorCentavos: centavos,
        observacao,
      });
      if (r.ok) {
        toast.success("Parcela ajustada");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(r.erro);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Ajustar parcela {parcela.numero}
            {parcela.parcelasTotal ? `/${parcela.parcelasTotal}` : ""}
          </DialogTitle>
          <DialogDescription>
            {parcela.clienteNome} · {parcela.cobrancaTitulo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Campo rotulo="Vencimento">
            <Input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
            />
          </Campo>
          <Campo
            rotulo="Valor"
            dica="mexe só nesta parcela; as outras ficam como estão"
          >
            <Input
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </Campo>
          <Campo rotulo="Observação">
            <Input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Adiada a pedido do cliente…"
            />
          </Campo>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || !centavos}>
            {salvando && <Loader2 className="size-3.5 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

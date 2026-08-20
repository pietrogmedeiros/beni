import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Apple,
  CalendarDays,
  Check,
  GanttChartSquare,
  GitBranch,
  KanbanSquare,
  Layers,
  Link2,
  List,
  MessageSquare,
  NotebookPen,
  Plus,
  PieChart,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { BeniLogo, BeniMascote } from "@/components/logo";
import { DOWNLOAD_MAC } from "@/lib/constants";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import "./efeitos.css";

/**
 * Página de apresentação do Beni.
 *
 * Fica fora do grupo `(app)` de propósito: quem chega aqui não tem conta, e
 * herdar a casca do aplicativo traria barra lateral, busca e atalhos que não
 * levam a lugar nenhum. Precisa também estar em `OPEN_PATHS` no `proxy.ts`,
 * senão o visitante é mandado para o login antes de ler a primeira linha.
 *
 * As telas são **capturas reais** do app, geradas por
 * `~/frete-scraper/_beni_capturas.mjs` com os dados de demonstração. Descrever
 * recurso em cartão de texto é barato e não convence; mostrar a tela convence
 * e envelhece junto com o produto, que é o preço certo a pagar. O script
 * esconde a aba de Cobranças antes de capturar: é área de administrador e não
 * entra em página pública.
 *
 * Tudo é renderizado no servidor e não há JavaScript próprio. A página não tem
 * estado, e script só para animar rolagem custaria mais do que entrega num
 * servidor de CPU compartilhada a 220 ms de distância.
 */

const TITULO = "Beni: do backlog à aprovação do cliente";
const RESUMO =
  "Gerenciador de projetos com sete visões da mesma tarefa, anotações e conversas junto do trabalho, e aprovação do cliente por link, sem conta.";

export const metadata: Metadata = {
  // `absolute` porque o layout raiz acrescenta " · Beni" a todo título, e o
  // nome já está aqui dentro: sem isto a aba vira "Beni ... · Beni"
  title: { absolute: TITULO },
  description: RESUMO,
  openGraph: {
    title: TITULO,
    description: RESUMO,
    type: "website",
    siteName: "Beni",
  },
  twitter: { card: "summary_large_image", title: TITULO, description: RESUMO },
};

const VISOES = [
  { icon: List, nome: "Lista" },
  { icon: KanbanSquare, nome: "Quadro" },
  { icon: GanttChartSquare, nome: "Gantt" },
  { icon: Layers, nome: "Backlog" },
  { icon: CalendarDays, nome: "Calendário" },
  { icon: PieChart, nome: "Painel" },
  { icon: NotebookPen, nome: "Anotações" },
];

const ETAPAS = [
  {
    numero: "01",
    titulo: "Quadro",
    nota: "As colunas do time, do backlog ao revisado. Arrasta o cartão e o status muda para todo mundo.",
    captura: "quadro",
    alt: "Quadro kanban de um projeto no Beni",
  },
  {
    numero: "02",
    titulo: "Gantt",
    nota: "A linha do tempo do projeto, com o que trava o quê. Dá para mandar um link de leitura a quem só quer acompanhar o prazo.",
    captura: "gantt",
    alt: "Gráfico de Gantt de um projeto no Beni",
  },
  {
    numero: "03",
    titulo: "Lista",
    nota: "Para quem executa: tudo em ordem, editável na própria linha, agrupado do jeito que fizer sentido no dia.",
    captura: "lista",
    alt: "Visão de lista de tarefas no Beni",
  },
  {
    numero: "04",
    titulo: "Painel",
    nota: "Onde o projeto está agora, sem alguém precisar montar relatório na véspera da reunião.",
    captura: "painel",
    alt: "Painel com o andamento do projeto no Beni",
  },
];

const PASSOS = [
  "Pedido criado na tarefa",
  "Cliente abriu o link",
  "Leu o que precisa validar",
  "Aprovou",
];

const FERRAMENTAS_MCP = [
  "beni_meu_dia",
  "beni_tarefas",
  "beni_criar_tarefa",
  "beni_atualizar_tarefa",
  "beni_buscar",
  "beni_comentar",
  "beni_projetos",
  "beni_criar_tarefas_em_massa",
];


export default function PaginaDoBeni() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <Cabecalho />
      <main className="flex-1">
        <Hero />
        <Retrato />
        <DoisModos />
        <Problema />
        <Visoes />
        <EmMassa />
        <FluxoDeAprovacao />
        <ConectorDoClaude />
        <EscritaEConversa />
        <Fragmentos />
        <AppDeMac />
        <Perguntas />
        <ChamadaFinal />
      </main>
      <Rodape />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Cabecalho() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-5">
        <BeniLogo />
        <nav className="ml-auto flex items-center gap-1 sm:gap-3">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-105"
          >
            Criar conta
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 h-[28rem] bg-[radial-gradient(45rem_22rem_at_50%_0%,var(--color-primary)/0.18,transparent)]"
      />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-10 pt-16 sm:pt-24 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary-strong">
            <Sparkles className="size-3.5" />
            Em construção, e de graça enquanto estiver
          </span>

          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            Do backlog à{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative z-10">aprovação do cliente</span>
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-1 z-0 h-3 rounded-sm bg-primary/35"
              />
            </span>
            , num lugar só.
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Serve para o projeto que é só do time e para o que tem cliente
            esperando aprovação. Tarefas, decisões e conversas no mesmo lugar,
            sete jeitos de olhar a mesma tarefa, e quando chega a validação o
            cliente aprova por um link, sem criar conta e sem ver a sua cozinha.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-105"
            >
              Criar conta grátis
              <ArrowRight className="size-4" />
            </Link>
            <a
              href={DOWNLOAD_MAC}
              className="inline-flex items-center gap-2 rounded-xl border bg-card px-5 py-3 text-sm font-semibold transition hover:bg-muted/60"
            >
              <Apple className="size-4" />
              Baixar para Mac
            </a>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Sem cartão. O app de Mac é assinado e reconhecido pela Apple.
          </p>
        </div>

        <div className="relative flex justify-center lg:justify-end">
          <div
            aria-hidden
            className="absolute inset-0 m-auto size-56 rounded-full bg-primary/15 blur-3xl sm:size-72"
          />
          <BeniMascote
            pose="beni"
            className="flutua relative w-44 drop-shadow-xl sm:w-56 lg:w-60"
          />
        </div>
      </div>
    </section>
  );
}

/** A tela do produto logo abaixo da chamada: prova antes de qualquer promessa. */
function Retrato() {
  return (
    <section className="relative">
      <div className="mx-auto w-full max-w-6xl px-5 pb-16 sm:pb-20">
        <div className="levantar">
          <Moldura
            src="quadro"
            alt="Quadro kanban de um projeto no Beni"
            prioridade
          />
        </div>
      </div>
    </section>
  );
}

/**
 * Moldura das capturas.
 *
 * `img` simples, e não `next/image`: o otimizador reprocessaria a imagem a cada
 * tamanho pedido, e num servidor de CPU compartilhada isso é trabalho repetido
 * para entregar sempre o mesmo arquivo. As medidas ficam no atributo para o
 * navegador reservar o espaço e a página não pular ao carregar.
 */
function Moldura({
  src,
  alt,
  prioridade = false,
  className,
}: {
  src: string;
  alt: string;
  prioridade?: boolean;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "moldura overflow-hidden rounded-2xl border bg-card shadow-lg shadow-black/5",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-2">
        <span className="size-2.5 rounded-full bg-red-400/70" />
        <span className="size-2.5 rounded-full bg-amber-400/70" />
        <span className="size-2.5 rounded-full bg-emerald-400/70" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBase(`/pagina/${src}.webp`)}
        alt={alt}
        width={2400}
        height={1467}
        loading={prioridade ? "eager" : "lazy"}
        className="block w-full"
      />
    </figure>
  );
}

function Secao({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("border-t border-border/60", className)}>
      <div className="revelar mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
        {children}
      </div>
    </section>
  );
}

function Titulo({
  sobre,
  children,
  descricao,
}: {
  sobre: string;
  children: React.ReactNode;
  descricao?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary-strong">
        {sobre}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        {children}
      </h2>
      {descricao && (
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          {descricao}
        </p>
      )}
    </div>
  );
}

/**
 * As quatro visões que se sucedem no palco.
 *
 * O desenho é o mesmo nos dois mundos: cada etapa é um bloco com texto de um
 * lado e captura do outro. Sem animação de rolagem, os quatro ficam
 * empilhados e a seção vira uma lista de recursos comum, completa e legível.
 * Com animação, eles passam a ocupar o mesmo lugar e trocam conforme se rola.
 * É a mesma marcação servindo aos dois casos, e é por isso que a falta de
 * suporte não deixa buraco.
 */
function Visoes() {
  return (
    <section className="border-t border-border/60">
      <div className="mx-auto w-full max-w-6xl px-5 pt-16 sm:pt-20">
        <div className="revelar">
          <Titulo
            sobre="Uma tarefa, sete ângulos"
            descricao="A mesma informação, apresentada como cada pessoa precisa ver. Quem executa quer a lista, quem coordena quer o Gantt, quem cobra quer o painel. Ninguém precisa manter duas ferramentas em dia."
          >
            Trocar de visão não é trocar de ferramenta
          </Titulo>
        </div>

        <div className="cascata mt-8 flex flex-wrap gap-2">
          {VISOES.map((v) => (
            <span
              key={v.nome}
              className="etiqueta inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium"
            >
              <v.icon className="size-4 text-primary-strong" />
              {v.nome}
            </span>
          ))}
        </div>
      </div>

      <div className="palco">
        <div className="palco-fixo">
          <div className="mx-auto w-full max-w-6xl px-5 py-12">
            <div className="flex gap-6 sm:gap-8">
              {/* trilho de progresso: existe só quando o palco existe */}
              <div className="palco-trilho relative w-0.5 shrink-0 overflow-hidden rounded-full bg-border">
                <span className="palco-progresso absolute inset-x-0 top-0 h-full rounded-full bg-primary" />
              </div>

              <div className="palco-pilha min-w-0 flex-1">
                {ETAPAS.map((e) => (
                  <div key={e.captura} className="palco-etapa">
                    <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,0.85fr)_1.6fr] lg:gap-10">
                      <div>
                        <p className="font-mono text-xs text-primary-strong">
                          {e.numero}
                        </p>
                        <p className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
                          {e.titulo}
                        </p>
                        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                          {e.nota}
                        </p>
                      </div>
                      <Moldura src={e.captura} alt={e.alt} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Para dentro e para fora.
 *
 * Vem logo depois da primeira tela porque a chamada fala em aprovação do
 * cliente, e sozinha ela estreita: quem toca produto interno leria "isto é
 * para agência" e sairia. A distinção real é pequena, e é essa a mensagem: o
 * projeto é o mesmo, o que muda é mandar ou não um link para fora.
 */
function DoisModos() {
  return (
    <Secao>
      <div className="revelar mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Serve para o time e serve para o cliente
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          É o mesmo projeto nos dois casos. O que muda é você mandar um link
          para fora ou não.
        </p>
      </div>

      <div className="cascata mt-10 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary-strong">
            <Users className="size-5" />
          </span>
          <p className="mt-4 font-semibold">Projeto interno</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Roadmap de produto, sprint da engenharia, plano de marketing, mudança
            de processo. Só quem é do workspace entra, e ninguém precisa saber
            que existe cliente nenhum.
          </p>
          <ul className="mt-4 space-y-2">
            {[
              "Sprints, backlog e dependências entre tarefas",
              "Conversas por canal e anotações no projeto",
              "Painel com o andamento, sem montar relatório",
            ].map((t) => (
              <li key={t} className="flex gap-2.5 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary-strong" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-6">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/25 text-primary-strong">
            <Link2 className="size-5" />
          </span>
          <p className="mt-4 font-semibold">Projeto com cliente</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Tudo do interno, mais o caminho para fora. O cliente participa do
            que precisa participar, aprova o que precisa aprovar, e para por aí.
          </p>
          <ul className="mt-4 space-y-2">
            {[
              "Link de aprovação, sem conta e sem convite",
              "Gantt compartilhado para acompanhar o prazo",
              "A discussão interna continua interna",
            ].map((t) => (
              <li key={t} className="flex gap-2.5 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary-strong" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Secao>
  );
}

/**
 * A dor, antes do remédio.
 *
 * Vem logo depois da primeira tela do produto e antes dos recursos: quem chega
 * numa página de ferramenta já usa alguma coisa, e só troca se reconhecer o
 * próprio incômodo primeiro. Sem esta seção a página vira lista de recursos
 * sem motivo.
 */
function Problema() {
  return (
    <Secao className="bg-muted/30">
      <div className="revelar mx-auto max-w-3xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Tocar projeto é mais difícil do que devia ser
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Não é falta de ferramenta. É ferramenta demais, e o combinado
          espalhado entre elas, tanto dentro do time quanto com quem está de
          fora.
        </p>
      </div>

      <div className="cascata mt-10 grid gap-3 sm:grid-cols-2">
        {[
          {
            dor: "O quadro está numa ferramenta, a ata noutra, e a conversa no WhatsApp.",
            jeito: "Tarefa, anotação e conversa no mesmo projeto.",
          },
          {
            dor: "Para o cliente aprovar, alguém monta um PDF e manda por e-mail.",
            jeito: "Um link. Ele abre, lê e aprova, sem conta.",
          },
          {
            dor: "O cliente pede acesso e passa a ver discussão interna do time.",
            jeito: "O link mostra só o que ele precisa validar.",
          },
          {
            dor: "Na véspera da reunião alguém para tudo para montar relatório.",
            jeito: "O painel do projeto já está pronto.",
          },
        ].map((i) => (
          <div key={i.dor} className="rounded-2xl border bg-card p-5">
            <p className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
              <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" />
              <span>{i.dor}</span>
            </p>
            <p className="mt-3 flex gap-2.5 text-sm font-medium leading-relaxed">
              <Check className="mt-0.5 size-4 shrink-0 text-primary-strong" />
              <span>{i.jeito}</span>
            </p>
          </div>
        ))}
      </div>
    </Secao>
  );
}

/**
 * Criação em massa.
 *
 * É a funcionalidade que mais economiza tempo no dia a dia e a que menos se
 * descobre sozinho, então ganha seção própria e mostra o texto de entrada ao
 * lado do resultado. Explicar "cria várias tarefas de uma vez" não diz nada;
 * ver a linha virar tarefa com prazo e responsável diz tudo.
 */
function EmMassa() {
  return (
    <Secao>
      <div className="revelar">
        <Titulo
          sobre="Criação em massa"
          descricao="Cole a ata da reunião, a lista do cliente ou o checklist que já estava no seu bloco de notas. Uma tarefa por linha, e o Beni lê prioridade, responsável, tipo, prazo, estimativa e pontos direto do texto."
        >
          A reunião acabou com trinta tarefas. Cole e pronto.
        </Titulo>
      </div>

      <div className="mt-10 grid items-stretch gap-4 lg:grid-cols-2">
        <div className="revelar rounded-2xl border bg-neutral-900 p-5 font-mono text-[12.5px] leading-relaxed text-neutral-300">
          <p className="mb-3 font-sans text-[11px] uppercase tracking-wider text-neutral-500">
            O que você cola
          </p>
          <p>
            Corrigir login quebrado <span className="text-primary">!alta</span>{" "}
            <span className="text-sky-400">@ana</span>{" "}
            <span className="text-rose-400">#bug</span>{" "}
            <span className="text-emerald-400">14/08</span>{" "}
            <span className="text-neutral-500">~3h *5</span>
          </p>
          <p className="pl-4 text-neutral-500">- Reproduzir o erro</p>
          <p className="pl-4 text-neutral-500">- Escrever teste de regressão</p>
          <p className="mt-2">
            Refatorar cabeçalho <span className="text-primary">!baixa</span>{" "}
            <span className="text-emerald-400">sexta</span>
          </p>
          <p className="mt-2">
            Revisar textos da home <span className="text-sky-400">@caio</span>
          </p>
        </div>

        <div className="revelar rounded-2xl border bg-card p-5">
          <p className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            O que ele mostra antes de criar
          </p>
          <div className="space-y-2.5">
            {[
              {
                titulo: "Corrigir login quebrado",
                marcas: ["Alta", "Ana", "Bug", "14/08", "3h", "5 pts"],
                sub: "2 subtarefas",
              },
              { titulo: "Refatorar cabeçalho", marcas: ["Baixa", "sexta"], sub: null },
              { titulo: "Revisar textos da home", marcas: ["Caio"], sub: null },
            ].map((t) => (
              <div key={t.titulo} className="rounded-xl border bg-background p-3">
                <p className="text-sm font-medium">{t.titulo}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {t.marcas.map((m) => (
                    <span
                      key={m}
                      className="rounded-md bg-primary/12 px-1.5 py-0.5 text-[10.5px] font-medium text-primary-strong"
                    >
                      {m}
                    </span>
                  ))}
                  {t.sub && (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
                      {t.sub}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="cascata mt-6 grid gap-3 sm:grid-cols-3">
        {[
          {
            t: "Linha indentada vira subtarefa",
            n: "Marcador de lista e numeração são descartados, então ata de reunião e checklist de Markdown entram sem limpeza.",
          },
          {
            t: "Sem modelo de linguagem",
            n: "As regras são fixas: o mesmo texto dá sempre o mesmo resultado, e não existe a chance de inventar uma tarefa que ninguém escreveu.",
          },
          {
            t: "Você confere antes",
            n: "A tela mostra o que vai ser criado, com o que ele reconheceu em cada linha. Só depois é que vira tarefa.",
          },
        ].map((i) => (
          <div key={i.t} className="rounded-2xl border bg-card p-4">
            <p className="text-sm font-semibold">{i.t}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {i.n}
            </p>
          </div>
        ))}
      </div>
    </Secao>
  );
}

/**
 * O caminho da aprovação, em faixa cheia.
 *
 * É a única seção que sangra até as bordas e troca de fundo. Serve de
 * respiro no meio da página e marca o que diferencia o Beni: o cliente entra
 * no fluxo sem entrar no time. O painel escuro dentro do amarelo é proposital,
 * o contraste faz o olho parar aqui.
 */
function FluxoDeAprovacao() {
  return (
    <section className="relative bg-primary text-primary-foreground">
      {/*
        As curvas de fundo precisam ser recortadas, mas o recorte **não** pode
        ficar na seção: `overflow: hidden` cria um contêiner de rolagem, e a
        linha do tempo do caminho passaria a medir contra ele, que nunca rola.
        O efeito congelava no meio sem erro nenhum. Por isso o recorte vive
        nesta camada, que é irmã do conteúdo e não ancestral dele.
      */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-56 size-[46rem] rounded-full border-[5rem] border-white/12" />
        <div className="absolute -bottom-72 -right-32 size-[40rem] rounded-full border-[4rem] border-white/10" />
      </div>

      <div className="revelar relative mx-auto w-full max-w-6xl px-5 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Do pedido à aprovação, num caminho só
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed opacity-80">
            Você pede a validação dentro da tarefa. O cliente recebe um link,
            responde, e a resposta volta para o mesmo lugar.
          </p>
        </div>

        <div className="fluxo mx-auto mt-12 max-w-xl rounded-3xl bg-neutral-900 p-7 text-neutral-100 shadow-2xl sm:p-10">
          <div className="mx-auto w-fit rounded-full border border-white/15 bg-white/5 px-4 py-2 font-mono text-[11px] text-neutral-400 sm:text-xs">
            app.benicio.space/aprovar/k3f9…
          </div>

          <ol className="fluxo-lista relative mx-auto mt-8 max-w-xs">
            {/* trilho: o cinza é o caminho todo, o âmbar é o quanto já andou */}
            <span aria-hidden className="fluxo-trilho" />
            <span aria-hidden className="fluxo-andado" />

            {PASSOS.map((passo) => (
              <li key={passo} className="passo">
                <span className="passo-marca">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span className="passo-texto">{passo}</span>
              </li>
            ))}
          </ol>

          <div className="fluxo-fim mx-auto mt-8 w-fit rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
            Registrado na tarefa, com data e autor
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-lg text-center text-sm opacity-80">
          A descrição interna não viaja no link. Combinado de equipe não é
          assunto de cliente, e esconder na tela não bastaria: o texto iria
          junto no conteúdo da página.
        </p>
      </div>
    </section>
  );
}

function ConectorDoClaude() {
  return (
    <Secao>
      <Titulo
        sobre="Conector do Claude (MCP)"
        descricao="O Beni fala MCP, o protocolo que o Claude usa para conversar com ferramentas de fora. Conectado, ele lê e escreve no seu backlog: você pergunta o que vence hoje, manda abrir tarefa, pede um resumo do projeto, e a resposta sai do dado de verdade."
      >
        Seu backlog responde quando você pergunta
      </Titulo>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border bg-card p-6">
          <p className="text-sm font-semibold">Como ligar, em três passos</p>
          <ol className="mt-5 space-y-5">
            <Passo n={1} titulo="Crie uma chave de acesso">
              Dentro do Beni, em Configurações, na seção de chaves de API. Ela
              aparece uma vez só, então copie na hora.
            </Passo>
            <Passo n={2} titulo="Adicione o conector no Claude">
              Em Configurações, Conectores, Adicionar conector personalizado.
              O endereço é:
              <code className="mt-2 block rounded-lg bg-muted px-3 py-2 font-mono text-[12px] break-all">
                https://app.benicio.space/api/mcp
              </code>
            </Passo>
            <Passo n={3} titulo="Pergunte">
              &quot;O que vence hoje?&quot;, &quot;abre uma tarefa de bug no
              Plataforma Web&quot;, &quot;o que está parado esperando
              aprovação?&quot;.
            </Passo>
          </ol>
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            No Claude Code funciona igual, apontando para o mesmo endereço. A
            chave pode ir no cabeçalho <code className="font-mono">Authorization</code>{" "}
            ou como <code className="font-mono">?token=</code> na própria URL,
            para os clientes que não deixam configurar cabeçalho.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border bg-card p-5 font-mono text-[13px] leading-relaxed shadow-sm">
            <p className="text-muted-foreground">
              <span className="text-primary-strong">você</span> o que eu tenho
              para hoje?
            </p>
            <p className="mt-3">
              Três tarefas vencem hoje no Plataforma Web. A de login está parada
              há quatro dias esperando aprovação.
            </p>
            <p className="mt-4 text-muted-foreground">
              <span className="text-primary-strong">você</span> abre uma tarefa
              para o bug do relatório
            </p>
            <p className="mt-3">
              Criada: <span className="text-primary-strong">WEB-142</span>,
              prioridade alta, no seu nome.
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <p className="text-sm font-semibold">O que ele consegue fazer</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {FERRAMENTAS_MCP.map((f) => (
                <span
                  key={f}
                  className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground"
                >
                  {f}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Doze ferramentas ao todo, entre ler, criar, atualizar e comentar.
              A chave vale por workspace e pode ser revogada a qualquer momento.
            </p>
          </div>
        </div>
      </div>
    </Secao>
  );
}

function Passo({
  n,
  titulo,
  children,
}: {
  n: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary-strong">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{titulo}</p>
        <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      </div>
    </li>
  );
}

function EscritaEConversa() {
  return (
    <Secao className="bg-muted/30">
      <Titulo
        sobre="Contexto"
        descricao="A decisão que explica a tarefa costuma morrer num chat de fora. No Beni ela fica ao lado do trabalho, e continua lá quando alguém perguntar, seis meses depois, por que foi feito assim."
      >
        O porquê fica junto do quê
      </Titulo>

      <div className="cascata mt-10 grid gap-4 sm:grid-cols-3">
        <Cartao
          icone={NotebookPen}
          titulo="Anotações no projeto"
          nota="Ata de reunião, combinado com o cliente, rascunho de escopo."
        />
        <Cartao
          icone={MessageSquare}
          titulo="Conversas por canal"
          nota="Um canal por assunto, com menção e reação, dentro do mesmo lugar."
        />
        <Cartao
          icone={Link2}
          titulo="Link público quando precisa"
          nota="Anotação e Gantt viram link de leitura para quem está de fora."
        />
      </div>
    </Secao>
  );
}

function Cartao({
  icone: Icone,
  titulo,
  nota,
}: {
  icone: typeof NotebookPen;
  titulo: string;
  nota: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary-strong">
        <Icone className="size-5" />
      </span>
      <p className="mt-4 font-semibold">{titulo}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{nota}</p>
    </div>
  );
}

function AppDeMac() {
  return (
    <Secao>
      <div className="overflow-hidden rounded-3xl border bg-linear-to-br from-primary/12 via-card to-card">
        <div className="grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-strong">
              App de macOS
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Fora do navegador, com ícone no Dock
            </h2>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              Mesmo Beni, em janela própria. Assinado com certificado de
              desenvolvedor e reconhecido pela Apple, então abre no primeiro
              clique, sem aviso de programa não identificado.
            </p>

            <a
              href={DOWNLOAD_MAC}
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90"
            >
              <Apple className="size-4" />
              Baixar para Mac
            </a>
            <p className="mt-3 text-xs text-muted-foreground">
              Intel e Apple Silicon no mesmo arquivo.
            </p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <BeniMascote pose="beni" className="w-32 drop-shadow-lg sm:w-40" />
          </div>
        </div>
      </div>
    </Secao>
  );
}

/**
 * O resto dos recursos, mostrando um pedaço de interface em vez de um ícone.
 *
 * Ícone com legenda diz o nome da funcionalidade; um pedaço da tela diz como
 * ela é. Custa mais para escrever e vale a diferença, porque é o que separa
 * "tem busca" de "a busca é assim".
 */
function Fragmentos() {
  return (
    <Secao className="bg-muted/30">
      <div className="revelar">
        <Titulo sobre="E ainda">O resto que você espera de uma ferramenta séria</Titulo>
      </div>

      <div className="cascata mt-10 grid gap-4 lg:grid-cols-2">
        <CartaoFragmento
          titulo="Busca instantânea"
          nota="Tarefa, projeto ou anotação, em ⌘K, de qualquer tela."
          destaque
        >
          <div className="rounded-xl border border-black/10 bg-white/70 p-2.5 dark:border-white/10 dark:bg-black/20">
            <div className="flex items-center gap-2 border-b border-black/5 px-1 pb-2 text-xs text-muted-foreground dark:border-white/10">
              <Search className="size-3.5" />
              login
              <span className="ml-auto rounded border px-1 font-mono text-[10px]">⌘K</span>
            </div>
            <div className="space-y-1 pt-2">
              {[
                ["WEB-8", "Implementar login com e-mail e senha"],
                ["APP-3", "Login social no app"],
                ["Nota", "Decisões do fluxo de entrada"],
              ].map(([ref, nome]) => (
                <p key={ref} className="flex gap-2 px-1 text-[11px]">
                  <span className="font-mono text-muted-foreground">{ref}</span>
                  <span className="truncate">{nome}</span>
                </p>
              ))}
            </div>
          </div>
        </CartaoFragmento>

        <CartaoFragmento
          titulo="GitHub na tarefa"
          nota="O commit e o pull request aparecem onde o trabalho foi combinado."
        >
          <div className="space-y-2">
            {[
              ["a3f91c2", "corrige validação do formulário"],
              ["PR #218", "login com e-mail e senha"],
            ].map(([ref, nome]) => (
              <div
                key={ref}
                className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2 text-[11px]"
              >
                <GitBranch className="size-3.5 shrink-0 text-primary-strong" />
                <span className="font-mono text-muted-foreground">{ref}</span>
                <span className="truncate">{nome}</span>
              </div>
            ))}
          </div>
        </CartaoFragmento>

        <CartaoFragmento
          titulo="Avisos por e-mail"
          nota="Ao ser atribuído, quando pedem sua aprovação, e um resumo no começo do dia."
        >
          <div className="rounded-xl border bg-card p-3">
            <p className="text-[11px] font-medium">Seu dia no Beni</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              3 tarefas vencem hoje, 1 esperando você
            </p>
            <div className="mt-2.5 space-y-1.5">
              {["Corrigir estouro no mobile", "Aprovar landing page"].map((t) => (
                <p key={t} className="flex items-center gap-2 text-[11px]">
                  <span className="size-1.5 rounded-full bg-primary" />
                  {t}
                </p>
              ))}
            </div>
          </div>
        </CartaoFragmento>

        <CartaoFragmento
          titulo="API com chave por workspace"
          nota="Para automatizar o que se repete, e é a mesma chave que o conector do Claude usa."
        >
          <div className="rounded-xl border bg-neutral-900 p-3 font-mono text-[10.5px] leading-relaxed text-neutral-300">
            <p className="text-neutral-500">
              curl -H &quot;Authorization: Bearer …&quot; \
            </p>
            <p className="pl-3">app.benicio.space/api/v1/tasks</p>
            <p className="mt-2 text-primary">{"{ \"tarefas\": 12, \"vencendo\": 3 }"}</p>
          </div>
        </CartaoFragmento>
      </div>
    </Secao>
  );
}

function CartaoFragmento({
  titulo,
  nota,
  destaque = false,
  children,
}: {
  titulo: string;
  nota: string;
  destaque?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-5 rounded-2xl border p-5",
        destaque ? "border-primary/40 bg-primary/10" : "bg-card",
      )}
    >
      <div>{children}</div>
      <div>
        <p className="font-semibold">{titulo}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{nota}</p>
      </div>
    </div>
  );
}

/**
 * Perguntas e respostas.
 *
 * `details` e `summary` do próprio HTML: abre e fecha sem uma linha de script,
 * funciona com teclado e é encontrado pela busca do navegador mesmo fechado.
 */
function Perguntas() {
  const itens = [
    {
      p: "Preciso pagar para usar?",
      r: "Não. O Beni está sendo construído e é de graça enquanto estiver. Quando houver plano pago, o que existe hoje continua funcionando para quem já usa.",
    },
    {
      p: "O cliente precisa criar conta para aprovar?",
      r: "Não. Ele recebe um link, abre, lê o que precisa validar e responde. Não pede senha, convite nem cadastro, e ele não entra no seu workspace.",
    },
    {
      p: "O cliente vê as conversas internas do time?",
      r: "Não. O link de aprovação leva o nome da tarefa e o que precisa ser validado. A descrição interna não é enviada, então nem no conteúdo da página ela aparece.",
    },
    {
      p: "Dá para usar com o Claude?",
      r: "Sim. O Beni é um servidor MCP: você cria uma chave em Configurações e adiciona o conector apontando para app.benicio.space/api/mcp. A partir daí dá para perguntar o que vence hoje, abrir tarefa e comentar por conversa.",
    },
    {
      p: "Tem app para computador?",
      r: "Para Mac, sim, assinado e reconhecido pela Apple, com Intel e Apple Silicon no mesmo arquivo. No Windows e no Linux o Beni roda no navegador.",
    },
    {
      p: "Meus arquivos e dados ficam onde?",
      r: "Num banco próprio do Beni, junto do projeto a que pertencem. Anexos ficam guardados no banco, e não numa pasta que some quando o servidor é atualizado.",
    },
  ];

  return (
    <Secao>
      <div className="revelar mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Perguntas e respostas
        </h2>
      </div>

      <div className="cascata mx-auto mt-10 max-w-2xl space-y-2.5">
        {itens.map((i) => (
          <details key={i.p} className="pergunta group rounded-2xl border bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 text-sm font-medium">
              {i.p}
              <Plus className="seta ml-auto size-4 shrink-0 text-muted-foreground" />
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
              {i.r}
            </p>
          </details>
        ))}
      </div>
    </Secao>
  );
}

function ChamadaFinal() {
  return (
    <Secao>
      <div className="relative overflow-hidden rounded-3xl border bg-card px-8 py-14 text-center sm:px-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(30rem_12rem_at_50%_0%,var(--color-primary)/0.22,transparent)]"
        />
        <div className="relative">
          <BeniMascote pose="beni" pequeno className="mx-auto w-20" />
          <h2 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
            Comece com um projeto e veja se serve
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Leva um minuto para criar a conta e o primeiro quadro. Se não fizer
            sentido, você não perdeu nada além do minuto.
          </p>
          <Link
            href="/register"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-105"
          >
            Criar minha conta
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </Secao>
  );
}

function Rodape() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center">
        <BeniLogo className="origin-left scale-90" />
        <p className="text-xs text-muted-foreground sm:ml-4">
          Gestão de projetos, tarefas e backlog.
        </p>
        <nav className="flex gap-4 text-xs text-muted-foreground sm:ml-auto">
          <Link href="/login" className="transition hover:text-foreground">
            Entrar
          </Link>
          <Link href="/register" className="transition hover:text-foreground">
            Criar conta
          </Link>
          <a href={DOWNLOAD_MAC} className="transition hover:text-foreground">
            App de Mac
          </a>
        </nav>
      </div>

      {/* a marca ocupando a largura toda no fim: fecha a leitura com o nome, e
          é a última coisa que fica na cabeça de quem rolou até aqui */}
      <div className="overflow-hidden px-5 pb-6" aria-hidden>
        <p className="select-none text-center text-[19vw] font-semibold leading-[0.8] tracking-tighter text-primary/25">
          Beni
        </p>
      </div>
    </footer>
  );
}

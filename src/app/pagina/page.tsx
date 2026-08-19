import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Apple,
  Bell,
  CalendarDays,
  Check,
  GanttChartSquare,
  GitBranch,
  KanbanSquare,
  Layers,
  List,
  MessageSquare,
  NotebookPen,
  Paperclip,
  PieChart,
  Search,
  Sparkles,
  Terminal,
  Users,
} from "lucide-react";
import { BeniLogo, BeniMascote } from "@/components/logo";
import { DOWNLOAD_MAC } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Página de apresentação do Beni.
 *
 * Fica fora do grupo `(app)` de propósito: quem chega aqui não tem conta, e
 * herdar a casca do aplicativo traria barra lateral, busca e atalhos que não
 * levam a lugar nenhum. Precisa também estar em `OPEN_PATHS` no `proxy.ts`,
 * senão o visitante é mandado para o login antes de ler a primeira linha.
 *
 * Tudo aqui é renderizado no servidor. A página não tem estado, e um trecho de
 * JavaScript só para animar rolagem custaria mais do que entrega numa máquina
 * com CPU compartilhada e 220 ms de distância.
 */

const TITULO = "Beni — do backlog à aprovação do cliente";
const RESUMO =
  "Gerenciador de projetos com sete visões da mesma tarefa, anotações e conversas junto do trabalho, e aprovação do cliente por link, sem conta.";

export const metadata: Metadata = {
  title: TITULO,
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
  { icon: List, nome: "Lista", nota: "Tudo em ordem, com filtro e agrupamento." },
  { icon: KanbanSquare, nome: "Quadro", nota: "Arrasta entre as colunas do time." },
  { icon: GanttChartSquare, nome: "Gantt", nota: "Prazos e dependências no tempo." },
  { icon: Layers, nome: "Backlog", nota: "O que ainda não entrou no sprint." },
  { icon: CalendarDays, nome: "Calendário", nota: "O mês pelo vencimento." },
  { icon: PieChart, nome: "Painel", nota: "Onde o projeto está agora." },
  { icon: NotebookPen, nome: "Anotações", nota: "A decisão junto da tarefa." },
];

const EXTRAS = [
  { icon: Search, nome: "Busca instantânea", nota: "Tarefa, projeto ou anotação em ⌘K." },
  { icon: GitBranch, nome: "GitHub", nota: "Liga commit e pull request à tarefa." },
  { icon: Bell, nome: "Avisos por e-mail", nota: "Ao ser atribuído e no resumo do dia." },
  { icon: Paperclip, nome: "Anexos", nota: "Arquivo e print colados na tarefa." },
  { icon: Users, nome: "Sprints e responsáveis", nota: "Quem faz o quê, e até quando." },
  { icon: Terminal, nome: "API com token", nota: "Para automatizar o que se repete." },
];

export default function PaginaDoBeni() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <Cabecalho />

      <main className="flex-1">
        <Hero />
        <Visoes />
        <Aprovacao />
        <Claude />
        <EscritaEConversa />
        <AppDeMac />
        <TambemTem />
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
      {/* clarão quente atrás do texto — puro CSS, sem imagem para baixar */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 h-[28rem] bg-[radial-gradient(45rem_22rem_at_50%_0%,var(--color-primary)/0.18,transparent)]"
      />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-16 sm:py-24 lg:grid-cols-[1.15fr_1fr]">
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
            O Beni guarda as tarefas, as decisões e as conversas do projeto no
            mesmo lugar. Cada projeto tem sete jeitos de ser olhado — e quando
            chega a hora de validar, o cliente aprova por um link, sem criar
            conta e sem ver a sua cozinha.
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
            className="absolute inset-0 m-auto size-64 rounded-full bg-primary/15 blur-3xl sm:size-80"
          />
          <BeniMascote
            pose="apresentando"
            className="relative w-52 drop-shadow-xl sm:w-64 lg:w-72"
          />
        </div>
      </div>
    </section>
  );
}

function Secao({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("border-t border-border/60", className)}>
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">{children}</div>
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

function Visoes() {
  return (
    <Secao>
      <Titulo
        sobre="Uma tarefa, sete ângulos"
        descricao="A mesma informação, apresentada como cada pessoa precisa ver. Quem executa quer a lista; quem coordena quer o Gantt; quem cobra quer o painel. Ninguém precisa manter duas ferramentas em dia."
      >
        Trocar de visão não é trocar de ferramenta
      </Titulo>

      {/* sete cartões numa grade de quatro deixariam um buraco na última linha;
          em linha flexível centralizada os três de baixo ficam alinhados ao
          meio e o desenho parece intencional, que é o que ele é */}
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        {VISOES.map((v) => (
          <div
            key={v.nome}
            className="w-full rounded-2xl border bg-card p-4 transition hover:border-primary/40 sm:w-[calc(50%-0.375rem)] lg:w-[calc(25%-0.5625rem)]"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/12 text-primary-strong">
              <v.icon className="size-4.5" />
            </span>
            <p className="mt-3 text-sm font-semibold">{v.nome}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {v.nota}
            </p>
          </div>
        ))}
      </div>
    </Secao>
  );
}

function Aprovacao() {
  return (
    <Secao className="bg-muted/30">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <Titulo
            sobre="Aprovação"
            descricao="Você manda um link. Ele abre, lê o que precisa validar, aprova ou pede ajuste — e nada disso exige conta, senha ou convite."
          >
            O cliente aprova sem entrar no seu time
          </Titulo>

          <ul className="mt-7 space-y-3.5">
            {[
              "Só o nome da tarefa e o que ele precisa validar. A descrição interna não viaja no link — combinado de equipe não é assunto de cliente.",
              "A resposta volta para dentro da tarefa, com data e quem aprovou.",
              "Serve também para o Gantt: um link de leitura para acompanhar o prazo.",
            ].map((t) => (
              <li key={t} className="flex gap-3 text-sm leading-relaxed">
                <Check className="mt-0.5 size-4 shrink-0 text-primary-strong" />
                <span className="text-muted-foreground">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <MockAprovacao />
      </div>
    </Secao>
  );
}

/** Amostra do que o cliente vê. Desenhada em HTML — não é captura de tela. */
function MockAprovacao() {
  return (
    <div className="relative">
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b pb-3">
          <BeniLogo className="scale-90 origin-left" />
          <span className="ml-auto rounded-md bg-amber-500/12 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            Aguardando você
          </span>
        </div>

        <p className="mt-4 text-[11px] uppercase tracking-wider text-muted-foreground">
          Tarefa
        </p>
        <p className="mt-1 text-sm font-semibold">
          Landing page — versão para revisão
        </p>

        <p className="mt-4 text-[11px] uppercase tracking-wider text-muted-foreground">
          O que validar
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Confere se o texto da dobra principal está como combinamos e se o
          botão leva para o formulário certo.
        </p>

        <div className="mt-5 flex gap-2">
          <span className="flex-1 rounded-lg bg-primary px-3 py-2 text-center text-xs font-semibold text-primary-foreground">
            Aprovar
          </span>
          <span className="flex-1 rounded-lg border px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
            Pedir ajuste
          </span>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        É isso que o cliente recebe. Nada além disso.
      </p>
    </div>
  );
}

function Claude() {
  return (
    <Secao>
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <div className="rounded-2xl border bg-card p-5 font-mono text-[13px] leading-relaxed shadow-sm">
            <p className="text-muted-foreground">
              <span className="text-primary-strong">você</span> — o que eu tenho
              para hoje?
            </p>
            <p className="mt-3">
              Três tarefas vencem hoje no Plataforma Web. A de login está
              parada há quatro dias esperando aprovação.
            </p>
            <p className="mt-4 text-muted-foreground">
              <span className="text-primary-strong">você</span> — abre uma tarefa
              para o bug do relatório
            </p>
            <p className="mt-3">
              Criada: <span className="text-primary-strong">WEB-142</span>,
              prioridade alta, no seu nome.
            </p>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <Titulo
            sobre="Conector do Claude"
            descricao="O Beni fala MCP. Conecte no claude.ai ou no Claude Code e converse com o backlog em vez de navegar por ele — criar tarefa, procurar, comentar, saber o que vence hoje."
          >
            Seu backlog responde quando você pergunta
          </Titulo>
          <p className="mt-5 text-sm text-muted-foreground">
            Também dá para chegar pela API, com token por workspace, quando o
            que você quer é automatizar em vez de conversar.
          </p>
        </div>
      </div>
    </Secao>
  );
}

function EscritaEConversa() {
  return (
    <Secao className="bg-muted/30">
      <Titulo
        sobre="Contexto"
        descricao="A decisão que explica a tarefa costuma morrer num chat de fora. No Beni ela fica ao lado do trabalho — e continua lá quando alguém perguntar, seis meses depois, por que foi feito assim."
      >
        O porquê fica junto do quê
      </Titulo>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary-strong">
            <NotebookPen className="size-5" />
          </span>
          <p className="mt-4 font-semibold">Anotações no projeto</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Ata de reunião, combinado com o cliente, rascunho de escopo. Com
            link público quando alguém de fora precisa ler.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary-strong">
            <MessageSquare className="size-5" />
          </span>
          <p className="mt-4 font-semibold">Conversas por canal</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Um canal por assunto, com menção e reação, dentro do mesmo lugar em
            que o trabalho acontece.
          </p>
        </div>
      </div>
    </Secao>
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
              desenvolvedor e reconhecido pela Apple — abre no primeiro clique,
              sem aviso de programa não identificado.
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
            <BeniMascote pose="andando" className="w-40 drop-shadow-lg sm:w-52" />
          </div>
        </div>
      </div>
    </Secao>
  );
}

function TambemTem() {
  return (
    <Secao className="bg-muted/30">
      <Titulo sobre="E ainda">O resto que você espera de uma ferramenta séria</Titulo>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EXTRAS.map((e) => (
          <div key={e.nome} className="flex gap-3 rounded-2xl border bg-card p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary-strong">
              <e.icon className="size-4.5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{e.nome}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {e.nota}
              </p>
            </div>
          </div>
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
          <BeniMascote pose="prancheta" pequeno className="mx-auto w-24" />
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
        <BeniLogo className="scale-90 origin-left" />
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
    </footer>
  );
}

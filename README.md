<div align="center">

# Beni

**Gestão de projetos, tarefas e backlog** — no espírito do ClickUp e do Azure DevOps.
Lista, Quadro (kanban), Gantt, Backlog com sprints, Calendário e Painel — num único lugar.

</div>

---

## Subir tudo com Docker (1 comando)

```bash
docker compose up -d --build
```

Abra **http://localhost:3000** e entre com:

| Campo | Valor            |
| ----- | ---------------- |
| Login | `admin@beni.app` |
| Senha | `beni1234`       |

O container aplica as migrations e popula um workspace de demonstração
(3 projetos, 5 pessoas, sprints, dependências e comentários) automaticamente.
O seed é **idempotente**: se o usuário admin já existir, ele não faz nada.

Para desligar: `docker compose down` (com `-v` também apaga o banco).

### Variáveis de ambiente

| Variável              | Padrão              | Para quê                                        |
| --------------------- | ------------------- | ----------------------------------------------- |
| `DATABASE_URL`        | definido no compose | conexão com o Postgres                          |
| `AUTH_SECRET`         | valor de exemplo    | assina o JWT de sessão — **troque em produção**  |
| `SEED_ADMIN_EMAIL`    | `admin@beni.app`    | usuário criado pelo seed                        |
| `SEED_ADMIN_PASSWORD` | `beni1234`          | senha do usuário do seed                        |
| `SEED_ON_START`       | `true`              | `false` desliga o seed automático               |

---

## O que dá para fazer

### Visões do projeto

| Visão          | O que entrega                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Lista**      | Agrupamento por status/responsável/prioridade/sprint, edição inline, seleção múltipla com ações em lote e reordenação por arrastar |
| **Quadro**     | Kanban com arrastar-e-soltar entre colunas, contagem de itens e de pontos por coluna                                             |
| **Gantt**      | Linha do tempo com barras arrastáveis e redimensionáveis, setas de dependência, linha do "hoje" e zoom dia/semana/mês            |
| **Backlog**    | Sprints no estilo Azure DevOps: arrastar itens entre sprints e backlog, iniciar/concluir sprint, pontos e progresso              |
| **Calendário** | Mês a mês por prazo, arrastando tarefas para reagendar                                                                          |
| **Painel**     | Fluxo cumulativo, burndown da sprint ativa, distribuição por status/prioridade e carga do time                                   |

### Tarefas

Tipos (tarefa, bug, história, épico, manutenção), prioridades, responsável,
datas de início e prazo, estimativa em horas, story points, progresso,
etiquetas, subtarefas, comentários, dependências (bloqueia / é bloqueada por)
e histórico de atividade.

### Aprovação de stakeholder por link público

Na aba **Aprovação** do detalhe da tarefa você gera um **link público**
(`/aprovar/<token>`) e envia ao sponsor. Quem recebe:

- **não precisa de conta** — a rota é aberta;
- vê o resumo da entrega e a mensagem de quem pediu;
- **identifica-se pelo nome** (e-mail e comentário são opcionais);
- clica em **Aprovar** ou **Reprovar**.

A decisão fica registrada com **nome, e-mail, comentário e data/hora**, aparece
para o time no detalhe da tarefa e vira um evento no histórico. O token tem
32 bytes aleatórios, expira em 30 dias e aceita **uma única** decisão.

### Cronograma compartilhável (Gantt público com comentários)

Na visão **Gantt**, o botão **Compartilhar** gera um link público
(`/compartilhar/<token>`). Quem recebe:

- vê o cronograma completo em **modo leitura** — não arrasta nem altera nada;
- clica em qualquer barra e abre o painel do item com descrição e comentários;
- **comenta informando nome e e-mail** se não estiver logado (quem já tem conta
  comenta com a própria identidade, sem preencher nada).

Comentários de visitantes aparecem para o time com a etiqueta **convidado** e o
e-mail informado. Dá para **ligar/desligar os comentários** e **revogar o link**
a qualquer momento; ele expira em 90 dias.

### Integração com o GitHub

Em **Configurar projeto → GitHub** você vincula repositórios ao projeto
(`dono/repositório` ou a URL). Depois, na aba **GitHub** de cada tarefa:

- vincule **issues e pull requests** pelo número (`#42`) ou colando a URL —
  ou escolha na lista de itens abertos do repositório;
- veja **título, autor e estado ao vivo** (aberto, rascunho, fechado, mesclado)
  com um botão para ressincronizar;
- copie o **nome de branch sugerido** (`feature/web-12-titulo-da-tarefa`) para
  manter tarefa, branch e PR conectados.

Repositórios **públicos funcionam sem configuração**. Para repositórios
privados (ou para elevar o limite de requisições), salve um *personal access
token* com escopo `repo` em **Configurações → GitHub** — ele é guardado
**cifrado (AES-256-GCM)** e nunca volta para o navegador.

### Chat do time (estilo Slack)

Em **Chat** o time conversa sem sair do Beni:

- **canais** públicos ou privados, com assunto e participantes, mais **explorar canais** para entrar nos públicos;
- **mensagens diretas** entre duas pessoas;
- **threads** (respostas presas à mensagem), **reações** com emoji, **editar** e **apagar** as próprias mensagens;
- **@menções** destacadas no texto, que geram um selo vermelho no canal e na barra lateral;
- **selo de não lidas** por canal e no menu, com o total também no título da aba;
- **tempo real** por Server-Sent Events (`/api/chat/stream`) — mensagem enviada por uma pessoa aparece na tela da outra sem recarregar.

> O barramento de eventos é em memória (`src/server/chat-bus.ts`), suficiente para
> uma instância. Para rodar réplicas, troque por `LISTEN/NOTIFY` do Postgres ou
> Redis pub/sub mantendo a mesma interface `publish`/`subscribe`.

### App para macOS (.dmg)

`desktop/` traz um app nativo que carrega **exatamente a mesma aplicação web** —
nada é reimplementado. O que a camada nativa acrescenta: menu em português com
atalhos do sistema (⌘1/⌘2/⌘3 para as seções, ⌘[ e ⌘] para navegar), memória da
posição da janela, links externos abrindo no navegador, barra de título própria
para os botões do macOS e uma tela para apontar o servidor quando ele não responde.

```bash
cd desktop
npm install
npm run dist     # gera desktop/dist/Beni-1.0.0-mac.dmg (universal: Intel + Apple Silicon)
```

Por padrão o app aponta para `https://app.benicio.space`; troque em **Beni → Servidor…**
ou pela variável `BENI_URL`. O `.dmg` não é assinado com conta de desenvolvedor —
na primeira vez, abra com **clique direito → Abrir**.

### Produtividade

- **⌘K / Ctrl+K** — busca tarefas e navega entre projetos e visões
- **N** — nova tarefa · **[** — recolhe a barra lateral
- Tema claro / escuro / automático
- Layout responsivo (a barra lateral vira gaveta no celular)

---

## Desenvolvimento local

```bash
# 1. só o banco no Docker
docker compose up -d db

# 2. dependências e schema
npm install
npm run db:migrate
npm run db:seed

# 3. app em modo dev
npm run dev
```

### Scripts

| Script               | O que faz                                   |
| -------------------- | ------------------------------------------- |
| `npm run dev`        | servidor de desenvolvimento                 |
| `npm run build`      | `prisma generate` + build de produção       |
| `npm run start`      | serve o build                               |
| `npm run lint`       | ESLint                                      |
| `npm run db:migrate` | cria/aplica migrations em desenvolvimento   |
| `npm run db:deploy`  | aplica migrations (produção)                |
| `npm run db:seed`    | popula os dados de demonstração             |
| `npm run db:studio`  | abre o Prisma Studio                        |

---

## Arquitetura

```
src/
  app/
    (auth)/            login e cadastro
    (app)/             app autenticado (layout com barra lateral)
      p/[projectId]/   as seis visões + configurações do projeto
    aprovar/[token]/       página pública de aprovação (sem login)
    compartilhar/[token]/  Gantt público com comentários de visitantes
  components/
    ui/                shadcn/ui (Base UI + Tailwind v4)
    app-shell/         barra lateral, paleta de comandos, gaveta mobile
    task/              cartão, painel de detalhe, seletores, aprovação, GitHub
    views/             lista, quadro, gantt, backlog, calendário, painéis
    charts/            primitivas de visualização (tiles, barras, legenda)
  server/
    actions/           Server Actions (auth, tarefas, sprints, aprovações, GitHub…)
    github.ts          cliente da API REST do GitHub
    queries.ts         leitura + DTOs serializáveis para os componentes client
  lib/                 db (Prisma), auth (JWT), cifra de segredos, utilitários
  proxy.ts             guarda de rotas (o "middleware" do Next 16)
prisma/                schema, migrations e seed
```

**Stack:** Next.js 16 (App Router, Server Actions, Turbopack) · React 19 ·
TypeScript · Tailwind CSS v4 · shadcn/ui · Prisma 7 + PostgreSQL 17 ·
dnd-kit · Recharts · jose (JWT) · bcrypt.

### Decisões que valem nota

- **Ordenação fracionária** (`order: Float`): arrastar um item grava só uma
  linha — a lista inteira não é reindexada.
- **Status são dados, não enum**: cada projeto define suas colunas; a
  *categoria* (backlog / a fazer / em andamento / concluído / cancelado) é que
  dá o comportamento, como "concluir" e o burndown.
- **Otimista + servidor**: as visões atualizam o estado local no `drop` e
  reconciliam com `router.refresh()` depois da Server Action.
- **Paleta de gráficos validada** para daltonismo e contraste, idêntica em tema
  claro e escuro; toda visualização tem legenda e alternativa em tabela.

---

## Produção

- Troque **`AUTH_SECRET`** por uma string longa e aleatória.
- Troque a senha do admin (ou desligue o seed com `SEED_ON_START=false`).
- Sirva por HTTPS: o cookie de sessão usa `secure` quando `NODE_ENV=production`.
- O `docker-compose.yml` sobe um Postgres por conveniência; em produção aponte
  `DATABASE_URL` para o seu banco gerenciado e remova o serviço `db`.

### API e MCP

O Beni expõe uma API em `/api/v1`, autenticada por chave (`Authorization:
Bearer beni_…`). As chaves são criadas em **Configurações → Chaves de acesso**,
aparecem uma única vez e podem ser revogadas sem trocar a senha de ninguém —
guardamos só o hash.

| Rota | O que faz |
| --- | --- |
| `GET /api/v1/workspace` | workspace, quem é o dono da chave e o time |
| `GET /api/v1/projects` | projetos, status válidos e sprints · `POST` cria projeto |
| `GET /api/v1/tasks` | lista com filtros (`project`, `status=aberto`, `assignee=eu`, `q`, `overdue`) · `POST` cria |
| `GET /api/v1/tasks/:ref` | tarefa por inteiro · `PATCH` altera · `DELETE` apaga |
| `POST /api/v1/tasks/:ref/comments` | comenta |
| `POST /api/v1/tasks/bulk` | cria em massa a partir de texto (`dryRun` só simula) |
| `GET /api/v1/search?q=` | busca (Elasticsearch quando configurado) |
| `GET /api/version` | carimbo do build no ar |

Tarefas aceitam a referência curta (`WEB-12`) no lugar do id.

### Conectar o Claude

São dois caminhos, conforme onde o Claude roda:

**Claude na web (claude.ai)** — o Beni serve o próprio servidor MCP em
`POST /api/mcp`. Em *Configurações → Conectores → Adicionar conector
personalizado*, use:

```
https://app.benicio.space/api/mcp?token=beni_SUA_CHAVE
```

A chave vai na URL porque o cadastro de conector não tem onde pôr cabeçalho;
`Authorization: Bearer` também é aceito, para clientes que tenham. Cada
requisição é independente — não há sessão guardada em memória, o que importa
num app que reinicia a cada implantação.

**Claude Code (no seu computador)** — use o servidor por stdio em `~/beni-mcp`,
que fala com esta mesma API. Veja o README de lá.

Nos dois casos são as mesmas 12 ferramentas: ler workspace, projetos e tarefas,
abrir uma tarefa por inteiro, "meu dia", buscar, criar (uma ou em massa por
texto), atualizar, comentar, criar projeto e excluir.

### Deploy no EasyPanel

1. **Fonte**: GitHub, ramo `main`, caminho `/`, build por **Dockerfile** (não Nixpacks).
2. **Domínio**: o host, caminho `/` na origem e no destino, protocolo **HTTP**
   e porta **3000**. O padrão 80 devolve *Bad Gateway* mesmo com DNS e
   certificado corretos — quem faz o TLS é o Traefik na frente.

   Para servir sob um caminho (`dominio.com/algo`) em vez da raiz, builde com
   `BASE_PATH=/algo`. É o `basePath` do Next e **entra nos pacotes durante o
   build**: mudar a variável depois não adianta, é preciso reconstruir.
3. **Variáveis** (o Postgres do próprio EasyPanel entrega as `PG*`; não monte a
   URL na mão, a senha gerada costuma ter caracteres que a quebram):

   ```
   PGHOST=<projeto>_<servico-do-postgres>
   PGPORT=5432
   PGUSER=postgres
   PGPASSWORD=<senha do serviço>
   PGDATABASE=<banco>
   PGSCHEMA=beni
   AUTH_SECRET=<string longa e aleatória>
   PORT=3000
   SEED_ON_START=false
   ```

   **Banco compartilhado**: se a instância já hospeda outros projetos, defina
   `PGSCHEMA=beni`. O Beni cria o schema no boot e passa a viver inteiro lá —
   tabelas, migrations e histórico —, sem tocar no `public`. Para apagar o Beni
   depois basta `DROP SCHEMA beni CASCADE`. Se puder criar uma base separada,
   melhor ainda; o schema é a alternativa quando só existe uma.

4. **Primeiro acesso**: com `SEED_ON_START=false` não existe usuário nenhum —
   abra `/register`, crie a sua conta e o workspace nasce junto. Com `true`,
   entra o conjunto de demonstração (`admin@beni.app` / `beni1234`).

As migrations rodam sozinhas no boot (`prisma migrate deploy` no entrypoint);
não é preciso executar SQL. O log de partida mostra
`→ Banco: usuario@host:5432/base` e depois `✔ Migrations aplicadas`.

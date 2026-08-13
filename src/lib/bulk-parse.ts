/**
 * Interpretador de texto para criação de tarefas em massa.
 *
 * Sem modelo de linguagem: as regras são fixas e o resultado é sempre o mesmo
 * para o mesmo texto. Isso é uma vantagem, não uma limitação — a tela mostra o
 * que vai ser criado **antes** de criar, e não existe a chance de inventar uma
 * tarefa que ninguém escreveu.
 *
 * Formato, uma tarefa por linha:
 *
 *     Corrigir login quebrado !alta @ana #bug 14/08 ~3h *5
 *       - Reproduzir o erro
 *       - Escrever teste de regressão
 *     Refatorar cabeçalho !baixa sexta
 *
 * Linhas indentadas (ou começando com `-`, `*`, `[ ]`) viram subtarefas da
 * tarefa acima. Marcadores de lista e numeração são descartados, então dá para
 * colar ata de reunião e checklist de Markdown sem limpar nada antes.
 */

/**
 * Teto por importação. Colar um documento inteiro por engano é fácil — e sem
 * limite isso vira centenas de tarefas de lixo para apagar uma a uma, além de
 * uma tela com milhares de cartões para desenhar.
 */
export const MAX_BULK_TASKS = 200;

export type BulkMode = "linha" | "bloco" | "titulo";

export type ParsedTask = {
  title: string;
  description: string | null;
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW" | null;
  type: "TASK" | "BUG" | "STORY" | "EPIC" | "CHORE" | null;
  assigneeHint: string | null;
  dueDate: string | null;
  estimateHours: number | null;
  points: number | null;
  tags: string[];
  subtasks: string[];
  /** Trechos que reconhecemos e retiramos do título, para a tela explicar. */
  matched: string[];
  warnings: string[];
};

const PRIORITIES: Record<string, ParsedTask["priority"]> = {
  urgente: "URGENT",
  critica: "URGENT",
  crítica: "URGENT",
  alta: "HIGH",
  alto: "HIGH",
  media: "MEDIUM",
  média: "MEDIUM",
  normal: "MEDIUM",
  baixa: "LOW",
  baixo: "LOW",
};

const TYPES: Record<string, ParsedTask["type"]> = {
  tarefa: "TASK",
  task: "TASK",
  bug: "BUG",
  erro: "BUG",
  historia: "STORY",
  história: "STORY",
  story: "STORY",
  epico: "EPIC",
  épico: "EPIC",
  epic: "EPIC",
  melhoria: "CHORE",
  chore: "CHORE",
  manutencao: "CHORE",
  manutenção: "CHORE",
};

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  terça: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
  sábado: 6,
};

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function isoDate(date: Date) {
  const local = new Date(date);
  local.setHours(12, 0, 0, 0);
  return local.toISOString().slice(0, 10);
}

/**
 * Datas em português do jeito que as pessoas escrevem. `today` entra por
 * parâmetro para o resultado ser testável e não depender do relógio.
 */
function parseDate(text: string, today: Date): { iso: string; matched: string } | null {
  const lower = stripAccents(text.toLowerCase());

  const dmy = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = dmy[3] ? Number(dmy[3]) : today.getFullYear();
    if (year < 100) year += 2000;
    const date = new Date(year, month - 1, day, 12);
    if (date.getMonth() === month - 1 && date.getDate() === day) {
      // sem ano explícito e já passou? a pessoa quis dizer o ano que vem
      if (!dmy[3] && date < today) date.setFullYear(year + 1);
      return { iso: isoDate(date), matched: dmy[0] };
    }
  }

  if (/\bhoje\b/.test(lower)) return { iso: isoDate(today), matched: "hoje" };
  if (/\bamanha\b/.test(lower)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return { iso: isoDate(d), matched: "amanhã" };
  }

  const inDays = lower.match(/\bem (\d{1,3}) dias?\b/);
  if (inDays) {
    const d = new Date(today);
    d.setDate(d.getDate() + Number(inDays[1]));
    return { iso: isoDate(d), matched: inDays[0] };
  }

  const inWeeks = lower.match(/\bem (\d{1,2}) semanas?\b/);
  if (inWeeks) {
    const d = new Date(today);
    d.setDate(d.getDate() + Number(inWeeks[1]) * 7);
    return { iso: isoDate(d), matched: inWeeks[0] };
  }

  for (const [name, weekday] of Object.entries(WEEKDAYS)) {
    const plain = stripAccents(name);
    const re = new RegExp(`\\b(proxima |proximo )?${plain}(-feira)?\\b`);
    const hit = lower.match(re);
    if (!hit) continue;
    const d = new Date(today);
    // sempre para a frente: "sexta" numa sexta significa a próxima
    let delta = (weekday - d.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    if (hit[1]) delta += delta <= 6 ? 0 : 0;
    d.setDate(d.getDate() + delta);
    return { iso: isoDate(d), matched: hit[0].trim() };
  }

  return null;
}

/**
 * Padrão que casa o trecho ignorando acentos.
 *
 * O reconhecimento de data trabalha sobre o texto sem acento, então "amanha"
 * casa com a regra e devolve "amanhã" como trecho reconhecido — que não existe
 * no título original e sobraria lá, dentro do título da tarefa.
 */
function accentInsensitive(text: string) {
  const classes: Record<string, string> = {
    a: "[aáàâã]",
    e: "[eéèê]",
    i: "[iíì]",
    o: "[oóòôõ]",
    u: "[uúù]",
    c: "[cç]",
  };
  return text
    .split("")
    .map((ch) => {
      const plain = stripAccents(ch).toLowerCase();
      if (classes[plain]) return classes[plain];
      return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
}

/** Tira marcadores de lista, numeração e caixas de seleção do início da linha. */
function stripBullet(line: string) {
  return line
    .replace(/^\s*[-*•·]\s+/, "")
    .replace(/^\s*\d+[.)]\s+/, "")
    .replace(/^\s*\[[ xX]?\]\s*/, "")
    .trim();
}

function isSubtaskLine(raw: string) {
  if (/^\s{2,}/.test(raw) || /^\t/.test(raw)) return true;
  // um marcador de lista sozinho não é subtarefa: pode ser a lista inteira
  return false;
}

/**
 * Linha que abre uma tarefa num documento: `TAREFA 1:`, `Etapa 2 -`,
 * `Lote 3.`, ou um título de Markdown. O número é obrigatório justamente para
 * não confundir com uma frase qualquer que comece com maiúscula.
 */
const HEADING = /^(?:#{1,6}\s+.+|[A-Za-zÀ-ÿ]{3,20}\s*\d{1,3}\s*[:.)\-–—]\s*.*)$/;

function isHeading(line: string) {
  return HEADING.test(line.trim());
}

/**
 * Descobre o formato do texto colado.
 *
 * Lista curta vem uma tarefa por linha. Documento vem em blocos separados por
 * linha em branco, com um título e um parágrafo embaixo — e aí quebrar por
 * linha transforma cada frase numa tarefa, que foi como esta função nasceu.
 *
 * A regra é conservadora: só é "bloco" quando existe linha em branco separando
 * trechos E algum desses trechos tem mais de uma linha. Uma lista com linhas em
 * branco entre os itens continua sendo uma tarefa por linha.
 */
export function detectBulkMode(input: string): BulkMode {
  const lines = input.split(/\r?\n/).filter((l) => l.trim());

  // Documento com cabeçalhos numerados: cada cabeçalho abre uma tarefa e o que
  // vem embaixo é a descrição dela. Sem isto, cada parágrafo de explicação
  // viraria uma tarefa solta — foi o que aconteceu com "Descritivo. Cria as 11
  // propriedades…" virando tarefa.
  const headings = lines.filter(isHeading).length;
  if (headings >= 2 && headings < lines.length) return "titulo";

  const blocks = input
    .split(/\n\s*\n/)
    .map((b) => b.split(/\r?\n/).filter((l) => l.trim()))
    .filter((b) => b.length > 0);

  if (blocks.length < 2) return "linha";

  const multiline = blocks.filter(
    (b) => b.filter((l) => !/^\s+/.test(l)).length > 1,
  ).length;
  return multiline >= 1 ? "bloco" : "linha";
}

/**
 * Cada bloco separado por linha em branco vira uma tarefa: a primeira linha é o
 * título, o resto vira descrição. Linhas indentadas ou com marcador viram
 * subtarefas, como no modo por linha.
 */
function parseBlocks(input: string, today: Date): ParsedTask[] {
  const blocks = input.split(/\n\s*\n/);
  const tasks: ParsedTask[] = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) continue;

    const [first, ...rest] = lines;
    const [task] = parseBulkTasks(first, today, "linha");
    if (!task) continue;

    const subtasks: string[] = [];
    const descricao: string[] = [];
    for (const line of rest) {
      if (/^\s{2,}/.test(line) || /^\s*[-*•·]\s+/.test(line) || /^\s*\[[ xX]?\]/.test(line)) {
        subtasks.push(stripBullet(line).slice(0, 200));
      } else {
        descricao.push(line.trim());
      }
    }

    task.subtasks.push(...subtasks);
    task.description = descricao.length ? descricao.join("\n") : null;
    tasks.push(task);
  }

  return tasks;
}

/**
 * Cabeçalho abre tarefa; tudo até o próximo cabeçalho é descrição dela.
 * Linhas com marcador viram subtarefas, como nos outros modos.
 */
function parseHeadings(input: string, today: Date): ParsedTask[] {
  const lines = input.split(/\r?\n/);
  const tasks: ParsedTask[] = [];
  let descricao: string[] = [];

  const fechar = () => {
    const atual = tasks[tasks.length - 1];
    if (atual && descricao.length) {
      atual.description = descricao.join("\n").trim() || null;
    }
    descricao = [];
  };

  for (const raw of lines) {
    if (!raw.trim()) continue;

    if (isHeading(raw)) {
      fechar();
      const [task] = parseBulkTasks(raw.replace(/^#{1,6}\s+/, ""), today, "linha");
      if (task) tasks.push(task);
      continue;
    }

    if (tasks.length === 0) {
      // texto antes do primeiro cabeçalho: vira uma tarefa por linha
      const [task] = parseBulkTasks(raw, today, "linha");
      if (task) tasks.push(task);
      continue;
    }

    if (/^\s{2,}/.test(raw) || /^\s*[-*•·]\s+/.test(raw) || /^\s*\[[ xX]?\]/.test(raw)) {
      tasks[tasks.length - 1].subtasks.push(stripBullet(raw).slice(0, 200));
    } else {
      descricao.push(raw.trim());
    }
  }
  fechar();

  return tasks;
}

export function parseBulkTasks(
  input: string,
  today = new Date(),
  mode: BulkMode | "auto" = "auto",
): ParsedTask[] {
  const resolved = mode === "auto" ? detectBulkMode(input) : mode;
  if (resolved === "bloco") return parseBlocks(input, today);
  if (resolved === "titulo") return parseHeadings(input, today);

  const lines = input.split(/\r?\n/);
  const tasks: ParsedTask[] = [];

  for (const raw of lines) {
    if (!raw.trim()) continue;

    const content = stripBullet(raw);
    if (!content) continue;

    if (isSubtaskLine(raw) && tasks.length > 0) {
      tasks[tasks.length - 1].subtasks.push(content.slice(0, 200));
      continue;
    }

    const task: ParsedTask = {
      title: content,
      description: null,
      priority: null,
      type: null,
      assigneeHint: null,
      dueDate: null,
      estimateHours: null,
      points: null,
      tags: [],
      subtasks: [],
      matched: [],
      warnings: [],
    };

    // !prioridade
    task.title = task.title.replace(/!([\wáéíóúâêôãõç]+)/gi, (whole, word: string) => {
      const value = PRIORITIES[stripAccents(word.toLowerCase())] ?? PRIORITIES[word.toLowerCase()];
      if (!value) {
        task.warnings.push(`"!${word}" não é uma prioridade conhecida`);
        return whole;
      }
      task.priority = value;
      task.matched.push(whole);
      return "";
    });

    // #tipo ou #etiqueta
    task.title = task.title.replace(/#([\wáéíóúâêôãõç-]+)/gi, (whole, word: string) => {
      const value = TYPES[stripAccents(word.toLowerCase())] ?? TYPES[word.toLowerCase()];
      if (value) {
        task.type = value;
      } else {
        task.tags.push(word);
      }
      task.matched.push(whole);
      return "";
    });

    // @responsável
    task.title = task.title.replace(/@([\wáéíóúâêôãõç.-]+)/gi, (whole, word: string) => {
      task.assigneeHint = word;
      task.matched.push(whole);
      return "";
    });

    // ~3h de estimativa
    task.title = task.title.replace(/~\s*(\d+(?:[.,]\d+)?)\s*h?\b/gi, (whole, n: string) => {
      task.estimateHours = Number(n.replace(",", "."));
      task.matched.push(whole.trim());
      return "";
    });

    // *5 pontos
    task.title = task.title.replace(/(?:^|\s)\*(\d{1,3})\b/g, (whole, n: string) => {
      task.points = Number(n);
      task.matched.push(`*${n}`);
      return " ";
    });

    // data por último: o texto restante já está livre dos outros marcadores
    const date = parseDate(task.title, today);
    if (date) {
      task.dueDate = date.iso;
      task.matched.push(date.matched);
      task.title = task.title.replace(new RegExp(accentInsensitive(date.matched), "i"), "");
    }

    task.title = task.title.replace(/\s{2,}/g, " ").trim();

    if (!task.title) {
      // sobrou só marcador: vira subtarefa da anterior ou é descartado
      continue;
    }

    task.title = task.title.slice(0, 200);
    tasks.push(task);
  }

  return tasks;
}

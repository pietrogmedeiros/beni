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

export type ParsedTask = {
  title: string;
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

export function parseBulkTasks(input: string, today = new Date()): ParsedTask[] {
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
      const re = new RegExp(
        date.matched.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      task.title = task.title.replace(re, "");
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

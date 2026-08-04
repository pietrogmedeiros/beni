/**
 * E2E do chat do Beni — idempotente.
 *
 * Cobre: abrir o chat, criar canal com participantes, mensagem com menção,
 * recebimento em tempo real via SSE em outro navegador, resposta em thread,
 * reação com emoji, mensagem direta e selo de não lidas.
 *
 * Rodar:  node /Users/pietro_medeiros/beni/e2e/chat.mjs
 *
 * Idempotência:
 *  - todo artefato criado carrega o sufixo único RUN (canal, textos das mensagens);
 *  - antes de começar, `cleanup()` apaga via psql o que execuções anteriores
 *    desta suíte deixaram para trás (canais `e2e-*`, mensagens com a marca
 *    `#e2e-`, a DM Pietro↔Caio) e zera o estado de leitura das três contas
 *    usadas, para o selo de não lidas ser determinístico;
 *  - nenhum dado de seed é apagado.
 *
 * Notas de ambiente:
 *  - o app mantém um SSE aberto em /api/chat/stream — nunca usar
 *    waitUntil: 'networkidle', só 'domcontentloaded';
 *  - o Playwright vem de ~/frete-scraper/node_modules (caminho absoluto).
 */
import { chromium } from "/Users/pietro_medeiros/frete-scraper/node_modules/playwright/index.mjs";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const PASSWORD = "beni1234";
const RUN = Date.now().toString(36);
const TAG = `#e2e-${RUN}`;
const CHANNEL = `e2e-plataforma-${RUN}`;
const TOPIC = `Squad da plataforma web ${TAG}`;

const OUT = process.env.E2E_SHOTS ?? join(tmpdir(), "beni-e2e", "chat");
mkdirSync(OUT, { recursive: true });

const USERS = {
  pietro: "admin@beni.app",
  ana: "ana@beni.app",
  caio: "caio@beni.app",
};

/* ————— psql ————— */

function psql(sql) {
  return execFileSync(
    "docker",
    [
      "exec",
      "beni-db",
      "psql",
      "-U",
      "beni",
      "-d",
      "beni",
      "-v",
      "ON_ERROR_STOP=1",
      "-t",
      "-A",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  ).trim();
}

const TEST_EMAILS = `'${Object.values(USERS).join("','")}'`;

/** Apaga só o que esta suíte cria e deixa o estado de leitura previsível. */
function cleanup() {
  // canais criados por execuções anteriores (o servidor "slugifica" o nome)
  psql(`DELETE FROM "Channel" WHERE name LIKE 'e2e-%';`);

  // a DM Pietro↔Caio: só ela — exatamente esses dois membros e mais ninguém.
  // O seed não cria nenhuma conversa DIRECT, então isto nunca toca em seed.
  psql(`
    DELETE FROM "Channel" WHERE kind = 'DIRECT' AND id IN (
      SELECT cm."channelId"
        FROM "ChannelMember" cm
        JOIN "User" u ON u.id = cm."userId"
       GROUP BY cm."channelId"
      HAVING count(*) = 2
         AND array_agg(DISTINCT u.email) @> ARRAY['${USERS.pietro}','${USERS.caio}']::text[]
    );
  `);

  // mensagens marcadas que tenham sobrado em canais de seed
  psql(`DELETE FROM "Message" WHERE body LIKE '%#e2e-%';`);

  // estado de leitura zerado para as contas do teste → selo determinístico
  psql(`
    UPDATE "ChannelMember" SET "lastReadAt" = now()
     WHERE "userId" IN (SELECT id FROM "User" WHERE email IN (${TEST_EMAILS}));
  `);
  psql(`
    UPDATE "Mention" SET "readAt" = now()
     WHERE "readAt" IS NULL
       AND "userId" IN (SELECT id FROM "User" WHERE email IN (${TEST_EMAILS}));
  `);
}

/* ————— runner ————— */

let failed = 0;
const results = [];

async function step(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`✔ ${name}  (${Date.now() - started}ms)`);
  } catch (e) {
    failed++;
    results.push({ name, ok: false, error: e.message });
    console.log(`✘ ${name} — ${String(e.message).split("\n")[0]}`);
  }
}

/** Espera uma condição virar verdadeira (usado onde não há seletor a esperar). */
async function waitFor(fn, { timeout = 20000, interval = 250, what = "condição" } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  for (;;) {
    try {
      last = await fn();
      if (last) return last;
    } catch (e) {
      last = e.message;
    }
    if (Date.now() > deadline) {
      throw new Error(`timeout esperando ${what} (último valor: ${JSON.stringify(last)})`);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

/* ————— seletores estáveis ————— */

/** A coluna de conversas do chat — não a barra lateral do app. */
const sidebarOf = (page) => page.locator('aside:has(h1:text("Conversas"))');
const dialogOf = (page) => page.locator('[data-slot="dialog-content"]');
/** Só o popover aberto: os já fechados continuam no DOM com data-closed. */
const popoverOf = (page) => page.locator('[data-slot="popover-content"][data-open]');
const composerOf = (page) => page.locator('textarea[placeholder*="Escreva uma mensagem"]');
const threadComposerOf = (page) => page.locator('textarea[placeholder*="Responder na thread"]');
/** A linha de uma mensagem específica (texto único por execução). */
const messageRow = (page, text) => page.locator("div.group").filter({ hasText: text }).first();
/**
 * Linha da conversa na coluna de conversas, pelo nome.
 * O nome acessível pode vir com as iniciais do avatar antes (DMs) e com o
 * selo de não lidas depois — daí casar o nome como palavra, não a string toda.
 */
const conversationRow = (page, name) =>
  sidebarOf(page).getByRole("button", { name: new RegExp(`(^|\\s)${name}(\\s|$)`) });

async function login(browser, email, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("   PAGEERROR", e.message));
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(`${BASE}/`);
  return page;
}

/* ————— execução ————— */

console.log(`\n▶ suíte de chat — RUN=${RUN}  canal=${CHANNEL}`);
console.log(`  limpando estado anterior via psql…`);
cleanup();
console.log(`  ok. capturas em ${OUT}\n`);

const browser = await chromium.launch();

// Pietro (admin) e Ana em navegadores separados; Caio entra só no fim.
const pietro = await login(browser, USERS.pietro, { width: 1440, height: 900 });
const ana = await login(browser, USERS.ana, { width: 1280, height: 860 });

const MSG = `Bem-vinda @Ana! Vamos usar este canal para a squad. ${TAG}`;
const REPLY = `Combinado! Já entrei. ${TAG}`;
const DM = `Oi Caio, consegue revisar o PR hoje? ${TAG}`;

await step("abrir o chat pela barra lateral", async () => {
  await pietro.click('a[href="/chat"]');
  await pietro.waitForURL(/\/chat/);
  await pietro.waitForSelector('h1:has-text("Conversas")', { timeout: 20000 });
  await conversationRow(pietro, "geral").click();
  await pietro.waitForSelector('h2:has-text("geral")', { timeout: 20000 });
  await pietro.waitForSelector("text=Bom dia, time", { timeout: 25000 });
});
await pietro.screenshot({ path: `${OUT}/01-chat-main.png` });

// Ana fica parada no chat antes do canal existir: é o que prova o SSE.
await step("segunda pessoa entra no chat (fica ouvindo o SSE)", async () => {
  await ana.goto(`${BASE}/chat`, { waitUntil: "domcontentloaded" });
  await ana.waitForSelector('h1:has-text("Conversas")', { timeout: 20000 });
});

await step("criar canal com participantes", async () => {
  await pietro.click('button[aria-label="Novo canal"]');
  const dlg = dialogOf(pietro);
  await dlg.waitFor({ state: "visible", timeout: 10000 });
  await dlg.locator("#ch-name").fill(CHANNEL);
  await dlg.locator("#ch-topic").fill(TOPIC);

  // seleção estrita dentro do diálogo: a linha da Ana, não o texto solto
  const anaRow = dlg.locator("label").filter({ hasText: "Ana Ribeiro" });
  await anaRow.locator('[data-slot="checkbox"]').click();
  await waitFor(
    async () => (await anaRow.locator('[data-slot="checkbox"][data-checked]').count()) === 1,
    { what: "checkbox da Ana marcado", timeout: 5000 },
  );

  await dlg.getByRole("button", { name: "Criar canal" }).click();
  await pietro.waitForSelector(`h2:has-text("${CHANNEL}")`, { timeout: 20000 });
  await pietro.waitForSelector(`text=${TOPIC}`, { timeout: 10000 });
});

await step("canal novo chega em tempo real para a participante", async () => {
  // sem reload: a lista da Ana se atualiza pelo evento `channel` do SSE
  await conversationRow(ana, CHANNEL).waitFor({ state: "visible", timeout: 25000 });
  await conversationRow(ana, CHANNEL).click();
  await ana.waitForSelector(`h2:has-text("${CHANNEL}")`, { timeout: 20000 });
});

await step("enviar mensagem com menção", async () => {
  await composerOf(pietro).fill(MSG);
  await composerOf(pietro).press("Enter");
  await messageRow(pietro, TAG).waitFor({ state: "visible", timeout: 20000 });
  // a menção vira destaque no corpo da mensagem
  await messageRow(pietro, TAG).getByText("@Ana", { exact: true }).waitFor({ timeout: 10000 });
});

await step("a outra pessoa recebe em tempo real (SSE)", async () => {
  // Ana já está com o canal aberto — nada de reload aqui
  await messageRow(ana, TAG).waitFor({ state: "visible", timeout: 25000 });
  await messageRow(ana, TAG).getByText("@Ana", { exact: true }).waitFor({ timeout: 10000 });
});
await ana.screenshot({ path: `${OUT}/02-chat-sse.png` });

await step("responder em thread", async () => {
  const row = messageRow(ana, TAG);
  await row.hover();
  await row.locator('button[aria-label="Responder na thread"]').click();
  await ana.waitForSelector('h3:has-text("Thread")', { timeout: 15000 });
  await threadComposerOf(ana).fill(REPLY);
  await threadComposerOf(ana).press("Enter");
  await ana.locator('aside:has(h3:text("Thread"))').getByText(REPLY).waitFor({ timeout: 20000 });
});
await ana.screenshot({ path: `${OUT}/03-chat-thread.png` });

await step("thread aparece para quem enviou a mensagem", async () => {
  await messageRow(pietro, TAG)
    .getByRole("button", { name: /1 resposta/ })
    .waitFor({ timeout: 25000 });
});

await step("reagir a uma mensagem", async () => {
  const row = messageRow(pietro, TAG);
  await row.hover();
  await row.locator('button[aria-label="Reagir"]').click();
  const pop = popoverOf(pietro);
  await pop.waitFor({ state: "visible", timeout: 10000 });
  await pop.getByRole("button", { name: "🎉" }).click();
  // o selo da reação nasce na própria linha da mensagem
  await messageRow(pietro, TAG)
    .getByRole("button", { name: /🎉\s*1/ })
    .waitFor({ timeout: 20000 });
});
await pietro.screenshot({ path: `${OUT}/04-chat-reaction.png` });

await step("mensagem direta entre duas pessoas", async () => {
  await sidebarOf(pietro).getByRole("button", { name: "Nova conversa" }).click();
  const pop = popoverOf(pietro);
  await pop.waitFor({ state: "visible", timeout: 10000 });
  // estrito dentro do popover: na barra lateral pode haver outra "Caio Duarte"
  await pop.getByRole("button", { name: "Caio Duarte" }).click();
  await pietro.waitForSelector('h2:has-text("Caio Duarte")', { timeout: 20000 });
  await composerOf(pietro).fill(DM);
  await composerOf(pietro).press("Enter");
  await messageRow(pietro, DM).waitFor({ state: "visible", timeout: 20000 });
});
await pietro.screenshot({ path: `${OUT}/05-chat-dm.png` });

await step("selo de não lidas aparece para quem não leu", async () => {
  const caio = await login(browser, USERS.caio, { width: 1280, height: 860 });
  const link = caio.locator('a[href="/chat"]');
  // estado de leitura foi zerado no cleanup → a única não lida é a DM acima
  const text = await waitFor(
    async () => {
      const t = (await link.innerText()).replace(/\s+/g, " ").trim();
      return /\b1\b/.test(t) ? t : null;
    },
    { timeout: 25000, what: 'selo "1" no item Chat da barra lateral' },
  );
  console.log(`   selo na barra lateral: "${text}"`);
  await caio.screenshot({ path: `${OUT}/06-chat-badge.png` });

  // e a conversa aparece destacada dentro do chat
  await caio.goto(`${BASE}/chat`, { waitUntil: "domcontentloaded" });
  await conversationRow(caio, "Pietro Medeiros").waitFor({ state: "visible", timeout: 20000 });
  await caio.waitForSelector(`text=${DM}`, { timeout: 20000 });
});

await pietro.screenshot({ path: `${OUT}/07-chat-final.png` });

console.log("\n———— resumo ————");
for (const r of results) console.log(`${r.ok ? "✔" : "✘"} ${r.name}${r.ok ? "" : ` — ${r.error}`}`);
console.log(
  `\n${failed === 0 ? "✅ CHAT OK" : `❌ ${failed} falha(s)`} — ${results.length - failed}/${results.length} passos\n`,
);

await browser.close();
process.exit(failed ? 1 : 0);

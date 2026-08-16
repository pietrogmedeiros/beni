/**
 * Beni para macOS.
 *
 * O app é uma janela nativa que carrega exatamente a mesma aplicação web —
 * nada é reimplementado aqui. O que a camada nativa acrescenta: menu em
 * português com atalhos do sistema, memória da posição da janela, links
 * externos abrindo no navegador e uma tela para apontar o servidor.
 */
const { app, BrowserWindow, Menu, shell, dialog, nativeTheme } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const DEFAULT_URL = "https://app.benicio.space";
const configFile = path.join(app.getPath("userData"), "config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configFile, "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  fs.writeFileSync(configFile, JSON.stringify(next, null, 2));
  return next;
}

function serverUrl() {
  return process.env.BENI_URL || readConfig().serverUrl || DEFAULT_URL;
}

let mainWindow = null;

function createWindow() {
  const { bounds } = readConfig();

  mainWindow = new BrowserWindow({
    width: bounds?.width ?? 1440,
    height: bounds?.height ?? 900,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    // alinhado com a faixa de 38px que o app web reserva no modo desktop
    trafficLightPosition: { x: 14, y: 12 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1a1a17" : "#fdfdfb",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  const persistBounds = () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFullScreen()) {
      writeConfig({ bounds: mainWindow.getBounds() });
    }
  };
  mainWindow.on("resized", persistBounds);
  mainWindow.on("moved", persistBounds);

  // links externos (GitHub, etc.) vão para o navegador padrão
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(serverUrl())) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Um endereço salvo em teste antigo (localhost, por exemplo) continua
  // valendo depois de instalar uma versão nova, porque a configuração ganha do
  // padrão. Antes de acusar erro, tentamos o endereço de produção uma vez — sem
  // isso o app fica preso apontando para um servidor que não existe mais.
  let tentouPadrao = false;
  mainWindow.webContents.on("did-fail-load", (_e, code, description, url) => {
    if (code === -3) return; // navegação abortada
    if (!tentouPadrao && serverUrl() !== DEFAULT_URL) {
      tentouPadrao = true;
      writeConfig({ serverUrl: DEFAULT_URL });
      mainWindow.loadURL(DEFAULT_URL);
      return;
    }
    showOfflineScreen(description, url);
  });

  // marca o user agent para o app web reservar a faixa dos botões do sistema
  mainWindow.webContents.setUserAgent(
    `${mainWindow.webContents.getUserAgent()} BeniDesktop/${app.getVersion()}`,
  );

  mainWindow.loadURL(serverUrl());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/** Tela mostrada quando o servidor do Beni não responde. */
function showOfflineScreen(reason, url) {
  const html = `
    <!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
    <style>
      :root { color-scheme: light dark; }
      body {
        font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        display: flex; align-items: center; justify-content: center;
        height: 100vh; margin: 0; background: Canvas; color: CanvasText;
        -webkit-app-region: drag;
      }
      .card { max-width: 460px; text-align: center; -webkit-app-region: no-drag; }
      h1 { font-size: 19px; margin: 18px 0 6px; }
      p { color: color-mix(in oklab, CanvasText 60%, transparent); margin: 0 0 18px; }
      code { background: color-mix(in oklab, CanvasText 8%, transparent);
             padding: 2px 6px; border-radius: 6px; font-size: 13px; }
      input { width: 100%; padding: 9px 11px; border-radius: 9px; font-size: 14px;
              border: 1px solid color-mix(in oklab, CanvasText 20%, transparent);
              background: Canvas; color: CanvasText; margin-bottom: 10px; }
      button { background: #f5b301; color: #3b2c05; border: 0; border-radius: 9px;
               padding: 9px 18px; font-size: 14px; font-weight: 600; cursor: pointer; }
      img { width: 56px; height: 56px; }
    </style></head><body>
      <div class="card">
        <img src="data:image/png;base64,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" alt="" width="56" height="56" />
        <h1>Não consegui falar com o Beni</h1>
        <p>Tentei <code>${url ?? serverUrl()}</code><br />${reason ?? ""}</p>
        <input id="url" value="${DEFAULT_URL}" placeholder="${DEFAULT_URL}" />
        <button onclick="location.href='beni-set://'+encodeURIComponent(document.getElementById('url').value)">
          Conectar
        </button>
      </div>
    </body></html>`;

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

// captura o "protocolo" usado pelo botão da tela offline
app.on("web-contents-created", (_e, contents) => {
  contents.on("will-navigate", (event, url) => {
    if (url.startsWith("beni-set://")) {
      event.preventDefault();
      const value = decodeURIComponent(url.replace("beni-set://", "")).replace(/\/$/, "");
      writeConfig({ serverUrl: value });
      mainWindow.loadURL(value);
    }
  });
});

function buildMenu() {
  const template = [
    {
      label: "Beni",
      submenu: [
        { role: "about", label: "Sobre o Beni" },
        { type: "separator" },
        {
          label: "Servidor…",
          accelerator: "Cmd+,",
          click: async () => {
            const { response } = await dialog.showMessageBox(mainWindow, {
              type: "question",
              message: "Servidor do Beni",
              detail: `Conectado a ${serverUrl()}`,
              buttons: ["Trocar servidor", "Fechar"],
              defaultId: 1,
              cancelId: 1,
            });
            if (response === 0) showOfflineScreen("Informe o endereço do servidor.", serverUrl());
          },
        },
        { type: "separator" },
        { role: "hide", label: "Ocultar o Beni" },
        { role: "hideOthers", label: "Ocultar os outros" },
        { role: "unhide", label: "Mostrar tudo" },
        { type: "separator" },
        { role: "quit", label: "Encerrar o Beni" },
      ],
    },
    {
      label: "Editar",
      submenu: [
        { role: "undo", label: "Desfazer" },
        { role: "redo", label: "Refazer" },
        { type: "separator" },
        { role: "cut", label: "Recortar" },
        { role: "copy", label: "Copiar" },
        { role: "paste", label: "Colar" },
        { role: "selectAll", label: "Selecionar tudo" },
      ],
    },
    {
      label: "Ver",
      submenu: [
        { role: "reload", label: "Recarregar" },
        { role: "forceReload", label: "Recarregar do zero" },
        { type: "separator" },
        { role: "resetZoom", label: "Tamanho normal" },
        { role: "zoomIn", label: "Aumentar" },
        { role: "zoomOut", label: "Diminuir" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Tela cheia" },
        { role: "toggleDevTools", label: "Ferramentas do desenvolvedor" },
      ],
    },
    {
      label: "Ir",
      submenu: [
        { label: "Início", accelerator: "Cmd+1", click: () => go("/") },
        { label: "Minhas tarefas", accelerator: "Cmd+2", click: () => go("/my-tasks") },
        { label: "Projetos", accelerator: "Cmd+3", click: () => go("/projects") },
        { type: "separator" },
        { label: "Configurações", click: () => go("/settings") },
        { type: "separator" },
        {
          label: "Voltar",
          accelerator: "Cmd+[",
          click: () => mainWindow?.webContents.navigationHistory.goBack(),
        },
        {
          label: "Avançar",
          accelerator: "Cmd+]",
          click: () => mainWindow?.webContents.navigationHistory.goForward(),
        },
      ],
    },
    {
      label: "Janela",
      submenu: [
        { role: "minimize", label: "Minimizar" },
        { role: "zoom", label: "Zoom" },
        { role: "close", label: "Fechar janela" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function go(pathname) {
  mainWindow?.loadURL(`${serverUrl()}${pathname}`);
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

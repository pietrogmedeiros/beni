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

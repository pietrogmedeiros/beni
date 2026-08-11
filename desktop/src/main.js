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

// O app é servido sob um prefixo; apontar para a raiz do domínio dá 404.
const DEFAULT_URL = "https://beni.space/workspace";
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

  mainWindow.webContents.on("did-fail-load", (_e, code, description, url) => {
    if (code === -3) return; // navegação abortada
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
      svg { width: 46px; height: 46px; }
    </style></head><body>
      <div class="card">
        <svg viewBox="0 0 32 32" fill="none">
          <defs><linearGradient id="g" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fbbf24"/><stop offset="55%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#d97706"/></linearGradient></defs>
          <g stroke="url(#g)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8.5 5.5V26.5"/><path d="M8.5 5.5h6.2a5.2 5.2 0 0 1 0 10.4H8.5"/>
            <path d="M8.5 15.9h7a5.3 5.3 0 0 1 0 10.6h-7"/>
          </g><circle cx="26.4" cy="7.4" r="2.6" fill="url(#g)"/>
        </svg>
        <h1>Não consegui falar com o Beni</h1>
        <p>Tentei <code>${url ?? serverUrl()}</code><br />${reason ?? ""}</p>
        <input id="url" value="${serverUrl()}" placeholder="http://localhost:3000" />
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

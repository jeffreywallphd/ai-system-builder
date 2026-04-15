import { app, BrowserWindow } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function resolvePreloadPath(): string {
  return path.resolve(__dirname, "../preload/index.js");
}

function resolveRendererPath(): string {
  const distRendererHtml = path.resolve(__dirname, "../renderer/index.html");

  if (existsSync(distRendererHtml)) {
    return distRendererHtml;
  }

  return path.resolve(process.cwd(), "apps/desktop/src/renderer/index.html");
}

async function loadRenderer(mainWindow: BrowserWindow): Promise<void> {
  const devServerUrl = process.env.ELECTRON_RENDERER_URL;

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    return;
  }

  const rendererPath = resolveRendererPath();
  await mainWindow.loadURL(pathToFileURL(rendererPath).toString());
}

async function createMainWindow(): Promise<BrowserWindow> {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await loadRenderer(mainWindow);

  return mainWindow;
}

app.whenReady().then(async () => {
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

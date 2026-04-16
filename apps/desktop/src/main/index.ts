import path from "node:path";

import { app, BrowserWindow, ipcMain } from "electron";

import { composeDesktopHost } from "../../../../modules/hosts/desktop";

const openWindows = new Set<BrowserWindow>();

async function createMainWindow(): Promise<void> {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  openWindows.add(mainWindow);

  mainWindow.on("closed", () => {
    openWindows.delete(mainWindow);
  });

  await mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
}

app.whenReady().then(async () => {
  const desktopHost = composeDesktopHost({
    logging: {
      verbosity: process.env.LOG_VERBOSITY,
      level: "info",
    },
  });

  desktopHost.registerImageUploadIpc({
    ipcMain,
    storageRootDirectory: path.join(app.getPath("userData"), "artifacts"),
  });

  await createMainWindow();

  app.on("activate", async () => {
    if (openWindows.size === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

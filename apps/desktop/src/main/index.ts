import path from "node:path";

import { app, BrowserWindow, ipcMain } from "electron";

import { composeDesktopHost } from "../../../../modules/hosts/desktop";
import { recordDesktopMemorySnapshot } from "../../../../modules/hosts/desktop/diagnostics";

recordDesktopMemorySnapshot({
  milestone: "desktop.main.module.loaded",
  component: "desktop-main",
});

const openWindows = new Set<BrowserWindow>();

async function createMainWindow(): Promise<void> {
  recordDesktopMemorySnapshot({
    milestone: "desktop.window.create.before",
    component: "desktop-main",
  });

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  recordDesktopMemorySnapshot({
    milestone: "desktop.window.constructed",
    component: "desktop-main",
  });

  openWindows.add(mainWindow);

  mainWindow.on("closed", () => {
    openWindows.delete(mainWindow);
  });

  mainWindow.maximize();
  recordDesktopMemorySnapshot({
    milestone: "desktop.window.load.before",
    component: "desktop-main",
  });
  await mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  recordDesktopMemorySnapshot({
    milestone: "desktop.window.load.after",
    component: "desktop-main",
  });
  recordDesktopMemorySnapshot({
    milestone: "desktop.window.show.before",
    component: "desktop-main",
  });
  mainWindow.show();
  recordDesktopMemorySnapshot({
    milestone: "desktop.window.show.after",
    component: "desktop-main",
  });
}

recordDesktopMemorySnapshot({
  milestone: "desktop.app.whenReady.enter",
  component: "desktop-main",
});

app.whenReady().then(async () => {
  recordDesktopMemorySnapshot({
    milestone: "desktop.app.whenReady.ready",
    component: "desktop-main",
  });

  const desktopDataRootDirectory = app.getPath("userData");
  const storageRootDirectory = path.join(desktopDataRootDirectory, "artifacts");
  recordDesktopMemorySnapshot({
    milestone: "desktop.paths.resolved",
    component: "desktop-main",
    detail: {
      hasUserDataPath: Boolean(desktopDataRootDirectory),
      hasStorageRoot: Boolean(storageRootDirectory),
    },
  });

  recordDesktopMemorySnapshot({
    milestone: "desktop.host.compose.before",
    component: "desktop-main",
  });
  const desktopHost = composeDesktopHost({
    logging: {
      verbosity: process.env.LOG_VERBOSITY,
      level: "info",
    },
    artifactRepo: {
      huggingFaceAccessToken: process.env.HF_TOKEN ?? process.env.HUGGING_FACE_TOKEN,
      huggingFaceTokenConfigFilePath: path.join(storageRootDirectory, "config", "hugging-face-token.json"),
    },
  });
  recordDesktopMemorySnapshot({
    milestone: "desktop.host.compose.after",
    component: "desktop-main",
  });

  recordDesktopMemorySnapshot({
    milestone: "desktop.ipc.register.before",
    component: "desktop-main",
  });
  desktopHost.registerDesktopIpc({
    ipcMain,
    storageRootDirectory,
    runtimeRootDirectory: desktopDataRootDirectory,
  });
  recordDesktopMemorySnapshot({
    milestone: "desktop.ipc.register.after",
    component: "desktop-main",
  });

  await createMainWindow();

  app.on("activate", async () => {
    if (openWindows.size === 0) {
      recordDesktopMemorySnapshot({
        milestone: "desktop.activate.window-create.before",
        component: "desktop-main",
      });
      await createMainWindow();
      recordDesktopMemorySnapshot({
        milestone: "desktop.activate.window-create.after",
        component: "desktop-main",
      });
    }
  });

  app.on("before-quit", () => {
    recordDesktopMemorySnapshot({
      milestone: "desktop.before-quit",
      component: "desktop-main",
    });
    void desktopHost.stopPythonRuntime();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

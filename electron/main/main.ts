import started from "electron-squirrel-startup";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain } from "electron";
import { InitializeProductionStorageUseCase } from "../../application/runtime/InitializeProductionStorageUseCase";
import { ResolveAppRuntimeModeUseCase } from "../../application/runtime/ResolveAppRuntimeModeUseCase";
import { resolveDesktopStoragePaths } from "../../infrastructure/desktop/DesktopAppPaths";
import { DesktopStorageDatabase } from "../../infrastructure/desktop/DesktopStorageDatabase";
import { DesktopWorkflowPersistence } from "../../infrastructure/desktop/DesktopWorkflowPersistence";
import { resolveDesktopPythonRuntime } from "../../infrastructure/desktop/DesktopPythonRuntimeResolver";
import { AppRuntimeConfig } from "../../infrastructure/config/AppRuntimeConfig";
import { DesktopServiceSupervisor } from "./DesktopServiceSupervisor";
import type { DesktopBootstrapContext } from "../shared/DesktopContracts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (started) {
  app.quit();
}
const repoRoot = path.resolve(__dirname, "../..");
const isPackaged = app.isPackaged;
const rendererDevUrl = process.env.ELECTRON_RENDERER_URL || "http://127.0.0.1:5174";

let mainWindow: BrowserWindow | undefined;
let storageDatabase: DesktopStorageDatabase | undefined;
let workflowPersistence: DesktopWorkflowPersistence | undefined;
let serviceSupervisor: DesktopServiceSupervisor | undefined;
let bootstrapContext: DesktopBootstrapContext | undefined;

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    show: false,
    backgroundColor: "#111827",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "../preload.mjs"),
    },
  });

  mainWindow = window;
  window.once("ready-to-show", () => window.show());

  if (isPackaged) {
    await window.loadFile(path.join(__dirname, "../../dist/index.html"));
  } else {
    await window.loadURL(rendererDevUrl);
    window.webContents.openDevTools({ mode: "detach" });
  }
}

async function bootstrapDesktopRuntime(): Promise<void> {
  const storagePaths = resolveDesktopStoragePaths({
    userDataPath: app.getPath("userData"),
    logsPath: app.getPath("logs"),
  });

  storageDatabase = new DesktopStorageDatabase({ paths: storagePaths });
  await new InitializeProductionStorageUseCase(storageDatabase).execute();

  const pythonRuntime = resolveDesktopPythonRuntime({
    isPackaged,
    repoRoot,
    resourcesPath: process.resourcesPath,
    storagePaths,
  });

  serviceSupervisor = new DesktopServiceSupervisor({
    repoRoot,
    isPackaged,
    resourcesPath: process.resourcesPath,
    storagePaths,
    pythonRuntime,
  });
  await serviceSupervisor.start();

  const runtimeMode = new ResolveAppRuntimeModeUseCase().execute({
    hasDesktopHost: true,
    isPackagedDesktopHost: isPackaged,
  });

  const runtimeConfig = isPackaged
    ? AppRuntimeConfig.forDesktopProduction({
        storage: storagePaths,
        pythonRuntime,
        serviceSupervisorBaseUrl: serviceSupervisor.baseUrl,
        serviceSupervisorPort: 8790,
      })
    : AppRuntimeConfig.forDesktopDevelopment({
        storage: storagePaths,
        pythonRuntime,
        serviceSupervisorBaseUrl: serviceSupervisor.baseUrl,
        serviceSupervisorPort: 8790,
      });

  bootstrapContext = Object.freeze({
    runtimeConfig: runtimeConfig.toValues(),
    storage: storagePaths,
    serviceSupervisor: {
      baseUrl: serviceSupervisor.baseUrl,
      port: 8790,
    },
    pythonRuntime,
  });

  ipcMain.on("ai-loom-desktop:get-bootstrap-sync", (event) => {
    event.returnValue = bootstrapContext;
  });
  ipcMain.on("ai-loom-desktop-storage:getItem", (event, key: string) => {
    event.returnValue = storageDatabase?.getItem(key) ?? null;
  });
  ipcMain.on("ai-loom-desktop-storage:setItem", (_event, key: string, value: string) => {
    storageDatabase?.setItem(key, value);
  });
  ipcMain.on("ai-loom-desktop-storage:removeItem", (_event, key: string) => {
    storageDatabase?.removeItem(key);
  });
  const workflowsDirectory = runtimeConfig.workflowStorageDirectory
    ? path.resolve(repoRoot, runtimeConfig.workflowStorageDirectory)
    : path.resolve(repoRoot, "dev/workflow-data/workflows");
  const workflowIndexDatabasePath = runtimeConfig.workflowIndexDatabasePath
    ? path.resolve(repoRoot, runtimeConfig.workflowIndexDatabasePath)
    : path.resolve(repoRoot, "dev/workflow-data/workflows/workflow-index.sqlite");
  workflowPersistence = new DesktopWorkflowPersistence({
    workflowsDirectory,
    indexDatabasePath: workflowIndexDatabasePath,
  });
  ipcMain.on("ai-loom-desktop-workflows:save-record", (_event, recordJson: string) => {
    workflowPersistence?.saveWorkflowRecord(recordJson);
  });
  ipcMain.on("ai-loom-desktop-workflows:load-record", (event, id: string) => {
    event.returnValue = workflowPersistence?.loadWorkflowRecord(id) ?? null;
  });
  ipcMain.on("ai-loom-desktop-workflows:list-summaries", (event) => {
    event.returnValue = workflowPersistence?.listWorkflowSummaries() ?? [];
  });
  ipcMain.on("ai-loom-desktop-workflows:delete-record", (_event, id: string) => {
    workflowPersistence?.deleteWorkflowRecord(id);
  });
  ipcMain.on("ai-loom-desktop-workflows:exists", (event, id: string) => {
    event.returnValue = workflowPersistence?.workflowExists(id) ?? false;
  });
  ipcMain.on("ai-loom-desktop-workflows:status", (event) => {
    event.returnValue = workflowPersistence?.getWorkflowPersistenceStatus() ?? {
      provider: "desktop-filesystem-indexed",
      workflowsDirectory,
      indexDatabasePath: workflowIndexDatabasePath,
      degraded: true,
      detail: "Desktop workflow persistence service is unavailable.",
    };
  });

  if (runtimeMode === "desktop-production" && !pythonRuntime.isAvailable) {
    console.warn(
      `[ai-loom] Packaged private Python runtime was not found at '${pythonRuntime.executablePath ?? pythonRuntime.runtimeRoot}'.`,
    );
  }
}

app.whenReady().then(async () => {
  await bootstrapDesktopRuntime();
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
}).catch((error) => {
  console.error("Failed to bootstrap desktop host", error);
  app.exit(1);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  await serviceSupervisor?.stop();
  storageDatabase?.dispose();
});

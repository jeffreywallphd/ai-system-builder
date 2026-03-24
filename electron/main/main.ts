import started from "electron-squirrel-startup";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain } from "electron";
import { InitializeProductionStorageUseCase } from "../../application/runtime/InitializeProductionStorageUseCase";
import { GetExecutionRunUseCase } from "../../application/execution/GetExecutionRunUseCase";
import { resolveDesktopStoragePaths } from "../../infrastructure/desktop/DesktopAppPaths";
import { DesktopStorageDatabase } from "../../infrastructure/desktop/DesktopStorageDatabase";
import { DesktopWorkflowPersistence } from "../../infrastructure/desktop/DesktopWorkflowPersistence";
import { SqliteExecutionRunRepository } from "../../infrastructure/filesystem/execution/SqliteExecutionRunRepository";
import {
  createExecutionHistoryInfrastructure,
  createExecutionRunRepository,
} from "../../infrastructure/execution/createExecutionInfrastructure";
import { resolveDesktopPythonRuntime } from "../../infrastructure/desktop/DesktopPythonRuntimeResolver";
import { AppRuntimeConfig } from "../../infrastructure/config/AppRuntimeConfig";
import { RendererDeliveryModes } from "../../domain/runtime/AppRuntimeProfile";
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
let executionRunRepository: SqliteExecutionRunRepository | undefined;
let getExecutionRunUseCase: GetExecutionRunUseCase | undefined;
let listExecutionRunsUseCase: ReturnType<typeof createExecutionHistoryInfrastructure>["listExecutionRunsUseCase"] | undefined;
let serviceSupervisor: DesktopServiceSupervisor | undefined;
let bootstrapContext: DesktopBootstrapContext | undefined;

function toFileEntry(filePath: string) {
  const stats = fs.statSync(filePath);
  return {
    path: filePath,
    kind: stats.isDirectory() ? "directory" as const : "file" as const,
    size: stats.isFile() ? stats.size : undefined,
    modifiedAt: stats.mtime.toISOString(),
  };
}

function listEntries(rootPath: string, recursive = false): ReadonlyArray<ReturnType<typeof toFileEntry>> {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  const results: ReturnType<typeof toFileEntry>[] = [];
  const walk = (currentPath: string) => {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      results.push(toFileEntry(entryPath));
      if (recursive && entry.isDirectory()) {
        walk(entryPath);
      }
    }
  };
  walk(rootPath);
  return results;
}

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

  const runtimeConfig = bootstrapContext?.runtimeConfig;
  if (runtimeConfig?.rendererDeliveryMode === RendererDeliveryModes.packagedAssets) {
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
  executionRunRepository = createExecutionRunRepository({
    sqliteDatabasePath: storagePaths.databasePath,
  }) as SqliteExecutionRunRepository;
  const executionHistoryInfrastructure = createExecutionHistoryInfrastructure(executionRunRepository);
  getExecutionRunUseCase = new GetExecutionRunUseCase(executionRunRepository);
  listExecutionRunsUseCase = executionHistoryInfrastructure.listExecutionRunsUseCase;
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
  ipcMain.handle("ai-loom-desktop-execution-runs:save", async (_event, runJson: string) => {
    if (!executionRunRepository) {
      return;
    }
    await executionRunRepository.saveRun(JSON.parse(runJson));
  });
  ipcMain.handle("ai-loom-desktop-execution-runs:load", async (_event, runId: string) => {
    const run = await getExecutionRunUseCase?.execute(runId);
    return run ? JSON.stringify(run) : null;
  });
  ipcMain.handle("ai-loom-desktop-execution-runs:list", async (_event, criteriaJson?: string) => {
    const criteria = criteriaJson ? JSON.parse(criteriaJson) : undefined;
    const runs = await listExecutionRunsUseCase?.execute(criteria);
    return (runs ?? []).map((run) => JSON.stringify(run));
  });
  ipcMain.on("ai-loom-desktop-model-files:exists", (event, targetPath: string) => {
    event.returnValue = fs.existsSync(targetPath);
  });
  ipcMain.on("ai-loom-desktop-model-files:stat", (event, targetPath: string) => {
    event.returnValue = toFileEntry(targetPath);
  });
  ipcMain.on("ai-loom-desktop-model-files:read", (event, targetPath: string) => {
    event.returnValue = new Uint8Array(fs.readFileSync(targetPath));
  });
  ipcMain.on("ai-loom-desktop-model-files:write", (_event, request: { path: string; content: Uint8Array; overwrite?: boolean; createDirectories?: boolean }) => {
    if (!request.overwrite && fs.existsSync(request.path)) {
      throw new Error(`File '${request.path}' already exists.`);
    }
    if (request.createDirectories) {
      fs.mkdirSync(path.dirname(request.path), { recursive: true });
    }
    fs.writeFileSync(request.path, Buffer.from(request.content));
  });
  ipcMain.on("ai-loom-desktop-model-files:delete", (_event, targetPath: string) => {
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
  });
  ipcMain.on("ai-loom-desktop-model-files:list", (event, targetPath: string, options?: { recursive?: boolean }) => {
    event.returnValue = listEntries(targetPath, options?.recursive === true);
  });
  ipcMain.on("ai-loom-desktop-model-files:move", (_event, request: { from: string; to: string; overwrite?: boolean }) => {
    if (!request.overwrite && fs.existsSync(request.to)) {
      throw new Error(`File '${request.to}' already exists.`);
    }
    fs.mkdirSync(path.dirname(request.to), { recursive: true });
    fs.renameSync(request.from, request.to);
  });
  ipcMain.on("ai-loom-desktop-model-files:copy", (_event, request: { from: string; to: string; overwrite?: boolean }) => {
    if (!request.overwrite && fs.existsSync(request.to)) {
      throw new Error(`File '${request.to}' already exists.`);
    }
    fs.mkdirSync(path.dirname(request.to), { recursive: true });
    fs.copyFileSync(request.from, request.to);
  });

  if (runtimeConfig.isPackagedDesktopHost && !pythonRuntime.isAvailable) {
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
  executionRunRepository?.dispose();
});

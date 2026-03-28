import started from "electron-squirrel-startup";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, safeStorage } from "electron";
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
import { SqliteAssetSystemRepository } from "../../infrastructure/filesystem/SqliteAssetSystemRepository";
import { InMemoryAssetLineageGraphProjectionSink } from "../../infrastructure/filesystem/InMemoryAssetLineageGraphProjectionSink";
import { ExplainCanonicalVersionExistenceUseCase, ListCanonicalAssetsUseCase, LoadCanonicalAssetDetailUseCase } from "../../application/assets-system/CanonicalAssetReadUseCases";
import { GetAssetVersionHistoryUseCase } from "../../application/assets-system/GetAssetVersionHistoryUseCase";
import { GetCanonicalDependencyStateUseCase } from "../../application/assets-system/CanonicalDependencyStateUseCase";
import { GetAssetDependencyHealthUseCase } from "../../application/assets-system/GetAssetDependencyHealthUseCase";
import { GetAssetImpactAnalysisUseCase } from "../../application/assets-system/GetAssetImpactAnalysisUseCase";
import { GetCanonicalProvenanceSummaryUseCase } from "../../application/assets-system/CanonicalAssetReadUseCases";
import { ReconcileCanonicalIdentityMappingsUseCase, ReplayScopedAssetGraphProjectionUseCase } from "../../application/assets-system/ReconciliationUseCases";
import { ReplayAssetGraphProjectionUseCase } from "../../application/assets-system/ReplayAssetGraphProjectionUseCase";
import { VerifyAssetGraphProjectionUseCase } from "../../application/assets-system/VerifyAssetGraphProjectionUseCase";
import { ProjectionRebuildOrchestrationUseCase } from "../../application/assets-system/ProjectionRebuildOrchestrationUseCase";
import { LoadCanonicalAssetManagementSnapshotUseCase } from "../../application/assets-system/LoadCanonicalAssetManagementSnapshotUseCase";
import { ProjectionTrustReadModelService } from "../../application/assets-system/ProjectionTrustReadModelService";
import { SqliteAgentRepository } from "../../infrastructure/filesystem/agents/SqliteAgentRepository";
import { SqliteAgentExecutionSessionRepository } from "../../infrastructure/filesystem/agents/SqliteAgentExecutionSessionRepository";
import { AgentStudioBackendApi } from "../../infrastructure/api/agents/AgentStudioBackendApi";
import { AgentRunnerService } from "../../application/agents/services/AgentRunnerService";
import { DeterministicAgentPlanningService } from "../../application/agents/services/AgentPlanningInterface";
import { ExecuteAgentToolsUseCase } from "../../application/agents/ExecuteAgentToolsUseCase";
import { DefaultAgentMemoryRetrievalService } from "../../application/agents/services/AgentMemoryRetrievalService";
import { AgentMemoryWriteService } from "../../application/agents/services/AgentMemoryWriteService";
import { AssetBackedAgentMemoryStore } from "../../application/agents/services/AssetBackedAgentMemoryStore";
import { CompositeToolCapabilityCatalog } from "../../infrastructure/tools/CompositeToolCapabilityCatalog";
import { StaticLocalToolCapabilityCatalog } from "../../infrastructure/tools/StaticLocalToolCapabilityCatalog";
import { McpToolCapabilityCatalog } from "../../infrastructure/tools/McpToolCapabilityCatalog";
import { CompositeToolCapabilityExecutor } from "../../infrastructure/tools/CompositeToolCapabilityExecutor";
import { StaticLocalToolCapabilityExecutor } from "../../infrastructure/tools/StaticLocalToolCapabilityExecutor";
import { McpToolCapabilityExecutor } from "../../infrastructure/tools/McpToolCapabilityExecutor";
import { DeterministicToolCapabilityAgentOrchestrator } from "../../infrastructure/agents/DeterministicToolCapabilityAgentOrchestrator";
import { PythonRuntimeConfig } from "../../infrastructure/config/PythonRuntimeConfig";
import { createMcpRuntimeIntegration } from "../../infrastructure/python/mcp/createMcpRuntimeIntegration";
import { SqliteAssetSystemAgentMemoryCatalog } from "../../infrastructure/filesystem/agents/SqliteAssetSystemAgentMemoryCatalog";
import type { CreateAgentRequest } from "../../application/agents/CreateAgentUseCase";
import type { UpdateAgentRequest } from "../../application/agents/UpdateAgentUseCase";
import type { ConfigureAgentGoalsRequest } from "../../application/agents/ConfigureAgentGoalsUseCase";
import type { AgentPolicy, AgentToolAccessPolicy } from "../../domain/agents/AgentPolicy";
import type { AgentMemoryConfiguration } from "../../domain/agents/AgentMemory";
import type { AgentPlanningStrategy } from "../../domain/agents/Agent";
import type { AgentConfigurationValidationInput } from "../../application/agents/services/AgentConfigurationValidationService";
import type { AgentRunControlRequest, AgentRunRequest } from "../../application/agents/contracts/AgentRunContracts";
import type { TriggerAgentLaunchRequest } from "../../application/agents/TriggerAgentLaunchUseCase";
import { StudioShellBackendApi } from "../../infrastructure/api/studio-shell/StudioShellBackendApi";
import { RegistryBackendApi } from "../../infrastructure/api/registry/RegistryBackendApi";
import { SqliteStudioShellRepository } from "../../infrastructure/filesystem/studio-shell/SqliteStudioShellRepository";
import type { CreateAssetDraftCommand, PublishAssetDraftVersionCommand, TransitionAssetDraftLifecycleCommand, UpdateAssetDraftCommand, UpdateAssetDraftDependenciesCommand } from "../../application/studio-shell/contracts";
import { RegistryQueryService } from "../../application/asset-registry/RegistryQueryService";
import { CrossStudioRegistryQueryService } from "../../application/asset-registry/CrossStudioRegistryQueryService";
import { RegistryDependencyGraphService } from "../../application/asset-registry/RegistryDependencyGraphService";
import { RegistryCacheLayer } from "../../application/asset-registry/RegistryCacheLayer";
import { CompositionAssetContractResolver } from "../../application/contracts/CompositionAssetContractResolver";
import { SystemStudioBackendApi } from "../../infrastructure/api/system-studio/SystemStudioBackendApi";

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
let canonicalAssetSystemRepository: SqliteAssetSystemRepository | undefined;
let canonicalProjectionSink: InMemoryAssetLineageGraphProjectionSink | undefined;
let agentRepository: SqliteAgentRepository | undefined;
let agentSessionRepository: SqliteAgentExecutionSessionRepository | undefined;
let serviceSupervisor: DesktopServiceSupervisor | undefined;
let studioShellRepository: SqliteStudioShellRepository | undefined;
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

function createDesktopAgentRunner(params: {
  readonly assetSystemRepository: SqliteAssetSystemRepository;
  readonly sessionRepository: SqliteAgentExecutionSessionRepository;
}): AgentRunnerService {
  const pythonConfig = PythonRuntimeConfig.fromEnv(process.env);
  const mcpIntegration = createMcpRuntimeIntegration(pythonConfig);
  const toolCatalog = new CompositeToolCapabilityCatalog([
    new StaticLocalToolCapabilityCatalog([]),
    new McpToolCapabilityCatalog(mcpIntegration.toolCatalog),
  ]);
  const toolExecutor = new CompositeToolCapabilityExecutor([
    {
      providerKind: "local",
      providerId: "local-runtime",
      executor: new StaticLocalToolCapabilityExecutor({}),
    },
    {
      providerKind: "mcp",
      providerId: "python-mcp-runtime",
      executor: new McpToolCapabilityExecutor(mcpIntegration.toolExecutor),
    },
  ]);
  const memoryStore = new AssetBackedAgentMemoryStore(
    new SqliteAssetSystemAgentMemoryCatalog(params.assetSystemRepository),
    params.assetSystemRepository,
  );
  return new AgentRunnerService(
    new DeterministicAgentPlanningService(toolCatalog, memoryStore),
    new ExecuteAgentToolsUseCase(toolCatalog, new DeterministicToolCapabilityAgentOrchestrator(toolExecutor)),
    new DefaultAgentMemoryRetrievalService(memoryStore),
    new AgentMemoryWriteService(memoryStore),
    undefined,
    undefined,
    params.sessionRepository,
  );
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
  ipcMain.on("ai-loom-desktop-secrets:is-available", (event) => {
    event.returnValue = safeStorage.isEncryptionAvailable();
  });
  ipcMain.on("ai-loom-desktop-secrets:get", (event, key: string) => {
    const encoded = storageDatabase?.getItem(`secure:${key}`) ?? null;
    if (!encoded) {
      event.returnValue = null;
      return;
    }
    try {
      const decrypted = safeStorage.decryptString(Buffer.from(encoded, "base64"));
      event.returnValue = decrypted;
    } catch {
      event.returnValue = null;
    }
  });
  ipcMain.on("ai-loom-desktop-secrets:set", (_event, key: string, value: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      return;
    }
    const encrypted = safeStorage.encryptString(value).toString("base64");
    storageDatabase?.setItem(`secure:${key}`, encrypted);
  });
  ipcMain.on("ai-loom-desktop-secrets:remove", (_event, key: string) => {
    storageDatabase?.removeItem(`secure:${key}`);
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
  agentRepository = new SqliteAgentRepository(path.join(storagePaths.storageDirectory, "agents", "agents.sqlite"));
  agentSessionRepository = new SqliteAgentExecutionSessionRepository(path.join(storagePaths.storageDirectory, "agents", "agent-sessions.sqlite"));
  const agentRunnerAssetSystemRepository = new SqliteAssetSystemRepository(path.join(storagePaths.assetsDirectory, "asset-system.sqlite"));
  const agentRunner = createDesktopAgentRunner({
    assetSystemRepository: agentRunnerAssetSystemRepository,
    sessionRepository: agentSessionRepository,
  });
  const agentStudioBackendApi = new AgentStudioBackendApi(agentRepository, agentSessionRepository, agentRunner);
  studioShellRepository = new SqliteStudioShellRepository(path.join(storagePaths.storageDirectory, "studio-shell", "studio-shell.sqlite"));
  const studioShellBackendApi = new StudioShellBackendApi(studioShellRepository);
  const systemStudioBackendApi = new SystemStudioBackendApi(studioShellRepository);
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
  ipcMain.handle("ai-loom-desktop-agents:create", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as CreateAgentRequest;
    return JSON.stringify(await agentStudioBackendApi.createAgent(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:update", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as UpdateAgentRequest;
    return JSON.stringify(await agentStudioBackendApi.updateAgent(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:get", async (_event, agentId: string) => {
    return JSON.stringify(await agentStudioBackendApi.getAgent(agentId));
  });
  ipcMain.handle("ai-loom-desktop-agents:list", async (_event, includeArchived = true) => {
    return JSON.stringify(await agentStudioBackendApi.listAgents(includeArchived));
  });
  ipcMain.handle("ai-loom-desktop-agents:delete", async (_event, agentId: string) => {
    return JSON.stringify(await agentStudioBackendApi.deleteAgent(agentId));
  });
  ipcMain.handle("ai-loom-desktop-agents:archive", async (_event, agentId: string) => {
    return JSON.stringify(await agentStudioBackendApi.archiveAgent(agentId));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-goals", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as ConfigureAgentGoalsRequest;
    return JSON.stringify(await agentStudioBackendApi.configureGoals(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-policy", async (_event, agentId: string, policyJson: string) => {
    const policy = JSON.parse(policyJson) as AgentPolicy;
    return JSON.stringify(await agentStudioBackendApi.configurePolicy(agentId, policy));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-tools", async (_event, agentId: string, toolAccessJson: string) => {
    const toolAccess = JSON.parse(toolAccessJson) as AgentToolAccessPolicy;
    return JSON.stringify(await agentStudioBackendApi.configureTools(agentId, toolAccess));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-memory", async (_event, agentId: string, memoryJson: string) => {
    const memory = JSON.parse(memoryJson) as AgentMemoryConfiguration;
    return JSON.stringify(await agentStudioBackendApi.configureMemory(agentId, memory));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-strategy", async (_event, agentId: string, planningStrategyJson: string) => {
    const planningStrategy = JSON.parse(planningStrategyJson) as AgentPlanningStrategy;
    return JSON.stringify(await agentStudioBackendApi.configureStrategy(agentId, planningStrategy));
  });
  ipcMain.handle("ai-loom-desktop-agents:validate", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as AgentConfigurationValidationInput;
    return JSON.stringify(await agentStudioBackendApi.validateConfiguration(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:launch", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as AgentRunRequest;
    return JSON.stringify(await agentStudioBackendApi.launchAgent(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:trigger-launch", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as TriggerAgentLaunchRequest;
    return JSON.stringify(await agentStudioBackendApi.triggerLaunch(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:list-sessions", async (_event, agentId: string) => {
    return JSON.stringify(await agentStudioBackendApi.listSessions(agentId));
  });
  ipcMain.handle("ai-loom-desktop-agents:get-session", async (_event, sessionId: string) => {
    return JSON.stringify(await agentStudioBackendApi.getSessionDetail(sessionId));
  });
  ipcMain.handle("ai-loom-desktop-agents:control-run", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as AgentRunControlRequest;
    return JSON.stringify(await agentStudioBackendApi.controlRun(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:studio-snapshot", async (_event, agentId: string) => {
    return JSON.stringify(await agentStudioBackendApi.getStudioSnapshot(agentId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:initialize", async (_event, studioId: string, name: string) => {
    return JSON.stringify(await studioShellBackendApi.initializeStudio(studioId, name));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:snapshot", async (_event, studioId: string) => {
    return JSON.stringify(await studioShellBackendApi.loadSnapshot(studioId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:start-session", async (_event, studioId: string) => {
    return JSON.stringify(await studioShellBackendApi.startSession(studioId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:create-draft", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as CreateAssetDraftCommand;
    return JSON.stringify(await studioShellBackendApi.createDraft(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:update-draft", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as UpdateAssetDraftCommand;
    return JSON.stringify(await studioShellBackendApi.updateDraft(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:update-dependencies", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as UpdateAssetDraftDependenciesCommand;
    return JSON.stringify(await studioShellBackendApi.updateDependencies(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:transition-lifecycle", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as TransitionAssetDraftLifecycleCommand;
    return JSON.stringify(await studioShellBackendApi.transitionLifecycle(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:publish-version", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as PublishAssetDraftVersionCommand;
    return JSON.stringify(await studioShellBackendApi.publishVersion(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:validate-draft", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as { studioId: string; draftId: string };
    return JSON.stringify(await studioShellBackendApi.validateDraft(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-components:list", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["listChildComponents"]>[0];
    return JSON.stringify(await systemStudioBackendApi.listChildComponents(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-components:add", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["addChildComponent"]>[0];
    return JSON.stringify(await systemStudioBackendApi.addChildComponent(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-components:remove", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["removeChildComponent"]>[0];
    return JSON.stringify(await systemStudioBackendApi.removeChildComponent(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-components:reorder", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["reorderChildComponent"]>[0];
    return JSON.stringify(await systemStudioBackendApi.reorderChildComponent(request));
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

  canonicalAssetSystemRepository = new SqliteAssetSystemRepository(path.join(storagePaths.assetsDirectory, "asset-system.sqlite"));
  canonicalProjectionSink = new InMemoryAssetLineageGraphProjectionSink();
  const listCanonicalAssetsUseCase = new ListCanonicalAssetsUseCase(canonicalAssetSystemRepository, canonicalAssetSystemRepository);
  const loadCanonicalAssetDetailUseCase = new LoadCanonicalAssetDetailUseCase(
    canonicalAssetSystemRepository,
    canonicalAssetSystemRepository,
    canonicalAssetSystemRepository,
    canonicalAssetSystemRepository,
    canonicalAssetSystemRepository,
  );
  const getVersionHistoryUseCase = new GetAssetVersionHistoryUseCase(canonicalAssetSystemRepository);
  const explainVersionExistenceUseCase = new ExplainCanonicalVersionExistenceUseCase(
    new GetCanonicalProvenanceSummaryUseCase(canonicalAssetSystemRepository, canonicalAssetSystemRepository, canonicalAssetSystemRepository),
    canonicalAssetSystemRepository,
  );
  const dependencyStateUseCase = new GetCanonicalDependencyStateUseCase(
    canonicalAssetSystemRepository,
    canonicalAssetSystemRepository,
    new GetAssetDependencyHealthUseCase(canonicalAssetSystemRepository, canonicalAssetSystemRepository, canonicalAssetSystemRepository),
    new GetAssetImpactAnalysisUseCase(canonicalAssetSystemRepository, canonicalAssetSystemRepository, canonicalAssetSystemRepository),
    new GetCanonicalProvenanceSummaryUseCase(canonicalAssetSystemRepository, canonicalAssetSystemRepository, canonicalAssetSystemRepository),
    canonicalAssetSystemRepository,
  );
  const replayProjectionUseCase = new ReplayAssetGraphProjectionUseCase(canonicalAssetSystemRepository, canonicalProjectionSink);
  const replayScopedProjectionUseCase = new ReplayScopedAssetGraphProjectionUseCase(canonicalAssetSystemRepository, replayProjectionUseCase);
  const verifyProjectionUseCase = new VerifyAssetGraphProjectionUseCase(canonicalAssetSystemRepository, canonicalProjectionSink);
  const projectionTrustReadModelService = new ProjectionTrustReadModelService();
  const rebuildProjectionOrchestrationUseCase = new ProjectionRebuildOrchestrationUseCase(
    replayScopedProjectionUseCase,
    replayProjectionUseCase,
    verifyProjectionUseCase,
  );
  const loadManagementSnapshotUseCase = new LoadCanonicalAssetManagementSnapshotUseCase(
    loadCanonicalAssetDetailUseCase,
    getVersionHistoryUseCase,
    dependencyStateUseCase,
    explainVersionExistenceUseCase,
    verifyProjectionUseCase,
  );
  const registryCacheLayer = new RegistryCacheLayer({ maxEntriesPerNamespace: 300 });
  const registryQueryService = new RegistryQueryService(
    canonicalAssetSystemRepository,
    canonicalAssetSystemRepository,
    canonicalAssetSystemRepository,
    new CompositionAssetContractResolver(),
    canonicalAssetSystemRepository,
    undefined,
    registryCacheLayer,
    canonicalAssetSystemRepository,
  );
  const registryBackendApi = new RegistryBackendApi(
    new CrossStudioRegistryQueryService(registryQueryService),
    new RegistryDependencyGraphService(registryQueryService, canonicalAssetSystemRepository, canonicalAssetSystemRepository, registryCacheLayer),
  );

  ipcMain.handle("ai-loom-desktop-canonical-assets:list", async (_event, criteriaJson?: string) => {
    if (!canonicalAssetSystemRepository?.isAvailable) {
      return [];
    }
    const criteria = criteriaJson ? JSON.parse(criteriaJson) : undefined;
    const assets = await listCanonicalAssetsUseCase.execute(criteria);
    const details = await Promise.all(assets.map((asset) => loadCanonicalAssetDetailUseCase.execute(asset.id)));
    return details
      .filter((entry): entry is NonNullable<typeof entry> => !!entry)
      .map((entry) => JSON.stringify({
        assetId: entry.assetId,
        name: entry.name,
        kind: entry.kind,
        status: entry.status,
        latestVersionId: entry.latestVersion?.versionId,
        versionCount: entry.versionCount,
        transformationCount: entry.transformationCount,
        lineageEdgeCount: entry.lineageEdgeCount,
      }));
  });
  ipcMain.handle("ai-loom-desktop-registry:assets", async (_event, limit?: number) => {
    return JSON.stringify(await registryBackendApi.listAssets(limit));
  });
  ipcMain.handle("ai-loom-desktop-registry:assets-filter", async (_event, filtersJson: string) => {
    const filters = JSON.parse(filtersJson) as Parameters<RegistryBackendApi["filterAssets"]>[0];
    return JSON.stringify(await registryBackendApi.filterAssets(filters));
  });
  ipcMain.handle("ai-loom-desktop-registry:search", async (_event, queryJson: string) => {
    const query = JSON.parse(queryJson) as Parameters<RegistryBackendApi["searchAssets"]>[0];
    return JSON.stringify(await registryBackendApi.searchAssets(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:asset-detail", async (_event, queryJson: string) => {
    const query = JSON.parse(queryJson) as Parameters<RegistryBackendApi["getAssetDetail"]>[0];
    return JSON.stringify(await registryBackendApi.getAssetDetail(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:dependencies", async (_event, queryJson: string) => {
    const query = JSON.parse(queryJson) as Parameters<RegistryBackendApi["getDependencies"]>[0];
    return JSON.stringify(await registryBackendApi.getDependencies(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:dependents", async (_event, queryJson: string) => {
    const query = JSON.parse(queryJson) as Parameters<RegistryBackendApi["getDependents"]>[0];
    return JSON.stringify(await registryBackendApi.getDependents(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:traverse-upstream", async (_event, queryJson: string) => {
    const query = JSON.parse(queryJson) as Parameters<RegistryBackendApi["traverseDependencies"]>[0];
    return JSON.stringify(await registryBackendApi.traverseDependencies(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:traverse-downstream", async (_event, queryJson: string) => {
    const query = JSON.parse(queryJson) as Parameters<RegistryBackendApi["traverseDependents"]>[0];
    return JSON.stringify(await registryBackendApi.traverseDependents(query));
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:detail", async (_event, assetId: string) => {
    if (!canonicalAssetSystemRepository?.isAvailable) {
      return null;
    }
    const detail = await loadCanonicalAssetDetailUseCase.execute(assetId);
    if (!detail) return null;
    return JSON.stringify({
      assetId: detail.assetId,
      name: detail.name,
      kind: detail.kind,
      status: detail.status,
      latestVersionId: detail.latestVersion?.versionId,
      versionCount: detail.versionCount,
      transformationCount: detail.transformationCount,
      lineageEdgeCount: detail.lineageEdgeCount,
    });
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:version-chain", async (_event, assetId: string) => {
    if (!canonicalAssetSystemRepository?.isAvailable) {
      return [];
    }
    const chain = await getVersionHistoryUseCase.execute(assetId);
    const withState = await Promise.all(chain.map(async (version) => {
      const dependencyState = await dependencyStateUseCase.execute({
        versionId: version.versionId,
        preferPersistedIfFreshMs: 300_000,
      }).catch(() => undefined);
      return JSON.stringify({
        versionId: version.versionId,
        parentVersionId: version.parentVersionId,
        createdAt: version.createdAt.toISOString(),
        label: version.versionLabel,
        dependencyState: dependencyState
          ? {
            state: dependencyState.state,
            reasons: dependencyState.reasons,
            nextActions: dependencyState.nextActions,
          }
          : undefined,
      });
    }));
    return withState;
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:dependency-state", async (_event, versionId: string) => {
    if (!canonicalAssetSystemRepository?.isAvailable) {
      return null;
    }
    const summary = await dependencyStateUseCase.execute({
      versionId,
      preferPersistedIfFreshMs: 300_000,
    });
    return JSON.stringify({
      versionId: summary.versionId,
      state: summary.state,
      lineageConfidence: summary.lineageConfidence,
      lifecycle: {
        source: summary.lifecycle.source,
        computedAt: summary.lifecycle.computedAt.toISOString(),
        reason: summary.lifecycle.reason,
      },
      reasons: summary.reasons,
      nextActions: summary.nextActions,
    });
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:reconcile-identity", async (_event, entityType: string, entityId: string) => {
    if (!canonicalAssetSystemRepository?.isAvailable) {
      return null;
    }
    const reconciled = await new ReconcileCanonicalIdentityMappingsUseCase(canonicalAssetSystemRepository, canonicalAssetSystemRepository).execute({
      entityType: entityType as any,
      entityId,
    });
    return JSON.stringify(reconciled);
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:replay-scope", async (_event, entityType: string, entityId: string, versionId?: string) => {
    if (!canonicalAssetSystemRepository?.isAvailable) {
      return JSON.stringify({ replayed: false, reason: "Canonical asset system is unavailable." });
    }
    const replay = await replayScopedProjectionUseCase.execute({ entityType: entityType as any, entityId, versionId });
    return JSON.stringify(replay);
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:verify-projection", async (_event, assetId: string, versionIdsInScope?: ReadonlyArray<string>) => {
    if (!canonicalAssetSystemRepository?.isAvailable) {
      return null;
    }
    const verification = await verifyProjectionUseCase.execute({ assetId, versionIdsInScope });
    return JSON.stringify(projectionTrustReadModelService.summarize(verification));
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:rebuild-scopes", async (_event, requestJson: string) => {
    if (!canonicalAssetSystemRepository?.isAvailable) {
      return JSON.stringify({ totalScopes: 0, replayedScopes: 0, verifiedScopes: 0, results: [] });
    }
    const request = JSON.parse(requestJson) as Parameters<ProjectionRebuildOrchestrationUseCase["execute"]>[0];
    const result = await rebuildProjectionOrchestrationUseCase.execute(request);
    return JSON.stringify(result);
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:management-snapshot", async (_event, assetId: string, includeProjectionHealth = true, versionIdsInProjectionScope?: ReadonlyArray<string>) => {
    if (!canonicalAssetSystemRepository?.isAvailable) {
      return null;
    }
    const snapshot = await loadManagementSnapshotUseCase.execute({
      assetId,
      includeProjectionHealth,
      versionIdsInProjectionScope,
    });
    if (!snapshot) {
      return null;
    }
    return JSON.stringify({
      ...snapshot,
      versions: snapshot.versions.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
      })),
    });
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
  agentRepository?.dispose();
  studioShellRepository?.dispose();
});

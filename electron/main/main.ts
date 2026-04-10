import started from "electron-squirrel-startup";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, safeStorage, session } from "electron";
import { InitializeProductionStorageUseCase } from "../../src/application/runtime/InitializeProductionStorageUseCase";
import { ProductionStorageInitializationScopes } from "../../src/application/runtime/interfaces/IProductionStorageInitializer";
import { resolveDesktopStoragePaths } from "../../src/infrastructure/desktop/DesktopAppPaths";
import { DesktopStorageDatabase } from "../../src/infrastructure/desktop/DesktopStorageDatabase";
import { resolveDesktopPythonRuntime } from "../../src/infrastructure/desktop/DesktopPythonRuntimeResolver";
import { AppRuntimeConfig, type AppRuntimeConfigValues } from "../../src/infrastructure/config/AppRuntimeConfig";
import {
  HostSecureTransportKinds,
  assertSecureTransportEndpoint,
  resolveHostSecureTransportConfig,
} from "../../src/infrastructure/config/HostSecureTransportConfig";
import { RendererDeliveryModes } from "../../src/domain/runtime/AppRuntimeProfile";
import { DesktopServiceSupervisor } from "./DesktopServiceSupervisor";
import type {
  DesktopAuthBootstrapContext,
  DesktopAuthBootstrapRuntimeConfig,
  DesktopPostLoginWarmupRequest,
} from "../shared/DesktopContracts";
import { SqliteAssetSystemRepository } from "../../src/infrastructure/filesystem/SqliteAssetSystemRepository";
import { SqliteAgentRepository } from "../../src/infrastructure/filesystem/agents/SqliteAgentRepository";
import { SqliteAgentExecutionSessionRepository } from "../../src/infrastructure/filesystem/agents/SqliteAgentExecutionSessionRepository";
import { AgentStudioBackendApi } from "../../src/infrastructure/api/agents/AgentStudioBackendApi";
import { AgentRunnerService } from "../../src/application/agents/services/AgentRunnerService";
import { DeterministicAgentPlanningService } from "../../src/application/agents/services/AgentPlanningInterface";
import { ExecuteAgentToolsUseCase } from "../../src/application/agents/ExecuteAgentToolsUseCase";
import { DefaultAgentMemoryRetrievalService } from "../../src/application/agents/services/AgentMemoryRetrievalService";
import { AgentMemoryWriteService } from "../../src/application/agents/services/AgentMemoryWriteService";
import { AssetBackedAgentMemoryStore } from "../../src/application/agents/services/AssetBackedAgentMemoryStore";
import { CompositeToolCapabilityCatalog } from "../../src/infrastructure/tools/CompositeToolCapabilityCatalog";
import { StaticLocalToolCapabilityCatalog } from "../../src/infrastructure/tools/StaticLocalToolCapabilityCatalog";
import { McpToolCapabilityCatalog } from "../../src/infrastructure/tools/McpToolCapabilityCatalog";
import { CompositeToolCapabilityExecutor } from "../../src/infrastructure/tools/CompositeToolCapabilityExecutor";
import { StaticLocalToolCapabilityExecutor } from "../../src/infrastructure/tools/StaticLocalToolCapabilityExecutor";
import { McpToolCapabilityExecutor } from "../../src/infrastructure/tools/McpToolCapabilityExecutor";
import { DeterministicToolCapabilityAgentOrchestrator } from "../../src/infrastructure/agents/DeterministicToolCapabilityAgentOrchestrator";
import { PythonRuntimeConfig } from "../../src/infrastructure/config/PythonRuntimeConfig";
import { createMcpRuntimeIntegration } from "../../src/infrastructure/python/mcp/createMcpRuntimeIntegration";
import { SqliteAssetSystemAgentMemoryCatalog } from "../../src/infrastructure/filesystem/agents/SqliteAssetSystemAgentMemoryCatalog";
import type { CreateAgentRequest } from "../../src/application/agents/CreateAgentUseCase";
import type { UpdateAgentRequest } from "../../src/application/agents/UpdateAgentUseCase";
import type { ConfigureAgentGoalsRequest } from "../../src/application/agents/ConfigureAgentGoalsUseCase";
import type { AgentPolicy, AgentToolAccessPolicy } from "../../src/domain/agents/AgentPolicy";
import type { AgentMemoryConfiguration } from "../../src/domain/agents/AgentMemory";
import type { AgentPlanningStrategy } from "../../src/domain/agents/Agent";
import type { AgentConfigurationValidationInput } from "../../src/application/agents/services/AgentConfigurationValidationService";
import type { AgentRunControlRequest, AgentRunRequest } from "../../src/application/agents/contracts/AgentRunContracts";
import type { TriggerAgentLaunchRequest } from "../../src/application/agents/TriggerAgentLaunchUseCase";
import type { StudioShellBackendApi } from "../../src/infrastructure/api/studio-shell/StudioShellBackendApi";
import { ListPersistedWorkflowsUseCase } from "../../src/application/workflow-persistence/ListPersistedWorkflowsUseCase";
import type { CreateAssetDraftCommand, PublishAssetDraftVersionCommand, TransitionAssetDraftLifecycleCommand, UpdateAssetDraftCommand, UpdateAssetDraftDependenciesCommand } from "../../src/application/studio-shell/contracts";
import type { SystemStudioBackendApi } from "../../src/infrastructure/api/system-studio/SystemStudioBackendApi";
import type { SystemRuntimeBackendApi } from "../../src/infrastructure/api/system-runtime/SystemRuntimeBackendApi";
import {
  parseSystemRuntimeWindowLaunchContract,
  SystemRuntimeWindowLaunchQueryParam,
  type LaunchSystemRuntimeWindowReadModel,
} from "../../src/application/system-runtime/SystemRuntimeWindowLaunchContract";
import { createRendererContentSecurityPolicy } from "./RendererContentSecurityPolicy";
import { logInitializationCheckpoint, logInitializationEnd, logInitializationMemory, logInitializationStart } from "./InitializationLogging";
import { createDesktopConnectivityProbePort, normalizeHttpOrigin, resolveDesktopIdentityTransportTrustBootstrap } from "./DesktopTrustBootstrap";
import { listEntries, toFileEntry } from "./ModelFileEntries";
import { resolveModelFileAbsolutePath } from "./ModelFilePathPolicy";
import { registerAuthBootstrapIpc } from "./AuthBootstrapIpcRegistration";
import { DesktopStartupPhases, validateDesktopStartupContract } from "./DesktopStartupContract";
import { startDesktopHostAssembly, type DesktopHostRuntimeHandle } from "../../src/hosts/desktop/DesktopHostEntrypoint";
import {
  DesktopConnectivityStateService,
} from "../../src/hosts/desktop/DesktopConnectivityStateService";
import {
  createDeferredDesktopFeatureRuntime,
  type DeferredDesktopFeatureRuntime,
} from "./DeferredDesktopFeatureRuntime";
import {
  startAuthMinimalServerHostAssembly,
  type AuthoritativeServerHostRuntimeHandle,
} from "../../src/hosts/server/AuthMinimalServerHostEntrypoint";

// Provide ESM-safe CommonJS path globals for runtime compatibility with CJS dependencies.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
if (started) {
  app.quit();
}
const repoRoot = path.resolve(__dirname, "../..");
const isPackaged = app.isPackaged;
const rendererDevUrl = process.env.ELECTRON_RENDERER_URL || "http://127.0.0.1:5174";
const preloadScriptPath = resolvePreloadScriptPath();
validateDesktopStartupContract();

function resolvePreloadScriptPath(): string {
  const preloadCandidates = [
    path.join(__dirname, "preload.cjs"),
    path.join(__dirname, "../preload.cjs"),
    path.join(__dirname, "preload.mjs"),
    path.join(__dirname, "../preload.mjs"),
  ];
  const resolvedPath = preloadCandidates.find((candidate) => fs.existsSync(candidate));
  if (!resolvedPath) {
    return preloadCandidates[0];
  }
  return resolvedPath;
}

function installRendererContentSecurityPolicy(): void {
  const policy = createRendererContentSecurityPolicy({
    rendererDevUrl,
    runtimeConfig: rendererContentSecurityPolicyRuntimeConfig,
  });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders ? { ...details.responseHeaders } : {};
    responseHeaders["Content-Security-Policy"] = [policy];
    callback({ responseHeaders });
  });
}

let mainWindow: BrowserWindow | undefined;
let storageDatabase: DesktopStorageDatabase | undefined;
let agentRepository: SqliteAgentRepository | undefined;
let agentSessionRepository: SqliteAgentExecutionSessionRepository | undefined;
let agentRunnerAssetSystemRepository: SqliteAssetSystemRepository | undefined;
let agentStudioBackendApi: AgentStudioBackendApi | undefined;
let serviceSupervisor: DesktopServiceSupervisor | undefined;
let authMinimalServerRuntime: AuthoritativeServerHostRuntimeHandle | undefined;
let bootstrapContext: DesktopAuthBootstrapContext | undefined;
let rendererContentSecurityPolicyRuntimeConfig: AppRuntimeConfigValues | undefined;
let desktopHostRuntime: DesktopHostRuntimeHandle | undefined;
let desktopConnectivityStateService: DesktopConnectivityStateService | undefined;
let deferredFeatureRuntime: DeferredDesktopFeatureRuntime | undefined;
type CanonicalRegistryRuntime = {
  readonly repository: SqliteAssetSystemRepository;
  readonly listCanonicalAssetsUseCase: any;
  readonly loadCanonicalAssetDetailUseCase: any;
  readonly getVersionHistoryUseCase: any;
  readonly dependencyStateUseCase: any;
  readonly replayScopedProjectionUseCase: any;
  readonly verifyProjectionUseCase: any;
  readonly projectionTrustReadModelService: any;
  readonly rebuildProjectionOrchestrationUseCase: any;
  readonly loadManagementSnapshotUseCase: any;
  readonly reconcileIdentityUseCase: any;
  readonly registryBackendApi: any;
};
let canonicalRegistryRuntime: CanonicalRegistryRuntime | undefined;
const runtimeWindowByReuseKey = new Map<string, BrowserWindow>();
const DesktopServiceSupervisorPort = 8790;
let authIpcRegistered = false;
let deferredFeatureIpcRegistered = false;
let deferredFeatureIpcReady = false;
let postLoginBootstrapPromise: Promise<void> | undefined;
let postLoginWarmupStarted = false;
let isDesktopRuntimeDisposing = false;
let authShellBootstrapResult: AuthShellBootstrapResult | undefined;

type AuthShellBootstrapResult = {
  readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
  readonly identityApiBaseUrl: string;
};
function createRendererSearch(params: Record<string, string | undefined>): string | undefined {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value) {
      continue;
    }
    search.set(key, value);
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : undefined;
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

function ensureAgentStudioBackendApi(
  storagePaths: ReturnType<typeof resolveDesktopStoragePaths>,
): AgentStudioBackendApi {
  if (agentStudioBackendApi) {
    return agentStudioBackendApi;
  }
  agentRepository = new SqliteAgentRepository(path.join(storagePaths.storageDirectory, "agents", "agents.sqlite"));
  agentSessionRepository = new SqliteAgentExecutionSessionRepository(path.join(storagePaths.storageDirectory, "agents", "agent-sessions.sqlite"));
  agentRunnerAssetSystemRepository = new SqliteAssetSystemRepository(path.join(storagePaths.assetsDirectory, "asset-system.sqlite"));
  const agentRunner = createDesktopAgentRunner({
    assetSystemRepository: agentRunnerAssetSystemRepository,
    sessionRepository: agentSessionRepository,
  });
  agentStudioBackendApi = new AgentStudioBackendApi(agentRepository, agentSessionRepository, agentRunner);
  logInitializationMemory(DesktopStartupPhases.deferredFeatureRuntime, "agent-runtime-ready");
  return agentStudioBackendApi;
}

async function createMainWindow(): Promise<void> {
  const mainWindowCreateStartedAt = logInitializationStart(DesktopStartupPhases.mainWindowCreation);
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    show: false,
    backgroundColor: "#111827",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadScriptPath,
    },
  });

  mainWindow = window;
  window.once("ready-to-show", () => window.show());

  try {
    await loadRendererRoot(window);
    logInitializationCheckpoint(DesktopStartupPhases.mainWindowCreation, "renderer-content-loaded", mainWindowCreateStartedAt);
    logInitializationMemory(DesktopStartupPhases.mainWindowCreation, "renderer-content-loaded");
  } finally {
    logInitializationEnd(DesktopStartupPhases.mainWindowCreation, mainWindowCreateStartedAt);
    logInitializationMemory(DesktopStartupPhases.mainWindowCreation, "ready");
  }
}

async function loadRendererRoot(window: BrowserWindow, search?: string): Promise<void> {
  const runtimeConfig = bootstrapContext?.runtimeConfig;
  if (runtimeConfig?.rendererDeliveryMode === RendererDeliveryModes.packagedAssets) {
    await window.loadFile(path.join(__dirname, "../../dist/index.html"), {
      search,
    });
  } else {
    const url = new URL(rendererDevUrl);
    url.pathname = "/";
    if (search) {
      url.search = search.startsWith("?") ? search.slice(1) : search;
    }
    await window.loadURL(url.toString());
    if (window === mainWindow) {
      window.webContents.openDevTools({ mode: "detach" });
    }
  }
}

async function launchRuntimeWindowFromContract(
  launchContractJson: string,
): Promise<LaunchSystemRuntimeWindowReadModel> {
  const contract = parseSystemRuntimeWindowLaunchContract(launchContractJson);
  if (!contract) {
    throw new Error("invalid-request:Runtime window launch contract is missing or invalid.");
  }

  const reuseWindowKey = contract.windowIntent.reuseWindowKey?.trim();
  if (reuseWindowKey) {
    const existing = runtimeWindowByReuseKey.get(reuseWindowKey);
    if (existing && !existing.isDestroyed()) {
      const search = createRendererSearch({
        [SystemRuntimeWindowLaunchQueryParam]: launchContractJson,
      });
      await loadRendererRoot(existing, search);
      if (contract.windowIntent.focus === "foreground") {
        existing.focus();
      }
      return Object.freeze({
        launchId: contract.launchId,
        launchedAt: new Date().toISOString(),
        targetKind: contract.launchTarget.targetKind,
        systemAssetId: contract.launchTarget.systemAssetId,
        pageBindingId: contract.launchTarget.pageBindingId,
        routePath: "/",
      });
    }
  }

  const runtimeWindow = new BrowserWindow({
    width: contract.windowIntent.dimensions?.width ?? 1440,
    height: contract.windowIntent.dimensions?.height ?? 960,
    show: false,
    backgroundColor: "#111827",
    title: contract.windowIntent.titleHint ?? "AI Loom Runtime",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadScriptPath,
    },
  });

  runtimeWindow.once("ready-to-show", () => runtimeWindow.show());
  const search = createRendererSearch({
    [SystemRuntimeWindowLaunchQueryParam]: launchContractJson,
  });
  await loadRendererRoot(runtimeWindow, search);

  if (contract.windowIntent.focus === "foreground") {
    runtimeWindow.focus();
  }

  if (reuseWindowKey) {
    runtimeWindowByReuseKey.set(reuseWindowKey, runtimeWindow);
    runtimeWindow.on("closed", () => {
      runtimeWindowByReuseKey.delete(reuseWindowKey);
    });
  }

  return Object.freeze({
    launchId: contract.launchId,
    launchedAt: new Date().toISOString(),
    targetKind: contract.launchTarget.targetKind,
    systemAssetId: contract.launchTarget.systemAssetId,
    pageBindingId: contract.launchTarget.pageBindingId,
    routePath: "/",
  });
}

async function ensureCanonicalRegistryRuntime(
  storagePaths: ReturnType<typeof resolveDesktopStoragePaths>,
): Promise<CanonicalRegistryRuntime> {
  if (canonicalRegistryRuntime) {
    return canonicalRegistryRuntime;
  }
  const runtime = deferredFeatureRuntime;
  if (!runtime) {
    throw new Error("Deferred desktop feature runtime is unavailable.");
  }
  const systemRuntimeBackendApi = runtime.ensureSystemRuntimeBackendApi();
  const [
    { InMemoryAssetLineageGraphProjectionSink },
    { ExplainCanonicalVersionExistenceUseCase, GetCanonicalProvenanceSummaryUseCase, ListCanonicalAssetsUseCase, LoadCanonicalAssetDetailUseCase },
    { GetAssetVersionHistoryUseCase },
    { GetCanonicalDependencyStateUseCase },
    { GetAssetDependencyHealthUseCase },
    { GetAssetImpactAnalysisUseCase },
    { ReconcileCanonicalIdentityMappingsUseCase, ReplayScopedAssetGraphProjectionUseCase },
    { ReplayAssetGraphProjectionUseCase },
    { VerifyAssetGraphProjectionUseCase },
    { ProjectionRebuildOrchestrationUseCase },
    { LoadCanonicalAssetManagementSnapshotUseCase },
    { ProjectionTrustReadModelService },
    { RegistryBackendApi },
    { RegistryQueryService },
    { CrossStudioRegistryQueryService },
    { RegistryDependencyGraphService },
    { RegistryCacheLayer },
    { CompositionAssetContractResolver },
  ] = await Promise.all([
    import("../../src/infrastructure/filesystem/InMemoryAssetLineageGraphProjectionSink"),
    import("../../src/application/assets-system/CanonicalAssetReadUseCases"),
    import("../../src/application/assets-system/GetAssetVersionHistoryUseCase"),
    import("../../src/application/assets-system/CanonicalDependencyStateUseCase"),
    import("../../src/application/assets-system/GetAssetDependencyHealthUseCase"),
    import("../../src/application/assets-system/GetAssetImpactAnalysisUseCase"),
    import("../../src/application/assets-system/ReconciliationUseCases"),
    import("../../src/application/assets-system/ReplayAssetGraphProjectionUseCase"),
    import("../../src/application/assets-system/VerifyAssetGraphProjectionUseCase"),
    import("../../src/application/assets-system/ProjectionRebuildOrchestrationUseCase"),
    import("../../src/application/assets-system/LoadCanonicalAssetManagementSnapshotUseCase"),
    import("../../src/application/assets-system/ProjectionTrustReadModelService"),
    import("../../src/infrastructure/api/registry/RegistryBackendApi"),
    import("../../src/application/asset-registry/RegistryQueryService"),
    import("../../src/application/asset-registry/CrossStudioRegistryQueryService"),
    import("../../src/application/asset-registry/RegistryDependencyGraphService"),
    import("../../src/application/asset-registry/RegistryCacheLayer"),
    import("../../src/application/contracts/CompositionAssetContractResolver"),
  ]);

  const repository = new SqliteAssetSystemRepository(path.join(storagePaths.assetsDirectory, "asset-system.sqlite"));
  const projectionSink = new InMemoryAssetLineageGraphProjectionSink();
  const listCanonicalAssetsUseCase = new ListCanonicalAssetsUseCase(repository, repository);
  const loadCanonicalAssetDetailUseCase = new LoadCanonicalAssetDetailUseCase(repository, repository, repository, repository, repository);
  const getVersionHistoryUseCase = new GetAssetVersionHistoryUseCase(repository);
  const explainVersionExistenceUseCase = new ExplainCanonicalVersionExistenceUseCase(
    new GetCanonicalProvenanceSummaryUseCase(repository, repository, repository),
    repository,
  );
  const dependencyStateUseCase = new GetCanonicalDependencyStateUseCase(
    repository,
    repository,
    new GetAssetDependencyHealthUseCase(repository, repository, repository),
    new GetAssetImpactAnalysisUseCase(repository, repository, repository),
    new GetCanonicalProvenanceSummaryUseCase(repository, repository, repository),
    repository,
  );
  const replayProjectionUseCase = new ReplayAssetGraphProjectionUseCase(repository, projectionSink);
  const replayScopedProjectionUseCase = new ReplayScopedAssetGraphProjectionUseCase(repository, replayProjectionUseCase);
  const verifyProjectionUseCase = new VerifyAssetGraphProjectionUseCase(repository, projectionSink);
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
    repository,
    repository,
    repository,
    new CompositionAssetContractResolver(),
    repository,
    undefined,
    registryCacheLayer,
    repository,
    {
      async listRecentExecutionsForSystem(input) {
        const response = await systemRuntimeBackendApi.listRecentExecutionsForSystem(input);
        return response.ok && response.data ? response.data : [];
      },
    },
  );
  const registryBackendApi = new RegistryBackendApi(
    new CrossStudioRegistryQueryService(registryQueryService),
    new RegistryDependencyGraphService(registryQueryService, repository, repository, registryCacheLayer),
    new ListPersistedWorkflowsUseCase(runtime.ensureWorkflowPersistenceRepository()),
  );
  canonicalRegistryRuntime = {
    repository,
    listCanonicalAssetsUseCase,
    loadCanonicalAssetDetailUseCase,
    getVersionHistoryUseCase,
    dependencyStateUseCase,
    replayScopedProjectionUseCase,
    verifyProjectionUseCase,
    projectionTrustReadModelService,
    rebuildProjectionOrchestrationUseCase,
    loadManagementSnapshotUseCase,
    reconcileIdentityUseCase: new ReconcileCanonicalIdentityMappingsUseCase(repository, repository),
    registryBackendApi,
  };
  logInitializationMemory(DesktopStartupPhases.deferredFeatureRuntime, "canonical-registry-runtime-ready");
  return canonicalRegistryRuntime;
}

function buildBootstrapContext(params: {
  readonly runtimeConfig: AppRuntimeConfig;
  readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
}): void {
  const runtimeConfigValues = params.runtimeConfig.toValues();
  rendererContentSecurityPolicyRuntimeConfig = runtimeConfigValues;
  bootstrapContext = Object.freeze({
    runtimeConfig: projectDesktopAuthBootstrapRuntimeConfig(runtimeConfigValues),
    storage: {
      appDataDirectory: params.storagePaths.appDataDirectory,
    },
    environment: {
      isPackaged,
    },
    identityTransportTrust: resolveDesktopIdentityTransportTrustBootstrap((key) => storageDatabase?.getItem(key) ?? null),
  });
}

function projectDesktopAuthBootstrapRuntimeConfig(values: AppRuntimeConfigValues): DesktopAuthBootstrapRuntimeConfig {
  return Object.freeze({
    runtimeMode: values.runtimeMode,
    hostKind: values.hostKind,
    lifecycleStage: values.lifecycleStage,
    distributionTarget: values.distributionTarget,
    rendererDeliveryMode: values.rendererDeliveryMode,
    workflowRepositoryMode: values.workflowRepositoryMode,
    workflowExecutorMode: values.workflowExecutorMode,
    nodeCatalogMode: values.nodeCatalogMode,
    uiSettingsPersistenceMode: values.uiSettingsPersistenceMode,
    installedModelCatalogMode: values.installedModelCatalogMode,
    seedStarterNode: values.seedStarterNode,
    isProductionMode: values.isProductionMode,
    devSyncBaseUrl: values.devSyncBaseUrl,
    devSyncToken: values.devSyncToken,
    identityApiBaseUrl: values.identityApiBaseUrl,
    modelInstallDirectory: values.modelInstallDirectory,
  });
}

function registerAuthIpc(): void {
  if (authIpcRegistered) {
    return;
  }
  authIpcRegistered = true;
  registerAuthBootstrapIpc({
    ipcMain,
    getBootstrapContext: () => bootstrapContext,
    storage: {
      getItem: (key: string) => storageDatabase?.getItem(key) ?? null,
      setItem: (key: string, value: string) => {
        storageDatabase?.setItem(key, value);
      },
      removeItem: (key: string) => {
        storageDatabase?.removeItem(key);
      },
    },
    isDeferredFeatureIpcReady: () => deferredFeatureIpcReady,
    startPostLoginWarmup: async (request: DesktopPostLoginWarmupRequest) => {
      await ensurePostLoginWarmupStarted(request);
    },
    connectivity: {
      getState: () => {
        const state = desktopConnectivityStateService?.getState() ?? {
          state: "connecting",
          stale: false,
          localModeActive: false,
          lastChangedAt: new Date().toISOString(),
          canQueueOperations: true,
          canResynchronize: false,
        };
        return JSON.stringify(state);
      },
      setOfflineMode: (requestJson: string) => {
        const request = JSON.parse(requestJson) as { readonly active?: boolean; readonly detail?: string };
        if (!desktopConnectivityStateService) {
          return JSON.stringify({
            state: "connecting",
            stale: false,
            localModeActive: false,
            detail: "Desktop connectivity state service is unavailable.",
            lastChangedAt: new Date().toISOString(),
            canQueueOperations: true,
            canResynchronize: false,
          });
        }
        const state = desktopConnectivityStateService.setDeliberateOfflineMode(request.active === true, request.detail);
        return JSON.stringify(state);
      },
    },
    secrets: {
      isAvailable: () => safeStorage.isEncryptionAvailable(),
      getSecret: (key: string) => {
        const encoded = storageDatabase?.getItem(`secure:${key}`) ?? null;
        if (!encoded) {
          return null;
        }
        try {
          return safeStorage.decryptString(Buffer.from(encoded, "base64"));
        } catch {
          return null;
        }
      },
      setSecret: (key: string, value: string) => {
        if (!safeStorage.isEncryptionAvailable()) {
          return;
        }
        const encrypted = safeStorage.encryptString(value).toString("base64");
        storageDatabase?.setItem(`secure:${key}`, encrypted);
      },
      removeSecret: (key: string) => {
        storageDatabase?.removeItem(`secure:${key}`);
      },
    },
  });
}

async function bootstrapAuthShell(): Promise<AuthShellBootstrapResult> {
  const authShellStartedAt = logInitializationStart(DesktopStartupPhases.preLoginAuthShellBootstrap);
  logInitializationMemory(DesktopStartupPhases.preLoginAuthShellBootstrap, "start");
  try {
    const storageInitializationStartedAt = logInitializationStart("desktop-startup.pre-login-storage-initialize");
    const storagePaths = resolveDesktopStoragePaths({
      userDataPath: app.getPath("userData"),
      logsPath: app.getPath("logs"),
    });
    storageDatabase = new DesktopStorageDatabase({ paths: storagePaths });
    await new InitializeProductionStorageUseCase(storageDatabase).execute({
      scope: ProductionStorageInitializationScopes.authShellPreLogin,
    });
    logInitializationEnd("desktop-startup.pre-login-storage-initialize", storageInitializationStartedAt);
    logInitializationCheckpoint(DesktopStartupPhases.preLoginAuthShellBootstrap, "storage-ready", authShellStartedAt);
    logInitializationMemory(DesktopStartupPhases.preLoginAuthShellBootstrap, "storage-ready");

    const rendererOrigin = normalizeHttpOrigin(rendererDevUrl);
    const authoritativeServerStartAt = logInitializationStart(DesktopStartupPhases.identityAuthHostReadiness);
    authMinimalServerRuntime = await startAuthMinimalServerHostAssembly({
      hostOptions: {
        databasePath: path.join(storagePaths.storageDirectory, "identity", "identity.sqlite"),
        cors: {
          allowedOrigins: rendererOrigin ? [rendererOrigin] : [],
          allowLoopbackOrigins: true,
          allowNullOrigin: isPackaged,
        },
        env: process.env,
      },
      boot: {
        startupReason: "electron-main-auth-minimal-server-host-startup",
        environment: process.env,
      },
    });
    logInitializationEnd(DesktopStartupPhases.identityAuthHostReadiness, authoritativeServerStartAt);
    logInitializationMemory(DesktopStartupPhases.identityAuthHostReadiness, "ready");
    logInitializationCheckpoint(DesktopStartupPhases.preLoginAuthShellBootstrap, "identity-auth-host-ready", authShellStartedAt);
    logInitializationMemory(DesktopStartupPhases.preLoginAuthShellBootstrap, "identity-auth-host-ready");
    const identityApiBaseUrl = assertSecureTransportEndpoint(
      `http://${authMinimalServerRuntime.address}`,
      resolveHostSecureTransportConfig({
        hostKind: HostSecureTransportKinds.desktop,
        hostAddress: "127.0.0.1",
      }),
    );
    const runtimeConfig = isPackaged
      ? AppRuntimeConfig.forDesktopProductionAuthShell({
        storage: storagePaths,
        identityApiBaseUrl,
      })
      : AppRuntimeConfig.forDesktopDevelopmentAuthShell({
        storage: storagePaths,
        identityApiBaseUrl,
      });
    buildBootstrapContext({
      runtimeConfig,
      storagePaths,
    });
    desktopConnectivityStateService = new DesktopConnectivityStateService();
    desktopConnectivityStateService.startMonitoring(createDesktopConnectivityProbePort(identityApiBaseUrl, (key) => storageDatabase?.getItem(key) ?? null), {
      intervalMs: 3_000,
    });
    registerAuthIpc();
    logInitializationCheckpoint(DesktopStartupPhases.preLoginAuthShellBootstrap, "auth-bootstrap-ipc-ready", authShellStartedAt);
    logInitializationMemory(DesktopStartupPhases.preLoginAuthShellBootstrap, "auth-bootstrap-ipc-ready");
    return Object.freeze({
      storagePaths,
      identityApiBaseUrl,
    });
  } finally {
    logInitializationEnd(DesktopStartupPhases.preLoginAuthShellBootstrap, authShellStartedAt);
    logInitializationMemory(DesktopStartupPhases.preLoginAuthShellBootstrap, "complete");
  }
}

function registerDeferredFeatureIpc(register: () => void): void {
  if (deferredFeatureIpcRegistered) {
    return;
  }
  const deferredFeatureRegistrationStartedAt = logInitializationStart(DesktopStartupPhases.deferredFeatureRegistration);
  try {
    deferredFeatureIpcRegistered = true;
    register();
    deferredFeatureIpcReady = true;
    logInitializationMemory(DesktopStartupPhases.deferredFeatureRegistration, "ready");
  } finally {
    logInitializationEnd(DesktopStartupPhases.deferredFeatureRegistration, deferredFeatureRegistrationStartedAt);
  }
}

function formatPostLoginWarmupRequestLog(request: DesktopPostLoginWarmupRequest): string {
  return `source=${request.triggerSource}${request.requestedAt ? ` requestedAt=${request.requestedAt}` : ""}`;
}

async function ensurePostLoginWarmupStarted(request: DesktopPostLoginWarmupRequest): Promise<void> {
  console.info(`[ai-loom] Post-login warmup requested (${formatPostLoginWarmupRequestLog(request)}).`);
  if (postLoginBootstrapPromise) {
    console.info("[ai-loom] Post-login warmup request joined in-flight warmup.");
    await postLoginBootstrapPromise;
    return;
  }
  if (postLoginWarmupStarted) {
    console.info("[ai-loom] Post-login warmup request ignored because warmup was already started.");
    return;
  }
  const authShell = authShellBootstrapResult;
  if (!authShell) {
    throw new Error("Auth-shell bootstrap context is unavailable for post-login warmup.");
  }

  postLoginWarmupStarted = true;
  console.info("[ai-loom] Starting post-login desktop runtime warmup.");
  logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "request-accepted");
  postLoginBootstrapPromise = bootstrapPostLoginRuntime(authShell);
  try {
    await postLoginBootstrapPromise;
    console.info("[ai-loom] Post-login desktop runtime warmup completed.");
  } catch (error) {
    postLoginBootstrapPromise = undefined;
    if (!isDesktopRuntimeDisposing) {
      console.error("Post-login desktop runtime bootstrap failed", error);
      await disposeDesktopRuntimeResources();
      app.exit(1);
    }
    postLoginWarmupStarted = false;
    throw error;
  }
}

async function bootstrapPostLoginRuntime(authShell: AuthShellBootstrapResult): Promise<void> {
  const bootstrapStartedAt = logInitializationStart(DesktopStartupPhases.postLoginWarmup);
  try {
  logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "start");
  const { storagePaths, identityApiBaseUrl } = authShell;
  if (!storageDatabase) {
    throw new Error("Desktop storage database is unavailable for post-login runtime bootstrap.");
  }
  const pythonRuntimeResolutionStartedAt = logInitializationStart("desktop-startup.post-login-python-runtime-resolve");
  const pythonRuntime = resolveDesktopPythonRuntime({
    isPackaged,
    repoRoot,
    resourcesPath: process.resourcesPath,
    storagePaths,
  });
  logInitializationEnd("desktop-startup.post-login-python-runtime-resolve", pythonRuntimeResolutionStartedAt);
  logInitializationCheckpoint(DesktopStartupPhases.postLoginWarmup, "python-runtime-resolved", bootstrapStartedAt);
  logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "python-runtime-resolved");
  await new InitializeProductionStorageUseCase(storageDatabase).execute({
    scope: ProductionStorageInitializationScopes.fullRuntime,
  });
  logInitializationCheckpoint(DesktopStartupPhases.postLoginWarmup, "full-storage-provisioning-ready", bootstrapStartedAt);
  logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "full-storage-provisioning-ready");
  serviceSupervisor = new DesktopServiceSupervisor({
    repoRoot,
    isPackaged,
    resourcesPath: process.resourcesPath,
    storagePaths,
    pythonRuntime,
    pythonRuntimeBaseUrl: process.env.PYTHON_RUNTIME_BASE_URL || "http://127.0.0.1:8100",
  });
  const supervisorStartAt = logInitializationStart("desktop-startup.post-login-service-supervisor-start");
  await serviceSupervisor.start();
  logInitializationEnd("desktop-startup.post-login-service-supervisor-start", supervisorStartAt);
  logInitializationCheckpoint(DesktopStartupPhases.postLoginWarmup, "local-service-supervisor-ready", bootstrapStartedAt);
  logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "local-service-supervisor-ready");

  const baseRuntimeConfig = isPackaged
    ? AppRuntimeConfig.forDesktopProduction({
        storage: storagePaths,
        pythonRuntime,
        serviceSupervisorBaseUrl: serviceSupervisor.baseUrl,
        serviceSupervisorPort: DesktopServiceSupervisorPort,
        pythonRuntimeBaseUrl: serviceSupervisor.runtimeBaseUrl,
      })
    : AppRuntimeConfig.forDesktopDevelopment({
        storage: storagePaths,
        pythonRuntime,
        serviceSupervisorBaseUrl: serviceSupervisor.baseUrl,
        serviceSupervisorPort: DesktopServiceSupervisorPort,
        pythonRuntimeBaseUrl: serviceSupervisor.runtimeBaseUrl,
      });
  const runtimeConfig = AppRuntimeConfig.fromValues({
    ...baseRuntimeConfig.toValues(),
    identityApiBaseUrl,
  });
  buildBootstrapContext({
    runtimeConfig,
    storagePaths,
  });
  const runtimeConfigValues = runtimeConfig.toValues();
  deferredFeatureRuntime = createDeferredDesktopFeatureRuntime({
    storagePaths,
    runtimeConfigValues,
    repoRoot,
  });
  const featureRuntime = deferredFeatureRuntime;
  if (!featureRuntime) {
    throw new Error("Deferred desktop feature runtime is unavailable for post-login bootstrap.");
  }
  registerDeferredFeatureIpc(() => {
  const getStudioShellBackendApi = () => featureRuntime.ensureStudioShellBackendApi();
  const getSystemStudioBackendApi = () => featureRuntime.ensureSystemStudioBackendApi();
  const getSystemRuntimeBackendApi = () => featureRuntime.ensureSystemRuntimeBackendApi();
  ipcMain.on("ai-loom-desktop-workflows:save-record", (_event, recordJson: string) => {
    featureRuntime.ensureWorkflowPersistence().saveWorkflowRecord(recordJson);
  });
  ipcMain.on("ai-loom-desktop-workflows:load-record", (event, id: string) => {
    event.returnValue = featureRuntime.ensureWorkflowPersistence().loadWorkflowRecord(id);
  });
  ipcMain.on("ai-loom-desktop-workflows:list-summaries", (event) => {
    event.returnValue = featureRuntime.ensureWorkflowPersistence().listWorkflowSummaries();
  });
  ipcMain.on("ai-loom-desktop-workflows:delete-record", (_event, id: string) => {
    featureRuntime.ensureWorkflowPersistence().deleteWorkflowRecord(id);
  });
  ipcMain.on("ai-loom-desktop-workflows:exists", (event, id: string) => {
    event.returnValue = featureRuntime.ensureWorkflowPersistence().workflowExists(id);
  });
  ipcMain.on("ai-loom-desktop-workflows:status", (event) => {
    event.returnValue = featureRuntime.ensureWorkflowPersistence().getWorkflowPersistenceStatus();
  });
  ipcMain.handle("ai-loom-desktop-execution-runs:save", async (_event, runJson: string) => {
    const { repository } = featureRuntime.ensureExecutionHistory();
    await repository.saveRun(JSON.parse(runJson));
  });
  ipcMain.handle("ai-loom-desktop-execution-runs:load", async (_event, runId: string) => {
    const { getExecutionRunUseCase } = featureRuntime.ensureExecutionHistory();
    const run = await getExecutionRunUseCase.execute(runId);
    return run ? JSON.stringify(run) : null;
  });
  ipcMain.handle("ai-loom-desktop-execution-runs:list", async (_event, criteriaJson?: string) => {
    const criteria = criteriaJson ? JSON.parse(criteriaJson) : undefined;
    const { listExecutionRunsUseCase } = featureRuntime.ensureExecutionHistory();
    const runs = await listExecutionRunsUseCase.execute(criteria);
    return runs.map((run) => JSON.stringify(run));
  });
  ipcMain.handle("ai-loom-desktop-workflow-runs:save", async (_event, summaryJson: string) => {
    const { repository: workflowRunSummaryRepository } = featureRuntime.ensureWorkflowRunHistory();
    await workflowRunSummaryRepository.upsert(JSON.parse(summaryJson));
  });
  ipcMain.handle("ai-loom-desktop-workflow-runs:load", async (_event, runId: string) => {
    const { repository: workflowRunSummaryRepository } = featureRuntime.ensureWorkflowRunHistory();
    const summary = await workflowRunSummaryRepository.getByRunId(runId);
    return summary ? JSON.stringify(summary) : null;
  });
  ipcMain.handle("ai-loom-desktop-workflow-runs:save-detail", async (_event, detailJson: string) => {
    const { repository: workflowRunSummaryRepository } = featureRuntime.ensureWorkflowRunHistory();
    await workflowRunSummaryRepository.upsertDetail(JSON.parse(detailJson));
  });
  ipcMain.handle("ai-loom-desktop-workflow-runs:load-detail", async (_event, runId: string) => {
    const { repository: workflowRunSummaryRepository } = featureRuntime.ensureWorkflowRunHistory();
    const detail = await workflowRunSummaryRepository.getDetailByRunId(runId);
    return detail ? JSON.stringify(detail) : null;
  });
  ipcMain.handle("ai-loom-desktop-workflow-runs:list", async (_event, queryJson?: string) => {
    const query = queryJson ? JSON.parse(queryJson) : undefined;
    const { listWorkflowRunSummariesUseCase } = featureRuntime.ensureWorkflowRunHistory();
    const summaries = await listWorkflowRunSummariesUseCase.execute(query);
    return summaries.map((summary) => JSON.stringify(summary));
  });
  ipcMain.handle("ai-loom-desktop-agents:create", async (_event, requestJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const request = JSON.parse(requestJson) as CreateAgentRequest;
    return JSON.stringify(await agentApi.createAgent(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:update", async (_event, requestJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const request = JSON.parse(requestJson) as UpdateAgentRequest;
    return JSON.stringify(await agentApi.updateAgent(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:get", async (_event, agentId: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    return JSON.stringify(await agentApi.getAgent(agentId));
  });
  ipcMain.handle("ai-loom-desktop-agents:list", async (_event, includeArchived = true) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    return JSON.stringify(await agentApi.listAgents(includeArchived));
  });
  ipcMain.handle("ai-loom-desktop-agents:delete", async (_event, agentId: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    return JSON.stringify(await agentApi.deleteAgent(agentId));
  });
  ipcMain.handle("ai-loom-desktop-agents:archive", async (_event, agentId: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    return JSON.stringify(await agentApi.archiveAgent(agentId));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-goals", async (_event, requestJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const request = JSON.parse(requestJson) as ConfigureAgentGoalsRequest;
    return JSON.stringify(await agentApi.configureGoals(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-policy", async (_event, agentId: string, policyJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const policy = JSON.parse(policyJson) as AgentPolicy;
    return JSON.stringify(await agentApi.configurePolicy(agentId, policy));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-tools", async (_event, agentId: string, toolAccessJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const toolAccess = JSON.parse(toolAccessJson) as AgentToolAccessPolicy;
    return JSON.stringify(await agentApi.configureTools(agentId, toolAccess));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-memory", async (_event, agentId: string, memoryJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const memory = JSON.parse(memoryJson) as AgentMemoryConfiguration;
    return JSON.stringify(await agentApi.configureMemory(agentId, memory));
  });
  ipcMain.handle("ai-loom-desktop-agents:configure-strategy", async (_event, agentId: string, planningStrategyJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const planningStrategy = JSON.parse(planningStrategyJson) as AgentPlanningStrategy;
    return JSON.stringify(await agentApi.configureStrategy(agentId, planningStrategy));
  });
  ipcMain.handle("ai-loom-desktop-agents:validate", async (_event, requestJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const request = JSON.parse(requestJson) as AgentConfigurationValidationInput;
    return JSON.stringify(await agentApi.validateConfiguration(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:launch", async (_event, requestJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const request = JSON.parse(requestJson) as AgentRunRequest;
    return JSON.stringify(await agentApi.launchAgent(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:trigger-launch", async (_event, requestJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const request = JSON.parse(requestJson) as TriggerAgentLaunchRequest;
    return JSON.stringify(await agentApi.triggerLaunch(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:list-sessions", async (_event, agentId: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    return JSON.stringify(await agentApi.listSessions(agentId));
  });
  ipcMain.handle("ai-loom-desktop-agents:get-session", async (_event, sessionId: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    return JSON.stringify(await agentApi.getSessionDetail(sessionId));
  });
  ipcMain.handle("ai-loom-desktop-agents:control-run", async (_event, requestJson: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    const request = JSON.parse(requestJson) as AgentRunControlRequest;
    return JSON.stringify(await agentApi.controlRun(request));
  });
  ipcMain.handle("ai-loom-desktop-agents:studio-snapshot", async (_event, agentId: string) => {
    const agentApi = ensureAgentStudioBackendApi(storagePaths);
    return JSON.stringify(await agentApi.getStudioSnapshot(agentId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:initialize", async (_event, studioId: string, name: string) => {
    return JSON.stringify(await getStudioShellBackendApi().initializeStudio(studioId, name));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:snapshot", async (_event, studioId: string) => {
    return JSON.stringify(await getStudioShellBackendApi().loadSnapshot(studioId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:start-session", async (_event, studioId: string) => {
    return JSON.stringify(await getStudioShellBackendApi().startSession(studioId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:create-draft", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as CreateAssetDraftCommand;
    return JSON.stringify(await getStudioShellBackendApi().createDraft(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:update-draft", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as UpdateAssetDraftCommand;
    return JSON.stringify(await getStudioShellBackendApi().updateDraft(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:update-dependencies", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as UpdateAssetDraftDependenciesCommand;
    return JSON.stringify(await getStudioShellBackendApi().updateDependencies(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:transition-lifecycle", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as TransitionAssetDraftLifecycleCommand;
    return JSON.stringify(await getStudioShellBackendApi().transitionLifecycle(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:publish-version", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as PublishAssetDraftVersionCommand;
    return JSON.stringify(await getStudioShellBackendApi().publishVersion(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:validate-draft", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as { studioId: string; draftId: string };
    return JSON.stringify(await getStudioShellBackendApi().validateDraft(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:image-workflows:list", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listImageWorkflowDefinitions"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().listImageWorkflowDefinitions(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:image-workflows:get", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["getImageWorkflowDefinition"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().getImageWorkflowDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:image-systems:list", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listImageSystemDefinitions"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().listImageSystemDefinitions(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:image-systems:get", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["getImageSystemDefinition"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().getImageSystemDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:image-systems:save", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["saveImageSystemDefinition"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().saveImageSystemDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:get-persisted-workflow", async (_event, workflowId: string) => {
    return JSON.stringify(await getStudioShellBackendApi().getPersistedWorkflow(workflowId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:duplicate-persisted-workflow", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["duplicatePersistedWorkflow"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().duplicatePersistedWorkflow(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:workflow-execution-readiness", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["assessWorkflowExecutionReadiness"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().assessWorkflowExecutionReadiness(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:run-workflow-draft", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["runWorkflowDraft"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().runWorkflowDraft(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:data-execution-readiness", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["assessDataStudioExecutionReadiness"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().assessDataStudioExecutionReadiness(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:run-data-pipeline", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["runDataStudioPipeline"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().runDataStudioPipeline(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:data-pipelines:list", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listDataStudioPipelines"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().listDataStudioPipelines(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:data-pipelines:load", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["loadDataStudioPipeline"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().loadDataStudioPipeline(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:workflow-runs:list", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listWorkflowRuns"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().listWorkflowRuns(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:workflow-runs:get-detail", async (_event, runId: string) => {
    return JSON.stringify(await getStudioShellBackendApi().getWorkflowRunDetail(runId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:workflow-runs:start-rerun", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["startWorkflowRunRerun"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().startWorkflowRunRerun(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-components:list", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["listChildComponents"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().listChildComponents(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-components:add", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["addChildComponent"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().addChildComponent(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-components:remove", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["removeChildComponent"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().removeChildComponent(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-components:reorder", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["reorderChildComponent"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().reorderChildComponent(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-interfaces:update", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["updateInterfaces"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().updateInterfaces(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-parameters:update", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["updateParameters"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().updateParameters(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-execution-metadata:update", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["updateExecutionMetadata"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().updateExecutionMetadata(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-definition:save", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["saveSystemDefinition"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().saveSystemDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-definition:load", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["loadSystemDefinition"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().loadSystemDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-definition:duplicate", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["duplicateSystemDefinition"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().duplicateSystemDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-definition:modify", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["modifySystemDefinition"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().modifySystemDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-compatibility:insights", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["getCompatibilityInsights"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().getCompatibilityInsights(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-runtime:start", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemRuntimeBackendApi["startExecution"]>[0];
    return JSON.stringify(await getSystemRuntimeBackendApi().startExecution(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-runtime:status", async (_event, executionId: string) => {
    return JSON.stringify(await getSystemRuntimeBackendApi().getExecutionStatus(executionId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-runtime:trace", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemRuntimeBackendApi["getExecutionTrace"]>[0];
    return JSON.stringify(await getSystemRuntimeBackendApi().getExecutionTrace(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-runtime:result", async (_event, executionId: string) => {
    return JSON.stringify(await getSystemRuntimeBackendApi().getExecutionResult(executionId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:upload", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["ingestReferenceImageUpload"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().ingestReferenceImageUpload(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:persist-outputs", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["persistReferenceImageOutputs"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().persistReferenceImageOutputs(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:list-outputs", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listReferenceImageOutputs"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().listReferenceImageOutputs(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:get-output", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["getReferenceImageOutput"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().getReferenceImageOutput(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:list-dataset-items", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listReferenceImageDatasetItems"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().listReferenceImageDatasetItems(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:get-dataset-item", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["getReferenceImageDatasetItem"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().getReferenceImageDatasetItem(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:list-run-history", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["listReferenceImageRunHistory"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().listReferenceImageRunHistory(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:reference-image:chain-to-input", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<StudioShellBackendApi["chainReferenceImageDatasetItemToInput"]>[0];
    return JSON.stringify(await getStudioShellBackendApi().chainReferenceImageDatasetItemToInput(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:runtime-window:launch", async (_event, requestJson: string) => {
    try {
      const request = JSON.parse(requestJson) as { readonly launchContract?: unknown };
      if (!request.launchContract) {
        throw new Error("invalid-request:launchContract is required.");
      }
      const launchContractJson = JSON.stringify(request.launchContract);
      const launched = await launchRuntimeWindowFromContract(launchContractJson);
      return JSON.stringify({
        ok: true,
        data: launched,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Runtime window launch failed.";
      const isInvalid = message.startsWith("invalid-request:");
      return JSON.stringify({
        ok: false,
        error: {
          code: isInvalid ? "invalid-request" : "internal",
          message: isInvalid ? message.slice("invalid-request:".length) : message,
        },
      });
    }
  });
  ipcMain.on("ai-loom-desktop-model-files:exists", (event, targetPath: string) => {
    const absolutePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, targetPath);
    event.returnValue = fs.existsSync(absolutePath);
  });
  ipcMain.on("ai-loom-desktop-model-files:stat", (event, targetPath: string) => {
    const absolutePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, targetPath);
    event.returnValue = toFileEntry(storagePaths.modelsDirectory, absolutePath);
  });
  ipcMain.on("ai-loom-desktop-model-files:read", (event, targetPath: string) => {
    const absolutePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, targetPath);
    event.returnValue = new Uint8Array(fs.readFileSync(absolutePath));
  });
  ipcMain.on("ai-loom-desktop-model-files:write", (_event, request: { path: string; content: Uint8Array; overwrite?: boolean; createDirectories?: boolean }) => {
    const absolutePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, request.path);
    if (!request.overwrite && fs.existsSync(absolutePath)) {
      throw new Error(`File '${request.path}' already exists.`);
    }
    if (request.createDirectories) {
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    }
    fs.writeFileSync(absolutePath, Buffer.from(request.content));
  });
  ipcMain.on("ai-loom-desktop-model-files:delete", (_event, targetPath: string) => {
    const absolutePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, targetPath);
    if (fs.existsSync(absolutePath)) {
      fs.rmSync(absolutePath, { recursive: true, force: true });
    }
  });
  ipcMain.on("ai-loom-desktop-model-files:list", (event, targetPath: string, options?: { recursive?: boolean }) => {
    const absolutePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, targetPath);
    event.returnValue = listEntries(storagePaths.modelsDirectory, absolutePath, options?.recursive === true);
  });
  ipcMain.on("ai-loom-desktop-model-files:move", (_event, request: { from: string; to: string; overwrite?: boolean }) => {
    const absoluteSourcePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, request.from);
    const absoluteTargetPath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, request.to);
    if (!request.overwrite && fs.existsSync(absoluteTargetPath)) {
      throw new Error(`File '${request.to}' already exists.`);
    }
    fs.mkdirSync(path.dirname(absoluteTargetPath), { recursive: true });
    fs.renameSync(absoluteSourcePath, absoluteTargetPath);
  });
  ipcMain.on("ai-loom-desktop-model-files:copy", (_event, request: { from: string; to: string; overwrite?: boolean }) => {
    const absoluteSourcePath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, request.from);
    const absoluteTargetPath = resolveModelFileAbsolutePath(storagePaths.modelsDirectory, request.to);
    if (!request.overwrite && fs.existsSync(absoluteTargetPath)) {
      throw new Error(`File '${request.to}' already exists.`);
    }
    fs.mkdirSync(path.dirname(absoluteTargetPath), { recursive: true });
    fs.copyFileSync(absoluteSourcePath, absoluteTargetPath);
  });

  logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "ipc-and-api-bindings-ready");

  ipcMain.handle("ai-loom-desktop-canonical-assets:list", async (_event, criteriaJson?: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    if (!canonicalRuntime.repository.isAvailable) {
      return [];
    }
    const criteria = criteriaJson ? JSON.parse(criteriaJson) : undefined;
    const assets = await canonicalRuntime.listCanonicalAssetsUseCase.execute(criteria);
    const details = await Promise.all(assets.map((asset: { id: string }) => canonicalRuntime.loadCanonicalAssetDetailUseCase.execute(asset.id)));
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
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    const { registryBackendApi } = canonicalRuntime;
    return JSON.stringify(await registryBackendApi.listAssets(limit));
  });
  ipcMain.handle("ai-loom-desktop-registry:assets-filter", async (_event, filtersJson: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    const { registryBackendApi } = canonicalRuntime;
    const filters = JSON.parse(filtersJson);
    return JSON.stringify(await registryBackendApi.filterAssets(filters));
  });
  ipcMain.handle("ai-loom-desktop-registry:search", async (_event, queryJson: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.searchAssets(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:explore-assets", async (_event, limit?: number) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    const { registryBackendApi } = canonicalRuntime;
    return JSON.stringify(await registryBackendApi.listExploreAssets(limit));
  });
  ipcMain.handle("ai-loom-desktop-registry:explore-search", async (_event, queryJson: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.searchExploreAssets(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:asset-detail", async (_event, queryJson: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.getAssetDetail(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:dependencies", async (_event, queryJson: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.getDependencies(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:dependents", async (_event, queryJson: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.getDependents(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:traverse-upstream", async (_event, queryJson: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.traverseDependencies(query));
  });
  ipcMain.handle("ai-loom-desktop-registry:traverse-downstream", async (_event, queryJson: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    const { registryBackendApi } = canonicalRuntime;
    const query = JSON.parse(queryJson);
    return JSON.stringify(await registryBackendApi.traverseDependents(query));
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:detail", async (_event, assetId: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    if (!canonicalRuntime.repository.isAvailable) {
      return null;
    }
    const detail = await canonicalRuntime.loadCanonicalAssetDetailUseCase.execute(assetId);
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
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    if (!canonicalRuntime.repository.isAvailable) {
      return [];
    }
    const chain = await canonicalRuntime.getVersionHistoryUseCase.execute(assetId);
    const withState = await Promise.all(chain.map(async (version) => {
      const dependencyState = await canonicalRuntime.dependencyStateUseCase.execute({
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
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    if (!canonicalRuntime.repository.isAvailable) {
      return null;
    }
    const summary = await canonicalRuntime.dependencyStateUseCase.execute({
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
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    if (!canonicalRuntime.repository.isAvailable) {
      return null;
    }
    const reconciled = await canonicalRuntime.reconcileIdentityUseCase.execute({
      entityType: entityType as any,
      entityId,
    });
    return JSON.stringify(reconciled);
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:replay-scope", async (_event, entityType: string, entityId: string, versionId?: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    if (!canonicalRuntime.repository.isAvailable) {
      return JSON.stringify({ replayed: false, reason: "Canonical asset system is unavailable." });
    }
    const replay = await canonicalRuntime.replayScopedProjectionUseCase.execute({ entityType: entityType as any, entityId, versionId });
    return JSON.stringify(replay);
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:verify-projection", async (_event, assetId: string, versionIdsInScope?: ReadonlyArray<string>) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    if (!canonicalRuntime.repository.isAvailable) {
      return null;
    }
    const verification = await canonicalRuntime.verifyProjectionUseCase.execute({ assetId, versionIdsInScope });
    return JSON.stringify(canonicalRuntime.projectionTrustReadModelService.summarize(verification));
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:rebuild-scopes", async (_event, requestJson: string) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    if (!canonicalRuntime.repository.isAvailable) {
      return JSON.stringify({ totalScopes: 0, replayedScopes: 0, verifiedScopes: 0, results: [] });
    }
    const request = JSON.parse(requestJson);
    const result = await canonicalRuntime.rebuildProjectionOrchestrationUseCase.execute(request);
    return JSON.stringify(result);
  });
  ipcMain.handle("ai-loom-desktop-canonical-assets:management-snapshot", async (_event, assetId: string, includeProjectionHealth = true, versionIdsInProjectionScope?: ReadonlyArray<string>) => {
    const canonicalRuntime = await ensureCanonicalRegistryRuntime(storagePaths);
    if (!canonicalRuntime.repository.isAvailable) {
      return null;
    }
    const snapshot = await canonicalRuntime.loadManagementSnapshotUseCase.execute({
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
  });
  logInitializationCheckpoint(DesktopStartupPhases.postLoginWarmup, "deferred-feature-registration-ready", bootstrapStartedAt);
  logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "deferred-feature-registration-ready");

  if (runtimeConfig.isPackagedDesktopHost && !pythonRuntime.isAvailable) {
    console.warn(
      `[ai-loom] Packaged private Python runtime was not found at '${pythonRuntime.executablePath ?? pythonRuntime.runtimeRoot}'.`,
    );
  }
  } finally {
    logInitializationEnd(DesktopStartupPhases.postLoginWarmup, bootstrapStartedAt);
    logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "complete");
  }
}

async function disposeDesktopRuntimeResources(): Promise<void> {
  isDesktopRuntimeDisposing = true;
  const pendingPostLoginBootstrap = postLoginBootstrapPromise;
  postLoginBootstrapPromise = undefined;
  await pendingPostLoginBootstrap?.catch(() => undefined);
  desktopConnectivityStateService?.stopMonitoring();
  desktopConnectivityStateService = undefined;
  await authMinimalServerRuntime?.stop();
  await serviceSupervisor?.stop();
  storageDatabase?.dispose();
  deferredFeatureRuntime?.dispose();
  agentRepository?.dispose();
  agentSessionRepository?.dispose();
  agentRunnerAssetSystemRepository?.dispose();
  canonicalRegistryRuntime?.repository.dispose();
  agentStudioBackendApi = undefined;
  agentRepository = undefined;
  agentSessionRepository = undefined;
  agentRunnerAssetSystemRepository = undefined;
  canonicalRegistryRuntime = undefined;
  deferredFeatureRuntime = undefined;
  serviceSupervisor = undefined;
  authMinimalServerRuntime = undefined;
  bootstrapContext = undefined;
  rendererContentSecurityPolicyRuntimeConfig = undefined;
  deferredFeatureIpcReady = false;
  postLoginWarmupStarted = false;
  authShellBootstrapResult = undefined;
  isDesktopRuntimeDisposing = false;
}

app.whenReady().then(async () => {
  const desktopHostStartupAt = logInitializationStart(DesktopStartupPhases.hostBootstrap);
  try {
    desktopHostRuntime = await startDesktopHostAssembly({
      startHost: async () => {
        try {
          const authShell = await bootstrapAuthShell();
          authShellBootstrapResult = authShell;
          installRendererContentSecurityPolicy();
          logInitializationCheckpoint(DesktopStartupPhases.hostBootstrap, "pre-login-auth-shell-ready", desktopHostStartupAt);
          logInitializationMemory(DesktopStartupPhases.hostBootstrap, "pre-login-auth-shell-ready");
          await createMainWindow();
          logInitializationCheckpoint(DesktopStartupPhases.hostBootstrap, "main-window-ready", desktopHostStartupAt);
          logInitializationMemory(DesktopStartupPhases.hostBootstrap, "main-window-ready");
          return Object.freeze({
            close: disposeDesktopRuntimeResources,
          });
        } catch (error) {
          await disposeDesktopRuntimeResources();
          throw error;
        }
      },
      boot: {
        startupReason: "electron-main-desktop-host-startup",
        environment: process.env,
      },
    });
  } finally {
    logInitializationEnd(DesktopStartupPhases.hostBootstrap, desktopHostStartupAt);
  }

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
  await desktopHostRuntime?.stop();
});

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
  DesktopPostLoginRuntimeStatus,
  DesktopPostLoginRuntimeUnavailableReason,
  DesktopPostLoginWarmupRequest,
} from "../shared/DesktopContracts";
import {
  DesktopPostLoginRuntimeActivationModes,
  DesktopPostLoginRuntimeStates,
  DesktopPostLoginRuntimeUnavailableReasons,
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
import { ListPersistedWorkflowsUseCase } from "../../src/application/workflow-persistence/ListPersistedWorkflowsUseCase";
import {
  parseSystemRuntimeWindowLaunchContract,
  SystemRuntimeWindowLaunchQueryParam,
  type LaunchSystemRuntimeWindowReadModel,
} from "../../src/application/system-runtime/SystemRuntimeWindowLaunchContract";
import { createRendererContentSecurityPolicyResolver } from "./RendererContentSecurityPolicy";
import { logInitializationCheckpoint, logInitializationEnd, logInitializationMemory, logInitializationStart } from "./InitializationLogging";
import { createDesktopConnectivityProbePort, normalizeHttpOrigin, resolveDesktopIdentityTransportTrustBootstrap } from "./DesktopTrustBootstrap";
import { registerAuthBootstrapIpc } from "./AuthBootstrapIpcRegistration";
import { DesktopStartupPhases, validateDesktopStartupContract } from "./DesktopStartupContract";
import { registerDeferredFeatureIpcDomains } from "./ipc/registerDeferredFeatureIpcDomains";
import type { OnDemandFeatureCompositionPaths } from "./ipc/IpcRegistrationTypes";
import { startDesktopHostAssembly, type DesktopHostRuntimeHandle } from "../../src/hosts/desktop/DesktopHostEntrypoint";
import {
  DesktopConnectivityStateService,
} from "../../src/hosts/desktop/DesktopConnectivityStateService";
import type { DeferredDesktopFeatureRuntime } from "./DeferredDesktopFeatureRuntime";
import {
  startAuthMinimalServerHostAssembly,
  type AuthMinimalServerHostRuntimeHandle,
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
  const resolvePolicy = createRendererContentSecurityPolicyResolver({
    rendererDevUrl,
    getRuntimeConfig: () => rendererContentSecurityPolicyRuntimeConfig,
  });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders ? { ...details.responseHeaders } : {};
    responseHeaders["Content-Security-Policy"] = [resolvePolicy()];
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
let authMinimalServerRuntime: AuthMinimalServerHostRuntimeHandle | undefined;
let bootstrapContext: DesktopAuthBootstrapContext | undefined;
let rendererContentSecurityPolicyRuntimeConfig: AppRuntimeConfigValues | undefined;
let desktopHostRuntime: DesktopHostRuntimeHandle | undefined;
let desktopConnectivityStateService: DesktopConnectivityStateService | undefined;
let desktopConnectivityMonitoringStarted = false;
let deferredFeatureRuntime: DeferredDesktopFeatureRuntime | undefined;
let deferredDesktopFeatureRuntimeFactory: ((options: {
  readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
  readonly runtimeConfigValues: AppRuntimeConfigValues;
  readonly repoRoot: string;
}) => DeferredDesktopFeatureRuntime) | undefined;
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
let postLoginRuntimeStatus: DesktopPostLoginRuntimeStatus = Object.freeze({
  state: DesktopPostLoginRuntimeStates.unavailable,
  unavailableReason: DesktopPostLoginRuntimeUnavailableReasons.preLogin,
  updatedAt: new Date().toISOString(),
});
const DeferredConnectivityStateDetail = "Connectivity monitoring is deferred until post-login runtime warmup starts.";

type AuthShellBootstrapResult = {
  readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
  readonly identityApiBaseUrl: string;
};

async function ensureDeferredDesktopFeatureRuntimeFactory(): Promise<(
  options: {
    readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
    readonly runtimeConfigValues: AppRuntimeConfigValues;
    readonly repoRoot: string;
  },
) => DeferredDesktopFeatureRuntime> {
  if (deferredDesktopFeatureRuntimeFactory) {
    return deferredDesktopFeatureRuntimeFactory;
  }
  const runtimeModule = await import("./DeferredDesktopFeatureRuntime");
  deferredDesktopFeatureRuntimeFactory = runtimeModule.createDeferredDesktopFeatureRuntime;
  return deferredDesktopFeatureRuntimeFactory;
}

function markPostLoginRuntimeUnavailable(reason: DesktopPostLoginRuntimeUnavailableReason): void {
  postLoginRuntimeStatus = Object.freeze({
    state: DesktopPostLoginRuntimeStates.unavailable,
    unavailableReason: reason,
    updatedAt: new Date().toISOString(),
  });
}

function markPostLoginRuntimeWarming(request: DesktopPostLoginWarmupRequest): void {
  postLoginRuntimeStatus = Object.freeze({
    state: DesktopPostLoginRuntimeStates.warming,
    activationMode: request.triggerSource === "feature-demand"
      ? DesktopPostLoginRuntimeActivationModes.lazyFeatureDemand
      : DesktopPostLoginRuntimeActivationModes.authSuccessWarmup,
    triggerSource: request.triggerSource,
    requestedAt: request.requestedAt,
    updatedAt: new Date().toISOString(),
  });
}

function markPostLoginRuntimeReady(): void {
  postLoginRuntimeStatus = Object.freeze({
    ...postLoginRuntimeStatus,
    state: DesktopPostLoginRuntimeStates.ready,
    failure: undefined,
    updatedAt: new Date().toISOString(),
  });
}

function markPostLoginRuntimeFailed(request: DesktopPostLoginWarmupRequest, error: unknown): void {
  const message = error instanceof Error ? error.message : "Post-login runtime warmup failed.";
  postLoginRuntimeStatus = Object.freeze({
    state: DesktopPostLoginRuntimeStates.failed,
    activationMode: request.triggerSource === "feature-demand"
      ? DesktopPostLoginRuntimeActivationModes.lazyFeatureDemand
      : DesktopPostLoginRuntimeActivationModes.authSuccessWarmup,
    triggerSource: request.triggerSource,
    requestedAt: request.requestedAt,
    updatedAt: new Date().toISOString(),
    failure: Object.freeze({
      message,
      failedAt: new Date().toISOString(),
      retryable: true,
    }),
  });
}

function createDeferredConnectivityState(detail?: string): {
  readonly state: "connecting";
  readonly stale: false;
  readonly localModeActive: false;
  readonly detail?: string;
  readonly lastChangedAt: string;
  readonly canQueueOperations: true;
  readonly canResynchronize: false;
} {
  return Object.freeze({
    state: "connecting",
    stale: false,
    localModeActive: false,
    detail,
    lastChangedAt: new Date().toISOString(),
    canQueueOperations: true,
    canResynchronize: false,
  });
}

function getConnectivityStateForAuthBootstrapIpc(): string {
  if (!desktopConnectivityMonitoringStarted) {
    return JSON.stringify(createDeferredConnectivityState(DeferredConnectivityStateDetail));
  }
  const state = desktopConnectivityStateService?.getState() ?? createDeferredConnectivityState();
  return JSON.stringify(state);
}

function setConnectivityOfflineModeForAuthBootstrapIpc(requestJson: string): string {
  const request = JSON.parse(requestJson) as { readonly active?: boolean; readonly detail?: string };
  if (!desktopConnectivityMonitoringStarted || !desktopConnectivityStateService) {
    return JSON.stringify(createDeferredConnectivityState(DeferredConnectivityStateDetail));
  }
  const state = desktopConnectivityStateService.setDeliberateOfflineMode(request.active === true, request.detail);
  return JSON.stringify(state);
}

function startDesktopConnectivityMonitoring(identityApiBaseUrl: string): void {
  if (desktopConnectivityMonitoringStarted) {
    return;
  }
  if (!desktopConnectivityStateService) {
    desktopConnectivityStateService = new DesktopConnectivityStateService();
  }
  desktopConnectivityStateService.startMonitoring(createDesktopConnectivityProbePort(identityApiBaseUrl, (key) => storageDatabase?.getItem(key) ?? null), {
    intervalMs: 3_000,
  });
  desktopConnectivityMonitoringStarted = true;
}

function stopDesktopConnectivityMonitoring(): void {
  desktopConnectivityStateService?.stopMonitoring();
  desktopConnectivityMonitoringStarted = false;
  desktopConnectivityStateService = undefined;
}

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
  window.once("ready-to-show", () => {
    logInitializationCheckpoint(DesktopStartupPhases.mainWindowCreation, "first-window-ready-to-show", mainWindowCreateStartedAt);
    logInitializationMemory(DesktopStartupPhases.mainWindowCreation, "first-window-ready-to-show");
    window.maximize();
    window.show();
  });

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
    getPostLoginRuntimeStatus: () => postLoginRuntimeStatus,
    startPostLoginWarmup: async (request: DesktopPostLoginWarmupRequest) => {
      await ensurePostLoginWarmupStarted(request);
    },
    connectivity: {
      getState: () => getConnectivityStateForAuthBootstrapIpc(),
      setOfflineMode: (requestJson: string) => setConnectivityOfflineModeForAuthBootstrapIpc(requestJson),
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
    const authMinimalHostStartAt = logInitializationStart(DesktopStartupPhases.identityAuthHostReadiness);
    logInitializationMemory(DesktopStartupPhases.identityAuthHostReadiness, "start");
    console.info("[ai-loom][startup] Starting auth-minimal identity host for pre-login bootstrap.");
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
    logInitializationEnd(DesktopStartupPhases.identityAuthHostReadiness, authMinimalHostStartAt);
    console.info(`[ai-loom][startup] Auth-minimal identity host ready at ${authMinimalServerRuntime.address}.`);
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
    markPostLoginRuntimeReady();
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
  markPostLoginRuntimeWarming(request);
  startDesktopConnectivityMonitoring(authShell.identityApiBaseUrl);
  console.info("[ai-loom] Starting post-login desktop runtime warmup.");
  logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "request-accepted");
  postLoginBootstrapPromise = bootstrapPostLoginRuntime(authShell);
  try {
    await postLoginBootstrapPromise;
    console.info("[ai-loom] Post-login desktop runtime warmup completed.");
  } catch (error) {
    postLoginBootstrapPromise = undefined;
    markPostLoginRuntimeFailed(request, error);
    if (!isDesktopRuntimeDisposing) {
      console.error("Post-login desktop runtime bootstrap failed", error);
      await disposeDesktopRuntimeResources();
      app.exit(1);
    }
    postLoginWarmupStarted = false;
    throw error;
  }
}

type PostLoginRuntimeComposition = {
  readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
  readonly runtimeConfig: AppRuntimeConfig;
  readonly pythonRuntime: ReturnType<typeof resolveDesktopPythonRuntime>;
  readonly featureRuntime: DeferredDesktopFeatureRuntime;
};

async function composePostLoginRuntime(authShell: AuthShellBootstrapResult, bootstrapStartedAt: number): Promise<PostLoginRuntimeComposition> {
  const { storagePaths, identityApiBaseUrl } = authShell;
  if (!storageDatabase) {
    throw new Error("Desktop storage database is unavailable for post-login runtime bootstrap.");
  }

  const pythonRuntimeResolutionStartedAt = logInitializationStart("desktop-startup.post-login-python-runtime-resolve");
  console.info("[ai-loom][startup] Resolving desktop Python runtime for post-login warmup.");
  const pythonRuntime = resolveDesktopPythonRuntime({
    isPackaged,
    repoRoot,
    resourcesPath: process.resourcesPath,
    storagePaths,
  });
  logInitializationEnd("desktop-startup.post-login-python-runtime-resolve", pythonRuntimeResolutionStartedAt);
  console.info(
    `[ai-loom][startup] Desktop Python runtime resolved (mode=${pythonRuntime.mode}, available=${pythonRuntime.isAvailable}).`,
  );
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
  console.info("[ai-loom][startup] Starting desktop local service supervisor for post-login runtime.");
  await serviceSupervisor.start();
  logInitializationEnd("desktop-startup.post-login-service-supervisor-start", supervisorStartAt);
  console.info(
    `[ai-loom][startup] Desktop local service supervisor ready (baseUrl=${serviceSupervisor.baseUrl}, runtimeBaseUrl=${serviceSupervisor.runtimeBaseUrl}).`,
  );
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
  const createDeferredDesktopFeatureRuntime = await ensureDeferredDesktopFeatureRuntimeFactory();
  deferredFeatureRuntime = createDeferredDesktopFeatureRuntime({
    storagePaths,
    runtimeConfigValues: runtimeConfig.toValues(),
    repoRoot,
  });
  logInitializationCheckpoint(DesktopStartupPhases.postLoginWarmup, "deferred-feature-runtime-container-ready", bootstrapStartedAt);
  logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "deferred-feature-runtime-container-ready");
  const featureRuntime = deferredFeatureRuntime;
  if (!featureRuntime) {
    throw new Error("Deferred desktop feature runtime is unavailable for post-login bootstrap.");
  }

  return Object.freeze({
    storagePaths,
    runtimeConfig,
    pythonRuntime,
    featureRuntime,
  });
}

function createOnDemandFeatureCompositionPaths(params: {
  readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
  readonly featureRuntime: DeferredDesktopFeatureRuntime;
}): OnDemandFeatureCompositionPaths {
  return Object.freeze({
    getWorkflowPersistence: () => params.featureRuntime.ensureWorkflowPersistence(),
    getExecutionHistory: () => params.featureRuntime.ensureExecutionHistory(),
    getWorkflowRunHistory: () => params.featureRuntime.ensureWorkflowRunHistory(),
    getStudioShellBackendApi: () => params.featureRuntime.ensureStudioShellBackendApi(),
    getSystemStudioBackendApi: () => params.featureRuntime.ensureSystemStudioBackendApi(),
    getSystemRuntimeBackendApi: () => params.featureRuntime.ensureSystemRuntimeBackendApi(),
    getCanonicalRegistryRuntime: () => ensureCanonicalRegistryRuntime(params.storagePaths),
    getAgentStudioBackendApi: () => ensureAgentStudioBackendApi(params.storagePaths),
  });
}

async function bootstrapPostLoginRuntime(authShell: AuthShellBootstrapResult): Promise<void> {
  const bootstrapStartedAt = logInitializationStart(DesktopStartupPhases.postLoginWarmup);
  try {
    logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "start");
    const runtimeComposition = await composePostLoginRuntime(authShell, bootstrapStartedAt);
    const { storagePaths, runtimeConfig, pythonRuntime, featureRuntime } = runtimeComposition;
    registerDeferredFeatureIpc(() => {
      const onDemand = createOnDemandFeatureCompositionPaths({ storagePaths, featureRuntime });
      registerDeferredFeatureIpcDomains({
        ipcMain,
        onDemand,
        storagePaths,
        launchRuntimeWindowFromContract,
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
  markPostLoginRuntimeUnavailable(DesktopPostLoginRuntimeUnavailableReasons.shuttingDown);
  const pendingPostLoginBootstrap = postLoginBootstrapPromise;
  postLoginBootstrapPromise = undefined;
  await pendingPostLoginBootstrap?.catch(() => undefined);
  stopDesktopConnectivityMonitoring();
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
  deferredDesktopFeatureRuntimeFactory = undefined;
  serviceSupervisor = undefined;
  authMinimalServerRuntime = undefined;
  bootstrapContext = undefined;
  rendererContentSecurityPolicyRuntimeConfig = undefined;
  deferredFeatureIpcReady = false;
  postLoginWarmupStarted = false;
  authShellBootstrapResult = undefined;
  markPostLoginRuntimeUnavailable(DesktopPostLoginRuntimeUnavailableReasons.preLogin);
  isDesktopRuntimeDisposing = false;
}

app.whenReady().then(async () => {
  const desktopHostStartupAt = logInitializationStart(DesktopStartupPhases.hostBootstrap);
  try {
    desktopHostRuntime = await startDesktopHostAssembly({
      startHost: async () => {
        try {
          logInitializationCheckpoint(DesktopStartupPhases.hostBootstrap, "pre-login-auth-shell-start", desktopHostStartupAt);
          const authShell = await bootstrapAuthShell();
          logInitializationCheckpoint(DesktopStartupPhases.hostBootstrap, "pre-login-auth-shell-starting", desktopHostStartupAt);
          authShellBootstrapResult = authShell;
          logInitializationCheckpoint(DesktopStartupPhases.hostBootstrap, "pre-login-csp-install-start", desktopHostStartupAt);
          installRendererContentSecurityPolicy();
          logInitializationCheckpoint(DesktopStartupPhases.hostBootstrap, "pre-login-auth-shell-ready", desktopHostStartupAt);
          logInitializationMemory(DesktopStartupPhases.hostBootstrap, "pre-login-auth-shell-ready");
          await createMainWindow();
          logInitializationCheckpoint(DesktopStartupPhases.hostBootstrap, "renderer-first-window-ready", desktopHostStartupAt);
          logInitializationMemory(DesktopStartupPhases.hostBootstrap, "renderer-first-window-ready");
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

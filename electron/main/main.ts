/**
 * Electron main-process entrypoint that initializes startup contracts, registers IPC surfaces, and composes deferred desktop runtimes.
 */
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
import { DesktopServiceSupervisor } from "./DesktopServiceSupervisor";
import type {
  DesktopAuthBootstrapContext,
  DesktopAuthBootstrapRuntimeConfig,
  DesktopPostLoginWarmupRequest,
} from "../shared/DesktopContracts";
import {
  DesktopPostLoginRuntimeUnavailableReasons,
} from "../shared/DesktopContracts";
import { type LaunchSystemRuntimeWindowReadModel } from "../../src/application/system-runtime/SystemRuntimeWindowLaunchContract";
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
import { createDesktopPostLoginRuntimeStatusStore } from "./DesktopPostLoginRuntimeStatusStore";
import { createDesktopConnectivityRuntimeController } from "./DesktopConnectivityRuntimeController";
import type { DeferredDesktopFeatureRuntime } from "./DeferredDesktopFeatureRuntime";
import {
  startAuthMinimalServerHostAssembly,
  type AuthMinimalServerHostRuntimeHandle,
} from "../../src/hosts/server/AuthMinimalServerHostEntrypoint";
import { createDesktopWindowManager } from "./DesktopWindowManager";
import { registerDesktopAppLifecycle } from "./DesktopAppLifecycle";
import { createDesktopAgentRuntimeProvider, type DesktopAgentRuntimeProvider } from "./runtime/DesktopAgentRuntimeProvider";
import { createCanonicalRegistryRuntimeProvider, type CanonicalRegistryRuntimeProvider } from "./runtime/CanonicalRegistryRuntimeProvider";

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

/**
 * Resolves the preload bundle path by probing packaged and development output locations in priority order.
 */
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

/**
 * Installs response-header middleware that injects the renderer Content Security Policy for every main-session response.
 */
function installRendererContentSecurityPolicy(): void {
  const resolvePolicy = createRendererContentSecurityPolicyResolver({
    rendererDevUrl,
    getRuntimeConfig: () => rendererContentSecurityPolicyRuntimeConfig,
  });
  // Intercepts renderer responses to attach the latest CSP header resolved from current runtime config.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders ? { ...details.responseHeaders } : {};
    responseHeaders["Content-Security-Policy"] = [resolvePolicy()];
    callback({ responseHeaders });
  });
}

let storageDatabase: DesktopStorageDatabase | undefined;
let serviceSupervisor: DesktopServiceSupervisor | undefined;
let authMinimalServerRuntime: AuthMinimalServerHostRuntimeHandle | undefined;
let bootstrapContext: DesktopAuthBootstrapContext | undefined;
let rendererContentSecurityPolicyRuntimeConfig: AppRuntimeConfigValues | undefined;
let desktopHostRuntime: DesktopHostRuntimeHandle | undefined;
let deferredFeatureRuntime: DeferredDesktopFeatureRuntime | undefined;
let deferredDesktopFeatureRuntimeFactory: ((options: {
  readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
  readonly runtimeConfigValues: AppRuntimeConfigValues;
  readonly repoRoot: string;
}) => DeferredDesktopFeatureRuntime) | undefined;
let agentRuntimeProvider: DesktopAgentRuntimeProvider | undefined;
let canonicalRegistryRuntimeProvider: CanonicalRegistryRuntimeProvider | undefined;
const DesktopServiceSupervisorPort = 8790;
let authIpcRegistered = false;
let deferredFeatureIpcRegistered = false;
let deferredFeatureIpcReady = false;
let postLoginBootstrapPromise: Promise<void> | undefined;
let postLoginWarmupStarted = false;
let isDesktopRuntimeDisposing = false;
let authShellBootstrapResult: AuthShellBootstrapResult | undefined;
const postLoginRuntimeStatusStore = createDesktopPostLoginRuntimeStatusStore();
const connectivityRuntimeController = createDesktopConnectivityRuntimeController({
  createConnectivityStateService: () => new DesktopConnectivityStateService(),
  createConnectivityProbePort: createDesktopConnectivityProbePort,
  lookupToken: (key) => storageDatabase?.getItem(key) ?? null,
});

const windowManager = createDesktopWindowManager({
  BrowserWindow,
  preloadScriptPath,
  rendererDevUrl,
  isPackaged,
  mainProcessDir: __dirname,
  getRuntimeConfig: () => bootstrapContext?.runtimeConfig,
});

type AuthShellBootstrapResult = {
  readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
  readonly identityApiBaseUrl: string;
};

/**
 * Lazily imports and memoizes the deferred feature runtime factory so startup can defer heavy module loading until needed.
 */
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

async function openMainDesktopWindow(): Promise<void> {
  const mainWindowCreateStartedAt = logInitializationStart(DesktopStartupPhases.mainWindowCreation);
  await windowManager.createMainWindow({
    onReadyToShow: () => {
      logInitializationCheckpoint(DesktopStartupPhases.mainWindowCreation, "first-window-ready-to-show", mainWindowCreateStartedAt);
      logInitializationMemory(DesktopStartupPhases.mainWindowCreation, "first-window-ready-to-show");
    },
    onRendererLoaded: () => {
      logInitializationCheckpoint(DesktopStartupPhases.mainWindowCreation, "renderer-content-loaded", mainWindowCreateStartedAt);
      logInitializationMemory(DesktopStartupPhases.mainWindowCreation, "renderer-content-loaded");
    },
    onComplete: () => {
      logInitializationEnd(DesktopStartupPhases.mainWindowCreation, mainWindowCreateStartedAt);
      logInitializationMemory(DesktopStartupPhases.mainWindowCreation, "ready");
    },
  });
}

/**
 * Builds immutable auth bootstrap context shared with renderer preload surfaces and auth IPC handlers.
 */
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

/**
 * Projects full runtime config values to the reduced auth-bootstrap runtime contract exposed before post-login warmup.
 */
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

/**
 * Registers pre-login auth bootstrap IPC channels once and wires storage, secrets, connectivity, and warmup hooks.
 */
function registerAuthIpc(): void {
  if (authIpcRegistered) {
    return;
  }
  authIpcRegistered = true;
  registerAuthBootstrapIpc({
    ipcMain,
    // Supplies immutable bootstrap context required by auth preload APIs.
    getBootstrapContext: () => bootstrapContext,
    storage: {
      // Reads persisted bootstrap storage values used by auth-shell workflows.
      getItem: (key: string) => storageDatabase?.getItem(key) ?? null,
      // Persists bootstrap storage values from renderer auth operations.
      setItem: (key: string, value: string) => {
        storageDatabase?.setItem(key, value);
      },
      // Removes bootstrap storage keys requested by renderer auth operations.
      removeItem: (key: string) => {
        storageDatabase?.removeItem(key);
      },
    },
    // Reports deferred-feature IPC readiness to control renderer feature gating.
    isDeferredFeatureIpcReady: () => deferredFeatureIpcReady,
    // Returns lifecycle status of post-login runtime warmup.
    getPostLoginRuntimeStatus: () => postLoginRuntimeStatusStore.getStatus(),
    // Handles explicit renderer requests to start post-login warmup.
    startPostLoginWarmup: async (request: DesktopPostLoginWarmupRequest) => {
      await ensurePostLoginWarmupStarted(request);
    },
    connectivity: {
      // Returns current serialized connectivity state for auth surfaces.
      getState: () => connectivityRuntimeController.getConnectivityStateForAuthBootstrapIpc(),
      // Applies deliberate offline-mode transitions for auth surfaces.
      setOfflineMode: (requestJson: string) => connectivityRuntimeController.setConnectivityOfflineModeForAuthBootstrapIpc(requestJson),
    },
    secrets: {
      // Indicates whether OS-backed encryption services are currently available.
      isAvailable: () => safeStorage.isEncryptionAvailable(),
      // Decrypts and returns a secret value from storage if available.
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
      // Encrypts and stores a secret value when platform encryption is available.
      setSecret: (key: string, value: string) => {
        if (!safeStorage.isEncryptionAvailable()) {
          return;
        }
        const encrypted = safeStorage.encryptString(value).toString("base64");
        storageDatabase?.setItem(`secure:${key}`, encrypted);
      },
      // Removes a previously stored encrypted secret value.
      removeSecret: (key: string) => {
        storageDatabase?.removeItem(`secure:${key}`);
      },
    },
  });
}

/**
 * Bootstraps pre-login runtime infrastructure, including storage, identity host, runtime config, and auth IPC.
 */
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

/**
 * Registers deferred feature IPC domains a single time and updates lifecycle status when registration succeeds.
 */
function registerDeferredFeatureIpc(register: () => void): void {
  if (deferredFeatureIpcRegistered) {
    return;
  }
  const deferredFeatureRegistrationStartedAt = logInitializationStart(DesktopStartupPhases.deferredFeatureRegistration);
  try {
    deferredFeatureIpcRegistered = true;
    register();
    deferredFeatureIpcReady = true;
    postLoginRuntimeStatusStore.markReady();
    logInitializationMemory(DesktopStartupPhases.deferredFeatureRegistration, "ready");
  } finally {
    logInitializationEnd(DesktopStartupPhases.deferredFeatureRegistration, deferredFeatureRegistrationStartedAt);
  }
}

/**
 * Formats a compact post-login warmup request string for startup diagnostics logging.
 */
function formatPostLoginWarmupRequestLog(request: DesktopPostLoginWarmupRequest): string {
  return `source=${request.triggerSource}${request.requestedAt ? ` requestedAt=${request.requestedAt}` : ""}`;
}

/**
 * Starts post-login warmup once, deduplicates concurrent requests, and handles failure shutdown semantics.
 */
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
  postLoginRuntimeStatusStore.markWarming(request);
  connectivityRuntimeController.startMonitoring(authShell.identityApiBaseUrl);
  console.info("[ai-loom] Starting post-login desktop runtime warmup.");
  logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "request-accepted");
  postLoginBootstrapPromise = bootstrapPostLoginRuntime(authShell);
  try {
    await postLoginBootstrapPromise;
    console.info("[ai-loom] Post-login desktop runtime warmup completed.");
  } catch (error) {
    postLoginBootstrapPromise = undefined;
    postLoginRuntimeStatusStore.markFailed(request, error);
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

/**
 * Composes post-login runtime dependencies (python, service supervisor, config, deferred runtime container).
 */
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

/**
 * Exposes lazy feature-resolver functions used by deferred IPC domains to load expensive services on demand.
 */
function createOnDemandFeatureCompositionPaths(params: {
  readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
  readonly featureRuntime: DeferredDesktopFeatureRuntime;
  readonly agentRuntimeProvider: DesktopAgentRuntimeProvider;
  readonly canonicalRegistryRuntimeProvider: CanonicalRegistryRuntimeProvider;
}): OnDemandFeatureCompositionPaths {
  // Each resolver lazily constructs/accesses a deferred feature service only when its IPC domain is exercised.
  return Object.freeze({
    getWorkflowPersistence: () => params.featureRuntime.ensureWorkflowPersistence(),
    getExecutionHistory: () => params.featureRuntime.ensureExecutionHistory(),
    getWorkflowRunHistory: () => params.featureRuntime.ensureWorkflowRunHistory(),
    getStudioShellBackendApi: () => params.featureRuntime.ensureStudioShellBackendApi(),
    getSystemStudioBackendApi: () => params.featureRuntime.ensureSystemStudioBackendApi(),
    getSystemRuntimeBackendApi: () => params.featureRuntime.ensureSystemRuntimeBackendApi(),
    getCanonicalRegistryRuntime: () => params.canonicalRegistryRuntimeProvider.ensureCanonicalRegistryRuntime(),
    getAgentStudioBackendApi: () => params.agentRuntimeProvider.ensureAgentStudioBackendApi(),
  });
}

/**
 * Completes post-login bootstrap by composing runtime dependencies and registering deferred IPC domains.
 */
async function bootstrapPostLoginRuntime(authShell: AuthShellBootstrapResult): Promise<void> {
  const bootstrapStartedAt = logInitializationStart(DesktopStartupPhases.postLoginWarmup);
  try {
    logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "start");
    const runtimeComposition = await composePostLoginRuntime(authShell, bootstrapStartedAt);
    const { storagePaths, runtimeConfig, pythonRuntime, featureRuntime } = runtimeComposition;
    agentRuntimeProvider = createDesktopAgentRuntimeProvider({
      storagePaths,
      onRuntimeReady: () => logInitializationMemory(DesktopStartupPhases.deferredFeatureRuntime, "agent-runtime-ready"),
    });
    canonicalRegistryRuntimeProvider = createCanonicalRegistryRuntimeProvider({
      storagePaths,
      getDeferredFeatureRuntime: () => deferredFeatureRuntime,
      onRuntimeReady: () => logInitializationMemory(DesktopStartupPhases.deferredFeatureRuntime, "canonical-registry-runtime-ready"),
    });
    // Registers deferred IPC only after core post-login services are composed and ready.
    registerDeferredFeatureIpc(() => {
      const onDemand = createOnDemandFeatureCompositionPaths({
        storagePaths,
        featureRuntime,
        agentRuntimeProvider: agentRuntimeProvider!,
        canonicalRegistryRuntimeProvider: canonicalRegistryRuntimeProvider!,
      });
      registerDeferredFeatureIpcDomains({
        ipcMain,
        onDemand,
        storagePaths,
        launchRuntimeWindowFromContract: async (launchContractJson): Promise<LaunchSystemRuntimeWindowReadModel> => {
          return windowManager.launchRuntimeWindowFromContract(launchContractJson);
        },
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

/**
 * Stops hosts/services and clears cached runtime resources so shutdown and fatal-error recovery are clean.
 */
async function disposeDesktopRuntimeResources(): Promise<void> {
  isDesktopRuntimeDisposing = true;
  postLoginRuntimeStatusStore.markUnavailable(DesktopPostLoginRuntimeUnavailableReasons.shuttingDown);
  const pendingPostLoginBootstrap = postLoginBootstrapPromise;
  postLoginBootstrapPromise = undefined;
  await pendingPostLoginBootstrap?.catch(() => undefined);
  connectivityRuntimeController.stopMonitoring();
  await authMinimalServerRuntime?.stop();
  await serviceSupervisor?.stop();
  storageDatabase?.dispose();
  deferredFeatureRuntime?.dispose();
  agentRuntimeProvider?.dispose();
  canonicalRegistryRuntimeProvider?.dispose();
  deferredFeatureRuntime = undefined;
  agentRuntimeProvider = undefined;
  canonicalRegistryRuntimeProvider = undefined;
  deferredDesktopFeatureRuntimeFactory = undefined;
  serviceSupervisor = undefined;
  authMinimalServerRuntime = undefined;
  bootstrapContext = undefined;
  rendererContentSecurityPolicyRuntimeConfig = undefined;
  deferredFeatureIpcReady = false;
  postLoginWarmupStarted = false;
  authShellBootstrapResult = undefined;
  postLoginRuntimeStatusStore.markUnavailable(DesktopPostLoginRuntimeUnavailableReasons.preLogin);
  isDesktopRuntimeDisposing = false;
}

registerDesktopAppLifecycle({
  app,
  hasOpenWindows: () => windowManager.hasOpenWindows(),
  createMainWindow: openMainDesktopWindow,
  bootstrapDesktopHost: async () => {
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
            await openMainDesktopWindow();
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
  },
  stopDesktopHost: async () => {
    await desktopHostRuntime?.stop();
  },
  isMacOS: process.platform === "darwin",
});

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
  DesktopControlPlaneCapabilityPhase,
  DesktopPostLoginWarmupRequest,
} from "../shared/DesktopContracts";
import { createRendererContentSecurityPolicyResolver } from "./RendererContentSecurityPolicy";
import { logInitializationCheckpoint, logInitializationEnd, logInitializationMemory, logInitializationStart } from "./InitializationLogging";
import { createDesktopConnectivityProbePort, normalizeHttpOrigin, resolveDesktopIdentityTransportTrustBootstrap } from "./DesktopTrustBootstrap";
import { registerAuthBootstrapIpc } from "./AuthBootstrapIpcRegistration";
import { DesktopStartupPhases, validateDesktopStartupContract } from "./DesktopStartupContract";
import { startDesktopHostAssembly, type DesktopHostRuntimeHandle } from "../../src/hosts/desktop/DesktopHostEntrypoint";
import {
  DesktopConnectivityStateService,
} from "../../src/hosts/desktop/DesktopConnectivityStateService";
import { createDesktopPostLoginRuntimeStatusStore } from "./DesktopPostLoginRuntimeStatusStore";
import { createDesktopConnectivityRuntimeController } from "./DesktopConnectivityRuntimeController";
import type { DeferredDesktopFeatureRuntime } from "./DeferredDesktopFeatureRuntime";
import { startAuthoritativeServerHostAssembly } from "../../src/hosts/server/AuthoritativeServerHostEntrypoint";
import type { AuthoritativeServerHostRuntimeHandle } from "../../src/hosts/server/AuthoritativeServerCompositionRoot";
import { AuthoritativeServerCapabilityIds } from "../../src/hosts/server/AuthoritativeServerCapabilityActivation";
import { createDesktopWindowManager } from "./DesktopWindowManager";
import { registerDesktopAppLifecycle } from "./DesktopAppLifecycle";
import type { DesktopAgentRuntimeProvider } from "./runtime/DesktopAgentRuntimeProvider";
import type { CanonicalRegistryRuntimeProvider } from "./runtime/CanonicalRegistryRuntimeProvider";
import { createPostLoginRuntimeBootstrapper, type AuthShellBootstrapResult } from "./runtime/PostLoginRuntimeBootstrapper";
import { createDesktopRuntimeDisposalCoordinator } from "./runtime/DesktopRuntimeDisposalCoordinator";
import {
  createDesktopOperationalEventLogger,
  type DesktopOperationalEventLogger,
} from "./DesktopOperationalEventLogger";

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
const consoleGreen = "\u001b[32m";
const consoleReset = "\u001b[0m";

function logDevelopmentUserDataPath(userDataPath: string): void {
  if (isPackaged) {
    return;
  }
  const headerRule = "----------------------------------------------------------------";
  const formattedPathBlock = `${consoleGreen}${headerRule}\n\n${userDataPath}\n\n${headerRule}${consoleReset}`;
  console.info(`[ai-loom][startup] Development user data path:\n${formattedPathBlock}`);
}

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
let controlPlaneServerRuntime: AuthoritativeServerHostRuntimeHandle | undefined;
let bootstrapContext: DesktopAuthBootstrapContext | undefined;
let rendererContentSecurityPolicyRuntimeConfig: AppRuntimeConfigValues | undefined;
let desktopHostRuntime: DesktopHostRuntimeHandle | undefined;
let deferredFeatureRuntime: DeferredDesktopFeatureRuntime | undefined;
let agentRuntimeProvider: DesktopAgentRuntimeProvider | undefined;
let canonicalRegistryRuntimeProvider: CanonicalRegistryRuntimeProvider | undefined;
let desktopOperationalEventLogger: DesktopOperationalEventLogger | undefined;
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
  const controlPlaneBaseUrl = values.controlPlaneBaseUrl ?? values.identityApiBaseUrl;
  if (!controlPlaneBaseUrl) {
    throw new Error("Desktop bootstrap runtime config requires a control-plane base URL.");
  }
  const controlPlaneCapabilityPhase = values.controlPlaneCapabilityPhase ?? "pre-login";
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
    controlPlaneBaseUrl,
    controlPlaneCapabilityPhase,
    identityApiBaseUrl: values.identityApiBaseUrl ?? controlPlaneBaseUrl,
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
 * Starts the authoritative desktop control-plane host once and reuses the same runtime for the full desktop session.
 */
async function ensureDesktopControlPlaneHostBound(params: {
  readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
  readonly rendererOrigin: string | undefined;
}): Promise<AuthoritativeServerHostRuntimeHandle> {
  const existingRuntime = controlPlaneServerRuntime;
  if (existingRuntime) {
    console.info(
      `[ai-loom][startup] Reusing authoritative control-plane host at ${existingRuntime.address} for desktop session lifecycle.`,
    );
    postLoginRuntimeStatusStore.markTransportAvailable({
      boundAddress: existingRuntime.address,
      boundPort: existingRuntime.port,
      reason: "authoritative-host-bind-reused",
    });
    return existingRuntime;
  }

  const controlPlaneHostStartAt = logInitializationStart(DesktopStartupPhases.identityAuthHostReadiness);
  logInitializationMemory(DesktopStartupPhases.identityAuthHostReadiness, "start");
  console.info("[ai-loom][startup] Starting authoritative control-plane host with bind-once desktop lifecycle.");
  postLoginRuntimeStatusStore.markTransportBinding({
    reason: "authoritative-host-bind-start",
  });
  const runtime = await startAuthoritativeServerHostAssembly({
    hostOptions: {
      databasePath: path.join(params.storagePaths.storageDirectory, "identity", "identity.sqlite"),
      cors: {
        allowedOrigins: params.rendererOrigin ? [params.rendererOrigin] : [],
        allowLoopbackOrigins: true,
        allowNullOrigin: isPackaged,
      },
      env: process.env,
      logger: desktopOperationalEventLogger,
    },
    boot: {
      startupReason: "electron-main-authoritative-server-host-startup",
      environment: process.env,
    },
  });
  controlPlaneServerRuntime = runtime;
  logInitializationEnd(DesktopStartupPhases.identityAuthHostReadiness, controlPlaneHostStartAt);
  console.info(`[ai-loom][startup] Authoritative control-plane host ready at ${runtime.address} (bind-once).`);
  postLoginRuntimeStatusStore.markTransportAvailable({
    boundAddress: runtime.address,
    boundPort: runtime.port,
    reason: "authoritative-host-bind-ready",
  });
  logInitializationMemory(DesktopStartupPhases.identityAuthHostReadiness, "ready");

  return runtime;
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
    desktopOperationalEventLogger = createDesktopOperationalEventLogger({
      logsDirectory: storagePaths.logsDirectory,
    });
    logDevelopmentUserDataPath(storagePaths.appDataDirectory);
    storageDatabase = new DesktopStorageDatabase({ paths: storagePaths });
    await new InitializeProductionStorageUseCase(storageDatabase).execute({
      scope: ProductionStorageInitializationScopes.authShellPreLogin,
    });
    logInitializationEnd("desktop-startup.pre-login-storage-initialize", storageInitializationStartedAt);
    logInitializationCheckpoint(DesktopStartupPhases.preLoginAuthShellBootstrap, "storage-ready", authShellStartedAt);
    logInitializationMemory(DesktopStartupPhases.preLoginAuthShellBootstrap, "storage-ready");

    const rendererOrigin = normalizeHttpOrigin(rendererDevUrl);
    const controlPlaneRuntime = await ensureDesktopControlPlaneHostBound({
      storagePaths,
      rendererOrigin,
    });
    logInitializationCheckpoint(DesktopStartupPhases.preLoginAuthShellBootstrap, "identity-auth-host-ready", authShellStartedAt);
    logInitializationMemory(DesktopStartupPhases.preLoginAuthShellBootstrap, "identity-auth-host-ready");
    const controlPlaneBaseUrl = assertSecureTransportEndpoint(
      `http://${controlPlaneRuntime.address}`,
      resolveHostSecureTransportConfig({
        hostKind: HostSecureTransportKinds.desktop,
        hostAddress: "127.0.0.1",
      }),
    );
    const controlPlaneCapabilityPhase: DesktopControlPlaneCapabilityPhase = "pre-login";
    const runtimeConfig = isPackaged
      ? AppRuntimeConfig.forDesktopProductionAuthShell({
        storage: storagePaths,
        controlPlaneBaseUrl,
        controlPlaneCapabilityPhase,
      })
      : AppRuntimeConfig.forDesktopDevelopmentAuthShell({
        storage: storagePaths,
        controlPlaneBaseUrl,
        controlPlaneCapabilityPhase,
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
      controlPlaneBaseUrl,
    });
  } finally {
    logInitializationEnd(DesktopStartupPhases.preLoginAuthShellBootstrap, authShellStartedAt);
    logInitializationMemory(DesktopStartupPhases.preLoginAuthShellBootstrap, "complete");
  }
}

const postLoginRuntimeBootstrapper = createPostLoginRuntimeBootstrapper({
  ipcMain,
  isPackaged,
  repoRoot,
  getStorageDatabase: () => storageDatabase,
  setServiceSupervisor: (supervisor) => {
    serviceSupervisor = supervisor;
  },
  setDeferredFeatureRuntime: (runtime) => {
    deferredFeatureRuntime = runtime;
  },
  getDeferredFeatureRuntime: () => deferredFeatureRuntime,
  setAgentRuntimeProvider: (provider) => {
    agentRuntimeProvider = provider;
  },
  setCanonicalRegistryRuntimeProvider: (provider) => {
    canonicalRegistryRuntimeProvider = provider;
  },
  markDeferredFeatureIpcReady: () => {
    deferredFeatureIpcReady = true;
  },
  isDeferredFeatureIpcRegistered: () => deferredFeatureIpcRegistered,
  markDeferredFeatureIpcRegistered: () => {
    deferredFeatureIpcRegistered = true;
  },
  postLoginRuntimeStatusStore,
  buildBootstrapContext,
  launchRuntimeWindowFromContract: (launchContractJson) => windowManager.launchRuntimeWindowFromContract(launchContractJson),
  getOperationalLogger: () => desktopOperationalEventLogger,
});

const runtimeDisposalCoordinator = createDesktopRuntimeDisposalCoordinator({
  getPostLoginBootstrapPromise: () => postLoginBootstrapPromise,
  setPostLoginBootstrapPromise: (promise) => {
    postLoginBootstrapPromise = promise;
  },
  getControlPlaneServerRuntime: () => controlPlaneServerRuntime,
  setControlPlaneServerRuntime: (runtime) => {
    controlPlaneServerRuntime = runtime;
  },
  getServiceSupervisor: () => serviceSupervisor,
  setServiceSupervisor: (supervisor) => {
    serviceSupervisor = supervisor;
  },
  getStorageDatabase: () => storageDatabase,
  getDeferredFeatureRuntime: () => deferredFeatureRuntime,
  setDeferredFeatureRuntime: (runtime) => {
    deferredFeatureRuntime = runtime;
  },
  getAgentRuntimeProvider: () => agentRuntimeProvider,
  setAgentRuntimeProvider: (provider) => {
    agentRuntimeProvider = provider;
  },
  getCanonicalRegistryRuntimeProvider: () => canonicalRegistryRuntimeProvider,
  setCanonicalRegistryRuntimeProvider: (provider) => {
    canonicalRegistryRuntimeProvider = provider;
  },
  clearBootstrapContext: () => {
    bootstrapContext = undefined;
    rendererContentSecurityPolicyRuntimeConfig = undefined;
  },
  resetDeferredFeatureIpcReadiness: () => {
    deferredFeatureIpcReady = false;
  },
  resetWarmupStarted: () => {
    postLoginWarmupStarted = false;
  },
  clearAuthShellBootstrapResult: () => {
    authShellBootstrapResult = undefined;
  },
  clearDeferredRuntimeFactoryCache: () => {
    postLoginRuntimeBootstrapper.clearCachedFactory();
  },
  connectivityRuntimeController,
  postLoginRuntimeStatusStore,
  setIsDisposing: (value) => {
    isDesktopRuntimeDisposing = value;
  },
});

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
  const controlPlaneRuntime = controlPlaneServerRuntime;
  if (!controlPlaneRuntime) {
    throw new Error("Desktop control-plane host is unavailable for post-login warmup.");
  }
  console.info(`[ai-loom] Post-login warmup will activate capabilities on persistent control-plane host (${controlPlaneRuntime.address}).`);
  controlPlaneRuntime.activateCapabilities({
    capabilityIds: [AuthoritativeServerCapabilityIds.deferredRuntimeFeatures],
    reason: "desktop-post-login-warmup",
    activatedAt: request.requestedAt,
  });
  postLoginRuntimeStatusStore.markWarming(request);
  connectivityRuntimeController.startMonitoring(authShell.controlPlaneBaseUrl);
  console.info("[ai-loom] Starting post-login desktop runtime warmup.");
  logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "request-accepted");
  postLoginBootstrapPromise = postLoginRuntimeBootstrapper.bootstrap(authShell);
  try {
    await postLoginBootstrapPromise;
    console.info("[ai-loom] Post-login desktop runtime warmup completed.");
  } catch (error) {
    postLoginBootstrapPromise = undefined;
    postLoginRuntimeStatusStore.markFailed(request, error);
    if (!isDesktopRuntimeDisposing) {
      console.error("Post-login desktop runtime bootstrap failed", error);
      await runtimeDisposalCoordinator.disposeDesktopRuntimeResources();
      app.exit(1);
    }
    postLoginWarmupStarted = false;
    throw error;
  }
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
              close: runtimeDisposalCoordinator.disposeDesktopRuntimeResources,
            });
          } catch (error) {
            await runtimeDisposalCoordinator.disposeDesktopRuntimeResources();
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

import process from "node:process";
import { InitializeProductionStorageUseCase } from "../../../src/application/runtime/InitializeProductionStorageUseCase";
import { ProductionStorageInitializationScopes } from "../../../src/application/runtime/interfaces/IProductionStorageInitializer";
import { resolveDesktopStoragePaths } from "../../../src/infrastructure/desktop/DesktopAppPaths";
import { resolveDesktopPythonRuntime } from "../../../src/infrastructure/desktop/DesktopPythonRuntimeResolver";
import { AppRuntimeConfig, type AppRuntimeConfigValues } from "../../../src/infrastructure/config/AppRuntimeConfig";
import type { LaunchSystemRuntimeWindowReadModel } from "../../../src/application/system-runtime/SystemRuntimeWindowLaunchContract";
import { DesktopServiceSupervisor } from "../DesktopServiceSupervisor";
import { DesktopStartupPhases } from "../DesktopStartupContract";
import { registerDeferredFeatureIpcDomains } from "../ipc/registerDeferredFeatureIpcDomains";
import type { OnDemandFeatureCompositionPaths } from "../ipc/IpcRegistrationTypes";
import type { DeferredDesktopFeatureRuntime } from "../DeferredDesktopFeatureRuntime";
import { logInitializationCheckpoint, logInitializationEnd, logInitializationMemory, logInitializationStart } from "../InitializationLogging";
import { createDesktopAgentRuntimeProvider, type DesktopAgentRuntimeProvider } from "./DesktopAgentRuntimeProvider";
import { createCanonicalRegistryRuntimeProvider, type CanonicalRegistryRuntimeProvider } from "./CanonicalRegistryRuntimeProvider";
import type { DesktopStorageDatabase } from "../../../src/infrastructure/desktop/DesktopStorageDatabase";
import type { DesktopPostLoginRuntimeStatusStore } from "../DesktopPostLoginRuntimeStatusStore";
import type { DesktopOperationalEventLogger } from "../DesktopOperationalEventLogger";

const DesktopServiceSupervisorPort = 8790;

export type AuthShellBootstrapResult = {
  readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
  readonly controlPlaneBaseUrl: string;
};

export type PostLoginRuntimeBootstrapper = {
  readonly bootstrap: (authShell: AuthShellBootstrapResult) => Promise<void>;
  readonly clearCachedFactory: () => void;
};

type CreatePostLoginRuntimeBootstrapperParams = {
  readonly ipcMain: Electron.IpcMain;
  readonly isPackaged: boolean;
  readonly repoRoot: string;
  readonly getStorageDatabase: () => DesktopStorageDatabase | undefined;
  readonly setServiceSupervisor: (supervisor: DesktopServiceSupervisor | undefined) => void;
  readonly setDeferredFeatureRuntime: (runtime: DeferredDesktopFeatureRuntime | undefined) => void;
  readonly getDeferredFeatureRuntime: () => DeferredDesktopFeatureRuntime | undefined;
  readonly setAgentRuntimeProvider: (provider: DesktopAgentRuntimeProvider | undefined) => void;
  readonly setCanonicalRegistryRuntimeProvider: (provider: CanonicalRegistryRuntimeProvider | undefined) => void;
  readonly markDeferredFeatureIpcReady: () => void;
  readonly isDeferredFeatureIpcRegistered: () => boolean;
  readonly markDeferredFeatureIpcRegistered: () => void;
  readonly postLoginRuntimeStatusStore: DesktopPostLoginRuntimeStatusStore;
  readonly buildBootstrapContext: (params: {
    readonly runtimeConfig: AppRuntimeConfig;
    readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
  }) => void;
  readonly launchRuntimeWindowFromContract: (launchContractJson: string) => Promise<LaunchSystemRuntimeWindowReadModel>;
  readonly getOperationalLogger: () => DesktopOperationalEventLogger | undefined;
};

type PostLoginRuntimeComposition = {
  readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
  readonly runtimeConfig: AppRuntimeConfig;
  readonly pythonRuntime: ReturnType<typeof resolveDesktopPythonRuntime>;
  readonly featureRuntime: DeferredDesktopFeatureRuntime;
};

/**
 * Exposes lazy feature-resolver functions used by deferred IPC domains to load expensive services on demand.
 */
export function createOnDemandFeatureCompositionPaths(params: {
  readonly featureRuntime: DeferredDesktopFeatureRuntime;
  readonly agentRuntimeProvider: DesktopAgentRuntimeProvider;
  readonly canonicalRegistryRuntimeProvider: CanonicalRegistryRuntimeProvider;
}): OnDemandFeatureCompositionPaths {
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

export function createPostLoginRuntimeBootstrapper(params: CreatePostLoginRuntimeBootstrapperParams): PostLoginRuntimeBootstrapper {
  let deferredDesktopFeatureRuntimeFactory: ((options: {
    readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
    readonly runtimeConfigValues: AppRuntimeConfigValues;
    readonly repoRoot: string;
    readonly observabilityLogger?: DesktopOperationalEventLogger;
  }) => DeferredDesktopFeatureRuntime) | undefined;

  async function ensureDeferredDesktopFeatureRuntimeFactory(): Promise<(
    options: {
      readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
      readonly runtimeConfigValues: AppRuntimeConfigValues;
      readonly repoRoot: string;
      readonly observabilityLogger?: DesktopOperationalEventLogger;
    },
  ) => DeferredDesktopFeatureRuntime> {
    if (deferredDesktopFeatureRuntimeFactory) {
      return deferredDesktopFeatureRuntimeFactory;
    }
    const runtimeModule = await import("../DeferredDesktopFeatureRuntime");
    deferredDesktopFeatureRuntimeFactory = runtimeModule.createDeferredDesktopFeatureRuntime;
    return deferredDesktopFeatureRuntimeFactory;
  }

  function registerDeferredFeatureIpc(register: () => void): void {
    if (params.isDeferredFeatureIpcRegistered()) {
      return;
    }
    const deferredFeatureRegistrationStartedAt = logInitializationStart(DesktopStartupPhases.deferredFeatureRegistration);
    try {
      params.markDeferredFeatureIpcRegistered();
      register();
      params.markDeferredFeatureIpcReady();
      params.postLoginRuntimeStatusStore.markReady();
      logInitializationMemory(DesktopStartupPhases.deferredFeatureRegistration, "ready");
    } finally {
      logInitializationEnd(DesktopStartupPhases.deferredFeatureRegistration, deferredFeatureRegistrationStartedAt);
    }
  }

  async function composePostLoginRuntime(authShell: AuthShellBootstrapResult, bootstrapStartedAt: number): Promise<PostLoginRuntimeComposition> {
    const { storagePaths, controlPlaneBaseUrl } = authShell;
    const storageDatabase = params.getStorageDatabase();
    if (!storageDatabase) {
      throw new Error("Desktop storage database is unavailable for post-login runtime bootstrap.");
    }

    const pythonRuntimeResolutionStartedAt = logInitializationStart("desktop-startup.post-login-python-runtime-resolve");
    console.info("[ai-loom][startup] Resolving desktop Python runtime for post-login warmup.");
    const pythonRuntime = resolveDesktopPythonRuntime({
      isPackaged: params.isPackaged,
      repoRoot: params.repoRoot,
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

    const serviceSupervisor = new DesktopServiceSupervisor({
      repoRoot: params.repoRoot,
      isPackaged: params.isPackaged,
      resourcesPath: process.resourcesPath,
      storagePaths,
      pythonRuntime,
      pythonRuntimeBaseUrl: process.env.PYTHON_RUNTIME_BASE_URL || "http://127.0.0.1:8100",
    });
    params.setServiceSupervisor(serviceSupervisor);
    const supervisorStartAt = logInitializationStart("desktop-startup.post-login-service-supervisor-start");
    console.info("[ai-loom][startup] Starting desktop local service supervisor for post-login runtime.");
    await serviceSupervisor.start();
    logInitializationEnd("desktop-startup.post-login-service-supervisor-start", supervisorStartAt);
    console.info(
      `[ai-loom][startup] Desktop local service supervisor ready (baseUrl=${serviceSupervisor.baseUrl}, runtimeBaseUrl=${serviceSupervisor.runtimeBaseUrl}).`,
    );
    logInitializationCheckpoint(DesktopStartupPhases.postLoginWarmup, "local-service-supervisor-ready", bootstrapStartedAt);
    logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "local-service-supervisor-ready");

    const baseRuntimeConfig = params.isPackaged
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
      controlPlaneBaseUrl,
      controlPlaneCapabilityPhase: params.postLoginRuntimeStatusStore.getStatus().capabilityPhase,
      identityApiBaseUrl: controlPlaneBaseUrl,
    });
    params.buildBootstrapContext({
      runtimeConfig,
      storagePaths,
    });

    const createDeferredDesktopFeatureRuntime = await ensureDeferredDesktopFeatureRuntimeFactory();
    const featureRuntime = createDeferredDesktopFeatureRuntime({
      storagePaths,
      runtimeConfigValues: runtimeConfig.toValues(),
      repoRoot: params.repoRoot,
      observabilityLogger: params.getOperationalLogger(),
    });
    params.setDeferredFeatureRuntime(featureRuntime);
    logInitializationCheckpoint(DesktopStartupPhases.postLoginWarmup, "deferred-feature-runtime-container-ready", bootstrapStartedAt);
    logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "deferred-feature-runtime-container-ready");

    return Object.freeze({
      storagePaths,
      runtimeConfig,
      pythonRuntime,
      featureRuntime,
    });
  }

  async function bootstrapPostLoginRuntime(authShell: AuthShellBootstrapResult): Promise<void> {
    const bootstrapStartedAt = logInitializationStart(DesktopStartupPhases.postLoginWarmup);
    try {
      logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "start");
      const runtimeComposition = await composePostLoginRuntime(authShell, bootstrapStartedAt);
      const { storagePaths, runtimeConfig, pythonRuntime, featureRuntime } = runtimeComposition;
      const agentRuntimeProvider = createDesktopAgentRuntimeProvider({
        storagePaths,
        onRuntimeReady: () => logInitializationMemory(DesktopStartupPhases.deferredFeatureRuntime, "agent-runtime-ready"),
      });
      params.setAgentRuntimeProvider(agentRuntimeProvider);
      const canonicalRegistryRuntimeProvider = createCanonicalRegistryRuntimeProvider({
        storagePaths,
        getDeferredFeatureRuntime: () => params.getDeferredFeatureRuntime(),
        onRuntimeReady: () => logInitializationMemory(DesktopStartupPhases.deferredFeatureRuntime, "canonical-registry-runtime-ready"),
      });
      params.setCanonicalRegistryRuntimeProvider(canonicalRegistryRuntimeProvider);
      registerDeferredFeatureIpc(() => {
        const onDemand = createOnDemandFeatureCompositionPaths({
          featureRuntime,
          agentRuntimeProvider,
          canonicalRegistryRuntimeProvider,
        });
        registerDeferredFeatureIpcDomains({
          ipcMain: params.ipcMain,
          onDemand,
          storagePaths,
          launchRuntimeWindowFromContract: params.launchRuntimeWindowFromContract,
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

  return Object.freeze({
    bootstrap: bootstrapPostLoginRuntime,
    clearCachedFactory: () => {
      deferredDesktopFeatureRuntimeFactory = undefined;
    },
  });
}

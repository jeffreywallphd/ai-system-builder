import process from "node:process";
import { InitializeProductionStorageUseCase } from "../../../src/application/runtime/InitializeProductionStorageUseCase";
import { ProductionStorageInitializationScopes } from "../../../src/application/runtime/interfaces/IProductionStorageInitializer";
import { resolveDesktopStoragePaths } from "../../../src/infrastructure/desktop/DesktopAppPaths";
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
import type { DesktopPythonRuntimeInfo } from "../../shared/DesktopContracts";
import { resolvePythonRuntimeActivationStage } from "./PythonRuntimeResolutionActivationStage";
import { startServiceSupervisorActivationStage } from "./ServiceSupervisorActivationStage";

const DesktopServiceSupervisorPort = 8790;

export type AuthShellBootstrapResult = {
  readonly storagePaths: ReturnType<typeof resolveDesktopStoragePaths>;
  readonly controlPlaneBaseUrl: string;
};

export type PostLoginRuntimeDependencyActivator = {
  readonly activateDependencies: (authShell: AuthShellBootstrapResult) => Promise<void>;
  readonly clearCachedFactory: () => void;
};

type CreatePostLoginRuntimeDependencyActivatorParams = {
  readonly ipcMain: Electron.IpcMain;
  readonly isPackaged: boolean;
  readonly repoRoot: string;
  readonly getStorageDatabase: () => DesktopStorageDatabase | undefined;
  readonly setServiceSupervisor: (supervisor: DesktopServiceSupervisor | undefined) => void;
  readonly setDeferredFeatureRuntime: (runtime: DeferredDesktopFeatureRuntime | undefined) => void;
  readonly getDeferredFeatureRuntime: () => DeferredDesktopFeatureRuntime | undefined;
  readonly setAgentRuntimeProvider: (provider: DesktopAgentRuntimeProvider | undefined) => void;
  readonly setCanonicalRegistryRuntimeProvider: (provider: CanonicalRegistryRuntimeProvider | undefined) => void;
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
  readonly pythonRuntime: DesktopPythonRuntimeInfo;
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

export function createPostLoginRuntimeDependencyActivator(
  params: CreatePostLoginRuntimeDependencyActivatorParams,
): PostLoginRuntimeDependencyActivator {
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
    const deferredFeatureRegistrationStartedAt = logInitializationStart(DesktopStartupPhases.deferredFeatureRegistration);
    params.postLoginRuntimeStatusStore.markDeferredFeatureIpcRegistrationRunning();
    try {
      if (!params.isDeferredFeatureIpcRegistered()) {
        register();
        params.markDeferredFeatureIpcRegistered();
      }
      params.postLoginRuntimeStatusStore.markDeferredFeatureIpcRegistrationReady({
        detail: "Deferred feature IPC domains are registered and renderer bridges can bind.",
      });
      params.postLoginRuntimeStatusStore.markReady();
      logInitializationMemory(DesktopStartupPhases.deferredFeatureRegistration, "ready");
    } catch (error) {
      params.postLoginRuntimeStatusStore.markDeferredFeatureIpcRegistrationBlocked(error);
      throw error;
    } finally {
      logInitializationEnd(DesktopStartupPhases.deferredFeatureRegistration, deferredFeatureRegistrationStartedAt);
    }
  }

  async function composePostLoginRuntimeDependencies(
    authShell: AuthShellBootstrapResult,
    bootstrapStartedAt: number,
  ): Promise<PostLoginRuntimeComposition> {
    const { storagePaths, controlPlaneBaseUrl } = authShell;
    const storageDatabase = params.getStorageDatabase();
    if (!storageDatabase) {
      throw new Error("Desktop storage database is unavailable for post-login runtime activation.");
    }

    const pythonRuntime = resolvePythonRuntimeActivationStage({
      isPackaged: params.isPackaged,
      repoRoot: params.repoRoot,
      storagePaths,
      postLoginRuntimeStatusStore: params.postLoginRuntimeStatusStore,
      bootstrapStartedAt,
    });

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
    await startServiceSupervisorActivationStage({
      serviceSupervisor,
      postLoginRuntimeStatusStore: params.postLoginRuntimeStatusStore,
      bootstrapStartedAt,
    });

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

    params.postLoginRuntimeStatusStore.markDeferredFeatureRuntimeCompositionRunning();
    const featureRuntime = await Promise.resolve().then(async () => {
      const createDeferredDesktopFeatureRuntime = await ensureDeferredDesktopFeatureRuntimeFactory();
      return createDeferredDesktopFeatureRuntime({
        storagePaths,
        runtimeConfigValues: runtimeConfig.toValues(),
        repoRoot: params.repoRoot,
        observabilityLogger: params.getOperationalLogger(),
      });
    }).catch((error) => {
      params.postLoginRuntimeStatusStore.markDeferredFeatureRuntimeCompositionBlocked(error);
      throw error;
    });
    params.setDeferredFeatureRuntime(featureRuntime);
    params.postLoginRuntimeStatusStore.markDeferredFeatureRuntimeCompositionReady({
      detail: "Deferred feature runtime container is composed and ready for provider wiring.",
    });
    logInitializationCheckpoint(DesktopStartupPhases.postLoginWarmup, "deferred-feature-runtime-container-ready", bootstrapStartedAt);
    logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "deferred-feature-runtime-container-ready");

    return Object.freeze({
      storagePaths,
      runtimeConfig,
      pythonRuntime,
      featureRuntime,
    });
  }

  async function activatePostLoginRuntimeDependencies(authShell: AuthShellBootstrapResult): Promise<void> {
    const bootstrapStartedAt = logInitializationStart(DesktopStartupPhases.postLoginWarmup);
    try {
      logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "start");
      const runtimeComposition = await composePostLoginRuntimeDependencies(authShell, bootstrapStartedAt);
      const { storagePaths, runtimeConfig, pythonRuntime, featureRuntime } = runtimeComposition;
      params.postLoginRuntimeStatusStore.markDeferredFeatureProviderSetupRunning();
      const providers = await Promise.resolve().then(() => {
        const agentRuntimeProvider = createDesktopAgentRuntimeProvider({
          storagePaths,
          onRuntimeReady: () => logInitializationMemory(DesktopStartupPhases.deferredFeatureRuntime, "agent-runtime-ready"),
        });
        const canonicalRegistryRuntimeProvider = createCanonicalRegistryRuntimeProvider({
          storagePaths,
          getDeferredFeatureRuntime: () => params.getDeferredFeatureRuntime(),
          onRuntimeReady: () => logInitializationMemory(DesktopStartupPhases.deferredFeatureRuntime, "canonical-registry-runtime-ready"),
        });
        return Object.freeze({
          agentRuntimeProvider,
          canonicalRegistryRuntimeProvider,
        });
      }).catch((error) => {
        params.postLoginRuntimeStatusStore.markDeferredFeatureProviderSetupBlocked(error);
        throw error;
      });
      const { agentRuntimeProvider, canonicalRegistryRuntimeProvider } = providers;
      params.setAgentRuntimeProvider(agentRuntimeProvider);
      params.setCanonicalRegistryRuntimeProvider(canonicalRegistryRuntimeProvider);
      params.postLoginRuntimeStatusStore.markDeferredFeatureProviderSetupReady({
        detail: "Deferred feature runtime providers are configured for studio, registry, and agent domains.",
      });
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
    activateDependencies: activatePostLoginRuntimeDependencies,
    clearCachedFactory: () => {
      deferredDesktopFeatureRuntimeFactory = undefined;
    },
  });
}

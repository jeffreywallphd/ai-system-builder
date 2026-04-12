import {
  isProductionRuntimeMode,
  type AppRuntimeMode,
} from "@domain/runtime/AppRuntimeMode";
import {
  getAppRuntimeProfile,
  type AppDistributionTarget,
  type AppHostKind,
  type AppLifecycleStage,
  type RendererDeliveryMode,
} from "@domain/runtime/AppRuntimeProfile";
import type {
  DesktopAuthBootstrapRuntimeConfig,
  DesktopPythonRuntimeInfo,
  DesktopStoragePaths,
} from "../../../electron/shared/DesktopContracts";

export type WorkflowRepositoryMode = "browser-storage" | "filesystem-indexed" | "memory";
export type WorkflowExecutorMode = "scaffold" | "strategy";
export type NodeCatalogMode = "mock" | "registered" | "seeded";
export type UiSettingsPersistenceMode = "local-storage" | "desktop-sqlite";
export type InstalledModelCatalogMode = "browser-local-storage" | "desktop-sqlite";

export interface AppRuntimeConfigValues {
  readonly runtimeMode: AppRuntimeMode;
  readonly hostKind: AppHostKind;
  readonly lifecycleStage: AppLifecycleStage;
  readonly distributionTarget: AppDistributionTarget;
  readonly rendererDeliveryMode: RendererDeliveryMode;
  readonly workflowRepositoryMode: WorkflowRepositoryMode;
  readonly workflowExecutorMode: WorkflowExecutorMode;
  readonly nodeCatalogMode: NodeCatalogMode;
  readonly uiSettingsPersistenceMode: UiSettingsPersistenceMode;
  readonly installedModelCatalogMode: InstalledModelCatalogMode;
  readonly seedStarterNode: boolean;
  readonly isProductionMode: boolean;
  readonly devSyncBaseUrl?: string;
  readonly devSyncToken?: string;
  readonly identityApiBaseUrl?: string;
  readonly modelInstallDirectory: string;
  readonly serviceSupervisorBaseUrl?: string;
  readonly serviceSupervisorPort?: number;
  readonly pythonRuntimeBaseUrl?: string;
  readonly workflowStorageDirectory?: string;
  readonly workflowIndexDatabasePath?: string;
  readonly desktopStorage?: DesktopStoragePaths;
  readonly desktopPythonRuntime?: DesktopPythonRuntimeInfo;
}

interface DesktopConfigOptions {
  readonly storage: DesktopStoragePaths;
  readonly pythonRuntime: DesktopPythonRuntimeInfo;
  readonly serviceSupervisorBaseUrl: string;
  readonly serviceSupervisorPort: number;
  readonly pythonRuntimeBaseUrl?: string;
}

interface DesktopAuthShellConfigOptions {
  readonly storage: DesktopStoragePaths;
  readonly identityApiBaseUrl?: string;
}

export class AppRuntimeConfig {
  public readonly runtimeMode: AppRuntimeMode;
  public readonly hostKind: AppHostKind;
  public readonly lifecycleStage: AppLifecycleStage;
  public readonly distributionTarget: AppDistributionTarget;
  public readonly rendererDeliveryMode: RendererDeliveryMode;
  public readonly workflowRepositoryMode: WorkflowRepositoryMode;
  public readonly workflowExecutorMode: WorkflowExecutorMode;
  public readonly nodeCatalogMode: NodeCatalogMode;
  public readonly uiSettingsPersistenceMode: UiSettingsPersistenceMode;
  public readonly installedModelCatalogMode: InstalledModelCatalogMode;
  public readonly seedStarterNode: boolean;
  public readonly isProductionMode: boolean;
  public readonly devSyncBaseUrl?: string;
  public readonly devSyncToken?: string;
  public readonly identityApiBaseUrl?: string;
  public readonly modelInstallDirectory: string;
  public readonly serviceSupervisorBaseUrl?: string;
  public readonly serviceSupervisorPort?: number;
  public readonly pythonRuntimeBaseUrl?: string;
  public readonly workflowStorageDirectory?: string;
  public readonly workflowIndexDatabasePath?: string;
  public readonly desktopStorage?: DesktopStoragePaths;
  public readonly desktopPythonRuntime?: DesktopPythonRuntimeInfo;

  constructor(values: AppRuntimeConfigValues) {
    this.runtimeMode = values.runtimeMode;
    this.hostKind = values.hostKind;
    this.lifecycleStage = values.lifecycleStage;
    this.distributionTarget = values.distributionTarget;
    this.rendererDeliveryMode = values.rendererDeliveryMode;
    this.workflowRepositoryMode = values.workflowRepositoryMode;
    this.workflowExecutorMode = values.workflowExecutorMode;
    this.nodeCatalogMode = values.nodeCatalogMode;
    this.uiSettingsPersistenceMode = values.uiSettingsPersistenceMode;
    this.installedModelCatalogMode = values.installedModelCatalogMode;
    this.seedStarterNode = values.seedStarterNode;
    this.isProductionMode = values.isProductionMode;
    this.devSyncBaseUrl = values.devSyncBaseUrl?.trim() || undefined;
    this.devSyncToken = values.devSyncToken?.trim() || undefined;
    this.identityApiBaseUrl = values.identityApiBaseUrl?.trim() || undefined;
    this.modelInstallDirectory = values.modelInstallDirectory.trim();
    this.serviceSupervisorBaseUrl = values.serviceSupervisorBaseUrl?.trim() || undefined;
    this.serviceSupervisorPort = values.serviceSupervisorPort;
    this.pythonRuntimeBaseUrl = values.pythonRuntimeBaseUrl?.trim() || undefined;
    this.workflowStorageDirectory = values.workflowStorageDirectory?.trim() || undefined;
    this.workflowIndexDatabasePath = values.workflowIndexDatabasePath?.trim() || undefined;
    this.desktopStorage = values.desktopStorage;
    this.desktopPythonRuntime = values.desktopPythonRuntime;
  }

  public get isDesktopHost(): boolean {
    return this.hostKind === "desktop";
  }

  public get isPackagedDesktopHost(): boolean {
    return this.hostKind === "desktop" && this.rendererDeliveryMode === "packaged-assets";
  }

  public get isDevSyncEnabled(): boolean {
    return this.lifecycleStage === "development" && this.hostKind === "browser" && !!this.devSyncBaseUrl;
  }

  public toValues(): AppRuntimeConfigValues {
    return Object.freeze({
      runtimeMode: this.runtimeMode,
      hostKind: this.hostKind,
      lifecycleStage: this.lifecycleStage,
      distributionTarget: this.distributionTarget,
      rendererDeliveryMode: this.rendererDeliveryMode,
      workflowRepositoryMode: this.workflowRepositoryMode,
      workflowExecutorMode: this.workflowExecutorMode,
      nodeCatalogMode: this.nodeCatalogMode,
      uiSettingsPersistenceMode: this.uiSettingsPersistenceMode,
      installedModelCatalogMode: this.installedModelCatalogMode,
      seedStarterNode: this.seedStarterNode,
      isProductionMode: this.isProductionMode,
      devSyncBaseUrl: this.devSyncBaseUrl,
      devSyncToken: this.devSyncToken,
      identityApiBaseUrl: this.identityApiBaseUrl,
      modelInstallDirectory: this.modelInstallDirectory,
      serviceSupervisorBaseUrl: this.serviceSupervisorBaseUrl,
      serviceSupervisorPort: this.serviceSupervisorPort,
      pythonRuntimeBaseUrl: this.pythonRuntimeBaseUrl,
      workflowStorageDirectory: this.workflowStorageDirectory,
      workflowIndexDatabasePath: this.workflowIndexDatabasePath,
      desktopStorage: this.desktopStorage,
      desktopPythonRuntime: this.desktopPythonRuntime,
    });
  }

  private static readEnvVariable(key: string): string | undefined {
    const browserDevBootstrap = (
      globalThis as typeof globalThis & {
        window?: {
          aiLoomBrowserDevelopment?: {
            env?: Record<string, string | undefined>;
          };
        };
      }
    ).window?.aiLoomBrowserDevelopment?.env;
    const browserDevValue = browserDevBootstrap?.[key];
    if (browserDevValue) {
      return browserDevValue;
    }

    const processLike = typeof globalThis !== "undefined"
      ? (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process
      : undefined;

    if (processLike?.env?.[key]) {
      return processLike.env[key];
    }

    return import.meta.env?.[key];
  }

  private static createValues(
    runtimeMode: AppRuntimeMode,
    values: Omit<AppRuntimeConfigValues, "runtimeMode" | "hostKind" | "lifecycleStage" | "distributionTarget" | "rendererDeliveryMode" | "isProductionMode"> & {
      readonly isProductionMode?: boolean;
    },
  ): AppRuntimeConfigValues {
    const profile = getAppRuntimeProfile(runtimeMode);

    return {
      runtimeMode,
      hostKind: profile.hostKind,
      lifecycleStage: profile.lifecycleStage,
      distributionTarget: profile.distributionTarget,
      rendererDeliveryMode: profile.rendererDeliveryMode,
      workflowRepositoryMode: values.workflowRepositoryMode,
      workflowExecutorMode: values.workflowExecutorMode,
      nodeCatalogMode: values.nodeCatalogMode,
      uiSettingsPersistenceMode: values.uiSettingsPersistenceMode,
      installedModelCatalogMode: values.installedModelCatalogMode,
      seedStarterNode: values.seedStarterNode,
      isProductionMode: values.isProductionMode ?? profile.lifecycleStage === "production",
      devSyncBaseUrl: values.devSyncBaseUrl,
      devSyncToken: values.devSyncToken,
      identityApiBaseUrl: values.identityApiBaseUrl,
      modelInstallDirectory: values.modelInstallDirectory,
      serviceSupervisorBaseUrl: values.serviceSupervisorBaseUrl,
      serviceSupervisorPort: values.serviceSupervisorPort,
      pythonRuntimeBaseUrl: values.pythonRuntimeBaseUrl,
      workflowStorageDirectory: values.workflowStorageDirectory,
      workflowIndexDatabasePath: values.workflowIndexDatabasePath,
      desktopStorage: values.desktopStorage,
      desktopPythonRuntime: values.desktopPythonRuntime,
    };
  }

  public static forDevelopment(): AppRuntimeConfig {
    const runtimeMode = "browser-development" as const;
    const profile = getAppRuntimeProfile(runtimeMode);
    const devSyncBaseUrl =
      AppRuntimeConfig.readEnvVariable("VITE_DEV_SYNC_BASE_URL") ||
      "http://192.168.1.100:8787";
    const devSyncToken =
      AppRuntimeConfig.readEnvVariable("VITE_DEV_SYNC_TOKEN") || "ai-loom-dev-sync";
    const modelInstallDirectory =
      AppRuntimeConfig.readEnvVariable("VITE_MODEL_INSTALL_DIRECTORY") ||
      "dev/models";
    const identityApiBaseUrl = AppRuntimeConfig.readEnvVariable("VITE_IDENTITY_API_BASE_URL")
      || `http://${AppRuntimeConfig.readEnvVariable("AI_LOOM_BROWSER_IDENTITY_HOST") || "127.0.0.1"}:${AppRuntimeConfig.readEnvVariable("AI_LOOM_BROWSER_IDENTITY_PORT") || "8788"}`;

    return new AppRuntimeConfig(AppRuntimeConfig.createValues(runtimeMode, {
      workflowRepositoryMode: profile.supportsLocalWorkspaceFilesystem ? "filesystem-indexed" : "browser-storage",
      workflowExecutorMode: "strategy",
      nodeCatalogMode: "registered",
      uiSettingsPersistenceMode: "local-storage",
      installedModelCatalogMode: "browser-local-storage",
      seedStarterNode: true,
      devSyncBaseUrl,
      devSyncToken,
      identityApiBaseUrl,
      modelInstallDirectory,
      workflowStorageDirectory: "dev/workflow-data/workflows",
      workflowIndexDatabasePath: profile.supportsLocalWorkspaceFilesystem
        ? "dev/workflow-data/workflows/workflow-index.sqlite"
        : undefined,
    }));
  }

  public static forDesktopDevelopment(options: DesktopConfigOptions): AppRuntimeConfig {
    return new AppRuntimeConfig(AppRuntimeConfig.createValues("desktop-development", {
      workflowRepositoryMode: "filesystem-indexed",
      workflowExecutorMode: "strategy",
      nodeCatalogMode: "registered",
      uiSettingsPersistenceMode: "local-storage",
      installedModelCatalogMode: "browser-local-storage",
      seedStarterNode: true,
      identityApiBaseUrl: undefined,
      modelInstallDirectory: options.storage.modelsDirectory,
      serviceSupervisorBaseUrl: options.serviceSupervisorBaseUrl,
      serviceSupervisorPort: options.serviceSupervisorPort,
      pythonRuntimeBaseUrl: options.pythonRuntimeBaseUrl,
      workflowStorageDirectory: "dev/workflow-data/workflows",
      workflowIndexDatabasePath: "dev/workflow-data/workflows/workflow-index.sqlite",
      desktopStorage: options.storage,
      desktopPythonRuntime: options.pythonRuntime,
    }));
  }

  public static forDesktopDevelopmentAuthShell(options: DesktopAuthShellConfigOptions): AppRuntimeConfig {
    return new AppRuntimeConfig(AppRuntimeConfig.createValues("desktop-development", {
      workflowRepositoryMode: "filesystem-indexed",
      workflowExecutorMode: "strategy",
      nodeCatalogMode: "registered",
      uiSettingsPersistenceMode: "local-storage",
      installedModelCatalogMode: "browser-local-storage",
      seedStarterNode: true,
      identityApiBaseUrl: options.identityApiBaseUrl,
      modelInstallDirectory: options.storage.modelsDirectory,
      desktopStorage: options.storage,
    }));
  }

  public static forDesktopProduction(options: DesktopConfigOptions): AppRuntimeConfig {
    return new AppRuntimeConfig(AppRuntimeConfig.createValues("desktop-production", {
      workflowRepositoryMode: "filesystem-indexed",
      workflowExecutorMode: "strategy",
      nodeCatalogMode: "registered",
      uiSettingsPersistenceMode: "desktop-sqlite",
      installedModelCatalogMode: "desktop-sqlite",
      seedStarterNode: false,
      identityApiBaseUrl: undefined,
      modelInstallDirectory: options.storage.modelsDirectory,
      serviceSupervisorBaseUrl: options.serviceSupervisorBaseUrl,
      serviceSupervisorPort: options.serviceSupervisorPort,
      pythonRuntimeBaseUrl: options.pythonRuntimeBaseUrl,
      workflowStorageDirectory: `${options.storage.appDataDirectory}/workflow-data/workflows`,
      workflowIndexDatabasePath: `${options.storage.storageDirectory}/workflow-index.sqlite`,
      desktopStorage: options.storage,
      desktopPythonRuntime: options.pythonRuntime,
    }));
  }

  public static forDesktopProductionAuthShell(options: DesktopAuthShellConfigOptions): AppRuntimeConfig {
    return new AppRuntimeConfig(AppRuntimeConfig.createValues("desktop-production", {
      workflowRepositoryMode: "filesystem-indexed",
      workflowExecutorMode: "strategy",
      nodeCatalogMode: "registered",
      uiSettingsPersistenceMode: "desktop-sqlite",
      installedModelCatalogMode: "desktop-sqlite",
      seedStarterNode: false,
      identityApiBaseUrl: options.identityApiBaseUrl,
      modelInstallDirectory: options.storage.modelsDirectory,
      desktopStorage: options.storage,
    }));
  }

  public static fromValues(values: AppRuntimeConfigValues): AppRuntimeConfig {
    return new AppRuntimeConfig(values);
  }

  public static resolveDefault(): AppRuntimeConfig {
    const desktopBridge = (globalThis as typeof globalThis & {
      aiLoomDesktop?: {
        auth?: {
          bootstrap?: {
            runtimeConfig: AppRuntimeConfigValues | DesktopAuthBootstrapRuntimeConfig;
          };
        };
        bootstrap?: {
          runtimeConfig: AppRuntimeConfigValues | DesktopAuthBootstrapRuntimeConfig;
        };
      };
    }).aiLoomDesktop;
    const desktopBootstrap = desktopBridge?.auth?.bootstrap ?? desktopBridge?.bootstrap;

    if (desktopBootstrap?.runtimeConfig) {
      return new AppRuntimeConfig(expandDesktopBootstrapRuntimeConfig(desktopBootstrap.runtimeConfig));
    }

    return AppRuntimeConfig.forDevelopment();
  }
}

function expandDesktopBootstrapRuntimeConfig(
  values: AppRuntimeConfigValues | DesktopAuthBootstrapRuntimeConfig,
): AppRuntimeConfigValues {
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
    serviceSupervisorBaseUrl: "serviceSupervisorBaseUrl" in values ? values.serviceSupervisorBaseUrl : undefined,
    serviceSupervisorPort: "serviceSupervisorPort" in values ? values.serviceSupervisorPort : undefined,
    pythonRuntimeBaseUrl: "pythonRuntimeBaseUrl" in values ? values.pythonRuntimeBaseUrl : undefined,
    workflowStorageDirectory: "workflowStorageDirectory" in values ? values.workflowStorageDirectory : undefined,
    workflowIndexDatabasePath: "workflowIndexDatabasePath" in values ? values.workflowIndexDatabasePath : undefined,
    desktopStorage: "desktopStorage" in values ? values.desktopStorage : undefined,
    desktopPythonRuntime: "desktopPythonRuntime" in values ? values.desktopPythonRuntime : undefined,
  });
}

export function isDesktopProductionConfig(config: AppRuntimeConfig): boolean {
  return isProductionRuntimeMode(config.runtimeMode);
}

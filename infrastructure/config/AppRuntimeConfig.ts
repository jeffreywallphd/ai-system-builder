export type WorkflowRepositoryMode = "memory";
export type WorkflowExecutorMode = "preview";
export type NodeCatalogMode = "mock";

export interface AppRuntimeConfigValues {
  readonly workflowRepositoryMode: WorkflowRepositoryMode;
  readonly workflowExecutorMode: WorkflowExecutorMode;
  readonly nodeCatalogMode: NodeCatalogMode;
  readonly seedStarterNode: boolean;
  readonly isProductionMode: boolean;
  readonly devSyncBaseUrl?: string;
  readonly devSyncToken?: string;
  readonly modelInstallDirectory: string;
}

export class AppRuntimeConfig {
  public readonly workflowRepositoryMode: WorkflowRepositoryMode;
  public readonly workflowExecutorMode: WorkflowExecutorMode;
  public readonly nodeCatalogMode: NodeCatalogMode;
  public readonly seedStarterNode: boolean;
  public readonly isProductionMode: boolean;
  public readonly devSyncBaseUrl?: string;
  public readonly devSyncToken?: string;
  public readonly modelInstallDirectory: string;

  constructor(values: AppRuntimeConfigValues) {
    this.workflowRepositoryMode = values.workflowRepositoryMode;
    this.workflowExecutorMode = values.workflowExecutorMode;
    this.nodeCatalogMode = values.nodeCatalogMode;
    this.seedStarterNode = values.seedStarterNode;
    this.isProductionMode = values.isProductionMode;
    this.devSyncBaseUrl = values.devSyncBaseUrl?.trim() || undefined;
    this.devSyncToken = values.devSyncToken?.trim() || undefined;
    this.modelInstallDirectory = values.modelInstallDirectory.trim();
  }

  public get isDevSyncEnabled(): boolean {
    return !this.isProductionMode && !!this.devSyncBaseUrl;
  }

  private static readEnvVariable(key: string): string | undefined {
    if (typeof process !== "undefined" && process?.env?.[key]) {
      return process.env[key];
    }

    return import.meta.env?.[key];
  }

  public static forDevelopment(): AppRuntimeConfig {
    const devSyncBaseUrl =
      AppRuntimeConfig.readEnvVariable("VITE_DEV_SYNC_BASE_URL") ||
      "http://192.168.1.100:8787";
    const devSyncToken =
      AppRuntimeConfig.readEnvVariable("VITE_DEV_SYNC_TOKEN") || "ai-loom-dev-sync";
    const modelInstallDirectory =
      AppRuntimeConfig.readEnvVariable("VITE_MODEL_INSTALL_DIRECTORY") ||
      "dev/models";

    return new AppRuntimeConfig({
      workflowRepositoryMode: "memory",
      workflowExecutorMode: "preview",
      nodeCatalogMode: "mock",
      seedStarterNode: true,
      isProductionMode: false,
      devSyncBaseUrl,
      devSyncToken,
      modelInstallDirectory,
    });
  }
}

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
}

export class AppRuntimeConfig {
  public readonly workflowRepositoryMode: WorkflowRepositoryMode;
  public readonly workflowExecutorMode: WorkflowExecutorMode;
  public readonly nodeCatalogMode: NodeCatalogMode;
  public readonly seedStarterNode: boolean;
  public readonly isProductionMode: boolean;
  public readonly devSyncBaseUrl?: string;
  public readonly devSyncToken?: string;

  constructor(values: AppRuntimeConfigValues) {
    this.workflowRepositoryMode = values.workflowRepositoryMode;
    this.workflowExecutorMode = values.workflowExecutorMode;
    this.nodeCatalogMode = values.nodeCatalogMode;
    this.seedStarterNode = values.seedStarterNode;
    this.isProductionMode = values.isProductionMode;
    this.devSyncBaseUrl = values.devSyncBaseUrl?.trim() || undefined;
    this.devSyncToken = values.devSyncToken?.trim() || undefined;
  }

  public get isDevSyncEnabled(): boolean {
    return !this.isProductionMode && !!this.devSyncBaseUrl;
  }

  public static forDevelopment(): AppRuntimeConfig {
    return new AppRuntimeConfig({
      workflowRepositoryMode: "memory",
      workflowExecutorMode: "preview",
      nodeCatalogMode: "mock",
      seedStarterNode: true,
      isProductionMode: false,
      devSyncBaseUrl: "http://192.168.1.100:8787",
      devSyncToken: "ai-loom-dev-sync",
    });
  }
}

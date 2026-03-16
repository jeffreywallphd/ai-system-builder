export type WorkflowRepositoryMode = "memory";
export type WorkflowExecutorMode = "preview";
export type NodeCatalogMode = "mock";

export interface AppRuntimeConfigValues {
  readonly workflowRepositoryMode: WorkflowRepositoryMode;
  readonly workflowExecutorMode: WorkflowExecutorMode;
  readonly nodeCatalogMode: NodeCatalogMode;
  readonly seedStarterNode: boolean;
}

export class AppRuntimeConfig {
  public readonly workflowRepositoryMode: WorkflowRepositoryMode;
  public readonly workflowExecutorMode: WorkflowExecutorMode;
  public readonly nodeCatalogMode: NodeCatalogMode;
  public readonly seedStarterNode: boolean;

  constructor(values: AppRuntimeConfigValues) {
    this.workflowRepositoryMode = values.workflowRepositoryMode;
    this.workflowExecutorMode = values.workflowExecutorMode;
    this.nodeCatalogMode = values.nodeCatalogMode;
    this.seedStarterNode = values.seedStarterNode;
  }

  public static forDevelopment(): AppRuntimeConfig {
    return new AppRuntimeConfig({
      workflowRepositoryMode: "memory",
      workflowExecutorMode: "preview",
      nodeCatalogMode: "mock",
      seedStarterNode: true,
    });
  }
}

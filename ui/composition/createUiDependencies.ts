import { WorkflowValidator } from "../../domain/services/WorkflowValidator";
import { NodeCompatibilityService } from "../../domain/services/NodeCompatibilityService";
import { ModelCompatibilityService } from "../../domain/services/ModelCompatibilityService";
import { CreateWorkflowUseCase } from "../../application/workflows/CreateWorkflowUseCase";
import { ExecuteWorkflowUseCase } from "../../application/workflows/ExecuteWorkflowUseCase";
import { ValidateWorkflowUseCase } from "../../application/workflows/ValidateWorkflowUseCase";
import { CreateNodeUseCase } from "../../application/nodes/CreateNodeUseCase";
import { ConnectNodesUseCase } from "../../application/nodes/ConnectNodesUseCase";
import { ListAvailableNodesUseCase } from "../../application/nodes/ListAvailableNodesUseCase";
import { InstallModelUseCase } from "../../application/models/InstallModelUseCase";
import { ListInstalledModelsUseCase } from "../../application/models/ListInstalledModelsUseCase";
import { RemoveModelUseCase } from "../../application/models/RemoveModelUseCase";
import { ResolveModelCompatibilityUseCase } from "../../application/models/ResolveModelCompatibilityUseCase";
import { SearchRemoteModelsUseCase } from "../../application/models/SearchRemoteModelsUseCase";
import { WorkflowService } from "../services/WorkflowService";
import { NodeService } from "../services/NodeService";
import { ModelService } from "../services/ModelService";
import { WorkflowStore } from "../state/WorkflowStore";
import { NodeStore } from "../state/NodeStore";
import { ModelStore } from "../state/ModelStore";
import { AppRuntimeConfig } from "../../infrastructure/config/AppRuntimeConfig";
import { InMemoryWorkflowRepository } from "../../infrastructure/mocks/repositories/InMemoryWorkflowRepository";
import { InterpretedWorkflowExecutor } from "../../infrastructure/interpreted/execution/InterpretedWorkflowExecutor";
import { MockNodeCatalogProvider } from "../../infrastructure/mocks/catalog/MockNodeCatalogProvider";
import { NodeCatalogProvider } from "../../application/ports/NodeCatalogProvider";
import { createCompositeNodeImplementationRegistry } from "../../infrastructure/nodes/NodeProviderRegistryIndex";
import { ImplementationRegistryNodeCatalogProvider } from "../../infrastructure/nodes/ImplementationRegistryNodeCatalogProvider";
import { HuggingFaceApiClient } from "../../infrastructure/huggingface/HuggingFaceApiClient";
import { HuggingFaceModelCatalog } from "../../infrastructure/huggingface/HuggingFaceModelCatalog";
import type { IModel } from "../../domain/models/interfaces/IModel";
import type { IModelInstaller } from "../../application/ports/interfaces/IModelInstaller";
import type {
  IInstalledModelCatalog,
  IInstalledModelSearchCriteria,
} from "../../application/ports/interfaces/IInstalledModelCatalog";
import { RuntimeEventBuffer } from "../../application/runtime/RuntimeEventBuffer";
import { HttpPythonRuntimeClient } from "../../infrastructure/python/client/HttpPythonRuntimeClient";
import { PythonRuntimeConfig } from "../../infrastructure/config/PythonRuntimeConfig";
import { NodeProcessRuntimeEventSink } from "../../infrastructure/python/runtime/NodeProcessRuntimeEventSink";
import { PythonRuntimeLauncher } from "../../infrastructure/python/runtime/PythonRuntimeLauncher";
import { PythonRuntimeProcessManager } from "../../infrastructure/python/runtime/PythonRuntimeProcessManager";
import { RuntimeConsoleStore } from "../state/RuntimeConsoleStore";

import { WorkflowProjectionService } from "../../application/projection/WorkflowProjectionService";
import { WorkflowToolProjectionService } from "../../application/projection/WorkflowToolProjectionService";
import { ListPublishedToolsUseCase } from "../../application/tools/ListPublishedToolsUseCase";
import { LoadToolDefinitionUseCase } from "../../application/tools/LoadToolDefinitionUseCase";
import { RunToolUseCase } from "../../application/tools/RunToolUseCase";
import { ToolService } from "../services/ToolService";
import { ToolStore } from "../state/ToolStore";
import type { CreateUiDependenciesOptions, UiDependencies } from "./types";
import { createSeedWorkflows } from "./seedWorkflows";

export function createUiDependencies(
  options: CreateUiDependenciesOptions = {}
): UiDependencies {
  const config = options.config ?? AppRuntimeConfig.forDevelopment();

  const workflowRepository = createWorkflowRepository(config);
  const workflowExecutor = createWorkflowExecutor(config);
  const nodeCatalogProvider = createNodeCatalogProvider(config);

  const modelCompatibilityService = new ModelCompatibilityService();
  const nodeCompatibilityService = new NodeCompatibilityService(
    modelCompatibilityService
  );
  const workflowValidator = new WorkflowValidator(nodeCompatibilityService);

  const createWorkflowUseCase = new CreateWorkflowUseCase();
  const executeWorkflowUseCase = new ExecuteWorkflowUseCase(
    workflowExecutor,
    workflowValidator
  );
  const validateWorkflowUseCase = new ValidateWorkflowUseCase(workflowValidator);

  const createNodeUseCase = new CreateNodeUseCase(nodeCatalogProvider);
  const connectNodesUseCase = new ConnectNodesUseCase(nodeCompatibilityService);
  const listAvailableNodesUseCase = new ListAvailableNodesUseCase(
    nodeCatalogProvider
  );

  const workflowService = new WorkflowService({
    createWorkflowUseCase,
    executeWorkflowUseCase,
    validateWorkflowUseCase,
    workflowRepository,
  });

  const nodeService = new NodeService({
    createNodeUseCase,
    connectNodesUseCase,
    listAvailableNodesUseCase,
    nodeCatalogProvider,
  });

  const workflowProjectionService = new WorkflowProjectionService();
  const workflowToolProjectionService = new WorkflowToolProjectionService();
  const loadToolDefinitionUseCase = new LoadToolDefinitionUseCase(
    workflowRepository,
    workflowToolProjectionService
  );
  const toolService = new ToolService(
    new ListPublishedToolsUseCase(workflowRepository, workflowToolProjectionService),
    loadToolDefinitionUseCase,
    new RunToolUseCase(
      workflowRepository,
      workflowToolProjectionService,
      workflowExecutor,
      loadToolDefinitionUseCase
    )
  );

  const workflowStore = new WorkflowStore({
    workflowService,
    nodeService,
  });

  const nodeStore = new NodeStore({
    nodeService,
  });

  const installedModelCatalog = new InMemoryInstalledModelCatalog();
  const remoteModelCatalog = new HuggingFaceModelCatalog({
    apiClient: new HuggingFaceApiClient(),
  });

  const modelService = new ModelService({
    installModelUseCase: new InstallModelUseCase({
      modelInstaller: createNoopModelInstaller(),
      installedModelCatalog,
      remoteModelCatalog,
    }),
    listInstalledModelsUseCase: new ListInstalledModelsUseCase(installedModelCatalog),
    removeModelUseCase: new RemoveModelUseCase({
      installedModelCatalog,
      modelInstaller: createNoopModelInstaller(),
    }),
    resolveModelCompatibilityUseCase: new ResolveModelCompatibilityUseCase(
      modelCompatibilityService
    ),
    searchRemoteModelsUseCase: new SearchRemoteModelsUseCase(remoteModelCatalog),
    installedModelCatalog,
  });

  const modelStore = new ModelStore({
    modelService,
  });

  const pythonRuntimeConfig = new PythonRuntimeConfig({
    mode: "local-http",
    baseUrl: "http://127.0.0.1:8000",
  });
  const runtimeEventStore = new RuntimeEventBuffer({ capacity: 500 });
  const runtimeEventSink = new NodeProcessRuntimeEventSink(runtimeEventStore);
  const runtimeClient = new HttpPythonRuntimeClient(pythonRuntimeConfig);
  const pythonRuntimeManager = new PythonRuntimeProcessManager({
    client: runtimeClient,
    launcher: new PythonRuntimeLauncher({
      spawn: () => {
        throw new Error("Node child process spawning is unavailable in browser composition.");
      },
    }),
    eventSink: runtimeEventSink,
    config: pythonRuntimeConfig,
    autoStartEnabled: true,
  });
  const runtimeConsoleStore = new RuntimeConsoleStore({
    runtimeEventStore,
    pythonRuntimeManager,
  });

  return Object.freeze({
    config,
    workflowStore,
    nodeStore,
    modelStore,
    workflowService,
    nodeService,
    modelService,
    runtimeConsoleStore,
    toolService,
    toolStore: new ToolStore(toolService),
    workflowProjectionService,
  });
}

function createWorkflowRepository(config: AppRuntimeConfig) {
  switch (config.workflowRepositoryMode) {
    case "memory":
    default:
      return new InMemoryWorkflowRepository(createSeedWorkflows());
  }
}

function createWorkflowExecutor(config: AppRuntimeConfig) {
  switch (config.workflowExecutorMode) {
    case "preview":
    default:
      return new InterpretedWorkflowExecutor();
  }
}

function createNodeCatalogProvider(config: AppRuntimeConfig) {
  const implementationRegistryProvider = new ImplementationRegistryNodeCatalogProvider(
    createCompositeNodeImplementationRegistry()
  );

  switch (config.nodeCatalogMode) {
    case "mock":
    default:
      return new NodeCatalogProvider({
        providers: [new MockNodeCatalogProvider(), implementationRegistryProvider],
      });
  }
}

function createNoopModelInstaller(): IModelInstaller {
  return {
    async startInstall(_request: Parameters<IModelInstaller["startInstall"]>[0]): Promise<never> {
      throw new Error("Model install is not available in browser mode.");
    },
    async install(
      _request: Parameters<IModelInstaller["install"]>[0],
      _onProgress?: Parameters<IModelInstaller["install"]>[1]
    ): Promise<never> {
      throw new Error("Model install is not available in browser mode.");
    },
    canInstall(_request: Parameters<IModelInstaller["canInstall"]>[0]): boolean {
      return false;
    },
    async isInstalled(
      _model: Parameters<IModelInstaller["isInstalled"]>[0],
      _destination?: Parameters<IModelInstaller["isInstalled"]>[1]
    ): Promise<boolean> {
      return false;
    },
    async uninstall(_request: Parameters<IModelInstaller["uninstall"]>[0]): Promise<void> {
      throw new Error("Model uninstall is not available in browser mode.");
    },
    canUninstall(_model: Parameters<IModelInstaller["canUninstall"]>[0]): boolean {
      return false;
    },
  };
}

class InMemoryInstalledModelCatalog implements IInstalledModelCatalog {
  private readonly modelsById = new Map<string, IModel>();

  public async listInstalled(
    criteria?: IInstalledModelSearchCriteria
  ): Promise<ReadonlyArray<IModel>> {
    const all = [...this.modelsById.values()];
    const query = criteria?.query?.trim().toLowerCase();

    if (!query) {
      return Object.freeze(all);
    }

    return Object.freeze(
      all.filter(
        (model) =>
          model.id.toLowerCase().includes(query) ||
          model.name.toLowerCase().includes(query) ||
          (model.publisher?.toLowerCase().includes(query) ?? false)
      )
    );
  }

  public async getInstalledById(id: string): Promise<IModel | undefined> {
    return this.modelsById.get(id.trim());
  }

  public async saveInstalled(model: IModel): Promise<void> {
    this.modelsById.set(model.id, model);
  }

  public async removeInstalled(id: string): Promise<boolean> {
    return this.modelsById.delete(id.trim());
  }

  public async isInstalled(id: string): Promise<boolean> {
    return this.modelsById.has(id.trim());
  }
}

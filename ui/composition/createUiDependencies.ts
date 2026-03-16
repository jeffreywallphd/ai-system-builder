import { WorkflowValidator } from "../../domain/services/WorkflowValidator";
import { NodeCompatibilityService } from "../../domain/services/NodeCompatibilityService";
import { ModelCompatibilityService } from "../../domain/services/ModelCompatibilityService";
import { CreateWorkflowUseCase } from "../../application/workflows/CreateWorkflowUseCase";
import { ExecuteWorkflowUseCase } from "../../application/workflows/ExecuteWorkflowUseCase";
import { ValidateWorkflowUseCase } from "../../application/workflows/ValidateWorkflowUseCase";
import { CreateNodeUseCase } from "../../application/nodes/CreateNodeUseCase";
import { ConnectNodesUseCase } from "../../application/nodes/ConnectNodesUseCase";
import { ListAvailableNodesUseCase } from "../../application/nodes/ListAvailableNodesUseCase";
import { WorkflowService } from "../services/WorkflowService";
import { NodeService } from "../services/NodeService";
import { WorkflowStore } from "../state/WorkflowStore";
import { NodeStore } from "../state/NodeStore";
import { AppRuntimeConfig } from "../../infrastructure/config/AppRuntimeConfig";
import { InMemoryWorkflowRepository } from "../../infrastructure/mocks/repositories/InMemoryWorkflowRepository";
import { PreviewWorkflowExecutor } from "../../infrastructure/mocks/execution/PreviewWorkflowExecutor";
import { MockNodeCatalogProvider } from "../../infrastructure/mocks/catalog/MockNodeCatalogProvider";

export interface UiDependencies {
  readonly config: AppRuntimeConfig;
  readonly workflowStore: WorkflowStore;
  readonly nodeStore: NodeStore;
  readonly workflowService: WorkflowService;
  readonly nodeService: NodeService;
}

export interface ICreateUiDependenciesOptions {
  readonly config?: AppRuntimeConfig;
}

export function createUiDependencies(
  options: ICreateUiDependenciesOptions = {}
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

  const workflowStore = new WorkflowStore({
    workflowService,
    nodeService,
  });

  const nodeStore = new NodeStore({
    nodeService,
  });

  return Object.freeze({
    config,
    workflowStore,
    nodeStore,
    workflowService,
    nodeService,
  });
}

function createWorkflowRepository(config: AppRuntimeConfig) {
  switch (config.workflowRepositoryMode) {
    case "memory":
    default:
      return new InMemoryWorkflowRepository();
  }
}

function createWorkflowExecutor(config: AppRuntimeConfig) {
  switch (config.workflowExecutorMode) {
    case "preview":
    default:
      return new PreviewWorkflowExecutor();
  }
}

function createNodeCatalogProvider(config: AppRuntimeConfig) {
  switch (config.nodeCatalogMode) {
    case "mock":
    default:
      return new MockNodeCatalogProvider();
  }
}

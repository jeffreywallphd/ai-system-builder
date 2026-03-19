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
import { CompositeNodeCatalogProvider } from "../../application/nodes/CompositeNodeCatalogProvider";
import { createCompositeNodeImplementationRegistry } from "../../infrastructure/nodes/NodeProviderRegistryIndex";
import { ImplementationRegistryNodeCatalogProvider } from "../../infrastructure/nodes/ImplementationRegistryNodeCatalogProvider";
import { HuggingFaceApiClient } from "../../infrastructure/huggingface/HuggingFaceApiClient";
import { HuggingFaceModelCatalog } from "../../infrastructure/huggingface/HuggingFaceModelCatalog";
import type { IModel } from "../../domain/models/interfaces/IModel";
import type { IModelInstaller } from "../../application/ports/interfaces/IModelInstaller";
import type { IPythonRuntimeClient } from "../../application/ports/interfaces/IPythonRuntimeClient";
import type {
  IInstalledModelCatalog,
  IInstalledModelSearchCriteria,
} from "../../application/ports/interfaces/IInstalledModelCatalog";
import { RuntimeEventBuffer } from "../../application/runtime/RuntimeEventBuffer";
import { HttpPythonRuntimeClient } from "../../infrastructure/python/client/HttpPythonRuntimeClient";
import { PythonRuntimeConfig } from "../../infrastructure/config/PythonRuntimeConfig";
import { NodeProcessRuntimeEventSink } from "../../infrastructure/python/runtime/NodeProcessRuntimeEventSink";
import { BrowserPythonRuntimeManager } from "../../infrastructure/python/runtime/BrowserPythonRuntimeManager";
import { RuntimeConsoleStore } from "../state/RuntimeConsoleStore";
import { McpService } from "../services/McpService";
import { McpStore } from "../state/McpStore";
import { LocalStorageUiSettingsStorage, UiSettingsStore } from "../settings/UiSettingsStore";
import { HttpMcpRuntimeClient } from "../../infrastructure/python/mcp/HttpMcpRuntimeClient";
import { PythonBackedMcpToolCatalog } from "../../infrastructure/python/mcp/PythonBackedMcpToolCatalog";
import { PythonBackedMcpToolExecutor } from "../../infrastructure/python/mcp/PythonBackedMcpToolExecutor";
import { ListMcpToolsUseCase } from "../../application/mcp/ListMcpToolsUseCase";
import { SearchMcpServersUseCase } from "../../application/mcp/SearchMcpServersUseCase";
import { GetMcpServerStatusUseCase } from "../../application/mcp/GetMcpServerStatusUseCase";
import { ConnectMcpServerUseCase } from "../../application/mcp/ConnectMcpServerUseCase";
import { DisconnectMcpServerUseCase } from "../../application/mcp/DisconnectMcpServerUseCase";

import { WorkflowProjectionService } from "../../application/projection/WorkflowProjectionService";
import { WorkflowToolProjectionService } from "../../application/projection/WorkflowToolProjectionService";
import { ListPublishedToolsUseCase } from "../../application/tools/ListPublishedToolsUseCase";
import { LoadToolDefinitionUseCase } from "../../application/tools/LoadToolDefinitionUseCase";
import { RunToolUseCase } from "../../application/tools/RunToolUseCase";
import { ListToolCapabilitiesUseCase } from "../../application/tools/ListToolCapabilitiesUseCase";
import { InvokeToolCapabilityUseCase } from "../../application/tools/InvokeToolCapabilityUseCase";
import { SearchCapabilitiesUseCase } from "../../application/research/SearchCapabilitiesUseCase";
import { ToolService } from "../services/ToolService";
import { ToolStore } from "../state/ToolStore";
import type { CreateUiDependenciesOptions, UiDependencies } from "./types";
import { createSeedWorkflows } from "./seedWorkflows";
import { CompositeToolCapabilityCatalog } from "../../infrastructure/tools/CompositeToolCapabilityCatalog";
import { CompositeToolCapabilityExecutor } from "../../infrastructure/tools/CompositeToolCapabilityExecutor";
import { McpToolCapabilityCatalog, MCP_TOOL_CAPABILITY_PROVIDER } from "../../infrastructure/tools/McpToolCapabilityCatalog";
import { McpToolCapabilityExecutor } from "../../infrastructure/tools/McpToolCapabilityExecutor";
import { WorkflowProjectedToolCapabilityCatalog, WORKFLOW_TOOL_CAPABILITY_PROVIDER } from "../../infrastructure/tools/WorkflowProjectedToolCapabilityCatalog";
import { WorkflowToolCapabilityExecutor } from "../../infrastructure/tools/WorkflowToolCapabilityExecutor";

export function createUiDependencies(
  options: CreateUiDependenciesOptions = {}
): UiDependencies {
  const config = options.config ?? AppRuntimeConfig.forDevelopment();
  const settingsStore = new UiSettingsStore({
    config,
    storage: options.settingsStorage ?? new LocalStorageUiSettingsStorage(),
  });
  const settings = settingsStore.getSettings();

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
  const runToolUseCase = new RunToolUseCase(
    workflowRepository,
    workflowToolProjectionService,
    workflowExecutor,
    loadToolDefinitionUseCase
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
    mode: settings.runtime.mode,
    baseUrl: settings.runtime.mode === "disabled" ? undefined : settings.runtime.baseUrl,
    timeoutMs: settings.runtime.requestTimeoutMs,
    authToken: settings.runtime.authToken,
    runtimeWorkingDirectory: settings.runtime.workingDirectory,
    startupTimeoutMs: settings.runtime.startupTimeoutMs,
    healthPollIntervalMs: settings.runtime.healthPollIntervalMs,
    autoStartEnabled: settings.runtime.autoStartEnabled,
  });
  const runtimeEventStore = new RuntimeEventBuffer({ capacity: 500 });
  const runtimeEventSink = new NodeProcessRuntimeEventSink(runtimeEventStore);
  const runtimeClient = settings.runtime.mode === "disabled"
    ? createDisabledRuntimeClient()
    : new HttpPythonRuntimeClient(pythonRuntimeConfig);
  const pythonRuntimeManager = new BrowserPythonRuntimeManager({
    client: runtimeClient,
    eventSink: runtimeEventSink,
    config: pythonRuntimeConfig,
  });
  const runtimeConsoleStore = new RuntimeConsoleStore({
    runtimeEventStore,
    pythonRuntimeManager,
  });
  const mcpClient = settings.runtime.mode === "disabled"
    ? createDisabledMcpRuntimeClient()
    : new HttpMcpRuntimeClient(pythonRuntimeConfig, fetch, runtimeEventSink);
  const pythonBackedMcpToolCatalog = new PythonBackedMcpToolCatalog(mcpClient, runtimeEventSink);
  const toolCapabilityCatalog = new CompositeToolCapabilityCatalog([
    new WorkflowProjectedToolCapabilityCatalog(workflowRepository, workflowToolProjectionService),
    new McpToolCapabilityCatalog(pythonBackedMcpToolCatalog),
  ]);
  const toolCapabilityExecutor = new CompositeToolCapabilityExecutor([
    {
      providerKind: WORKFLOW_TOOL_CAPABILITY_PROVIDER.kind,
      providerId: WORKFLOW_TOOL_CAPABILITY_PROVIDER.id,
      executor: new WorkflowToolCapabilityExecutor(runToolUseCase),
    },
    {
      providerKind: MCP_TOOL_CAPABILITY_PROVIDER.kind,
      providerId: MCP_TOOL_CAPABILITY_PROVIDER.id,
      executor: new McpToolCapabilityExecutor(new PythonBackedMcpToolExecutor(mcpClient, runtimeEventSink)),
    },
  ]);
  const toolService = new ToolService(
    new ListPublishedToolsUseCase(workflowRepository, workflowToolProjectionService),
    loadToolDefinitionUseCase,
    runToolUseCase,
    new ListToolCapabilitiesUseCase(toolCapabilityCatalog),
    new InvokeToolCapabilityUseCase(toolCapabilityExecutor),
    new SearchCapabilitiesUseCase(toolCapabilityCatalog, {
      mcpToolCatalog: pythonBackedMcpToolCatalog,
      mcpRuntimeClient: mcpClient,
    })
  );
  const mcpService = new McpService(
    new ListMcpToolsUseCase(pythonBackedMcpToolCatalog),
    new SearchMcpServersUseCase(mcpClient),
    new GetMcpServerStatusUseCase(mcpClient),
    new ConnectMcpServerUseCase(mcpClient),
    new DisconnectMcpServerUseCase(mcpClient),
  );
  const mcpStore = new McpStore(mcpService);

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
    mcpService,
    mcpStore,
    workflowProjectionService,
    settingsStore,
  });
}

function createDisabledRuntimeClient(): IPythonRuntimeClient {
  return {
    async health() {
      return { status: "unavailable", runtime: "python" } as const;
    },
    async executeNode() {
      throw new Error("Python runtime is disabled in settings.");
    },
    async executeWorkflow() {
      throw new Error("Python runtime is disabled in settings.");
    },
  };
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
      return new CompositeNodeCatalogProvider({
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


function createDisabledMcpRuntimeClient() {
  const disabledStatus = () => ({
    enabled: false,
    state: "disabled" as const,
    checkedAt: new Date().toISOString(),
    servers: [],
    capabilities: { tools: false, resources: false, toolExecution: false },
    metadata: { reason: "python-runtime-disabled" },
  });

  return {
    async getConnectionStatus() {
      return disabledStatus();
    },
    async listServers() {
      return { query: "", totalCount: 0, limit: 20, servers: [], status: disabledStatus() };
    },
    async searchServers(criteria?: { query?: string; limit?: number }) {
      return {
        query: criteria?.query?.trim() || "",
        totalCount: 0,
        limit: criteria?.limit ?? 20,
        servers: [],
        status: disabledStatus(),
      };
    },
    async connectServer(request: { serverId: string; reconnect?: boolean }) {
      return {
        action: request.reconnect ? "reconnect" as const : "connect" as const,
        checkedAt: new Date().toISOString(),
        server: {
          id: request.serverId,
          name: request.serverId,
          transport: "inmemory" as const,
          status: "error" as const,
          toolCount: 0,
          resourceCount: 0,
          capabilities: { tools: false, resources: false, toolExecution: false },
          errorMessage: "Python runtime is disabled.",
        },
        status: disabledStatus(),
      };
    },
    async disconnectServer(serverId: string) {
      return {
        action: "disconnect" as const,
        checkedAt: new Date().toISOString(),
        server: {
          id: serverId,
          name: serverId,
          transport: "inmemory" as const,
          status: "disconnected" as const,
          toolCount: 0,
          resourceCount: 0,
          capabilities: { tools: false, resources: false, toolExecution: false },
          errorMessage: "Python runtime is disabled.",
        },
        status: disabledStatus(),
      };
    },
    async listTools() {
      return [];
    },
    async listResources() {
      return [];
    },
    async executeTool(request: { serverId: string; toolName: string; executionId?: string }) {
      return {
        executionId: request.executionId?.trim() || "mcp-disabled",
        serverId: request.serverId,
        toolName: request.toolName,
        status: "failed" as const,
        content: [],
        errorMessage: "Python runtime is disabled.",
      };
    },
  };
}

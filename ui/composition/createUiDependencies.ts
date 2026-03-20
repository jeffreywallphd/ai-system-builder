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
import { BrowserHuggingFaceModelDownloader } from "../../infrastructure/browser/models/BrowserHuggingFaceModelDownloader";
import { LocalStorageInstalledModelCatalog } from "../../infrastructure/browser/models/LocalStorageInstalledModelCatalog";
import { ModelDownloader } from "../../application/ports/ModelDownloader";
import { ModelInstaller } from "../../application/ports/ModelInstaller";
import type { IModel } from "../../domain/models/interfaces/IModel";
import type { IPythonRuntimeClient } from "../../application/ports/interfaces/IPythonRuntimeClient";
import type { IInstalledModelCatalog } from "../../application/ports/interfaces/IInstalledModelCatalog";
import { RuntimeEventBuffer } from "../../application/runtime/RuntimeEventBuffer";
import { HttpPythonRuntimeClient } from "../../infrastructure/python/client/HttpPythonRuntimeClient";
import { PythonRuntimeConfig } from "../../infrastructure/config/PythonRuntimeConfig";
import { NodeProcessRuntimeEventSink } from "../../infrastructure/python/runtime/NodeProcessRuntimeEventSink";
import { BrowserPythonRuntimeManager } from "../../infrastructure/python/runtime/BrowserPythonRuntimeManager";
import { RuntimeConsoleStore } from "../state/RuntimeConsoleStore";
import { McpService } from "../services/McpService";
import { McpToolCallAuthoringService } from "../services/McpToolCallAuthoringService";
import { McpStore } from "../state/McpStore";
import { LocalStorageUiSettingsStorage, UiSettingsStore } from "../settings/UiSettingsStore";
import { HttpMcpRuntimeClient } from "../../infrastructure/python/mcp/HttpMcpRuntimeClient";
import { HttpMcpServerRuntimeClient } from "../../infrastructure/python/mcp/HttpMcpServerRuntimeClient";
import { PythonBackedMcpServerCatalog } from "../../infrastructure/python/mcp/PythonBackedMcpServerCatalog";
import { PythonBackedMcpServerManager } from "../../infrastructure/python/mcp/PythonBackedMcpServerManager";
import { ConfiguredMcpServerCatalog } from "../../infrastructure/browser/mcp/ConfiguredMcpServerCatalog";
import { LocalStorageMcpConfiguredServerRepository } from "../../infrastructure/browser/mcp/LocalStorageMcpConfiguredServerRepository";
import { PythonBackedMcpToolCatalog } from "../../infrastructure/python/mcp/PythonBackedMcpToolCatalog";
import { PythonBackedMcpToolExecutor } from "../../infrastructure/python/mcp/PythonBackedMcpToolExecutor";
import { ListConfiguredMcpServersUseCase } from "../../application/mcp/ListConfiguredMcpServersUseCase";
import { SearchMcpServersUseCase } from "../../application/mcp/SearchMcpServersUseCase";
import { AddConfiguredMcpServerUseCase } from "../../application/mcp/AddConfiguredMcpServerUseCase";
import { GetMcpConnectionStatusUseCase } from "../../application/mcp/GetMcpConnectionStatusUseCase";
import { GetMcpServerStatusUseCase } from "../../application/mcp/GetMcpServerStatusUseCase";
import { SearchMcpToolsUseCase } from "../../application/mcp/SearchMcpToolsUseCase";
import { GetMcpToolDescriptorUseCase } from "../../application/mcp/GetMcpToolDescriptorUseCase";
import { ConnectMcpServerUseCase } from "../../application/mcp/ConnectMcpServerUseCase";
import { DisconnectMcpServerUseCase } from "../../application/mcp/DisconnectMcpServerUseCase";
import { ReconnectMcpServerUseCase } from "../../application/mcp/ReconnectMcpServerUseCase";
import { CreateLocalMcpServerUseCase } from "../../application/mcp/CreateLocalMcpServerUseCase";
import { GenerateLocalMcpToolDraftUseCase } from "../../application/mcp/GenerateLocalMcpToolDraftUseCase";
import { WorkflowContextService } from "../../application/context/WorkflowContextService";
import { CreateContextPackageUseCase } from "../../application/context/CreateContextPackageUseCase";
import { CreateContextRecipeUseCase } from "../../application/context/CreateContextRecipeUseCase";
import { UpdateContextPackageUseCase } from "../../application/context/UpdateContextPackageUseCase";
import { DeleteContextPackageUseCase } from "../../application/context/DeleteContextPackageUseCase";
import { ListContextPackagesUseCase } from "../../application/context/ListContextPackagesUseCase";
import { ListContextRecipesUseCase } from "../../application/context/ListContextRecipesUseCase";
import { LoadContextPackageUseCase } from "../../application/context/LoadContextPackageUseCase";
import { LoadContextRecipeUseCase } from "../../application/context/LoadContextRecipeUseCase";
import { SearchContextPackagesUseCase } from "../../application/context/SearchContextPackagesUseCase";
import { PreviewWorkflowContextUseCase } from "../../application/context/PreviewWorkflowContextUseCase";
import { PreviewToolContextUseCase } from "../../application/context/PreviewToolContextUseCase";
import { PreviewAgentContextUseCase } from "../../application/context/PreviewAgentContextUseCase";
import { LocalStorageContextPackageRepository } from "../../infrastructure/browser/context/LocalStorageContextPackageRepository";
import { LocalStorageContextRecipeRepository } from "../../infrastructure/browser/context/LocalStorageContextRecipeRepository";

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
import { ContextService } from "../services/ContextService";
import { ContextStore } from "../state/ContextStore";
import type { CreateUiDependenciesOptions, UiDependencies } from "./types";
import { createSeedWorkflows } from "./seedWorkflows";
import { CompositeToolCapabilityCatalog } from "../../infrastructure/tools/CompositeToolCapabilityCatalog";
import { StaticLocalToolCapabilityCatalog, LOCAL_TOOL_CAPABILITY_PROVIDER } from "../../infrastructure/tools/StaticLocalToolCapabilityCatalog";
import { CompositeToolCapabilityExecutor } from "../../infrastructure/tools/CompositeToolCapabilityExecutor";
import { StaticLocalToolCapabilityExecutor } from "../../infrastructure/tools/StaticLocalToolCapabilityExecutor";
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
  const contextPackageRepository = new LocalStorageContextPackageRepository();
  const contextRecipeRepository = new LocalStorageContextRecipeRepository();
  const workflowContextService = new WorkflowContextService(contextPackageRepository, contextRecipeRepository);

  const modelCompatibilityService = new ModelCompatibilityService();
  const nodeCompatibilityService = new NodeCompatibilityService(
    modelCompatibilityService
  );
  const workflowValidator = new WorkflowValidator(nodeCompatibilityService);

  const createWorkflowUseCase = new CreateWorkflowUseCase();
  const executeWorkflowUseCase = new ExecuteWorkflowUseCase(
    workflowExecutor,
    workflowValidator,
    workflowContextService
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
    loadToolDefinitionUseCase,
    workflowContextService
  );

  const nodeStore = new NodeStore({
    nodeService,
  });

  const huggingFaceApiClient = new HuggingFaceApiClient();
  const installedModelCatalog = new LocalStorageInstalledModelCatalog();
  const remoteModelCatalog = new HuggingFaceModelCatalog({
    apiClient: huggingFaceApiClient,
  });
  const modelInstaller = new ModelInstaller({
    downloader: new ModelDownloader([
      new BrowserHuggingFaceModelDownloader({
        apiClient: huggingFaceApiClient,
      }),
    ]),
  });

  const modelService = new ModelService({
    installModelUseCase: new InstallModelUseCase({
      modelInstaller,
      installedModelCatalog,
      remoteModelCatalog,
    }),
    listInstalledModelsUseCase: new ListInstalledModelsUseCase(installedModelCatalog),
    removeModelUseCase: new RemoveModelUseCase({
      installedModelCatalog,
      modelInstaller,
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
  const mcpClient = settings.runtime.mode === "disabled"
    ? createDisabledMcpRuntimeClient()
    : new HttpMcpRuntimeClient(pythonRuntimeConfig, fetch, runtimeEventSink);
  const mcpServerRuntimeClient = settings.runtime.mode === "disabled"
    ? createDisabledMcpServerRuntimeClient()
    : new HttpMcpServerRuntimeClient(pythonRuntimeConfig, fetch, runtimeEventSink);
  const persistedMcpServerRepository = new LocalStorageMcpConfiguredServerRepository();
  const runtimeMcpServerCatalog = settings.runtime.mode === "disabled"
    ? createDisabledMcpServerCatalog()
    : new PythonBackedMcpServerCatalog(mcpServerRuntimeClient);
  const mcpServerCatalog = new ConfiguredMcpServerCatalog(runtimeMcpServerCatalog, persistedMcpServerRepository);
  const mcpServerManager = settings.runtime.mode === "disabled"
    ? createDisabledMcpServerManager()
    : new PythonBackedMcpServerManager(mcpServerRuntimeClient, runtimeMcpServerCatalog, runtimeEventSink);
  const pythonBackedMcpToolCatalog = new PythonBackedMcpToolCatalog(mcpClient, runtimeEventSink);
  const toolCapabilityCatalog = new CompositeToolCapabilityCatalog([
    new WorkflowProjectedToolCapabilityCatalog(workflowRepository, workflowToolProjectionService),
    new StaticLocalToolCapabilityCatalog([]),
    new McpToolCapabilityCatalog(pythonBackedMcpToolCatalog),
  ]);
  const toolCapabilityExecutor = new CompositeToolCapabilityExecutor([
    {
      providerKind: WORKFLOW_TOOL_CAPABILITY_PROVIDER.kind,
      providerId: WORKFLOW_TOOL_CAPABILITY_PROVIDER.id,
      executor: new WorkflowToolCapabilityExecutor(runToolUseCase),
    },
    {
      providerKind: LOCAL_TOOL_CAPABILITY_PROVIDER.kind,
      providerId: LOCAL_TOOL_CAPABILITY_PROVIDER.id,
      executor: new StaticLocalToolCapabilityExecutor({}),
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
    new ListConfiguredMcpServersUseCase(mcpServerCatalog),
    new SearchMcpServersUseCase(mcpClient),
    new AddConfiguredMcpServerUseCase(persistedMcpServerRepository),
    new GetMcpConnectionStatusUseCase(mcpServerCatalog),
    new GetMcpServerStatusUseCase(mcpServerCatalog),
    new ConnectMcpServerUseCase(mcpServerManager),
    new DisconnectMcpServerUseCase(mcpServerManager),
    new ReconnectMcpServerUseCase(mcpServerManager),
    new SearchMcpToolsUseCase(pythonBackedMcpToolCatalog),
    new GetMcpToolDescriptorUseCase(pythonBackedMcpToolCatalog),
    new CreateLocalMcpServerUseCase(mcpServerManager),
    new GenerateLocalMcpToolDraftUseCase(),
  );
  const mcpToolCallAuthoringService = new McpToolCallAuthoringService(mcpService);
  const workflowStore = new WorkflowStore({
    workflowService,
    nodeService,
    mcpToolCallAuthoringService,
    workflowProjectionService,
  });
  const runtimeConsoleStore = new RuntimeConsoleStore({
    runtimeEventStore,
    pythonRuntimeManager,
    mcpService,
  });
  const mcpStore = new McpStore(mcpService);
  const previewWorkflowContextUseCase = new PreviewWorkflowContextUseCase(workflowContextService);
  const previewToolContextUseCase = new PreviewToolContextUseCase(
    workflowRepository,
    loadToolDefinitionUseCase,
    workflowContextService,
  );
  const previewAgentContextUseCase = new PreviewAgentContextUseCase(
    workflowContextService,
    new ListToolCapabilitiesUseCase(toolCapabilityCatalog),
  );
  const contextService = new ContextService({
    createContextPackageUseCase: new CreateContextPackageUseCase({
      contextPackageRepository,
    }),
    createContextRecipeUseCase: new CreateContextRecipeUseCase({
      contextRecipeRepository,
    }),
    updateContextPackageUseCase: new UpdateContextPackageUseCase({
      contextPackageRepository,
    }),
    deleteContextPackageUseCase: new DeleteContextPackageUseCase(contextPackageRepository),
    listContextPackagesUseCase: new ListContextPackagesUseCase(contextPackageRepository),
    loadContextPackageUseCase: new LoadContextPackageUseCase(contextPackageRepository),
    searchContextPackagesUseCase: new SearchContextPackagesUseCase(contextPackageRepository),
    listContextRecipesUseCase: new ListContextRecipesUseCase(contextRecipeRepository),
    loadContextRecipeUseCase: new LoadContextRecipeUseCase(contextRecipeRepository),
    previewWorkflowContextUseCase,
    previewToolContextUseCase,
    previewAgentContextUseCase,
  });
  const contextStore = new ContextStore(contextService);

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
    contextService,
    contextStore,
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



function createDisabledRuntimeStatus() {

  return {
    enabled: false,
    state: "disabled" as const,
    checkedAt: new Date().toISOString(),
    servers: [],
    capabilities: { tools: false, resources: false, toolExecution: false },
    metadata: { reason: "python-runtime-disabled" },
  };
}

function createDisabledServerDescriptor(serverId: string) {
  return {
    id: serverId,
    name: serverId,
    transport: "inmemory" as const,
    enabled: false,
    status: "error" as const,
    connected: false,
    toolCount: 0,
    resourceCount: 0,
    capabilities: { tools: false, resources: false, toolExecution: false },
    errorMessage: "Python runtime is disabled.",
  };
}

function createDisabledServerStatus(serverId: string) {
  return {
    serverId,
    name: serverId,
    transport: "inmemory" as const,
    configured: false,
    enabled: false,
    state: "error" as const,
    connected: false,
    checkedAt: new Date().toISOString(),
    toolCount: 0,
    resourceCount: 0,
    capabilities: { tools: false, resources: false, toolExecution: false },
    errorMessage: "Python runtime is disabled.",
  };
}

function createDisabledConnectionResult(serverId: string, action: "connect" | "disconnect" | "reconnect") {
  return {
    action,
    checkedAt: new Date().toISOString(),
    server: createDisabledServerDescriptor(serverId),
    status: createDisabledServerStatus(serverId),
    runtime: createDisabledRuntimeStatus(),
    metadata: { reason: "python-runtime-disabled" },
  };
}

function createDisabledMcpRuntimeClient() {
  const disabledStatus = () => createDisabledRuntimeStatus();

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
      return createDisabledConnectionResult(request.serverId, request.reconnect ? "reconnect" : "connect");
    },
    async disconnectServer(serverId: string) {
      return createDisabledConnectionResult(serverId, "disconnect");
    },
    async listTools() {
      return [];
    },
    async searchTools(criteria?: { query?: string; limit?: number }) {
      return { query: criteria?.query?.trim() || "", totalCount: 0, limit: criteria?.limit ?? 20, tools: [] };
    },
    async getToolDescriptor() {
      return undefined;
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
        structuredContent: {},
        errorMessage: "Python runtime is disabled.",
      };
    },
  };
}

function createDisabledMcpServerRuntimeClient() {
  return {
    async getConnectionStatus() {
      return createDisabledRuntimeStatus();
    },
    async listConfiguredServers() {
      return [];
    },
    async connectServer(request: { serverId: string }) {
      return createDisabledConnectionResult(request.serverId, "connect");
    },
    async disconnectServer(serverId: string) {
      return createDisabledConnectionResult(serverId, "disconnect");
    },
    async reconnectServer(serverId: string) {
      return createDisabledConnectionResult(serverId, "reconnect");
    },
    async createLocalServer(draft: { serverId: string }) {
      return {
        server: createDisabledServerDescriptor(draft.serverId),
        status: createDisabledServerStatus(draft.serverId),
        runtime: createDisabledRuntimeStatus(),
        checkedAt: new Date().toISOString(),
        created: false,
      };
    },
  };
}

function createDisabledMcpServerCatalog() {
  return {
    async getConnectionStatus() {
      return createDisabledRuntimeStatus();
    },
    async listConfiguredServers() {
      return [];
    },
    async getServerStatus(serverId: string) {
      return createDisabledServerStatus(serverId);
    },
  };
}

function createDisabledMcpServerManager() {
  return {
    async connectServer(request: { serverId: string }) {
      return createDisabledConnectionResult(request.serverId, "connect");
    },
    async disconnectServer(serverId: string) {
      return createDisabledConnectionResult(serverId, "disconnect");
    },
    async reconnectServer(serverId: string) {
      return createDisabledConnectionResult(serverId, "reconnect");
    },
    async createLocalServer(draft: { serverId: string }) {
      return {
        server: createDisabledServerDescriptor(draft.serverId),
        status: createDisabledServerStatus(draft.serverId),
        runtime: createDisabledRuntimeStatus(),
        checkedAt: new Date().toISOString(),
        created: false,
      };
    },
  };
}

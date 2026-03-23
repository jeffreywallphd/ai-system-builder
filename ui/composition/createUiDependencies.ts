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
import { MockNodeCatalogProvider } from "../../infrastructure/mocks/catalog/MockNodeCatalogProvider";
import { CompositeNodeCatalogProvider } from "../../application/nodes/CompositeNodeCatalogProvider";
import { createCompositeNodeImplementationRegistry } from "../../infrastructure/nodes/NodeProviderRegistryIndex";
import { ImplementationRegistryNodeCatalogProvider } from "../../infrastructure/nodes/ImplementationRegistryNodeCatalogProvider";
import { HuggingFaceApiClient } from "../../infrastructure/huggingface/HuggingFaceApiClient";
import { HuggingFaceModelCatalog } from "../../infrastructure/huggingface/HuggingFaceModelCatalog";
import { ModelDownloader } from "../../application/ports/ModelDownloader";
import { ModelInstaller } from "../../application/ports/ModelInstaller";
import type { IModel } from "../../domain/models/interfaces/IModel";
import type { IPythonRuntimeClient } from "../../application/ports/interfaces/IPythonRuntimeClient";
import type { IInstalledModelCatalog } from "../../application/ports/interfaces/IInstalledModelCatalog";
import type { IManagedModelLibrary } from "../../application/ports/interfaces/IManagedModelLibrary";
import { RuntimeEventBuffer } from "../../application/runtime/RuntimeEventBuffer";
import { HttpPythonRuntimeClient } from "../../infrastructure/python/client/HttpPythonRuntimeClient";
import { PythonRuntimeConfig } from "../../infrastructure/config/PythonRuntimeConfig";
import { NodeProcessRuntimeEventSink } from "../../infrastructure/python/runtime/NodeProcessRuntimeEventSink";
import { createPythonManagedService } from "../../infrastructure/python/runtime/createPythonManagedService";
import { RuntimeConsoleStore } from "../state/RuntimeConsoleStore";
import { McpService } from "../services/McpService";
import { McpToolCallAuthoringService } from "../services/McpToolCallAuthoringService";
import { McpStore } from "../state/McpStore";
import { LocalStorageUiSettingsStorage, UiSettingsStore } from "../settings/UiSettingsStore";
import type { UiSettings } from "../settings/UiSettings";
import { resolveDesktopStorageAdapter } from "./DesktopStorageAdapter";
import { resolveDesktopModelFileBridge } from "./DesktopModelFileBridgeAdapter";
import { HttpMcpRuntimeClient } from "../../infrastructure/python/mcp/HttpMcpRuntimeClient";
import { HttpMcpServerRuntimeClient } from "../../infrastructure/python/mcp/HttpMcpServerRuntimeClient";
import { RuntimeBackedMcpConfiguredServerRepository } from "../../infrastructure/python/mcp/RuntimeBackedMcpConfiguredServerRepository";
import { PythonBackedMcpServerCatalog } from "../../infrastructure/python/mcp/PythonBackedMcpServerCatalog";
import { PythonBackedMcpServerManager } from "../../infrastructure/python/mcp/PythonBackedMcpServerManager";
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
import { createPythonRuntimeServiceDefinition } from "../../infrastructure/python/runtime/PythonRuntimeServiceDefinition";
import { LocalStorageManagedServiceDefinitionRepository } from "../../infrastructure/browser/services/LocalStorageManagedServiceDefinitionRepository";
import { HttpManagedServiceDefinitionRepository } from "../../infrastructure/services/HttpManagedServiceDefinitionRepository";
import { HttpManagedServiceSupervisorClient } from "../../infrastructure/services/HttpManagedServiceSupervisorClient";

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
import { TuningDatasetService } from "../services/TuningDatasetService";
import { ContextStore } from "../state/ContextStore";
import { TuningDatasetStore } from "../state/TuningDatasetStore";
import { ManagedServicesService } from "../services/ManagedServicesService";
import { ManagedServiceEventStream } from "../services/ManagedServiceEventStream";
import { ManagedServicesStore } from "../state/ManagedServicesStore";
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
import { DefaultTuningDatasetStudioApplicationService } from "../../application/tuning-datasets/DefaultTuningDatasetStudioApplicationService";
import { DefaultFileIngestionApplicationService } from "../../application/ingestion/DefaultFileIngestionApplicationService";
import { FileIngestionPolicyService } from "../../domain/ingestion/FileIngestionServices";
import { PythonRuntimeDocumentConversionGateway } from "../../infrastructure/ingestion/PythonRuntimeDocumentConversionGateway";
import { DatasetSourceIngestionProfile } from "../../application/tuning-datasets/DatasetSourceIngestionProfile";
import { BrowserDatasetImportService, DatasetStatisticsService, DatasetWorkflowProgressService, DefaultDatasetDuplicationPolicy, DefaultDatasetPrivacyPolicy, DefaultDatasetReleasePolicy, DefaultDatasetReviewPolicy, DeterministicDatasetSplitService, FallbackAwareDatasetGenerationService, JsonTuningDatasetExportService, ProviderAgnosticDatasetGenerationService, TaskTypeAwareValidationService } from "../../domain/tuning-datasets/TuningDatasetServices";
import { LocalStorageTuningDatasetRepository } from "../../infrastructure/browser/tuning-datasets/LocalStorageTuningDatasetRepository";
import { LocalStorageTuningDatasetVersionRepository } from "../../infrastructure/browser/tuning-datasets/LocalStorageTuningDatasetVersionRepository";
import { BrowserStorageWorkflowRepository } from "../../infrastructure/browser/workflows/SqliteBackedWorkflowRepository";
import { DesktopBridgeWorkflowRepository } from "../../infrastructure/browser/workflows/DesktopBridgeWorkflowRepository";
import { resolveDesktopWorkflowBridge } from "./DesktopWorkflowBridgeAdapter";
import { TruthfulWorkflowExecutor } from "../../infrastructure/execution/TruthfulWorkflowExecutor";
import { InterpretedWorkflowExecutionStrategy } from "../../infrastructure/interpreted/execution/InterpretedWorkflowExecutionStrategy";
import { DefaultNodeExecutionContextResolver } from "../../infrastructure/interpreted/execution/DefaultNodeExecutionContextResolver";
import { DefaultNodeOutputStore } from "../../infrastructure/interpreted/execution/DefaultNodeOutputStore";
import { LangChainNodeExecutor } from "../../infrastructure/interpreted/execution/LangChainNodeExecutor";
import { PythonDelegatedWorkflowExecutionStrategy } from "../../infrastructure/python/execution/PythonDelegatedWorkflowExecutionStrategy";
import { PythonRuntimeDatasetGenerationService } from "../../infrastructure/python/tuning-datasets/PythonRuntimeDatasetGenerationService";
import { LocalStorageModelTrainingJobRepository } from "../../infrastructure/browser/model-training/LocalStorageModelTrainingJobRepository";
import { DefaultModelTrainingApplicationService } from "../../application/model-training/DefaultModelTrainingApplicationService";
import { ModelTrainingService } from "../services/ModelTrainingService";
import { ModelTrainingStore } from "../state/ModelTrainingStore";
import { PythonRuntimeModelTrainingGateway } from "../../infrastructure/python/model-training/PythonRuntimeModelTrainingGateway";
import { createModelManagementDependencies } from "./modelManagementDependencies";
import { BrowserDownloadModelLibrary } from "../../infrastructure/browser/models/BrowserDownloadModelLibrary";

export function createUiDependencies(
  options: CreateUiDependenciesOptions = {}
): UiDependencies {
  const config = options.config ?? AppRuntimeConfig.resolveDefault();
  const desktopStorage = resolveDesktopStorageAdapter();
  const desktopWorkflowBridge = resolveDesktopWorkflowBridge();
  const desktopModelFileBridge = resolveDesktopModelFileBridge();
  const durableDesktopStorage = desktopStorage;
  const settingsStore = new UiSettingsStore({
    config,
    storage: options.settingsStorage ?? createSettingsStorage(config, desktopStorage),
  });
  const settings = settingsStore.getSettings();
  const pythonRuntimeConfig = new PythonRuntimeConfig({
    mode: settings.runtime.mode,
    baseUrl: settings.runtime.mode === "disabled" ? undefined : settings.runtime.baseUrl,
    timeoutMs: settings.runtime.requestTimeoutMs,
    authToken: settings.runtime.authToken,
    pythonVersion: settings.runtime.pythonVersion,
    pythonInterpreterPath: settings.runtime.pythonInterpreterPath || undefined,
    runtimeWorkingDirectory: settings.runtime.workingDirectory,
    startupTimeoutMs: settings.runtime.startupTimeoutMs,
    healthPollIntervalMs: settings.runtime.healthPollIntervalMs,
    autoStartEnabled: settings.runtime.autoStartEnabled,
  });
  const runtimeEventStore = new RuntimeEventBuffer({ capacity: 500 });
  const runtimeEventSink = new NodeProcessRuntimeEventSink(runtimeEventStore);
  const runtimeClient = pythonRuntimeConfig.isEnabled
    ? new HttpPythonRuntimeClient(pythonRuntimeConfig)
    : createDisabledRuntimeClient();
  const mcpClient = settings.runtime.mode === "disabled"
    ? createDisabledMcpRuntimeClient()
    : new HttpMcpRuntimeClient(pythonRuntimeConfig, fetch, runtimeEventSink);
  const mcpServerRuntimeClient = settings.runtime.mode === "disabled"
    ? createDisabledMcpServerRuntimeClient()
    : new HttpMcpServerRuntimeClient(pythonRuntimeConfig, fetch, runtimeEventSink);
  const runtimeMcpServerCatalog = settings.runtime.mode === "disabled"
    ? createDisabledMcpServerCatalog()
    : new PythonBackedMcpServerCatalog(mcpServerRuntimeClient);
  const workflowExecutorSelection = createWorkflowExecutor(config, runtimeClient, pythonRuntimeConfig.isEnabled, mcpClient, runtimeMcpServerCatalog);
  const workflowExecutor = workflowExecutorSelection.executor;

  const nodeCatalogProvider = createNodeCatalogProvider(config);
  const workflowRepositorySelection = createWorkflowRepository(config, nodeCatalogProvider, desktopWorkflowBridge, desktopStorage);
  const workflowRepository = workflowRepositorySelection.repository;
  const contextPackageRepository = new LocalStorageContextPackageRepository(undefined, durableDesktopStorage);
  const contextRecipeRepository = new LocalStorageContextRecipeRepository(undefined, durableDesktopStorage);
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
  const modelManagement = createModelManagementDependencies({
    apiClient: huggingFaceApiClient,
    desktopModelFileBridge: desktopModelFileBridge ?? undefined,
    modelInstallDirectory: config.modelInstallDirectory,
    durableStorage: durableDesktopStorage as never,
  });
  const desktopModelFileStorage = modelManagement.fileStorage;
  const installedModelCatalog = modelManagement.installedModelCatalog;
  const managedModelLibrary = modelManagement.managedModelLibrary;
  const remoteModelCatalog = new HuggingFaceModelCatalog({
    apiClient: huggingFaceApiClient,
  });
  const modelInstaller = new ModelInstaller({
    providers: modelManagement.installers,
    downloader: new ModelDownloader([modelManagement.downloader]),
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
    managedModelLibrary,
  });

  const modelStore = new ModelStore({
    modelService,
  });

  const pythonRuntimeDefinition = createPythonRuntimeServiceDefinition(new PythonRuntimeConfig({
    mode: settings.runtime.mode,
    baseUrl: settings.runtime.mode === "disabled" ? undefined : settings.runtime.baseUrl,
    timeoutMs: settings.runtime.requestTimeoutMs,
    authToken: settings.runtime.authToken,
    pythonVersion: settings.runtime.pythonVersion,
    pythonInterpreterPath: settings.runtime.pythonInterpreterPath || undefined,
    runtimeWorkingDirectory: settings.runtime.workingDirectory,
    startupTimeoutMs: settings.runtime.startupTimeoutMs,
    healthPollIntervalMs: settings.runtime.healthPollIntervalMs,
    autoStartEnabled: settings.runtime.autoStartEnabled,
  }));
  const managedServiceSupervisorClient = pythonRuntimeConfig.isManagedLocal
    ? new HttpManagedServiceSupervisorClient({
      baseUrl: pythonRuntimeConfig.supervisorBaseUrl,
      timeoutMs: pythonRuntimeConfig.timeoutMs,
      authToken: pythonRuntimeConfig.authToken,
    })
    : undefined;
  const pythonManagedService = createPythonManagedService({
    config: pythonRuntimeConfig,
    client: runtimeClient,
    eventSink: runtimeEventSink,
    supervisorClient: managedServiceSupervisorClient,
  });
  const pythonRuntimeManager = pythonManagedService.pythonRuntimeManager;
  const persistedMcpServerRepository = settings.runtime.mode === "disabled"
    ? undefined
    : new RuntimeBackedMcpConfiguredServerRepository(mcpServerRuntimeClient);
  const mcpServerCatalog = runtimeMcpServerCatalog;
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
    new AddConfiguredMcpServerUseCase(persistedMcpServerRepository ?? { saveConfiguredServer: async (server) => server, listConfiguredServers: async () => [] }),
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
    runtimeManagement: {
      isManagedLocal: pythonRuntimeConfig.isManagedLocal,
      autoStartEnabled: pythonRuntimeConfig.autoStartEnabled,
      healthPollIntervalMs: pythonRuntimeConfig.healthPollIntervalMs,
    },
  });
  const managedServiceDefinitionRepository = managedServiceSupervisorClient
    ? new HttpManagedServiceDefinitionRepository(managedServiceSupervisorClient)
    : new LocalStorageManagedServiceDefinitionRepository(undefined, durableDesktopStorage);
  const managedServicesService = new ManagedServicesService({
    serviceManager: pythonManagedService.manager,
    serviceSupervisor: pythonManagedService.manager,
    supervisorClient: managedServiceSupervisorClient,
    runtimeEventStore,
    builtinDefinitions: [pythonRuntimeDefinition],
    definitionRepository: managedServiceDefinitionRepository,
  });
  const managedServiceEventStream = settings.runtime.mode === "disabled"
    ? undefined
    : new ManagedServiceEventStream({
      baseUrl: pythonRuntimeConfig.supervisorBaseUrl,
    });
  const managedServicesStore = new ManagedServicesStore(managedServicesService, managedServiceEventStream);
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
  const tuningDatasetRepository = new LocalStorageTuningDatasetRepository(undefined, durableDesktopStorage as never);
  const tuningDatasetVersionRepository = new LocalStorageTuningDatasetVersionRepository(durableDesktopStorage as never);
  const duplicationPolicy = new DefaultDatasetDuplicationPolicy();
  const fileIngestionService = new DefaultFileIngestionApplicationService(
    new FileIngestionPolicyService(),
    new PythonRuntimeDocumentConversionGateway(runtimeClient),
  );
  const tuningDatasetApplicationService = new DefaultTuningDatasetStudioApplicationService({
    datasetRepository: tuningDatasetRepository,
    datasetVersionRepository: tuningDatasetVersionRepository,
    validationService: new TaskTypeAwareValidationService(duplicationPolicy),
    splitService: new DeterministicDatasetSplitService(),
    exportService: new JsonTuningDatasetExportService(),
    importService: new BrowserDatasetImportService(new DefaultDatasetPrivacyPolicy()),
    generationService: new FallbackAwareDatasetGenerationService(
      new PythonRuntimeDatasetGenerationService(runtimeClient),
      new ProviderAgnosticDatasetGenerationService(),
    ),
    reviewPolicy: new DefaultDatasetReviewPolicy(),
    duplicationPolicy,
    statisticsService: new DatasetStatisticsService(duplicationPolicy),
    releasePolicy: new DefaultDatasetReleasePolicy(),
    workflowService: new DatasetWorkflowProgressService(),
    fileIngestionService,
    datasetSourceIngestionProfile: DatasetSourceIngestionProfile,
  });
  const tuningDatasetService = new TuningDatasetService(tuningDatasetApplicationService);
  const tuningDatasetStore = new TuningDatasetStore(tuningDatasetService);
  const modelTrainingJobRepository = new LocalStorageModelTrainingJobRepository(undefined, durableDesktopStorage as never);
  const modelTrainingApplicationService = new DefaultModelTrainingApplicationService(
    installedModelCatalog,
    tuningDatasetRepository,
    tuningDatasetVersionRepository,
    modelTrainingJobRepository,
    new PythonRuntimeModelTrainingGateway(runtimeClient),
  );
  const modelTrainingService = new ModelTrainingService(modelTrainingApplicationService);
  const modelTrainingStore = new ModelTrainingStore(modelTrainingService);

  return Object.freeze({
    config,
    operationalStatus: {
      workflowPersistence: workflowRepositorySelection.status,
      execution: workflowExecutorSelection.status,
      nodeCatalog: describeNodeCatalogMode(config),
      mcp: describeMcpOperationalStatus(settings.runtime.mode),
      modelLibrary: describeModelLibraryOperationalStatus(managedModelLibrary),
    },
    workflowStore,
    nodeStore,
    modelStore,
    workflowService,
    nodeService,
    modelService,
    runtimeConsoleStore,
    pythonRuntimeManager,
    managedServicesService,
    managedServicesStore,
    toolService,
    toolStore: new ToolStore(toolService),
    mcpService,
    mcpStore,
    contextService,
    contextStore,
    tuningDatasetService,
    tuningDatasetStore,
    modelTrainingService,
    modelTrainingStore,
    workflowProjectionService,
    settingsStore,
  });
}


function createSettingsStorage(config: AppRuntimeConfig, desktopStorage = resolveDesktopStorageAdapter()) {
  if (config.uiSettingsPersistenceMode === "desktop-sqlite") {
    if (!desktopStorage) {
      throw new Error("Desktop SQLite settings persistence requires the desktop host storage bridge.");
    }
    return new LocalStorageUiSettingsStorage(undefined, desktopStorage);
  }

  return new LocalStorageUiSettingsStorage();
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
    async convertDocumentToMarkdown() {
      throw new Error("Python runtime is disabled in settings.");
    },
    async submitFineTuningJob() {
      throw new Error("Python runtime is disabled in settings.");
    },
    async getFineTuningJob() {
      throw new Error("Python runtime is disabled in settings.");
    },
    async refreshFineTuningJob() {
      throw new Error("Python runtime is disabled in settings.");
    },
    async reconcileFineTuningJob() {
      throw new Error("Python runtime is disabled in settings.");
    },
    async listFineTuningJobs() {
      throw new Error("Python runtime is disabled in settings.");
    },
    async cancelFineTuningJob() {
      throw new Error("Python runtime is disabled in settings.");
    },
    async generateDatasetExamples() {
      throw new Error("Python runtime is disabled in settings.");
    },
  };
}

function createWorkflowRepository(
  config: AppRuntimeConfig,
  nodeCatalogProvider: ReturnType<typeof createNodeCatalogProvider>,
  desktopWorkflowBridge = resolveDesktopWorkflowBridge(),
  desktopStorage = resolveDesktopStorageAdapter()
) {
  if (desktopWorkflowBridge && config.workflowRepositoryMode === "filesystem-indexed") {
    const desktopStatus = desktopWorkflowBridge.getWorkflowPersistenceStatus();
    return {
      repository: new DesktopBridgeWorkflowRepository(nodeCatalogProvider, desktopWorkflowBridge),
      status: {
        configuredMode: config.workflowRepositoryMode,
        effectiveMode: desktopStatus.provider,
        isDegraded: desktopStatus.degraded,
        detail: desktopStatus.degraded
          ? `Expected dev persistence is filesystem + SQLite, but the desktop bridge reported degradation: ${desktopStatus.detail}`
          : `Expected dev persistence is active at ${desktopStatus.workflowsDirectory} with SQLite index ${desktopStatus.indexDatabasePath}.`,
        workflowsDirectory: desktopStatus.workflowsDirectory,
        indexDatabasePath: desktopStatus.indexDatabasePath,
      },
    };
  }

  const browserStorage = typeof window !== "undefined" ? window.localStorage : undefined;
  if (browserStorage) {
    return {
      repository: new BrowserStorageWorkflowRepository(nodeCatalogProvider, browserStorage, createSeedWorkflows()),
      status: {
        configuredMode: config.workflowRepositoryMode,
        effectiveMode: "browser-storage-fallback",
        isDegraded: true,
        detail: config.workflowRepositoryMode === "filesystem-indexed"
          ? "Expected dev persistence is dev/ filesystem + SQLite, but the app is running in explicit browser fallback mode and is using browser storage instead."
          : "Workflow persistence is using the explicit browser-storage fallback mode.",
        workflowsDirectory: config.workflowStorageDirectory,
        indexDatabasePath: config.workflowIndexDatabasePath,
      },
    };
  }

  return {
    repository: new InMemoryWorkflowRepository(createSeedWorkflows()),
    status: {
      configuredMode: config.workflowRepositoryMode,
      effectiveMode: "in-memory-fallback",
      isDegraded: true,
      detail: "Emergency fallback only: no desktop workflow bridge or browser storage is available in this environment.",
      workflowsDirectory: config.workflowStorageDirectory,
      indexDatabasePath: config.workflowIndexDatabasePath,
    },
  };
}

function createWorkflowExecutor(config: AppRuntimeConfig, runtimeClient: IPythonRuntimeClient, runtimeEnabled: boolean, mcpClient: ReturnType<typeof createDisabledMcpRuntimeClient> | HttpMcpRuntimeClient, mcpServerCatalog: ReturnType<typeof createDisabledMcpServerCatalog> | PythonBackedMcpServerCatalog) {
  const executor = new TruthfulWorkflowExecutor({
    strategies: [
      new PythonDelegatedWorkflowExecutionStrategy(runtimeClient),
      new InterpretedWorkflowExecutionStrategy({
        runtime: "langchain",
        nodeExecutor: new LangChainNodeExecutor({
          pythonRuntimeClient: runtimeEnabled ? runtimeClient : undefined,
          mcpRuntimeClient: runtimeEnabled ? mcpClient : undefined,
          mcpServerCatalog: runtimeEnabled ? mcpServerCatalog : undefined,
        }),
        contextResolver: new DefaultNodeExecutionContextResolver(),
        outputStoreFactory: () => new DefaultNodeOutputStore(),
      }),
    ],
  });

  return {
    executor,
    status: {
      configuredMode: config.workflowExecutorMode,
      effectiveMode: runtimeEnabled ? "delegated-with-explicit-scaffold-fallback" : "scaffold-fallback-only",
      isDegraded: !runtimeEnabled || config.workflowExecutorMode === "scaffold",
      detail: config.workflowExecutorMode === "scaffold"
        ? "Execution is pinned to the explicit scaffold interpreter fallback."
        : runtimeEnabled
          ? "Workflow execution prefers delegated Python runtime execution and records every scaffold fallback explicitly in structured provenance."
          : "Python runtime is unavailable, so execution will run through the explicit scaffold fallback only.",
    },
  };
}

function createNodeCatalogProvider(config: AppRuntimeConfig) {
  const implementationRegistryProvider = new ImplementationRegistryNodeCatalogProvider(
    createCompositeNodeImplementationRegistry()
  );

  switch (config.nodeCatalogMode) {
    case "registered":
      return new CompositeNodeCatalogProvider({
        providers: [implementationRegistryProvider],
      });
    case "seeded":
      return new CompositeNodeCatalogProvider({
        providers: [new MockNodeCatalogProvider(), implementationRegistryProvider],
      });
    case "mock":
    default:
      return new CompositeNodeCatalogProvider({
        providers: [new MockNodeCatalogProvider()],
      });
  }
}

function describeNodeCatalogMode(config: AppRuntimeConfig) {
  switch (config.nodeCatalogMode) {
    case "registered":
      return {
        configuredMode: config.nodeCatalogMode,
        effectiveMode: "registered",
        isDegraded: false,
        detail: "Node catalog comes from the registered implementation registry.",
      };
    case "seeded":
      return {
        configuredMode: config.nodeCatalogMode,
        effectiveMode: "seeded",
        isDegraded: true,
        detail: "Seeded development nodes supplement the registered catalog.",
      };
    case "mock":
    default:
      return {
        configuredMode: config.nodeCatalogMode,
        effectiveMode: "mock",
        isDegraded: true,
        detail: "Mock catalog is enabled explicitly for fallback or test scenarios.",
      };
  }
}



function describeMcpOperationalStatus(runtimeMode: UiSettings["runtime"]["mode"]) {
  return runtimeMode === "disabled"
    ? { configuredMode: "disabled", effectiveMode: "disabled", isDegraded: true, detail: "MCP runtime is disabled in settings." }
    : { configuredMode: "runtime-backed", effectiveMode: "runtime-backed", isDegraded: false, detail: "MCP nodes and capabilities resolve through the runtime-backed MCP subsystem." };
}

function describeModelLibraryOperationalStatus(managedModelLibrary: IManagedModelLibrary) {
  const isBrowserFallback = managedModelLibrary instanceof BrowserDownloadModelLibrary;
  return {
    configuredMode: isBrowserFallback ? "browser-download-fallback" : "managed-local",
    effectiveMode: isBrowserFallback ? "browser-download-fallback" : "managed-local",
    isDegraded: isBrowserFallback,
    detail: isBrowserFallback
      ? "Model installs are running in browser-download fallback mode and are not treated as a fully managed local library."
      : "Model installs are reconciled against a managed local library path with verification-aware status reporting.",
  };
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

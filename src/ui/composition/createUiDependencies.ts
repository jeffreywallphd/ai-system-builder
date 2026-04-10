import { WorkflowValidator } from "@domain/services/WorkflowValidator";
import { NodeCompatibilityService } from "@domain/services/NodeCompatibilityService";
import { ModelCompatibilityService } from "@domain/services/ModelCompatibilityService";
import { CreateWorkflowUseCase } from "@application/workflows/CreateWorkflowUseCase";
import { ExecuteWorkflowUseCase } from "@application/workflows/ExecuteWorkflowUseCase";
import { ValidateWorkflowUseCase } from "@application/workflows/ValidateWorkflowUseCase";
import { LoadWorkflowUseCase } from "@application/workflows/LoadWorkflowUseCase";
import { CreateNodeUseCase } from "@application/nodes/CreateNodeUseCase";
import { ConnectNodesUseCase } from "@application/nodes/ConnectNodesUseCase";
import { ListAvailableNodesUseCase } from "@application/nodes/ListAvailableNodesUseCase";
import { InstallModelUseCase } from "@application/models/InstallModelUseCase";
import { ListInstalledModelsUseCase } from "@application/models/ListInstalledModelsUseCase";
import { RemoveModelUseCase } from "@application/models/RemoveModelUseCase";
import { ResolveModelCompatibilityUseCase } from "@application/models/ResolveModelCompatibilityUseCase";
import { SearchRemoteModelsUseCase } from "@application/models/SearchRemoteModelsUseCase";
import { WorkflowService } from "../services/WorkflowService";
import { NodeService } from "../services/NodeService";
import { ModelService } from "../services/ModelService";
import { WorkflowStore } from "../state/WorkflowStore";
import { NodeStore } from "../state/NodeStore";
import { ModelStore } from "../state/ModelStore";
import { AppRuntimeConfig } from "@infrastructure/config/AppRuntimeConfig";
import { InMemoryWorkflowRepository } from "@infrastructure/mocks/repositories/InMemoryWorkflowRepository";
import { MockNodeCatalogProvider } from "@infrastructure/mocks/catalog/MockNodeCatalogProvider";
import { CompositeNodeCatalogProvider } from "@application/nodes/CompositeNodeCatalogProvider";
import { createCompositeNodeImplementationRegistry } from "@infrastructure/nodes/NodeProviderRegistryIndex";
import { ImplementationRegistryNodeCatalogProvider } from "@infrastructure/nodes/ImplementationRegistryNodeCatalogProvider";
import { HuggingFaceApiClient } from "@infrastructure/huggingface/HuggingFaceApiClient";
import { HuggingFaceModelCatalog } from "@infrastructure/huggingface/HuggingFaceModelCatalog";
import { ModelDownloader } from "@application/ports/ModelDownloader";
import { ModelInstaller } from "@application/ports/ModelInstaller";
import type { IModel } from "@domain/models/interfaces/IModel";
import type { IPythonRuntimeClient } from "@application/ports/interfaces/IPythonRuntimeClient";
import { PythonRuntimeStatuses, type PythonRuntimeManagerStatus } from "@application/ports/interfaces/IPythonRuntimeManager";
import type { IMcpRuntimeClient } from "@application/ports/interfaces/IMcpRuntimeClient";
import type { IMcpServerCatalog } from "@application/ports/interfaces/IMcpServerCatalog";
import type { IInstalledModelCatalog } from "@application/ports/interfaces/IInstalledModelCatalog";
import type { IManagedModelLibrary } from "@application/ports/interfaces/IManagedModelLibrary";
import { RuntimeEventBuffer } from "@application/runtime/RuntimeEventBuffer";
import { HttpPythonRuntimeClient } from "@infrastructure/python/client/HttpPythonRuntimeClient";
import { PythonRuntimeConfig } from "@infrastructure/config/PythonRuntimeConfig";
import { NodeProcessRuntimeEventSink } from "@infrastructure/python/runtime/NodeProcessRuntimeEventSink";
import { createPythonManagedService } from "@infrastructure/python/runtime/createPythonManagedService";
import { RuntimeConsoleStore } from "../state/RuntimeConsoleStore";
import { McpService } from "../services/McpService";
import { McpToolCallAuthoringService } from "../services/McpToolCallAuthoringService";
import { McpStore } from "../state/McpStore";
import { LocalStorageUiSettingsStorage, UiSettingsStore } from "../settings/UiSettingsStore";
import type { UiSettings } from "../settings/UiSettings";
import { resolveDesktopStorageAdapter } from "./DesktopStorageAdapter";
import { resolveDesktopModelFileBridge } from "./DesktopModelFileBridgeAdapter";
import { ListConfiguredMcpServersUseCase } from "@application/mcp/ListConfiguredMcpServersUseCase";
import { SearchMcpServersUseCase } from "@application/mcp/SearchMcpServersUseCase";
import { AddConfiguredMcpServerUseCase } from "@application/mcp/AddConfiguredMcpServerUseCase";
import { GetMcpConnectionStatusUseCase } from "@application/mcp/GetMcpConnectionStatusUseCase";
import { GetMcpServerStatusUseCase } from "@application/mcp/GetMcpServerStatusUseCase";
import { SearchMcpToolsUseCase } from "@application/mcp/SearchMcpToolsUseCase";
import { GetMcpToolDescriptorUseCase } from "@application/mcp/GetMcpToolDescriptorUseCase";
import { ConnectMcpServerUseCase } from "@application/mcp/ConnectMcpServerUseCase";
import { DisconnectMcpServerUseCase } from "@application/mcp/DisconnectMcpServerUseCase";
import { ReconnectMcpServerUseCase } from "@application/mcp/ReconnectMcpServerUseCase";
import { CreateLocalMcpServerUseCase } from "@application/mcp/CreateLocalMcpServerUseCase";
import { GenerateLocalMcpToolDraftUseCase } from "@application/mcp/GenerateLocalMcpToolDraftUseCase";
import { ExecuteMcpToolUseCase } from "@application/mcp/ExecuteMcpToolUseCase";
import { WorkflowContextService } from "@application/context/WorkflowContextService";
import { CreateContextPackageUseCase } from "@application/context/CreateContextPackageUseCase";
import { CreateContextRecipeUseCase } from "@application/context/CreateContextRecipeUseCase";
import { UpdateContextPackageUseCase } from "@application/context/UpdateContextPackageUseCase";
import { DeleteContextPackageUseCase } from "@application/context/DeleteContextPackageUseCase";
import { ListContextPackagesUseCase } from "@application/context/ListContextPackagesUseCase";
import { ListContextRecipesUseCase } from "@application/context/ListContextRecipesUseCase";
import { LoadContextPackageUseCase } from "@application/context/LoadContextPackageUseCase";
import { LoadContextRecipeUseCase } from "@application/context/LoadContextRecipeUseCase";
import { SearchContextPackagesUseCase } from "@application/context/SearchContextPackagesUseCase";
import { PreviewWorkflowContextUseCase } from "@application/context/PreviewWorkflowContextUseCase";
import { PreviewToolContextUseCase } from "@application/context/PreviewToolContextUseCase";
import { PreviewAgentContextUseCase } from "@application/context/PreviewAgentContextUseCase";
import { LocalStorageContextPackageRepository } from "@infrastructure/browser/context/LocalStorageContextPackageRepository";
import { LocalStorageContextRecipeRepository } from "@infrastructure/browser/context/LocalStorageContextRecipeRepository";
import { createPythonRuntimeServiceDefinition } from "@infrastructure/python/runtime/PythonRuntimeServiceDefinition";
import { createMcpRuntimeIntegration } from "@infrastructure/python/mcp/createMcpRuntimeIntegration";
import {
  createDependentRuntimeCapabilityRegistration,
  createRuntimeDependencyOrchestrator,
} from "@infrastructure/runtime/RuntimeDependencyComposition";

import { WorkflowProjectionService } from "@application/projection/WorkflowProjectionService";
import { WorkflowToolProjectionService } from "@application/projection/WorkflowToolProjectionService";
import { ListPublishedToolsUseCase } from "@application/tools/ListPublishedToolsUseCase";
import { LoadToolDefinitionUseCase } from "@application/tools/LoadToolDefinitionUseCase";
import { RunToolUseCase } from "@application/tools/RunToolUseCase";
import { ListToolCapabilitiesUseCase } from "@application/tools/ListToolCapabilitiesUseCase";
import { InvokeToolCapabilityUseCase } from "@application/tools/InvokeToolCapabilityUseCase";
import { SearchCapabilitiesUseCase } from "@application/research/SearchCapabilitiesUseCase";
import { ToolService } from "../services/ToolService";
import { ToolStore } from "../state/ToolStore";
import { ContextService } from "../services/ContextService";
import { TuningDatasetService } from "../services/TuningDatasetService";
import { ContextStore } from "../state/ContextStore";
import { TuningDatasetStore } from "../state/TuningDatasetStore";
import { ManagedServicesService } from "../services/ManagedServicesService";
import { ManagedServicesStore } from "../state/ManagedServicesStore";
import type { CreateUiDependenciesOptions, UiDependencies } from "./types";
import { createSeedWorkflows } from "./seedWorkflows";
import { CompositeToolCapabilityCatalog } from "@infrastructure/tools/CompositeToolCapabilityCatalog";
import { StaticLocalToolCapabilityCatalog, LOCAL_TOOL_CAPABILITY_PROVIDER } from "@infrastructure/tools/StaticLocalToolCapabilityCatalog";
import { CompositeToolCapabilityExecutor } from "@infrastructure/tools/CompositeToolCapabilityExecutor";
import { StaticLocalToolCapabilityExecutor } from "@infrastructure/tools/StaticLocalToolCapabilityExecutor";
import { McpToolCapabilityCatalog, MCP_TOOL_CAPABILITY_PROVIDER } from "@infrastructure/tools/McpToolCapabilityCatalog";
import { McpToolCapabilityExecutor } from "@infrastructure/tools/McpToolCapabilityExecutor";
import { WorkflowProjectedToolCapabilityCatalog, WORKFLOW_TOOL_CAPABILITY_PROVIDER } from "@infrastructure/tools/WorkflowProjectedToolCapabilityCatalog";
import { WorkflowToolCapabilityExecutor } from "@infrastructure/tools/WorkflowToolCapabilityExecutor";
import { DefaultTuningDatasetStudioApplicationService } from "@application/tuning-datasets/DefaultTuningDatasetStudioApplicationService";
import { DefaultFileIngestionApplicationService } from "@application/ingestion/DefaultFileIngestionApplicationService";
import { FileIngestionPolicyService } from "@domain/ingestion/FileIngestionServices";
import { PythonRuntimeDocumentConversionGateway } from "@infrastructure/ingestion/PythonRuntimeDocumentConversionGateway";
import { OrchestratedDocumentConversionGateway } from "@infrastructure/ingestion/OrchestratedDocumentConversionGateway";
import { DatasetSourceIngestionProfile } from "@application/tuning-datasets/DatasetSourceIngestionProfile";
import { BrowserDatasetImportService, DatasetStatisticsService, DatasetWorkflowProgressService, DefaultDatasetDuplicationPolicy, DefaultDatasetPrivacyPolicy, DefaultDatasetReleasePolicy, DefaultDatasetReviewPolicy, DeterministicDatasetSplitService, FallbackAwareDatasetGenerationService, JsonTuningDatasetExportService, ProviderAgnosticDatasetGenerationService, TaskTypeAwareValidationService } from "@domain/tuning-datasets/TuningDatasetServices";
import { LocalStorageTuningDatasetRepository } from "@infrastructure/browser/tuning-datasets/LocalStorageTuningDatasetRepository";
import { LocalStorageTuningDatasetVersionRepository } from "@infrastructure/browser/tuning-datasets/LocalStorageTuningDatasetVersionRepository";
import { BrowserStorageWorkflowRepository } from "@infrastructure/browser/workflows/SqliteBackedWorkflowRepository";
import { DesktopBridgeWorkflowRepository } from "@infrastructure/browser/workflows/DesktopBridgeWorkflowRepository";
import { resolveDesktopWorkflowBridge } from "./DesktopWorkflowBridgeAdapter";
import { resolveDesktopExecutionRunBridge } from "./DesktopExecutionRunBridgeAdapter";
import { resolveDesktopCanonicalAssetBridge } from "./DesktopCanonicalAssetBridgeAdapter";
import { TruthfulWorkflowExecutor } from "@infrastructure/execution/TruthfulWorkflowExecutor";
import { InterpretedWorkflowExecutionStrategy } from "@infrastructure/interpreted/execution/InterpretedWorkflowExecutionStrategy";
import { DefaultNodeExecutionContextResolver } from "@infrastructure/interpreted/execution/DefaultNodeExecutionContextResolver";
import { DefaultNodeOutputStore } from "@infrastructure/interpreted/execution/DefaultNodeOutputStore";
import { LangChainNodeExecutor } from "@infrastructure/interpreted/execution/LangChainNodeExecutor";
import { WorkflowRuntimeSelector } from "@application/execution/WorkflowRuntimeSelector";
import { PythonDelegatedWorkflowExecutionStrategy } from "@infrastructure/python/execution/PythonDelegatedWorkflowExecutionStrategy";
import {
  createExecutionApplicationInfrastructure,
  createExecutionRunRepository,
  createWorkflowRunSummaryRepository,
} from "@infrastructure/execution/createExecutionInfrastructure";
import { PythonRuntimeDatasetGenerationService } from "@infrastructure/python/tuning-datasets/PythonRuntimeDatasetGenerationService";
import { OrchestratedDatasetGenerationService } from "@infrastructure/python/tuning-datasets/OrchestratedDatasetGenerationService";
import { LocalStorageModelTrainingJobRepository } from "@infrastructure/browser/model-training/LocalStorageModelTrainingJobRepository";
import { DefaultModelTrainingApplicationService } from "@application/model-training/DefaultModelTrainingApplicationService";
import { ModelTrainingService } from "../services/ModelTrainingService";
import { ModelTrainingStore } from "../state/ModelTrainingStore";
import { PythonRuntimeModelTrainingGateway } from "@infrastructure/python/model-training/PythonRuntimeModelTrainingGateway";
import { OrchestratedModelTrainingRuntime } from "@infrastructure/python/model-training/OrchestratedModelTrainingRuntime";
import { RuntimeAwareModelCreationEnvironmentGateway } from "@infrastructure/python/model-training/RuntimeAwareModelCreationEnvironmentGateway";
import { ExecutionHistoryService } from "../services/ExecutionHistoryService";
import { createModelManagementDependencies } from "./modelManagementDependencies";
import { BrowserDownloadModelLibrary } from "@infrastructure/browser/models/BrowserDownloadModelLibrary";
import { RuntimeDependencyIds, RuntimeDependencyOperationalStates, type IRuntimeDependencyOrchestrator } from "@application/runtime/RuntimeDependencyOrchestrator";
import { CanonicalAssetManagementService } from "../services/CanonicalAssetManagementService";
import { WorkflowConversationSessionService } from "../workflow-conversation/WorkflowConversationSessionService";
import { resolveDesktopWorkflowRunSummaryBridge } from "./DesktopWorkflowRunSummaryBridgeAdapter";
import { WorkflowRunHistoryService } from "@application/workflow-run-history/WorkflowRunHistoryService";
import { resolveLegacyManagedServiceBypassBoundary } from "./legacy/LegacyManagedServiceBypassBoundary";

export function createUiDependencies(
  options: CreateUiDependenciesOptions = {}
): UiDependencies {
  const config = options.config ?? AppRuntimeConfig.resolveDefault();
  const desktopStorage = resolveDesktopStorageAdapter();
  const desktopWorkflowBridge = resolveDesktopWorkflowBridge();
  const desktopExecutionRunBridge = resolveDesktopExecutionRunBridge();
  const desktopWorkflowRunSummaryBridge = resolveDesktopWorkflowRunSummaryBridge();
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
  const managedServiceLegacyBypassBoundary = resolveLegacyManagedServiceBypassBoundary({
    enableLegacyBypass: pythonRuntimeConfig.isManagedLocal,
    pythonRuntimeConfig,
    desktopStorage: durableDesktopStorage,
  });
  const managedServiceSupervisorClient =
    managedServiceLegacyBypassBoundary.supervisorClient;
  const pythonManagedService = createPythonManagedService({
    config: pythonRuntimeConfig,
    client: runtimeClient,
    eventSink: runtimeEventSink,
    supervisorClient: managedServiceSupervisorClient,
  });
  const pythonRuntimeManager = pythonManagedService.pythonRuntimeManager;
  const runtimeDependencyOrchestrator = createRuntimeDependencyOrchestrator({
    pythonRuntime: {
      providerId: "python-runtime-manager",
      ensureAvailable: async () => {
        const status = await pythonRuntimeManager.ensureRuntimeAvailability();
        return {
          state: mapPythonRuntimeStatusToDependencyState(status),
          isDegraded: status.status === PythonRuntimeStatuses.unhealthy,
          detail: status.detail,
          metadata: {
            owner: status.owner,
            status: status.status,
          },
          remediationHints: createPythonRuntimeRemediationHints(status),
        };
      },
    },
    additionalRegistrations: [
      createDependentRuntimeCapabilityRegistration({
        dependencyId: RuntimeDependencyIds.workflowExecutionRuntime,
        providerId: "workflow-execution-orchestration-gate",
        ensureAvailable: async () => ({
          state: RuntimeDependencyOperationalStates.healthy,
          detail: "Workflow execution dependency gate passed.",
        }),
      }),
      createDependentRuntimeCapabilityRegistration({
        dependencyId: RuntimeDependencyIds.documentConversionRuntime,
        providerId: "document-conversion-orchestration-gate",
        ensureAvailable: async () => ({
          state: RuntimeDependencyOperationalStates.healthy,
          detail: "Document conversion dependency gate passed.",
        }),
      }),
      createDependentRuntimeCapabilityRegistration({
        dependencyId: RuntimeDependencyIds.datasetGenerationRuntime,
        providerId: "dataset-generation-orchestration-gate",
        ensureAvailable: async () => ({
          state: RuntimeDependencyOperationalStates.healthy,
          detail: "Dataset generation dependency gate passed.",
        }),
      }),
      createDependentRuntimeCapabilityRegistration({
        dependencyId: RuntimeDependencyIds.modelTrainingRuntime,
        providerId: "model-training-orchestration-gate",
        ensureAvailable: async () => ({
          state: RuntimeDependencyOperationalStates.healthy,
          detail: "Model training dependency gate passed.",
        }),
      }),
    ],
  });
  const mcpRuntimeIntegration = createMcpRuntimeIntegration(
    pythonRuntimeConfig,
    runtimeEventSink,
    fetch,
    runtimeDependencyOrchestrator,
  );
  const mcpClient = mcpRuntimeIntegration.runtimeClient;
  const runtimeMcpServerCatalog = mcpRuntimeIntegration.serverCatalog;
  const workflowExecutorSelection = createWorkflowExecutor(
    config,
    runtimeClient,
    pythonRuntimeConfig.isEnabled,
    mcpClient,
    runtimeMcpServerCatalog,
    runtimeDependencyOrchestrator,
  );
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

  const datasetGenerationService = new FallbackAwareDatasetGenerationService(
    new OrchestratedDatasetGenerationService(
      new PythonRuntimeDatasetGenerationService(runtimeClient),
      runtimeDependencyOrchestrator,
    ),
    new ProviderAgnosticDatasetGenerationService(),
  );
  const modelTrainingRuntime = new OrchestratedModelTrainingRuntime(
    new PythonRuntimeModelTrainingGateway(runtimeClient),
    runtimeDependencyOrchestrator,
  );
  const createWorkflowUseCase = new CreateWorkflowUseCase();
  const executionRunRepository = createExecutionRunRepository({
    desktopExecutionRunBridge,
    storage: durableDesktopStorage,
  });
  const workflowRunSummaryRepository = createWorkflowRunSummaryRepository({
    desktopWorkflowRunSummaryBridge,
    storage: durableDesktopStorage,
  });
  const workflowRunHistoryService = new WorkflowRunHistoryService(workflowRunSummaryRepository);
  const executionInfrastructure = createExecutionApplicationInfrastructure({
    workflowExecutor,
    executionRunRepository,
    datasetGenerationService,
    modelTrainingRuntime,
    mcpServerManager: mcpRuntimeIntegration.serverManager,
    workflowRunHistoryService,
  });
  const executionHistoryFeature = createLazyValue(() => new ExecutionHistoryService(
    executionInfrastructure.listExecutionRunsUseCase,
    executionInfrastructure.executionRunProjectionService,
    executionInfrastructure.listRelatedExecutionRunsUseCase,
    executionInfrastructure.getExecutionRunDetailUseCase,
  ));
  const executionEngine = executionInfrastructure.executionEngine;
  const executeWorkflowUseCase = new ExecuteWorkflowUseCase(
    workflowExecutor,
    workflowValidator,
    workflowContextService,
    executionEngine,
  );
  const validateWorkflowUseCase = new ValidateWorkflowUseCase(workflowValidator);
  const loadWorkflowUseCase = new LoadWorkflowUseCase(workflowRepository, workflowValidator);

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
    loadWorkflowUseCase,
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
    workflowContextService,
    executionEngine,
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

  const persistedMcpServerRepository = mcpRuntimeIntegration.configuredServerRepository;
  const mcpServerCatalog = runtimeMcpServerCatalog;
  const mcpServerManager = mcpRuntimeIntegration.serverManager;
  const pythonBackedMcpToolCatalog = mcpRuntimeIntegration.toolCatalog;
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
      executor: new McpToolCapabilityExecutor(mcpRuntimeIntegration.toolExecutor),
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
  const toolStoreFeature = createLazyValue(() => new ToolStore(toolService));
  const mcpService = new McpService(
    new ListConfiguredMcpServersUseCase(mcpServerCatalog),
    new SearchMcpServersUseCase(mcpClient),
    new AddConfiguredMcpServerUseCase(persistedMcpServerRepository ?? { saveConfiguredServer: async (server) => server, listConfiguredServers: async () => [] }),
    new GetMcpConnectionStatusUseCase(mcpServerCatalog),
    new GetMcpServerStatusUseCase(mcpServerCatalog),
    new ConnectMcpServerUseCase(mcpServerManager, executionEngine),
    new DisconnectMcpServerUseCase(mcpServerManager, executionEngine),
    new ReconnectMcpServerUseCase(mcpServerManager, executionEngine),
    new SearchMcpToolsUseCase(pythonBackedMcpToolCatalog),
    new GetMcpToolDescriptorUseCase(pythonBackedMcpToolCatalog),
    new CreateLocalMcpServerUseCase(mcpServerManager, executionEngine),
    new GenerateLocalMcpToolDraftUseCase(),
  );
  const mcpToolCallAuthoringService = new McpToolCallAuthoringService(mcpService);
  const workflowConversationSessionService = new WorkflowConversationSessionService({
    workflowService,
  });
  const workflowStore = new WorkflowStore({
    workflowService,
    nodeService,
    mcpToolCallAuthoringService,
    workflowProjectionService,
    conversationSessionService: workflowConversationSessionService,
  });
  const runtimeConsoleStore = new RuntimeConsoleStore({
    runtimeEventStore,
    pythonRuntimeManager,
    mcpService,
    runtimeDependencyOrchestrator,
    runtimeManagement: {
      isManagedLocal: pythonRuntimeConfig.isManagedLocal,
      autoStartEnabled: pythonRuntimeConfig.autoStartEnabled,
      healthPollIntervalMs: pythonRuntimeConfig.healthPollIntervalMs,
    },
  });
  const managedServicesService = new ManagedServicesService({
    serviceManager: pythonManagedService.manager,
    serviceSupervisor: pythonManagedService.manager,
    supervisorClient: managedServiceSupervisorClient,
    runtimeEventStore,
    builtinDefinitions: [pythonRuntimeDefinition],
    definitionRepository: managedServiceLegacyBypassBoundary.definitionRepository,
  });
  const managedServiceEventStream = managedServiceLegacyBypassBoundary.eventStream;
  const managedServicesStore = new ManagedServicesStore(
    managedServicesService,
    managedServiceEventStream,
    runtimeDependencyOrchestrator,
  );
  const mcpStore = new McpStore(mcpService);
  const contextFeature = createLazyValue(() => {
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
    return Object.freeze({
      contextService,
      contextStore: new ContextStore(contextService),
    });
  });

  const tuningDatasetFeature = createLazyValue(() => {
    const tuningDatasetRepository = new LocalStorageTuningDatasetRepository(undefined, durableDesktopStorage as never);
    const tuningDatasetVersionRepository = new LocalStorageTuningDatasetVersionRepository(durableDesktopStorage as never);
    const duplicationPolicy = new DefaultDatasetDuplicationPolicy();
    const fileIngestionService = new DefaultFileIngestionApplicationService(
      new FileIngestionPolicyService(),
      new OrchestratedDocumentConversionGateway(
        new PythonRuntimeDocumentConversionGateway(runtimeClient),
        runtimeDependencyOrchestrator,
      ),
    );
    const tuningDatasetApplicationService = new DefaultTuningDatasetStudioApplicationService({
      datasetRepository: tuningDatasetRepository,
      datasetVersionRepository: tuningDatasetVersionRepository,
      validationService: new TaskTypeAwareValidationService(duplicationPolicy),
      splitService: new DeterministicDatasetSplitService(),
      exportService: new JsonTuningDatasetExportService(),
      importService: new BrowserDatasetImportService(new DefaultDatasetPrivacyPolicy()),
      generationService: datasetGenerationService,
      executionEngine,
      reviewPolicy: new DefaultDatasetReviewPolicy(),
      duplicationPolicy,
      statisticsService: new DatasetStatisticsService(duplicationPolicy),
      releasePolicy: new DefaultDatasetReleasePolicy(),
      workflowService: new DatasetWorkflowProgressService(),
      fileIngestionService,
      datasetSourceIngestionProfile: DatasetSourceIngestionProfile,
    });
    const tuningDatasetService = new TuningDatasetService(tuningDatasetApplicationService);
    return Object.freeze({
      tuningDatasetRepository,
      tuningDatasetVersionRepository,
      tuningDatasetService,
      tuningDatasetStore: new TuningDatasetStore(tuningDatasetService),
    });
  });

  const modelTrainingFeature = createLazyValue(() => {
    const tuningFeature = tuningDatasetFeature();
    const modelTrainingJobRepository = new LocalStorageModelTrainingJobRepository(undefined, durableDesktopStorage as never);
    const modelTrainingApplicationService = new DefaultModelTrainingApplicationService(
      installedModelCatalog,
      tuningFeature.tuningDatasetRepository,
      tuningFeature.tuningDatasetVersionRepository,
      modelTrainingJobRepository,
      modelTrainingRuntime,
      new RuntimeAwareModelCreationEnvironmentGateway(
        config,
        runtimeClient,
        pythonRuntimeConfig.isEnabled,
        desktopModelFileStorage,
        desktopModelFileStorage
          ? "Desktop model-file bridge is connected."
          : config.runtimeMode === "browser-development"
            ? "Browser fallback mode does not expose the desktop model-file bridge."
            : "The desktop model-file bridge is not available in this runtime.",
        runtimeDependencyOrchestrator,
      ),
      desktopModelFileStorage,
      executionEngine,
    );
    const modelTrainingService = new ModelTrainingService(modelTrainingApplicationService);
    return Object.freeze({
      modelTrainingService,
      modelTrainingStore: new ModelTrainingStore(modelTrainingService),
    });
  });

  const canonicalAssetFeature = createLazyValue(() => {
    const desktopCanonicalAssetBridge = resolveDesktopCanonicalAssetBridge();
    return new CanonicalAssetManagementService(desktopCanonicalAssetBridge
      ? {
        listAssets: async () => (await desktopCanonicalAssetBridge.listAssets()).map((entry) => JSON.parse(entry)),
        loadAssetDetail: async (assetId) => {
          const detail = await desktopCanonicalAssetBridge.loadAssetDetail(assetId);
          return detail ? JSON.parse(detail) : undefined;
        },
        listVersionChain: async (assetId) => (await desktopCanonicalAssetBridge.listVersionChain(assetId)).map((entry) => {
          const parsed = JSON.parse(entry) as {
            versionId: string;
            parentVersionId?: string;
            label?: string;
            dependencyState?: {
              state: "healthy" | "impacted" | "stale" | "partially-trusted" | "reconciliation-needed";
              reasons: ReadonlyArray<string>;
              nextActions: ReadonlyArray<string>;
            };
            createdAt: string;
          };
          return Object.freeze({
            ...parsed,
            createdAt: new Date(parsed.createdAt),
          });
        }),
        evaluateDependencyState: async (versionId) => {
          const state = await desktopCanonicalAssetBridge.evaluateDependencyState(versionId);
          if (!state) {
            throw new Error(`Canonical dependency state for version '${versionId}' is unavailable.`);
          }
          const parsed = JSON.parse(state) as {
            versionId: string;
            state: "healthy" | "impacted" | "stale" | "partially-trusted" | "reconciliation-needed";
            lineageConfidence: "exact" | "partial";
            lifecycle: { source: "persisted-fresh" | "recomputed"; computedAt: string; reason: string; };
            reasons: ReadonlyArray<string>;
            nextActions: ReadonlyArray<string>;
          };
          return Object.freeze({
            ...parsed,
            lifecycle: Object.freeze({
              ...parsed.lifecycle,
              computedAt: new Date(parsed.lifecycle.computedAt),
            }),
          });
        },
        reconcileIdentity: async ({ entityType, entityId }) => {
          const reconciled = await desktopCanonicalAssetBridge.reconcileIdentity(entityType, entityId);
          return reconciled ? JSON.parse(reconciled) : undefined;
        },
        replayScopedProjection: async ({ entityType, entityId, versionId }) => JSON.parse(
          await desktopCanonicalAssetBridge.replayScopedProjection(entityType, entityId, versionId),
        ),
        verifyProjection: async ({ assetId, versionIdsInScope }) => {
          const verification = await desktopCanonicalAssetBridge.verifyProjection(assetId, versionIdsInScope);
          if (!verification) {
            throw new Error(`Projection verification for canonical asset '${assetId}' is unavailable.`);
          }
          return JSON.parse(verification);
        },
        rebuildProjectionScopes: async (request) => JSON.parse(
          await desktopCanonicalAssetBridge.rebuildProjectionScopes(JSON.stringify(request)),
        ),
        loadManagementSnapshot: async ({ assetId, includeProjectionHealth, versionIdsInProjectionScope }) => {
          const snapshot = await desktopCanonicalAssetBridge.loadManagementSnapshot(assetId, includeProjectionHealth, versionIdsInProjectionScope);
          if (!snapshot) {
            return undefined;
          }
          const parsed = JSON.parse(snapshot) as {
            asset: import("../../application/assets-system/AssetManagementReadModels").CanonicalAssetDetailReadModel;
            versions: ReadonlyArray<{
              versionId: string;
              parentVersionId?: string;
              label?: string;
              createdAt: string;
              dependencyState: {
                state: "healthy" | "impacted" | "stale" | "partially-trusted" | "reconciliation-needed";
                reasons: ReadonlyArray<string>;
                nextActions: ReadonlyArray<string>;
              };
            }>;
            dependencyLifecycleSummary: {
              healthy: number;
              impacted: number;
              stale: number;
              partiallyTrusted: number;
              reconciliationNeeded: number;
            };
            existenceExplanation?: { versionId: string; explanation: string; evidence: ReadonlyArray<string>; };
            operationalSummary: {
              status: "healthy" | "attention-needed";
              explanation: string;
              recommendedActions: ReadonlyArray<string>;
            };
            projectionHealth?: {
              matched: boolean;
              trustState: "trusted" | "mismatch-detected";
              trustExplanation: string;
              failedChecks: ReadonlyArray<string>;
              edgeCount: number;
              scopedVersionCount: number;
              mismatchedVersionIds: ReadonlyArray<string>;
            };
          };
          return Object.freeze({
            ...parsed,
            versions: Object.freeze(parsed.versions.map((entry) => Object.freeze({
              ...entry,
              createdAt: new Date(entry.createdAt),
            }))),
          });
        },
      }
      : undefined);
  });

  logUiDependencyMemoryCheckpoint("core-features-ready");

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
    get toolStore() {
      return toolStoreFeature();
    },
    mcpService,
    mcpStore,
    get contextService() {
      return contextFeature().contextService;
    },
    get contextStore() {
      return contextFeature().contextStore;
    },
    get tuningDatasetService() {
      return tuningDatasetFeature().tuningDatasetService;
    },
    get tuningDatasetStore() {
      return tuningDatasetFeature().tuningDatasetStore;
    },
    get modelTrainingService() {
      return modelTrainingFeature().modelTrainingService;
    },
    get modelTrainingStore() {
      return modelTrainingFeature().modelTrainingStore;
    },
    get executionHistoryService() {
      return executionHistoryFeature();
    },
    get canonicalAssetManagementService() {
      return canonicalAssetFeature();
    },
    workflowConversationSessionService,
    workflowProjectionService,
    settingsStore,
  });
}

function logUiDependencyMemoryCheckpoint(checkpoint: string): void {
  const processRef = globalThis as typeof globalThis & {
    process?: {
      memoryUsage?: () => {
        rss: number;
        heapTotal: number;
        heapUsed: number;
        external: number;
        arrayBuffers?: number;
      };
    };
    performance?: {
      memory?: {
        totalJSHeapSize: number;
        usedJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    };
  };
  const memoryUsage = processRef.process?.memoryUsage?.();
  if (memoryUsage) {
    console.info(
      `[ai-loom][memory][ui-composition] checkpoint=${checkpoint} rssMB=${toMegabytes(memoryUsage.rss)} heapUsedMB=${toMegabytes(memoryUsage.heapUsed)} heapTotalMB=${toMegabytes(memoryUsage.heapTotal)} externalMB=${toMegabytes(memoryUsage.external)}`,
    );
    return;
  }
  const heapMemory = processRef.performance?.memory;
  if (heapMemory) {
    console.info(
      `[ai-loom][memory][ui-composition] checkpoint=${checkpoint} jsHeapUsedMB=${toMegabytes(heapMemory.usedJSHeapSize)} jsHeapTotalMB=${toMegabytes(heapMemory.totalJSHeapSize)} jsHeapLimitMB=${toMegabytes(heapMemory.jsHeapSizeLimit)}`,
    );
  }
}

function toMegabytes(value: number): string {
  return (value / (1024 * 1024)).toFixed(1);
}

function createLazyValue<TValue>(factory: () => TValue): () => TValue {
  let value: TValue | undefined;
  return () => {
    if (value !== undefined) {
      return value;
    }
    value = factory();
    return value;
  };
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
    const usingExplicitBrowserStorage = config.workflowRepositoryMode === "browser-storage";
    return {
      repository: new BrowserStorageWorkflowRepository(nodeCatalogProvider, browserStorage, createSeedWorkflows()),
      status: {
        configuredMode: config.workflowRepositoryMode,
        effectiveMode: usingExplicitBrowserStorage ? "browser-storage" : "browser-storage-fallback",
        isDegraded: !usingExplicitBrowserStorage,
        detail: usingExplicitBrowserStorage
          ? "Workflow persistence is aligned with the browser-hosted architecture and is using browser storage directly."
          : "Expected dev persistence is dev/ filesystem + SQLite, but the app is running in explicit browser fallback mode and is using browser storage instead.",
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

function createWorkflowExecutor(
  config: AppRuntimeConfig,
  runtimeClient: IPythonRuntimeClient,
  runtimeEnabled: boolean,
  mcpClient: IMcpRuntimeClient,
  mcpServerCatalog: IMcpServerCatalog,
  runtimeDependencyOrchestrator: Pick<IRuntimeDependencyOrchestrator, "ensureAvailable">,
) {
  const executorFactory = createLazyValue(() => {
    const executeMcpToolUseCase = new ExecuteMcpToolUseCase(mcpClient);
    return new TruthfulWorkflowExecutor({
      selector: new WorkflowRuntimeSelector({ runtimeDependencyOrchestrator }),
      strategies: [
        new PythonDelegatedWorkflowExecutionStrategy(runtimeClient),
        new InterpretedWorkflowExecutionStrategy({
          runtime: "langchain",
          nodeExecutor: new LangChainNodeExecutor({
            pythonRuntimeClient: runtimeEnabled ? runtimeClient : undefined,
            mcpRuntimeClient: runtimeEnabled ? mcpClient : undefined,
            mcpServerCatalog: runtimeEnabled ? mcpServerCatalog : undefined,
            executeMcpToolUseCase: runtimeEnabled ? executeMcpToolUseCase : undefined,
          }),
          contextResolver: new DefaultNodeExecutionContextResolver(),
          outputStoreFactory: () => new DefaultNodeOutputStore(),
        }),
      ],
    });
  });
  const executor = Object.freeze({
    startExecution: async (input: Parameters<TruthfulWorkflowExecutor["startExecution"]>[0]) => (
      await executorFactory().startExecution(input)
    ),
    execute: async (
      input: Parameters<TruthfulWorkflowExecutor["execute"]>[0],
      onEvent?: Parameters<TruthfulWorkflowExecutor["execute"]>[1],
    ) => await executorFactory().execute(input, onEvent),
    canExecute: (input: Parameters<TruthfulWorkflowExecutor["canExecute"]>[0]) => executorFactory().canExecute(input),
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



function mapPythonRuntimeStatusToDependencyState(status: PythonRuntimeManagerStatus) {
  switch (status.status) {
    case PythonRuntimeStatuses.healthy:
      return RuntimeDependencyOperationalStates.healthy;
    case PythonRuntimeStatuses.unhealthy:
      return RuntimeDependencyOperationalStates.degraded;
    case PythonRuntimeStatuses.starting:
      return RuntimeDependencyOperationalStates.starting;
    case PythonRuntimeStatuses.stopping:
      return RuntimeDependencyOperationalStates.stopped;
    case PythonRuntimeStatuses.stopped:
      return RuntimeDependencyOperationalStates.stopped;
    case PythonRuntimeStatuses.failed:
      return RuntimeDependencyOperationalStates.failed;
    case PythonRuntimeStatuses.unavailable:
    default:
      return RuntimeDependencyOperationalStates.unavailable;
  }
}

function createPythonRuntimeRemediationHints(status: PythonRuntimeManagerStatus): ReadonlyArray<string> {
  switch (status.status) {
    case PythonRuntimeStatuses.starting:
      return Object.freeze(["Wait for the managed runtime startup sequence to finish, then refresh runtime-backed capabilities."]);
    case PythonRuntimeStatuses.unhealthy:
      return Object.freeze(["Inspect the runtime console for probe failures and restart the managed runtime if health does not recover."]);
    case PythonRuntimeStatuses.failed:
      return Object.freeze(["Restart the Python runtime and review runtime console errors for the failure cause."]);
    case PythonRuntimeStatuses.stopped:
      return Object.freeze(["Start the managed runtime before using runtime-backed capabilities."]);
    case PythonRuntimeStatuses.unavailable:
      return Object.freeze(["Configure or enable a Python runtime endpoint before using runtime-backed capabilities."]);
    default:
      return Object.freeze([]);
  }
}

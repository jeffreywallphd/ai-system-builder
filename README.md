# ai-loom-studio

An AI platform to weave together AI capabilities for powerful automation workflows using no-code user interfaces.

## Project structure

Status legend: `✅ implemented (contains logic/content)` · `⚪ not implemented (blank or whitespace-only file)`

```text
ai-loom-studio
├── application
│   ├── assets
│   │   ├── tests
│   │   │   ├── AssetsContracts.test.ts ✅
│   │   │   ├── AssetsInteractions.test.ts ✅
│   │   │   ├── DeleteAssetUseCase.test.ts ✅
│   │   │   ├── ListAssetsUseCase.test.ts ✅
│   │   │   ├── LoadAssetUseCase.test.ts ✅
│   │   │   ├── SaveAssetUseCase.test.ts ✅
│   │   │   └── testUtils.ts ✅
│   │   ├── DeleteAssetUseCase.ts ✅
│   │   ├── ListAssetsUseCase.ts ✅
│   │   ├── LoadAssetUseCase.ts ✅
│   │   └── SaveAssetUseCase.ts ✅
│   ├── dto
│   │   ├── tests
│   │   │   ├── DtoContracts.test.ts ✅
│   │   │   ├── DtoInteractions.test.ts ✅
│   │   │   └── DtoUnit.test.ts ✅
│   │   ├── AssetResponse.ts ✅
│   │   ├── CreateWorkflowRequest.ts ✅
│   │   ├── ExecuteWorkflowRequest.ts ✅
│   │   ├── InstallModelRequest.ts ✅
│   │   ├── ModelResponse.ts ✅
│   │   ├── SaveWorkflowRequest.ts ✅
│   │   └── WorkflowResponse.ts ✅
│   ├── models
│   │   ├── tests
│   │   │   ├── InstallModelUseCase.test.ts ✅
│   │   │   ├── ListInstalledModelsUseCase.test.ts ✅
│   │   │   ├── ModelsContracts.test.ts ✅
│   │   │   ├── ModelsInteractions.test.ts ✅
│   │   │   ├── RemoveModelUseCase.test.ts ✅
│   │   │   ├── ResolveModelCompatibilityUseCase.test.ts ✅
│   │   │   ├── SearchRemoteModelsUseCase.test.ts ✅
│   │   │   └── testUtils.ts ✅
│   │   ├── InstallModelUseCase.ts ✅
│   │   ├── ListInstalledModelsUseCase.ts ✅
│   │   ├── RemoveModelUseCase.ts ✅
│   │   ├── ResolveModelCompatibilityUseCase.ts ✅
│   │   └── SearchRemoteModelsUseCase.ts ✅
│   ├── nodes
│   │   ├── tests
│   │   │   ├── ConnectNodesUseCase.test.ts ✅
│   │   │   ├── CreateNodeUseCase.test.ts ✅
│   │   │   ├── ListAvailableNodesUseCase.test.ts ✅
│   │   │   ├── NodesContracts.test.ts ✅
│   │   │   ├── NodesInteractions.test.ts ✅
│   │   │   ├── RemoveNodeUseCase.test.ts ✅
│   │   │   ├── testUtils.ts ✅
│   │   │   └── UpdateNodePropertyUseCase.test.ts ✅
│   │   ├── ConnectNodesUseCase.ts ✅
│   │   ├── CreateNodeUseCase.ts ✅
│   │   ├── ListAvailableNodesUseCase.ts ✅
│   │   ├── RemoveNodeUseCase.ts ✅
│   │   └── UpdateNodePropertyUseCase.ts ✅
│   ├── ports
│   │   ├── interfaces
│   │   │   ├── IAssetCatalog.ts ✅
│   │   │   ├── IEnvironmentConfigProvider.ts ✅
│   │   │   ├── IFileStorage.ts ✅
│   │   │   ├── IInstalledModelCatalog.ts ✅
│   │   │   ├── IModelDownloader.ts ✅
│   │   │   ├── IModelInstaller.ts ✅
│   │   │   ├── INodeCatalogProvider.ts ✅
│   │   │   ├── IRemoteModelCatalog.ts ✅
│   │   │   ├── IWorkflowExecutor.ts ✅
│   │   │   ├── IWorkflowRepository.ts ✅
│   │   │   └── IWorkflowSerializer.ts ✅
│   │   ├── tests
│   │   │   ├── EnvironmentConfigProvider.test.ts ✅
│   │   │   ├── FileStorage.test.ts ✅
│   │   │   ├── ModelDownloader.test.ts ✅
│   │   │   ├── ModelInstaller.test.ts ✅
│   │   │   ├── NodeCatalogProvider.test.ts ✅
│   │   │   ├── PortsContracts.test.ts ✅
│   │   │   ├── PortsInteractions.test.ts ✅
│   │   │   ├── RemoteModelCatalog.test.ts ✅
│   │   │   ├── testUtils.ts ✅
│   │   │   ├── WorkflowExecutor.test.ts ✅
│   │   │   └── WorkflowSerializer.test.ts ✅
│   │   ├── AssetCatalog.ts ✅
│   │   ├── EnvironmentConfigProvider.ts ✅
│   │   ├── FileStorage.ts ✅
│   │   ├── InstalledModelCatalog.ts ✅
│   │   ├── ModelDownloader.ts ✅
│   │   ├── ModelInstaller.ts ✅
│   │   ├── NodeCatalogProvider.ts ✅
│   │   ├── RemoteModelCatalog.ts ✅
│   │   ├── WorkflowExecutor.ts ✅
│   │   ├── WorkflowRepository.ts ✅
│   │   └── WorkflowSerializer.ts ✅
│   ├── tests
│   │   └── CrossSubfolderInteractions.test.ts ✅
│   └── workflows
│       ├── tests
│       │   ├── CreateWorkflowUseCase.test.ts ✅
│       │   ├── ExecuteWorkflowUseCase.test.ts ✅
│       │   ├── LoadWorkflowUseCase.test.ts ✅
│       │   ├── SaveWorkflowUseCase.test.ts ✅
│       │   ├── testUtils.ts ✅
│       │   ├── ValidateWorkflowUseCase.test.ts ✅
│       │   ├── WorkflowsContracts.test.ts ✅
│       │   └── WorkflowsInteractions.test.ts ✅
│       ├── CreateWorkflowUseCase.ts ✅
│       ├── ExecuteWorkflowUseCase.ts ✅
│       ├── LoadWorkflowUseCase.ts ✅
│       ├── SaveWorkflowUseCase.ts ✅
│       └── ValidateWorkflowUseCase.ts ✅
├── domain
│   ├── assets
│   │   ├── interfaces
│   │   │   └── IAsset.ts ✅
│   │   ├── tests
│   │   │   ├── Asset.test.ts ✅
│   │   │   ├── AssetContracts.test.ts ✅
│   │   │   ├── AssetInteractions.test.ts ✅
│   │   │   ├── AssetMetadata.test.ts ✅
│   │   │   └── GeneratedAsset.test.ts ✅
│   │   ├── Asset.ts ✅
│   │   ├── AssetMetadata.ts ✅
│   │   └── GeneratedAsset.ts ✅
│   ├── models
│   │   ├── interfaces
│   │   │   ├── IModel.ts ✅
│   │   │   ├── IModelCompatibility.ts ✅
│   │   │   ├── IModelDependency.ts ✅
│   │   │   └── IModelRequirement.ts ✅
│   │   ├── tests
│   │   │   ├── Model.test.ts ✅
│   │   │   ├── ModelCompatibility.test.ts ✅
│   │   │   ├── ModelContracts.test.ts ✅
│   │   │   ├── ModelDependency.test.ts ✅
│   │   │   ├── ModelFamily.test.ts ✅
│   │   │   ├── ModelInteractions.test.ts ✅
│   │   │   ├── ModelRequirement.test.ts ✅
│   │   │   └── ModelType.test.ts ✅
│   │   ├── Model.ts ✅
│   │   ├── ModelCompatibility.ts ✅
│   │   ├── ModelDependency.ts ✅
│   │   ├── ModelFamily.ts ✅
│   │   ├── ModelRequirement.ts ✅
│   │   └── ModelType.ts ✅
│   ├── nodes
│   │   ├── interfaces
│   │   │   ├── INode.ts ✅
│   │   │   ├── INodeDefinition.ts ✅
│   │   │   ├── INodePort.ts ✅
│   │   │   └── INodeProperty.ts ✅
│   │   ├── tests
│   │   │   ├── Node.test.ts ✅
│   │   │   ├── NodeCategory.test.ts ✅
│   │   │   ├── NodeCompatibilityProfile.test.ts ✅
│   │   │   ├── NodeContracts.test.ts ✅
│   │   │   ├── NodeDefinition.test.ts ✅
│   │   │   ├── NodeInteractions.test.ts ✅
│   │   │   ├── NodePort.test.ts ✅
│   │   │   └── NodeProperty.test.ts ✅
│   │   ├── Node.ts ✅
│   │   ├── NodeCategory.ts ✅
│   │   ├── NodeCompatibilityProfile.ts ✅
│   │   ├── NodeDefinition.ts ✅
│   │   ├── NodePort.ts ✅
│   │   └── NodeProperty.ts ✅
│   ├── services
│   │   ├── interfaces
│   │   │   ├── IModelCompatibilityService.ts ✅
│   │   │   ├── INodeCompatibilityService.ts ✅
│   │   │   └── IWorkflowValidator.ts ✅
│   │   ├── tests
│   │   │   ├── ConnectionValidationService.test.ts ✅
│   │   │   ├── ModelCompatibilityService.test.ts ✅
│   │   │   ├── NodeCompatibilityService.test.ts ✅
│   │   │   ├── ServiceContracts.test.ts ✅
│   │   │   ├── ServiceInteractions.test.ts ✅
│   │   │   ├── testUtils.ts ✅
│   │   │   ├── WorkflowGraphService.test.ts ✅
│   │   │   └── WorkflowValidator.test.ts ✅
│   │   ├── ConnectionValidationService.ts ✅
│   │   ├── ModelCompatibilityService.ts ✅
│   │   ├── NodeCompatibilityService.ts ✅
│   │   ├── WorkflowGraphService.ts ✅
│   │   └── WorkflowValidator.ts ✅
│   ├── tests
│   │   └── CrossSubfolderInteractions.test.ts ✅
│   └── workflows
│       ├── interfaces
│       │   ├── IWorkflow.ts ✅
│       │   ├── IWorkflowConnection.ts ✅
│       │   └── IWorkflowGraph.ts ✅
│       ├── tests
│       │   ├── testUtils.ts ✅
│       │   ├── Workflow.test.ts ✅
│       │   ├── WorkflowConnection.test.ts ✅
│       │   ├── WorkflowContracts.test.ts ✅
│       │   ├── WorkflowGraph.test.ts ✅
│       │   ├── WorkflowInteractions.test.ts ✅
│       │   └── WorkflowMetadata.test.ts ✅
│       ├── Workflow.ts ✅
│       ├── WorkflowConnection.ts ✅
│       ├── WorkflowGraph.ts ✅
│       └── WorkflowMetadata.ts ✅
├── infrastructure
│   ├── comfyui
│   │   ├── adapters
│   │   │   ├── tests
│   │   │   │   ├── AdaptersContracts.test.ts ✅
│   │   │   │   ├── AdaptersInteractions.test.ts ✅
│   │   │   │   ├── ComfyNodeAdapter.test.ts ✅
│   │   │   │   ├── ComfyPropertyAdapter.test.ts ✅
│   │   │   │   └── ComfyWorkflowAdapter.test.ts ✅
│   │   │   ├── ComfyNodeAdapter.ts ✅
│   │   │   ├── ComfyPropertyAdapter.ts ✅
│   │   │   └── ComfyWorkflowAdapter.ts ✅
│   │   ├── catalog
│   │   │   ├── tests
│   │   │   │   ├── CatalogContracts.test.ts ✅
│   │   │   │   ├── CatalogInteractions.test.ts ✅
│   │   │   │   └── ComfyNodeCatalogProvider.test.ts ✅
│   │   │   └── ComfyNodeCatalogProvider.ts ✅
│   │   ├── dto
│   │   │   ├── tests
│   │   │   │   ├── ComfyNodeDto.test.ts ✅
│   │   │   │   ├── ComfyPropertyDto.test.ts ✅
│   │   │   │   ├── ComfyWorkflowDto.test.ts ✅
│   │   │   │   └── DtoContracts.test.ts ✅
│   │   │   ├── ComfyNodeDto.ts ✅
│   │   │   ├── ComfyPropertyDto.ts ✅
│   │   │   └── ComfyWorkflowDto.ts ✅
│   │   ├── execution
│   │   │   ├── tests
│   │   │   │   ├── ComfyApiClient.test.ts ✅
│   │   │   │   ├── ComfyQueueClient.test.ts ✅
│   │   │   │   ├── ComfyWorkflowExecutor.test.ts ✅
│   │   │   │   ├── ExecutionContracts.test.ts ✅
│   │   │   │   └── ExecutionInteractions.test.ts ✅
│   │   │   ├── ComfyApiClient.ts ✅
│   │   │   ├── ComfyQueueClient.ts ✅
│   │   │   └── ComfyWorkflowExecutor.ts ✅
│   │   └── tests
│   │       └── CrossSubfolderInteractions.test.ts ✅
│   ├── composition
│   │   ├── tests
│   │   │   ├── ApplicationBootstrap.test.ts ✅
│   │   │   ├── CompositionContracts.test.ts ✅
│   │   │   ├── CompositionInteractions.test.ts ✅
│   │   │   ├── DependencyContainer.test.ts ✅
│   │   │   └── InfrastructureRegistry.test.ts ✅
│   │   ├── ApplicationBootstrap.ts ✅
│   │   ├── DependencyContainer.ts ✅
│   │   └── InfrastructureRegistry.ts ✅
│   ├── config
│   │   ├── tests
│   │   │   ├── ConfigContracts.test.ts ✅
│   │   │   ├── ConfigInteractions.test.ts ✅
│   │   │   ├── EnvironmentConfig.test.ts ✅
│   │   │   └── EnvironmentConfigProvider.test.ts ✅
│   │   ├── EnvironmentConfig.ts ✅
│   │   └── EnvironmentConfigProvider.ts ✅
│   ├── filesystem
│   │   ├── tests
│   │   │   ├── FilesystemContracts.test.ts ✅
│   │   │   ├── FilesystemInteractions.test.ts ✅
│   │   │   ├── LocalAssetRepository.test.ts ✅
│   │   │   ├── LocalFileStorage.test.ts ✅
│   │   │   ├── LocalModelRepository.test.ts ✅
│   │   │   └── LocalWorkflowRepository.test.ts ✅
│   │   ├── LocalAssetRepository.ts ✅
│   │   ├── LocalFileStorage.ts ✅
│   │   ├── LocalModelRepository.ts ✅
│   │   └── LocalWorkflowRepository.ts ✅
│   ├── huggingface
│   │   ├── tests
│   │   │   ├── HuggingFaceApiClient.test.ts ✅
│   │   │   ├── HuggingFaceContracts.test.ts ✅
│   │   │   ├── HuggingFaceInteractions.test.ts ✅
│   │   │   ├── HuggingFaceModelCatalog.test.ts ✅
│   │   │   └── HuggingFaceModelDownloader.test.ts ✅
│   │   ├── HuggingFaceApiClient.ts ✅
│   │   ├── HuggingFaceModelCatalog.ts ✅
│   │   └── HuggingFaceModelDownloader.ts ✅
│   └── tests
│       └── CrossSubfolderInteractions.test.ts ✅
├── ui
│   ├── components
│   │   ├── models
│   │   │   ├── tests
│   │   │   │   ├── ModelsContracts.test.ts ✅
│   │   │   │   ├── ModelsInteractions.test.ts ✅
│   │   │   │   └── ModelsUnit.test.ts ✅
│   │   │   ├── ModelBrowser.tsx ⚪
│   │   │   └── ModelInstaller.tsx ⚪
│   │   ├── nodes
│   │   │   ├── tests
│   │   │   │   ├── NodesContracts.test.ts ✅
│   │   │   │   ├── NodesInteractions.test.ts ✅
│   │   │   │   └── NodesUnit.test.ts ✅
│   │   │   ├── NodeComponent.tsx ⚪
│   │   │   ├── NodePortView.tsx ⚪
│   │   │   └── NodePropertyEditor.tsx ⚪
│   │   ├── tests
│   │   │   └── CrossSubfolderInteractions.test.ts ✅
│   │   └── workflow
│   │       ├── tests
│   │       │   ├── WorkflowContracts.test.ts ✅
│   │       │   ├── WorkflowInteractions.test.ts ✅
│   │       │   └── WorkflowUnit.test.ts ✅
│   │       ├── WorkflowCanvas.tsx ⚪
│   │       ├── WorkflowInspector.tsx ⚪
│   │       └── WorkflowToolbar.tsx ⚪
│   ├── pages
│   │   ├── tests
│   │   │   ├── PagesContracts.test.ts ✅
│   │   │   ├── PagesInteractions.test.ts ✅
│   │   │   └── PagesUnit.test.ts ✅
│   │   ├── AssetsPage.tsx ⚪
│   │   ├── ModelsPage.tsx ⚪
│   │   └── WorkflowEditorPage.tsx ⚪
│   ├── presenters
│   │   ├── tests
│   │   │   ├── PresentersContracts.test.ts ✅
│   │   │   ├── PresentersInteractions.test.ts ✅
│   │   │   └── PresentersUnit.test.ts ✅
│   │   ├── AssetPresenter.ts ✅
│   │   ├── ModelPresenter.ts ✅
│   │   ├── NodePresenter.ts ✅
│   │   ├── PresenterFormatting.ts ✅
│   │   ├── ValidationPresenter.ts ✅
│   │   └── WorkflowPresenter.ts ✅
│   ├── routes
│   │   ├── tests
│   │   │   ├── RoutesContracts.test.ts ✅
│   │   │   ├── RoutesInteractions.test.ts ✅
│   │   │   └── RoutesUnit.test.ts ✅
│   │   ├── AppRouter.tsx ⚪
│   │   ├── ProtectedRoute.tsx ⚪
│   │   └── RouteConfig.ts ⚪
│   ├── services
│   │   ├── tests
│   │   │   ├── ServicesContracts.test.ts ✅
│   │   │   ├── ServicesInteractions.test.ts ✅
│   │   │   └── ServicesUnit.test.ts ✅
│   │   ├── ModelService.ts ✅
│   │   ├── NodeService.ts ✅
│   │   └── WorkflowService.ts ✅
│   ├── state
│   │   ├── tests
│   │   │   ├── StateContracts.test.ts ✅
│   │   │   ├── StateInteractions.test.ts ✅
│   │   │   └── StateUnit.test.ts ✅
│   │   ├── ModelStore.ts ✅
│   │   ├── NodeStore.ts ✅
│   │   └── WorkflowStore.ts ✅
│   └── tests
│       ├── CrossSubfolderInteractions.test.ts ✅
│       └── testUtils.ts ✅
└── README.md ✅
```

Implementation status is based on file content:

- `✅ implemented`: file contains non-whitespace content.
- `⚪ not implemented`: file is blank or whitespace-only.


All discovered test files in the repository are currently marked as `✅ implemented`.

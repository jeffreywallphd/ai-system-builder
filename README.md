# ai-loom-studio

An AI platform to weave together AI capabilities for powerful automation workflows using no-code user interfaces.

## Project structure

```text
ai-loom-studio
├── .gitignore (implemented)
├── README.md (implemented)
├── application
│   ├── assets
│   │   ├── DeleteAssetUseCase.ts (not yet implemented)
│   │   ├── ListAssetsUseCase.ts (not yet implemented)
│   │   ├── LoadAssetUseCase.ts (not yet implemented)
│   │   └── SaveAssetUseCase.ts (not yet implemented)
│   ├── dto
│   │   ├── AssetResponse.ts (not yet implemented)
│   │   ├── CreateWorkflowRequest.ts (not yet implemented)
│   │   ├── ExecuteWorkflowRequest.ts (not yet implemented)
│   │   ├── InstallModelRequest.ts (not yet implemented)
│   │   ├── ModelResponse.ts (not yet implemented)
│   │   ├── SaveWorkflowRequest.ts (not yet implemented)
│   │   └── WorkflowResponse.ts (not yet implemented)
│   ├── models
│   │   ├── InstallModelUseCase.ts (not yet implemented)
│   │   ├── ListInstalledModelsUseCase.ts (not yet implemented)
│   │   ├── RemoveModelUseCase.ts (not yet implemented)
│   │   ├── ResolveModelCompatibilityUseCase.ts (not yet implemented)
│   │   └── SearchRemoteModelsUseCase.ts (not yet implemented)
│   ├── nodes
│   │   ├── ConnectNodesUseCase.ts (implemented)
│   │   ├── CreateNodeUseCase.ts (implemented)
│   │   ├── ListAvailableNodesUseCase.ts (implemented)
│   │   ├── RemoveNodeUseCase.ts (implemented)
│   │   └── UpdateNodePropertyUseCase.ts (implemented)
│   ├── ports
│   │   ├── EnvironmentConfigProvider.ts (implemented)
│   │   ├── FileStorage.ts (implemented)
│   │   ├── ModelDownloader.ts (implemented)
│   │   ├── ModelInstaller.ts (implemented)
│   │   ├── NodeCatalogProvider.ts (implemented)
│   │   ├── RemoteModelCatalog.ts (implemented)
│   │   ├── WorkflowExecutor.ts (implemented)
│   │   ├── WorkflowRepository.ts (implemented)
│   │   ├── WorkflowSerializer.ts (implemented)
│   │   ├── interfaces
│   │   │   ├── IEnvironmentConfigProvider.ts (implemented)
│   │   │   ├── IFileStorage.ts (implemented)
│   │   │   ├── IModelDownloader.ts (implemented)
│   │   │   ├── IModelInstaller.ts (implemented)
│   │   │   ├── INodeCatalogProvider.ts (implemented)
│   │   │   ├── IRemoteModelCatalog.ts (implemented)
│   │   │   ├── IWorkflowExecutor.ts (implemented)
│   │   │   ├── IWorkflowRepository.ts (implemented)
│   │   │   └── IWorkflowSerializer.ts (implemented)
│   │   └── tests
│   │       ├── EnvironmentConfigProvider.test.ts (implemented)
│   │       ├── FileStorage.test.ts (implemented)
│   │       ├── ModelDownloader.test.ts (implemented)
│   │       ├── ModelInstaller.test.ts (implemented)
│   │       ├── NodeCatalogProvider.test.ts (implemented)
│   │       ├── PortsContracts.test.ts (implemented)
│   │       ├── PortsInteractions.test.ts (implemented)
│   │       ├── RemoteModelCatalog.test.ts (implemented)
│   │       ├── WorkflowExecutor.test.ts (implemented)
│   │       ├── WorkflowSerializer.test.ts (implemented)
│   │       └── testUtils.ts (implemented)
│   └── workflows
│       ├── CreateWorkflowUseCase.ts (implemented)
│       ├── ExecuteWorkflowUseCase.ts (not yet implemented)
│       ├── LoadWorkflowUseCase.ts (implemented)
│       ├── SaveWorkflowUseCase.ts (implemented)
│       └── ValidateWorkflowUseCase.ts (implemented)
├── domain
│   ├── assets
│   │   ├── Asset.ts (implemented)
│   │   ├── AssetMetadata.ts (implemented)
│   │   ├── GeneratedAsset.ts (implemented)
│   │   ├── interfaces
│   │   │   └── IAsset.ts (implemented)
│   │   └── tests
│   │       ├── Asset.test.ts (implemented)
│   │       ├── AssetContracts.test.ts (implemented)
│   │       ├── AssetInteractions.test.ts (implemented)
│   │       ├── AssetMetadata.test.ts (implemented)
│   │       └── GeneratedAsset.test.ts (implemented)
│   ├── models
│   │   ├── Model.ts (implemented)
│   │   ├── ModelCompatibility.ts (implemented)
│   │   ├── ModelDependency.ts (implemented)
│   │   ├── ModelFamily.ts (implemented)
│   │   ├── ModelRequirement.ts (implemented)
│   │   ├── ModelType.ts (implemented)
│   │   ├── interfaces
│   │   │   ├── IModel.ts (implemented)
│   │   │   ├── IModelCompatibility.ts (implemented)
│   │   │   ├── IModelDependency.ts (implemented)
│   │   │   └── IModelRequirement.ts (implemented)
│   │   └── tests
│   │       ├── Model.test.ts (implemented)
│   │       ├── ModelCompatibility.test.ts (implemented)
│   │       ├── ModelContracts.test.ts (implemented)
│   │       ├── ModelDependency.test.ts (implemented)
│   │       ├── ModelFamily.test.ts (implemented)
│   │       ├── ModelInteractions.test.ts (implemented)
│   │       ├── ModelRequirement.test.ts (implemented)
│   │       └── ModelType.test.ts (implemented)
│   ├── nodes
│   │   ├── Node.ts (implemented)
│   │   ├── NodeCategory.ts (implemented)
│   │   ├── NodeCompatibilityProfile.ts (implemented)
│   │   ├── NodeDefinition.ts (implemented)
│   │   ├── NodePort.ts (implemented)
│   │   ├── NodeProperty.ts (implemented)
│   │   ├── interfaces
│   │   │   ├── INode.ts (implemented)
│   │   │   ├── INodeDefinition.ts (implemented)
│   │   │   ├── INodePort.ts (implemented)
│   │   │   └── INodeProperty.ts (implemented)
│   │   └── tests
│   │       ├── Node.test.ts (implemented)
│   │       ├── NodeCategory.test.ts (implemented)
│   │       ├── NodeCompatibilityProfile.test.ts (implemented)
│   │       ├── NodeContracts.test.ts (implemented)
│   │       ├── NodeDefinition.test.ts (implemented)
│   │       ├── NodePort.test.ts (implemented)
│   │       └── NodeProperty.test.ts (implemented)
│   ├── services
│   │   ├── ConnectionValidationService.ts (implemented)
│   │   ├── ModelCompatibilityService.ts (implemented)
│   │   ├── NodeCompatibilityService.ts (implemented)
│   │   ├── WorkflowGraphService.ts (implemented)
│   │   ├── WorkflowValidator.ts (implemented)
│   │   ├── interfaces
│   │   │   ├── IModelCompatibilityService.ts (implemented)
│   │   │   ├── INodeCompatibilityService.ts (implemented)
│   │   │   └── IWorkflowValidator.ts (implemented)
│   │   └── tests
│   │       ├── ConnectionValidationService.test.ts (implemented)
│   │       ├── ModelCompatibilityService.test.ts (implemented)
│   │       ├── NodeCompatibilityService.test.ts (implemented)
│   │       ├── ServiceContracts.test.ts (implemented)
│   │       ├── ServiceInteractions.test.ts (implemented)
│   │       ├── WorkflowGraphService.test.ts (implemented)
│   │       ├── WorkflowValidator.test.ts (implemented)
│   │       └── testUtils.ts (implemented)
│   └── workflows
│       ├── Workflow.ts (implemented)
│       ├── WorkflowConnection.ts (implemented)
│       ├── WorkflowGraph.ts (implemented)
│       ├── WorkflowMetadata.ts (implemented)
│       ├── interfaces
│       │   ├── IWorkflow.ts (implemented)
│       │   ├── IWorkflowConnection.ts (implemented)
│       │   └── IWorkflowGraph.ts (implemented)
│       └── tests
│           ├── Workflow.test.ts (implemented)
│           ├── WorkflowConnection.test.ts (implemented)
│           ├── WorkflowContracts.test.ts (implemented)
│           ├── WorkflowGraph.test.ts (implemented)
│           ├── WorkflowInteractions.test.ts (implemented)
│           ├── WorkflowMetadata.test.ts (implemented)
│           └── testUtils.ts (implemented)
├── infrastructure
│   ├── comfyui
│   │   ├── adapters
│   │   │   ├── ComfyNodeAdapter.ts (not yet implemented)
│   │   │   ├── ComfyPropertyAdapter.ts (not yet implemented)
│   │   │   └── ComfyWorkflowAdapter.ts (not yet implemented)
│   │   ├── catalog
│   │   │   └── ComfyNodeCatalogProvider.ts (not yet implemented)
│   │   ├── dto
│   │   │   ├── ComfyNodeDto.ts (not yet implemented)
│   │   │   ├── ComfyPropertyDto.ts (not yet implemented)
│   │   │   └── ComfyWorkflowDto.ts (not yet implemented)
│   │   └── execution
│   │       ├── ComfyApiClient.ts (not yet implemented)
│   │       ├── ComfyQueueClient.ts (not yet implemented)
│   │       └── ComfyWorkflowExecutor.ts (not yet implemented)
│   ├── composition
│   │   ├── ApplicationBootstrap.ts (not yet implemented)
│   │   ├── DependencyContainer.ts (not yet implemented)
│   │   └── InfrastructureRegistry.ts (not yet implemented)
│   ├── config
│   │   ├── EnvironmentConfig.ts (not yet implemented)
│   │   └── EnvironmentConfigProvider.ts (not yet implemented)
│   ├── filesystem
│   │   ├── LocalAssetRepository.ts (not yet implemented)
│   │   ├── LocalFileStorage.ts (not yet implemented)
│   │   ├── LocalModelRepository.ts (not yet implemented)
│   │   └── LocalWorkflowRepository.ts (not yet implemented)
│   └── huggingface
│       ├── HuggingFaceApiClient.ts (not yet implemented)
│       ├── HuggingFaceModelCatalog.ts (not yet implemented)
│       └── HuggingFaceModelDownloader.ts (not yet implemented)
└── ui
    ├── components
    │   ├── models
    │   │   ├── ModelBrowser.tsx (not yet implemented)
    │   │   └── ModelInstaller.tsx (not yet implemented)
    │   ├── nodes
    │   │   ├── NodeComponent.tsx (not yet implemented)
    │   │   ├── NodePortView.tsx (not yet implemented)
    │   │   └── NodePropertyEditor.tsx (not yet implemented)
    │   └── workflow
    │       ├── WorkflowCanvas.tsx (not yet implemented)
    │       ├── WorkflowInspector.tsx (not yet implemented)
    │       └── WorkflowToolbar.tsx (not yet implemented)
    ├── pages
    │   ├── AssetsPage.tsx (not yet implemented)
    │   ├── ModelsPage.tsx (not yet implemented)
    │   └── WorkflowEditorPage.tsx (not yet implemented)
    ├── presenters
    │   ├── AssetPresenter.ts (not yet implemented)
    │   ├── ModelPresenter.ts (not yet implemented)
    │   └── WorkflowPresenter.ts (not yet implemented)
    ├── routes
    │   ├── AppRouter.tsx (not yet implemented)
    │   ├── ProtectedRoute.tsx (not yet implemented)
    │   └── RouteConfig.ts (not yet implemented)
    ├── services
    │   ├── ModelService.ts (not yet implemented)
    │   ├── NodeService.ts (not yet implemented)
    │   └── WorkflowService.ts (not yet implemented)
    └── state
        ├── ModelStore.ts (not yet implemented)
        ├── NodeStore.ts (not yet implemented)
        └── WorkflowStore.ts (not yet implemented)
```

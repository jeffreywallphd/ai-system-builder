# ai-loom-studio

An AI platform to weave together AI capabilities for powerful automation workflows using no-code user interfaces.

## Project structure

```text
ai-loom-studio
├── .gitignore
├── README.md
├── application
│   ├── assets
│   │   ├── DeleteAssetUseCase.ts
│   │   ├── ListAssetsUseCase.ts
│   │   ├── LoadAssetUseCase.ts
│   │   └── SaveAssetUseCase.ts
│   ├── dto
│   │   ├── AssetResponse.ts
│   │   ├── CreateWorkflowRequest.ts
│   │   ├── ExecuteWorkflowRequest.ts
│   │   ├── InstallModelRequest.ts
│   │   ├── ModelResponse.ts
│   │   ├── SaveWorkflowRequest.ts
│   │   └── WorkflowResponse.ts
│   ├── models
│   │   ├── InstallModelUseCase.ts
│   │   ├── ListInstalledModelsUseCase.ts
│   │   ├── RemoveModelUseCase.ts
│   │   ├── ResolveModelCompatibilityUseCase.ts
│   │   └── SearchRemoteModelsUseCase.ts
│   ├── nodes
│   │   ├── ConnectNodesUseCase.ts
│   │   ├── CreateNodeUseCase.ts
│   │   ├── ListAvailableNodesUseCase.ts
│   │   ├── RemoveNodeUseCase.ts
│   │   └── UpdateNodePropertyUseCase.ts
│   ├── ports
│   │   ├── interfaces
│   │   │   ├── IEnvironmentConfigProvider.ts
│   │   │   ├── IFileStorage.ts
│   │   │   ├── IInstalledModelCatalog.ts
│   │   │   ├── IModelDownloader.ts
│   │   │   ├── IModelInstaller.ts
│   │   │   ├── INodeCatalogProvider.ts
│   │   │   ├── IRemoteModelCatalog.ts
│   │   │   ├── IWorkflowExecutor.ts
│   │   │   ├── IWorkflowRepository.ts
│   │   │   └── IWorkflowSerializer.ts
│   │   ├── tests
│   │   │   ├── EnvironmentConfigProvider.test.ts
│   │   │   ├── FileStorage.test.ts
│   │   │   ├── ModelDownloader.test.ts
│   │   │   ├── ModelInstaller.test.ts
│   │   │   ├── NodeCatalogProvider.test.ts
│   │   │   ├── PortsContracts.test.ts
│   │   │   ├── PortsInteractions.test.ts
│   │   │   ├── RemoteModelCatalog.test.ts
│   │   │   ├── WorkflowExecutor.test.ts
│   │   │   ├── WorkflowSerializer.test.ts
│   │   │   └── testUtils.ts
│   │   ├── EnvironmentConfigProvider.ts
│   │   ├── FileStorage.ts
│   │   ├── InstalledModelCatalog.ts
│   │   ├── ModelDownloader.ts
│   │   ├── ModelInstaller.ts
│   │   ├── NodeCatalogProvider.ts
│   │   ├── RemoteModelCatalog.ts
│   │   ├── WorkflowExecutor.ts
│   │   ├── WorkflowRepository.ts
│   │   └── WorkflowSerializer.ts
│   └── workflows
│       ├── CreateWorkflowUseCase.ts
│       ├── ExecuteWorkflowUseCase.ts
│       ├── LoadWorkflowUseCase.ts
│       ├── SaveWorkflowUseCase.ts
│       └── ValidateWorkflowUseCase.ts
├── domain
│   ├── assets
│   │   ├── interfaces
│   │   │   └── IAsset.ts
│   │   ├── tests
│   │   │   ├── Asset.test.ts
│   │   │   ├── AssetContracts.test.ts
│   │   │   ├── AssetInteractions.test.ts
│   │   │   ├── AssetMetadata.test.ts
│   │   │   └── GeneratedAsset.test.ts
│   │   ├── Asset.ts
│   │   ├── AssetMetadata.ts
│   │   └── GeneratedAsset.ts
│   ├── models
│   │   ├── interfaces
│   │   │   ├── IModel.ts
│   │   │   ├── IModelCompatibility.ts
│   │   │   ├── IModelDependency.ts
│   │   │   └── IModelRequirement.ts
│   │   ├── tests
│   │   │   ├── Model.test.ts
│   │   │   ├── ModelCompatibility.test.ts
│   │   │   ├── ModelContracts.test.ts
│   │   │   ├── ModelDependency.test.ts
│   │   │   ├── ModelFamily.test.ts
│   │   │   ├── ModelInteractions.test.ts
│   │   │   ├── ModelRequirement.test.ts
│   │   │   └── ModelType.test.ts
│   │   ├── Model.ts
│   │   ├── ModelCompatibility.ts
│   │   ├── ModelDependency.ts
│   │   ├── ModelFamily.ts
│   │   ├── ModelRequirement.ts
│   │   └── ModelType.ts
│   ├── nodes
│   │   ├── interfaces
│   │   │   ├── INode.ts
│   │   │   ├── INodeDefinition.ts
│   │   │   ├── INodePort.ts
│   │   │   └── INodeProperty.ts
│   │   ├── tests
│   │   │   ├── Node.test.ts
│   │   │   ├── NodeCategory.test.ts
│   │   │   ├── NodeCompatibilityProfile.test.ts
│   │   │   ├── NodeContracts.test.ts
│   │   │   ├── NodeDefinition.test.ts
│   │   │   ├── NodePort.test.ts
│   │   │   └── NodeProperty.test.ts
│   │   ├── Node.ts
│   │   ├── NodeCategory.ts
│   │   ├── NodeCompatibilityProfile.ts
│   │   ├── NodeDefinition.ts
│   │   ├── NodePort.ts
│   │   └── NodeProperty.ts
│   ├── services
│   │   ├── interfaces
│   │   │   ├── IModelCompatibilityService.ts
│   │   │   ├── INodeCompatibilityService.ts
│   │   │   └── IWorkflowValidator.ts
│   │   ├── tests
│   │   │   ├── ConnectionValidationService.test.ts
│   │   │   ├── ModelCompatibilityService.test.ts
│   │   │   ├── NodeCompatibilityService.test.ts
│   │   │   ├── ServiceContracts.test.ts
│   │   │   ├── ServiceInteractions.test.ts
│   │   │   ├── WorkflowGraphService.test.ts
│   │   │   ├── WorkflowValidator.test.ts
│   │   │   └── testUtils.ts
│   │   ├── ConnectionValidationService.ts
│   │   ├── ModelCompatibilityService.ts
│   │   ├── NodeCompatibilityService.ts
│   │   ├── WorkflowGraphService.ts
│   │   └── WorkflowValidator.ts
│   └── workflows
│       ├── interfaces
│       │   ├── IWorkflow.ts
│       │   ├── IWorkflowConnection.ts
│       │   └── IWorkflowGraph.ts
│       ├── tests
│       │   ├── Workflow.test.ts
│       │   ├── WorkflowConnection.test.ts
│       │   ├── WorkflowContracts.test.ts
│       │   ├── WorkflowGraph.test.ts
│       │   ├── WorkflowInteractions.test.ts
│       │   ├── WorkflowMetadata.test.ts
│       │   └── testUtils.ts
│       ├── Workflow.ts
│       ├── WorkflowConnection.ts
│       ├── WorkflowGraph.ts
│       └── WorkflowMetadata.ts
├── infrastructure
│   ├── comfyui
│   │   ├── adapters
│   │   │   ├── ComfyNodeAdapter.ts
│   │   │   ├── ComfyPropertyAdapter.ts
│   │   │   └── ComfyWorkflowAdapter.ts
│   │   ├── catalog
│   │   │   └── ComfyNodeCatalogProvider.ts
│   │   ├── dto
│   │   │   ├── ComfyNodeDto.ts
│   │   │   ├── ComfyPropertyDto.ts
│   │   │   └── ComfyWorkflowDto.ts
│   │   └── execution
│   │       ├── ComfyApiClient.ts
│   │       ├── ComfyQueueClient.ts
│   │       └── ComfyWorkflowExecutor.ts
│   ├── composition
│   │   ├── ApplicationBootstrap.ts
│   │   ├── DependencyContainer.ts
│   │   └── InfrastructureRegistry.ts
│   ├── config
│   │   ├── EnvironmentConfig.ts
│   │   └── EnvironmentConfigProvider.ts
│   ├── filesystem
│   │   ├── LocalAssetRepository.ts
│   │   ├── LocalFileStorage.ts
│   │   ├── LocalModelRepository.ts
│   │   └── LocalWorkflowRepository.ts
│   └── huggingface
│       ├── HuggingFaceApiClient.ts
│       ├── HuggingFaceModelCatalog.ts
│       └── HuggingFaceModelDownloader.ts
└── ui
    ├── components
    │   ├── models
    │   │   ├── ModelBrowser.tsx
    │   │   └── ModelInstaller.tsx
    │   ├── nodes
    │   │   ├── NodeComponent.tsx
    │   │   ├── NodePortView.tsx
    │   │   └── NodePropertyEditor.tsx
    │   └── workflow
    │       ├── WorkflowCanvas.tsx
    │       ├── WorkflowInspector.tsx
    │       └── WorkflowToolbar.tsx
    ├── pages
    │   ├── AssetsPage.tsx
    │   ├── ModelsPage.tsx
    │   └── WorkflowEditorPage.tsx
    ├── presenters
    │   ├── AssetPresenter.ts
    │   ├── ModelPresenter.ts
    │   └── WorkflowPresenter.ts
    ├── routes
    │   ├── AppRouter.tsx
    │   ├── ProtectedRoute.tsx
    │   └── RouteConfig.ts
    ├── services
    │   ├── ModelService.ts
    │   ├── NodeService.ts
    │   └── WorkflowService.ts
    └── state
        ├── ModelStore.ts
        ├── NodeStore.ts
        └── WorkflowStore.ts
```

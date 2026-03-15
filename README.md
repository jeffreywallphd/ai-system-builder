# ai-loom-studio

An AI platform to weave together AI capabilities for powerful automation workflows using no-code user interfaces.

## Project structure

```text
ai-loom-studio
│
├── domain
│   │
│   ├── models
│   │   ├── interfaces
│   │   │   ├── IModel.ts
│   │   │   ├── IModelCompatibility.ts
│   │   │   ├── IModelRequirement.ts
│   │   │   └── IModelDependency.ts
│   │   │
│   │   ├── Model.ts
│   │   ├── ModelCompatibility.ts
│   │   ├── ModelRequirement.ts
│   │   ├── ModelDependency.ts
│   │   ├── ModelFamily.ts
│   │   └── ModelType.ts
│   │
│   ├── nodes
│   │   ├── interfaces
│   │   │   ├── INode.ts
│   │   │   ├── INodeDefinition.ts
│   │   │   ├── INodePort.ts
│   │   │   └── INodeProperty.ts
│   │   │
│   │   ├── Node.ts
│   │   ├── NodeDefinition.ts
│   │   ├── NodePort.ts
│   │   ├── NodeProperty.ts
│   │   ├── NodeCategory.ts
│   │   └── NodeCompatibilityProfile.ts
│   │
│   ├── workflows
│   │   ├── interfaces
│   │   │   ├── IWorkflow.ts
│   │   │   └── IWorkflowConnection.ts
│   │   │
│   │   ├── Workflow.ts
│   │   ├── WorkflowConnection.ts
│   │   ├── WorkflowGraph.ts
│   │   └── WorkflowMetadata.ts
│   │
│   ├── assets
│   │   ├── interfaces
│   │   │   └── IAsset.ts
│   │   │
│   │   ├── Asset.ts
│   │   ├── GeneratedAsset.ts
│   │   └── AssetMetadata.ts
│   │
│   └── services
│       ├── interfaces
│       │   ├── IWorkflowValidator.ts
│       │   ├── INodeCompatibilityService.ts
│       │   └── IModelCompatibilityService.ts
│       │
│       ├── WorkflowValidator.ts
│       ├── NodeCompatibilityService.ts
│       ├── ModelCompatibilityService.ts
│       ├── ConnectionValidationService.ts
│       └── WorkflowGraphService.ts
│
├── application
│   │
│   ├── workflows
│   │   ├── CreateWorkflowUseCase.ts
│   │   ├── SaveWorkflowUseCase.ts
│   │   ├── LoadWorkflowUseCase.ts
│   │   ├── ExecuteWorkflowUseCase.ts
│   │   └── ValidateWorkflowUseCase.ts
│   │
│   ├── nodes
│   │   ├── CreateNodeUseCase.ts
│   │   ├── UpdateNodePropertyUseCase.ts
│   │   ├── ConnectNodesUseCase.ts
│   │   ├── RemoveNodeUseCase.ts
│   │   └── ListAvailableNodesUseCase.ts
│   │
│   ├── models
│   │   ├── InstallModelUseCase.ts
│   │   ├── ListInstalledModelsUseCase.ts
│   │   ├── ResolveModelCompatibilityUseCase.ts
│   │   ├── RemoveModelUseCase.ts
│   │   └── SearchRemoteModelsUseCase.ts
│   │
│   ├── assets
│   │   ├── SaveAssetUseCase.ts
│   │   ├── LoadAssetUseCase.ts
│   │   ├── DeleteAssetUseCase.ts
│   │   └── ListAssetsUseCase.ts
│   │
│   ├── ports
│   │   ├── interfaces
│   │   │   ├── IModelDownloader.ts
│   │   │   ├── IRemoteModelCatalog.ts
│   │   │   ├── IWorkflowExecutor.ts
│   │   │   ├── IWorkflowSerializer.ts
│   │   │   ├── IFileStorage.ts
│   │   │   ├── INodeCatalogProvider.ts
│   │   │   ├── IModelInstaller.ts
│   │   │   └── IEnvironmentConfigProvider.ts
│   │   │
│   │   ├── ModelDownloader.ts
│   │   ├── RemoteModelCatalog.ts
│   │   ├── WorkflowExecutor.ts
│   │   ├── WorkflowSerializer.ts
│   │   ├── FileStorage.ts
│   │   ├── NodeCatalogProvider.ts
│   │   ├── ModelInstaller.ts
│   │   └── EnvironmentConfigProvider.ts
│   │
│   └── dto
│       ├── CreateWorkflowRequest.ts
│       ├── SaveWorkflowRequest.ts
│       ├── ExecuteWorkflowRequest.ts
│       ├── InstallModelRequest.ts
│       ├── AssetResponse.ts
│       ├── WorkflowResponse.ts
│       └── ModelResponse.ts
│
├── infrastructure
│   │
│   ├── comfyui
│   │   ├── adapters
│   │   │   ├── ComfyWorkflowAdapter.ts
│   │   │   ├── ComfyNodeAdapter.ts
│   │   │   └── ComfyPropertyAdapter.ts
│   │   │
│   │   ├── execution
│   │   │   ├── ComfyQueueClient.ts
│   │   │   ├── ComfyApiClient.ts
│   │   │   └── ComfyWorkflowExecutor.ts
│   │   │
│   │   ├── catalog
│   │   │   └── ComfyNodeCatalogProvider.ts
│   │   │
│   │   └── dto
│   │       ├── ComfyWorkflowDto.ts
│   │       ├── ComfyNodeDto.ts
│   │       └── ComfyPropertyDto.ts
│   │
│   ├── huggingface
│   │   ├── HuggingFaceApiClient.ts
│   │   ├── HuggingFaceModelDownloader.ts
│   │   └── HuggingFaceModelCatalog.ts
│   │
│   ├── filesystem
│   │   ├── LocalFileStorage.ts
│   │   ├── LocalWorkflowRepository.ts
│   │   ├── LocalAssetRepository.ts
│   │   └── LocalModelRepository.ts
│   │
│   ├── config
│   │   ├── EnvironmentConfig.ts
│   │   └── EnvironmentConfigProvider.ts
│   │
│   └── composition
│       ├── DependencyContainer.ts
│       ├── ApplicationBootstrap.ts
│       └── InfrastructureRegistry.ts
│
└── ui
    │
    ├── components
    │   ├── nodes
    │   │   ├── NodeComponent.tsx
    │   │   ├── NodePropertyEditor.tsx
    │   │   └── NodePortView.tsx
    │   │
    │   ├── workflow
    │   │   ├── WorkflowCanvas.tsx
    │   │   ├── WorkflowToolbar.tsx
    │   │   └── WorkflowInspector.tsx
    │   │
    │   └── models
    │       ├── ModelBrowser.tsx
    │       └── ModelInstaller.tsx
    │
    ├── pages
    │   ├── WorkflowEditorPage.tsx
    │   ├── AssetsPage.tsx
    │   └── ModelsPage.tsx
    │
    ├── state
    │   ├── WorkflowStore.ts
    │   ├── NodeStore.ts
    │   └── ModelStore.ts
    │
    ├── services
    │   ├── WorkflowService.ts
    │   ├── NodeService.ts
    │   └── ModelService.ts
    │
    ├── presenters
    │   ├── WorkflowPresenter.ts
    │   ├── ModelPresenter.ts
    │   └── AssetPresenter.ts
    │
    └── routes
        ├── AppRouter.tsx
        ├── ProtectedRoute.tsx
        └── RouteConfig.ts
```

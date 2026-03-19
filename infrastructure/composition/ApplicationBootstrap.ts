import { DependencyContainer } from "./DependencyContainer";
import { InfrastructureRegistry, TOKENS, type IInfrastructureRegistryOptions } from "./InfrastructureRegistry";

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

import { SaveAssetUseCase } from "../../application/assets/SaveAssetUseCase";
import { LoadAssetUseCase } from "../../application/assets/LoadAssetUseCase";
import { ListAssetsUseCase } from "../../application/assets/ListAssetsUseCase";
import { DeleteAssetUseCase } from "../../application/assets/DeleteAssetUseCase";
import { ListMcpToolsUseCase } from "../../application/mcp/ListMcpToolsUseCase";
import { ExecuteMcpToolUseCase } from "../../application/mcp/ExecuteMcpToolUseCase";
import { ListToolCapabilitiesUseCase } from "../../application/tools/ListToolCapabilitiesUseCase";
import { InvokeToolCapabilityUseCase } from "../../application/tools/InvokeToolCapabilityUseCase";

import type { INodeCatalogProvider } from "../../application/ports/interfaces/INodeCatalogProvider";
import type { IWorkflowExecutor } from "../../application/ports/interfaces/IWorkflowExecutor";
import type { IWorkflowSerializer } from "../../application/ports/interfaces/IWorkflowSerializer";
import type { IAssetCatalog } from "../../application/ports/interfaces/IAssetCatalog";
import type { IInstalledModelCatalog } from "../../application/ports/interfaces/IInstalledModelCatalog";
import type { IRemoteModelCatalog } from "../../application/ports/interfaces/IRemoteModelCatalog";
import type { IModelInstaller } from "../../application/ports/interfaces/IModelInstaller";
import type { IFileStorage } from "../../application/ports/interfaces/IFileStorage";
import type { IMcpToolCatalog } from "../../application/ports/interfaces/IMcpToolCatalog";
import type { IMcpToolExecutor } from "../../application/ports/interfaces/IMcpToolExecutor";
import type { IToolCapabilityCatalog } from "../../application/ports/interfaces/IToolCapabilityCatalog";
import type { IToolCapabilityExecutor } from "../../application/ports/interfaces/IToolCapabilityExecutor";
import type { IWorkflowValidator } from "../../domain/services/interfaces/IWorkflowValidator";
import type { INodeCompatibilityService } from "../../domain/services/interfaces/INodeCompatibilityService";
import type { IModelCompatibilityService } from "../../domain/services/interfaces/IModelCompatibilityService";

export const APPLICATION_TOKENS = Object.freeze({
  ModelCompatibilityService: Symbol("ModelCompatibilityService"),
  NodeCompatibilityService: Symbol("NodeCompatibilityService"),
  WorkflowValidator: Symbol("WorkflowValidator"),

  CreateWorkflowUseCase: Symbol("CreateWorkflowUseCase"),
  ExecuteWorkflowUseCase: Symbol("ExecuteWorkflowUseCase"),
  ValidateWorkflowUseCase: Symbol("ValidateWorkflowUseCase"),

  CreateNodeUseCase: Symbol("CreateNodeUseCase"),
  ConnectNodesUseCase: Symbol("ConnectNodesUseCase"),
  ListAvailableNodesUseCase: Symbol("ListAvailableNodesUseCase"),

  InstallModelUseCase: Symbol("InstallModelUseCase"),
  ListInstalledModelsUseCase: Symbol("ListInstalledModelsUseCase"),
  RemoveModelUseCase: Symbol("RemoveModelUseCase"),
  ResolveModelCompatibilityUseCase: Symbol("ResolveModelCompatibilityUseCase"),
  SearchRemoteModelsUseCase: Symbol("SearchRemoteModelsUseCase"),

  SaveAssetUseCase: Symbol("SaveAssetUseCase"),
  LoadAssetUseCase: Symbol("LoadAssetUseCase"),
  ListAssetsUseCase: Symbol("ListAssetsUseCase"),
  DeleteAssetUseCase: Symbol("DeleteAssetUseCase"),

  ListMcpToolsUseCase: Symbol("ListMcpToolsUseCase"),
  ExecuteMcpToolUseCase: Symbol("ExecuteMcpToolUseCase"),
  ListToolCapabilitiesUseCase: Symbol("ListToolCapabilitiesUseCase"),
  InvokeToolCapabilityUseCase: Symbol("InvokeToolCapabilityUseCase"),
});

export interface IApplicationBootstrapOptions extends IInfrastructureRegistryOptions {}

export class ApplicationBootstrap {
  public static createContainer(
    options: IApplicationBootstrapOptions
  ): DependencyContainer {
    const container = new DependencyContainer();

    InfrastructureRegistry.register(container, options);
    this.registerDomainServices(container);
    this.registerUseCases(container);

    return container;
  }

  private static registerDomainServices(container: DependencyContainer): void {
    container.registerSingleton<IModelCompatibilityService>(
      APPLICATION_TOKENS.ModelCompatibilityService,
      () => new ModelCompatibilityService()
    );

    container.registerSingleton<INodeCompatibilityService>(
      APPLICATION_TOKENS.NodeCompatibilityService,
      (c) =>
        new NodeCompatibilityService(
          c.resolve<ModelCompatibilityService>(
            APPLICATION_TOKENS.ModelCompatibilityService
          )
        )
    );

    container.registerSingleton<IWorkflowValidator>(
      APPLICATION_TOKENS.WorkflowValidator,
      (c) =>
        new WorkflowValidator(
          c.resolve<NodeCompatibilityService>(
            APPLICATION_TOKENS.NodeCompatibilityService
          )
        )
    );
  }

  private static registerUseCases(container: DependencyContainer): void {
    container.registerSingleton(
      APPLICATION_TOKENS.CreateWorkflowUseCase,
      () => new CreateWorkflowUseCase()
    );

    container.registerSingleton(
      APPLICATION_TOKENS.ExecuteWorkflowUseCase,
      (c) =>
        new ExecuteWorkflowUseCase(
          c.resolve<IWorkflowExecutor>(TOKENS.WorkflowExecutor),
          c.resolve<IWorkflowValidator>(APPLICATION_TOKENS.WorkflowValidator)
        )
    );

    container.registerSingleton(
      APPLICATION_TOKENS.ValidateWorkflowUseCase,
      (c) =>
        new ValidateWorkflowUseCase(
          c.resolve<IWorkflowValidator>(APPLICATION_TOKENS.WorkflowValidator)
        )
    );

    container.registerSingleton(
      APPLICATION_TOKENS.CreateNodeUseCase,
      (c) =>
        new CreateNodeUseCase(
          c.resolve<INodeCatalogProvider>(TOKENS.NodeCatalogProvider)
        )
    );

    container.registerSingleton(
      APPLICATION_TOKENS.ConnectNodesUseCase,
      (c) =>
        new ConnectNodesUseCase(
          c.resolve<INodeCompatibilityService>(
            APPLICATION_TOKENS.NodeCompatibilityService
          )
        )
    );

    container.registerSingleton(
      APPLICATION_TOKENS.ListAvailableNodesUseCase,
      (c) =>
        new ListAvailableNodesUseCase(
          c.resolve<INodeCatalogProvider>(TOKENS.NodeCatalogProvider)
        )
    );

    container.registerSingleton(
      APPLICATION_TOKENS.InstallModelUseCase,
      (c) =>
        new InstallModelUseCase({
          modelInstaller: c.resolve<IModelInstaller>(TOKENS.ModelInstaller),
          installedModelCatalog: c.resolve<IInstalledModelCatalog>(
            TOKENS.InstalledModelCatalog
          ),
          remoteModelCatalog: c.resolve<IRemoteModelCatalog>(
            TOKENS.RemoteModelCatalog
          ),
        })
    );

    container.registerSingleton(
      APPLICATION_TOKENS.ListInstalledModelsUseCase,
      (c) =>
        new ListInstalledModelsUseCase(
          c.resolve<IInstalledModelCatalog>(TOKENS.InstalledModelCatalog)
        )
    );

    container.registerSingleton(
      APPLICATION_TOKENS.RemoveModelUseCase,
      (c) =>
        new RemoveModelUseCase({
          installedModelCatalog: c.resolve<IInstalledModelCatalog>(
            TOKENS.InstalledModelCatalog
          ),
          modelInstaller: c.resolve<IModelInstaller>(TOKENS.ModelInstaller),
        })
    );

    container.registerSingleton(
      APPLICATION_TOKENS.ResolveModelCompatibilityUseCase,
      (c) =>
        new ResolveModelCompatibilityUseCase(
          c.resolve<IModelCompatibilityService>(
            APPLICATION_TOKENS.ModelCompatibilityService
          )
        )
    );

    container.registerSingleton(
      APPLICATION_TOKENS.SearchRemoteModelsUseCase,
      (c) =>
        new SearchRemoteModelsUseCase(
          c.resolve<IRemoteModelCatalog>(TOKENS.RemoteModelCatalog)
        )
    );

    container.registerSingleton(
      APPLICATION_TOKENS.SaveAssetUseCase,
      (c) =>
        new SaveAssetUseCase({
          assetCatalog: c.resolve<IAssetCatalog>(TOKENS.AssetCatalog),
          fileStorage: c.resolve<IFileStorage>(TOKENS.FileStorage),
        })
    );

    container.registerSingleton(
      APPLICATION_TOKENS.LoadAssetUseCase,
      (c) =>
        new LoadAssetUseCase({
          assetCatalog: c.resolve<IAssetCatalog>(TOKENS.AssetCatalog),
          fileStorage: c.resolve<IFileStorage>(TOKENS.FileStorage),
        })
    );

    container.registerSingleton(
      APPLICATION_TOKENS.ListAssetsUseCase,
      (c) =>
        new ListAssetsUseCase(
          c.resolve<IAssetCatalog>(TOKENS.AssetCatalog)
        )
    );

    container.registerSingleton(
      APPLICATION_TOKENS.DeleteAssetUseCase,
      (c) =>
        new DeleteAssetUseCase({
          assetCatalog: c.resolve<IAssetCatalog>(TOKENS.AssetCatalog),
          fileStorage: c.resolve<IFileStorage>(TOKENS.FileStorage),
        })
    );

    container.registerSingleton(
      APPLICATION_TOKENS.ListMcpToolsUseCase,
      (c) =>
        new ListMcpToolsUseCase(
          c.resolve<IMcpToolCatalog>(TOKENS.McpToolCatalog)
        )
    );

    container.registerSingleton(
      APPLICATION_TOKENS.ExecuteMcpToolUseCase,
      (c) =>
        new ExecuteMcpToolUseCase(
          c.resolve<IMcpToolExecutor>(TOKENS.McpToolExecutor)
        )
    );

    container.registerSingleton(
      APPLICATION_TOKENS.ListToolCapabilitiesUseCase,
      (c) =>
        new ListToolCapabilitiesUseCase(
          c.resolve<IToolCapabilityCatalog>(TOKENS.ToolCapabilityCatalog)
        )
    );

    container.registerSingleton(
      APPLICATION_TOKENS.InvokeToolCapabilityUseCase,
      (c) =>
        new InvokeToolCapabilityUseCase(
          c.resolve<IToolCapabilityExecutor>(TOKENS.ToolCapabilityExecutor)
        )
    );
  }
}

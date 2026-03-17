import { EnvironmentConfig } from "../config/EnvironmentConfig";
import { EnvironmentConfigProvider } from "../config/EnvironmentConfigProvider";
import { LocalFileStorage } from "../filesystem/LocalFileStorage";
import { LocalAssetRepository } from "../filesystem/LocalAssetRepository";
import { LocalModelRepository } from "../filesystem/LocalModelRepository";
import { LocalWorkflowRepository } from "../filesystem/LocalWorkflowRepository";
import { DependencyContainer, type DependencyToken } from "./DependencyContainer";

import { AssetCatalog } from "../../application/ports/AssetCatalog";
import { EnvironmentConfigProvider as ApplicationEnvironmentConfigProvider } from "../../application/ports/EnvironmentConfigProvider";
import { InstalledModelCatalog } from "../../application/ports/InstalledModelCatalog";
import { ModelDownloader } from "../../application/ports/ModelDownloader";
import { ModelInstaller } from "../../application/ports/ModelInstaller";
import { NodeCatalogProvider } from "../../application/ports/NodeCatalogProvider";
import { RemoteModelCatalog } from "../../application/ports/RemoteModelCatalog";
import { WorkflowExecutor } from "../../application/ports/WorkflowExecutor";
import { WorkflowSerializer } from "../../application/ports/WorkflowSerializer";

import type { IFileStorage } from "../../application/ports/interfaces/IFileStorage";
import type { IAssetCatalog } from "../../application/ports/interfaces/IAssetCatalog";
import type { IInstalledModelCatalog } from "../../application/ports/interfaces/IInstalledModelCatalog";
import type { IEnvironmentConfigProvider } from "../../application/ports/interfaces/IEnvironmentConfigProvider";
import type { INodeCatalogProvider } from "../../application/ports/interfaces/INodeCatalogProvider";
import type { IModelDownloader } from "../../application/ports/interfaces/IModelDownloader";
import type { IRemoteModelCatalog } from "../../application/ports/interfaces/IRemoteModelCatalog";
import type { IModelInstaller } from "../../application/ports/interfaces/IModelInstaller";
import type { IWorkflowExecutor } from "../../application/ports/interfaces/IWorkflowExecutor";
import type { IWorkflowSerializer } from "../../application/ports/interfaces/IWorkflowSerializer";
import type { INodeImplementationRegistry } from "../nodes/shared/INodeImplementationRegistry";
import { CompositeNodeImplementationRegistry } from "../nodes/CompositeNodeImplementationRegistry";
import { createCompositeNodeImplementationRegistry } from "../nodes/NodeProviderRegistryIndex";

export const TOKENS = Object.freeze({
  EnvironmentConfig: Symbol("EnvironmentConfig"),
  EnvironmentConfigProvider: Symbol("EnvironmentConfigProvider"),
  FileStorage: Symbol("FileStorage"),
  AssetCatalog: Symbol("AssetCatalog"),
  InstalledModelCatalog: Symbol("InstalledModelCatalog"),
  NodeCatalogProvider: Symbol("NodeCatalogProvider"),
  RemoteModelCatalog: Symbol("RemoteModelCatalog"),
  ModelDownloader: Symbol("ModelDownloader"),
  ModelInstaller: Symbol("ModelInstaller"),
  WorkflowExecutor: Symbol("WorkflowExecutor"),
  WorkflowSerializer: Symbol("WorkflowSerializer"),
  WorkflowRepository: Symbol("WorkflowRepository"),
  AssetRepository: Symbol("AssetRepository"),
  ModelRepository: Symbol("ModelRepository"),
  NodeImplementationRegistry: Symbol("NodeImplementationRegistry"),
}) satisfies Record<string, DependencyToken>;

export interface IInfrastructureRegistryPaths {
  readonly workflowsDirectory: string;
  readonly assetsDirectory: string;
  readonly modelsDirectory: string;
}

export interface IInfrastructureRegistryOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly paths: IInfrastructureRegistryPaths;
  readonly nodeCatalogProviders?: ReadonlyArray<INodeCatalogProvider>;
  readonly remoteModelCatalogs?: ReadonlyArray<IRemoteModelCatalog>;
  readonly modelDownloaders?: ReadonlyArray<IModelDownloader>;
  readonly modelInstallers?: ReadonlyArray<IModelInstaller>;
  readonly workflowExecutors?: ReadonlyArray<IWorkflowExecutor>;
  readonly workflowSerializers?: ReadonlyArray<IWorkflowSerializer>;
  readonly nodeImplementationRegistries?: ReadonlyArray<INodeImplementationRegistry>;
}

export class InfrastructureRegistry {
  public static register(
    container: DependencyContainer,
    options: IInfrastructureRegistryOptions
  ): void {
    container.registerSingleton(TOKENS.EnvironmentConfig, () => {
      return EnvironmentConfig.fromEnv(options.env ?? {});
    });

    container.registerSingleton<IEnvironmentConfigProvider>(
      TOKENS.EnvironmentConfigProvider,
      (c) => {
        const config = c.resolve<EnvironmentConfig>(TOKENS.EnvironmentConfig);
        return new EnvironmentConfigProvider(config);
      }
    );

    container.registerSingleton<IEnvironmentConfigProvider>(
      Symbol.for("ApplicationEnvironmentConfigProvider"),
      (c) => {
        const config = c.resolve<EnvironmentConfig>(TOKENS.EnvironmentConfig);
        return new ApplicationEnvironmentConfigProvider(config.toObject());
      }
    );

    container.registerSingleton<IFileStorage>(TOKENS.FileStorage, () => {
      return new LocalFileStorage();
    });

    container.registerSingleton(TOKENS.AssetRepository, (c) => {
      return new LocalAssetRepository({
        fileStorage: c.resolve<IFileStorage>(TOKENS.FileStorage),
        rootDirectory: options.paths.assetsDirectory,
      });
    });

    container.registerSingleton<IAssetCatalog>(TOKENS.AssetCatalog, (c) => {
      const repository = c.resolve<LocalAssetRepository>(TOKENS.AssetRepository);

      return new AssetCatalog({
        catalogs: [repository],
        writableCatalog: repository,
      });
    });

    container.registerSingleton(TOKENS.ModelRepository, (c) => {
      return new LocalModelRepository({
        fileStorage: c.resolve<IFileStorage>(TOKENS.FileStorage),
        rootDirectory: options.paths.modelsDirectory,
      });
    });

    container.registerSingleton<IInstalledModelCatalog>(
      TOKENS.InstalledModelCatalog,
      (c) => {
        const repository = c.resolve<LocalModelRepository>(TOKENS.ModelRepository);

        return new InstalledModelCatalog({
          catalogs: [repository],
          writableCatalog: repository,
        });
      }
    );

    container.registerSingleton<INodeCatalogProvider>(
      TOKENS.NodeCatalogProvider,
      () => {
        return new NodeCatalogProvider({
          providers: options.nodeCatalogProviders ?? [],
        });
      }
    );

    container.registerSingleton<INodeImplementationRegistry>(
      TOKENS.NodeImplementationRegistry,
      () => {
        if (
          options.nodeImplementationRegistries &&
          options.nodeImplementationRegistries.length > 0
        ) {
          return new CompositeNodeImplementationRegistry(
            options.nodeImplementationRegistries
          );
        }

        return createCompositeNodeImplementationRegistry();
      }
    );

    container.registerSingleton<IRemoteModelCatalog>(
      TOKENS.RemoteModelCatalog,
      () => {
        return new RemoteModelCatalog(options.remoteModelCatalogs ?? []);
      }
    );

    container.registerSingleton<IModelDownloader>(
      TOKENS.ModelDownloader,
      () => {
        return new ModelDownloader(options.modelDownloaders ?? []);
      }
    );

    container.registerSingleton<IModelInstaller>(
      TOKENS.ModelInstaller,
      () => {
        return new ModelInstaller(options.modelInstallers ?? []);
      }
    );

    container.registerSingleton<IWorkflowExecutor>(
      TOKENS.WorkflowExecutor,
      () => {
        return new WorkflowExecutor(options.workflowExecutors ?? []);
      }
    );

    container.registerSingleton<IWorkflowSerializer>(
      TOKENS.WorkflowSerializer,
      () => {
        return new WorkflowSerializer(options.workflowSerializers ?? []);
      }
    );

    container.registerSingleton(TOKENS.WorkflowRepository, (c) => {
      return new LocalWorkflowRepository({
        fileStorage: c.resolve<IFileStorage>(TOKENS.FileStorage),
        nodeCatalogProvider: c.resolve<INodeCatalogProvider>(TOKENS.NodeCatalogProvider),
        rootDirectory: options.paths.workflowsDirectory,
      });
    });
  }
}

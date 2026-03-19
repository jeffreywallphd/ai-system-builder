import { EnvironmentConfig } from "../config/EnvironmentConfig";
import { EnvironmentConfigProvider } from "../config/EnvironmentConfigProvider";
import { McpRuntimeConfig } from "../config/McpRuntimeConfig";
import { PythonRuntimeConfig } from "../config/PythonRuntimeConfig";
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
import { CompositeNodeCatalogProvider } from "../../application/nodes/CompositeNodeCatalogProvider";
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
import type { IMcpRuntimeClient } from "../../application/ports/interfaces/IMcpRuntimeClient";
import type { IMcpToolCatalog } from "../../application/ports/interfaces/IMcpToolCatalog";
import type { IMcpToolExecutor } from "../../application/ports/interfaces/IMcpToolExecutor";
import type { IToolCapabilityCatalog } from "../../application/ports/interfaces/IToolCapabilityCatalog";
import type { IToolCapabilityExecutor } from "../../application/ports/interfaces/IToolCapabilityExecutor";
import type { IRuntimeEventSink } from "../../application/ports/interfaces/IRuntimeEventSink";
import type { INodeImplementationRegistry } from "../nodes/shared/INodeImplementationRegistry";
import { CompositeNodeImplementationRegistry } from "../nodes/CompositeNodeImplementationRegistry";
import { createCompositeNodeImplementationRegistry } from "../nodes/NodeProviderRegistryIndex";
import { HttpMcpRuntimeClient } from "../python/mcp/HttpMcpRuntimeClient";
import { PythonBackedMcpToolCatalog } from "../python/mcp/PythonBackedMcpToolCatalog";
import { PythonBackedMcpToolExecutor } from "../python/mcp/PythonBackedMcpToolExecutor";
import { CompositeToolCapabilityCatalog } from "../tools/CompositeToolCapabilityCatalog";
import { CompositeToolCapabilityExecutor } from "../tools/CompositeToolCapabilityExecutor";
import { McpToolCapabilityCatalog, MCP_TOOL_CAPABILITY_PROVIDER } from "../tools/McpToolCapabilityCatalog";
import { McpToolCapabilityExecutor } from "../tools/McpToolCapabilityExecutor";
import { WorkflowProjectedToolCapabilityCatalog, WORKFLOW_TOOL_CAPABILITY_PROVIDER } from "../tools/WorkflowProjectedToolCapabilityCatalog";
import { WorkflowToolCapabilityExecutor } from "../tools/WorkflowToolCapabilityExecutor";
import { WorkflowToolProjectionService } from "../../application/projection/WorkflowToolProjectionService";
import { LoadToolDefinitionUseCase } from "../../application/tools/LoadToolDefinitionUseCase";
import { RunToolUseCase } from "../../application/tools/RunToolUseCase";

export const TOKENS = Object.freeze({
  EnvironmentConfig: Symbol("EnvironmentConfig"),
  EnvironmentConfigProvider: Symbol("EnvironmentConfigProvider"),
  McpRuntimeConfig: Symbol("McpRuntimeConfig"),
  McpRuntimeClient: Symbol("McpRuntimeClient"),
  McpToolCatalog: Symbol("McpToolCatalog"),
  McpToolExecutor: Symbol("McpToolExecutor"),
  ToolCapabilityCatalog: Symbol("ToolCapabilityCatalog"),
  ToolCapabilityExecutor: Symbol("ToolCapabilityExecutor"),
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

function toStringEnv(
  env: Readonly<Record<string, unknown>>
): Readonly<Record<string, string | undefined>> {
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [key, value === undefined ? undefined : String(value)])
  );
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

    container.registerSingleton(TOKENS.McpRuntimeConfig, (c) => {
      const config = c.resolve<EnvironmentConfig>(TOKENS.EnvironmentConfig);
      return McpRuntimeConfig.fromEnv(toStringEnv(config.toObject()));
    });

    container.registerSingleton<IMcpRuntimeClient>(TOKENS.McpRuntimeClient, (c) => {
      const config = c.resolve<EnvironmentConfig>(TOKENS.EnvironmentConfig);
      const pythonRuntimeConfig = PythonRuntimeConfig.fromEnv(toStringEnv(config.toObject()));
      const eventSink = c.tryResolve<IRuntimeEventSink>(Symbol.for("RuntimeEventSink"));

      if (!pythonRuntimeConfig.isEnabled) {
        return {
          getConnectionStatus: async () => ({
            enabled: false,
            state: "disabled",
            checkedAt: new Date().toISOString(),
            servers: [],
            capabilities: { tools: false, resources: false, toolExecution: false },
            metadata: { reason: "python-runtime-disabled" },
          }),
          listServers: async () => ({
            query: "",
            totalCount: 0,
            limit: 20,
            servers: [],
            status: {
              enabled: false,
              state: "disabled",
              checkedAt: new Date().toISOString(),
              servers: [],
              capabilities: { tools: false, resources: false, toolExecution: false },
              metadata: { reason: "python-runtime-disabled" },
            },
          }),
          searchServers: async (criteria) => ({
            query: criteria?.query?.trim() || "",
            totalCount: 0,
            limit: criteria?.limit ?? 20,
            servers: [],
            status: {
              enabled: false,
              state: "disabled",
              checkedAt: new Date().toISOString(),
              servers: [],
              capabilities: { tools: false, resources: false, toolExecution: false },
              metadata: { reason: "python-runtime-disabled" },
            },
          }),
          connectServer: async (request) => ({
            action: request.reconnect ? "reconnect" : "connect",
            checkedAt: new Date().toISOString(),
            server: {
              id: request.serverId,
              name: request.serverId,
              transport: "inmemory",
              status: "error",
              toolCount: 0,
              resourceCount: 0,
              capabilities: { tools: false, resources: false, toolExecution: false },
              errorMessage: "Python runtime is disabled.",
            },
            status: {
              enabled: false,
              state: "disabled",
              checkedAt: new Date().toISOString(),
              servers: [],
              capabilities: { tools: false, resources: false, toolExecution: false },
              metadata: { reason: "python-runtime-disabled" },
            },
          }),
          disconnectServer: async (serverId) => ({
            action: "disconnect",
            checkedAt: new Date().toISOString(),
            server: {
              id: serverId,
              name: serverId,
              transport: "inmemory",
              status: "disconnected",
              toolCount: 0,
              resourceCount: 0,
              capabilities: { tools: false, resources: false, toolExecution: false },
              errorMessage: "Python runtime is disabled.",
            },
            status: {
              enabled: false,
              state: "disabled",
              checkedAt: new Date().toISOString(),
              servers: [],
              capabilities: { tools: false, resources: false, toolExecution: false },
              metadata: { reason: "python-runtime-disabled" },
            },
          }),
          listTools: async () => [],
          executeTool: async (request) => ({
            executionId: request.executionId?.trim() || "mcp-disabled",
            serverId: request.serverId,
            toolName: request.toolName,
            status: "failed",
            content: [],
            errorMessage: "Python runtime is disabled.",
          }),
        } satisfies IMcpRuntimeClient;
      }

      return new HttpMcpRuntimeClient(pythonRuntimeConfig, fetch, eventSink);
    });

    container.registerSingleton<IMcpToolCatalog>(TOKENS.McpToolCatalog, (c) => {
      return new PythonBackedMcpToolCatalog(
        c.resolve<IMcpRuntimeClient>(TOKENS.McpRuntimeClient),
        c.tryResolve<IRuntimeEventSink>(Symbol.for("RuntimeEventSink"))
      );
    });

    container.registerSingleton<IMcpToolExecutor>(TOKENS.McpToolExecutor, (c) => {
      return new PythonBackedMcpToolExecutor(
        c.resolve<IMcpRuntimeClient>(TOKENS.McpRuntimeClient),
        c.tryResolve<IRuntimeEventSink>(Symbol.for("RuntimeEventSink"))
      );
    });

    container.registerSingleton<IToolCapabilityCatalog>(TOKENS.ToolCapabilityCatalog, (c) => {
      return new CompositeToolCapabilityCatalog([
        new WorkflowProjectedToolCapabilityCatalog(
          c.resolve(TOKENS.WorkflowRepository),
          new WorkflowToolProjectionService()
        ),
        new McpToolCapabilityCatalog(c.resolve<IMcpToolCatalog>(TOKENS.McpToolCatalog)),
      ]);
    });

    container.registerSingleton<IToolCapabilityExecutor>(TOKENS.ToolCapabilityExecutor, (c) => {
      const workflowRepository = c.resolve(TOKENS.WorkflowRepository);
      const workflowToolProjectionService = new WorkflowToolProjectionService();
      const loadToolDefinitionUseCase = new LoadToolDefinitionUseCase(
        workflowRepository,
        workflowToolProjectionService
      );
      const runToolUseCase = new RunToolUseCase(
        workflowRepository,
        workflowToolProjectionService,
        c.resolve<IWorkflowExecutor>(TOKENS.WorkflowExecutor),
        loadToolDefinitionUseCase
      );

      return new CompositeToolCapabilityExecutor([
        {
          providerKind: WORKFLOW_TOOL_CAPABILITY_PROVIDER.kind,
          providerId: WORKFLOW_TOOL_CAPABILITY_PROVIDER.id,
          executor: new WorkflowToolCapabilityExecutor(runToolUseCase),
        },
        {
          providerKind: MCP_TOOL_CAPABILITY_PROVIDER.kind,
          providerId: MCP_TOOL_CAPABILITY_PROVIDER.id,
          executor: new McpToolCapabilityExecutor(
            c.resolve<IMcpToolExecutor>(TOKENS.McpToolExecutor)
          ),
        },
      ]);
    });

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
        return new CompositeNodeCatalogProvider({
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

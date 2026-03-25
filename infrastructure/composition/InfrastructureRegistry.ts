import { EnvironmentConfig } from "../config/EnvironmentConfig";
import { EnvironmentConfigProvider } from "../config/EnvironmentConfigProvider";
import { HttpPythonRuntimeClient } from "../python/client/HttpPythonRuntimeClient";
import { createRuntimeDependencyOrchestrator } from "../runtime/RuntimeDependencyComposition";
import { McpRuntimeConfig } from "../config/McpRuntimeConfig";
import { PythonRuntimeConfig } from "../config/PythonRuntimeConfig";
import { LocalFileStorage } from "../filesystem/LocalFileStorage";
import { LocalAssetRepository } from "../filesystem/LocalAssetRepository";
import { LocalModelRepository } from "../filesystem/LocalModelRepository";
import { LocalWorkflowRepository } from "../filesystem/LocalWorkflowRepository";
import { LocalContextPackageRepository } from "../filesystem/LocalContextPackageRepository";
import { LocalContextRecipeRepository } from "../filesystem/LocalContextRecipeRepository";
import { SqliteAssetSystemRepository } from "../filesystem/SqliteAssetSystemRepository";
import { SqliteAgentExecutionSessionRepository } from "../filesystem/agents/SqliteAgentExecutionSessionRepository";
import { SqliteAgentRepository } from "../filesystem/agents/SqliteAgentRepository";
import { Neo4jAssetLineageGraphProjectionSink } from "../graph/Neo4jAssetLineageGraphProjectionSink";
import { NoopNeo4jCypherExecutor } from "../graph/NoopNeo4jCypherExecutor";
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
import type { IWorkflowRepository } from "../../application/ports/interfaces/IWorkflowRepository";
import type { IExecutionRunRepository } from "../../application/ports/interfaces/IExecutionRunRepository";
import type { IContextPackageRepository } from "../../application/ports/interfaces/IContextPackageRepository";
import type { IContextRecipeRepository } from "../../application/ports/interfaces/IContextRecipeRepository";
import type { IWorkflowSerializer } from "../../application/ports/interfaces/IWorkflowSerializer";
import type { IMcpRuntimeClient } from "../../application/ports/interfaces/IMcpRuntimeClient";
import type { IMcpServerCatalog } from "../../application/ports/interfaces/IMcpServerCatalog";
import type { IMcpServerManager } from "../../application/ports/interfaces/IMcpServerManager";
import type { IMcpToolCatalog } from "../../application/ports/interfaces/IMcpToolCatalog";
import type { IMcpToolExecutor } from "../../application/ports/interfaces/IMcpToolExecutor";
import type { IToolCapabilityCatalog } from "../../application/ports/interfaces/IToolCapabilityCatalog";
import type { IToolCapabilityExecutor } from "../../application/ports/interfaces/IToolCapabilityExecutor";
import type { IRuntimeEventSink } from "../../application/ports/interfaces/IRuntimeEventSink";
import type { INodeImplementationRegistry } from "../nodes/shared/INodeImplementationRegistry";
import { CompositeNodeImplementationRegistry } from "../nodes/CompositeNodeImplementationRegistry";
import { createMcpRuntimeIntegration } from "../python/mcp/createMcpRuntimeIntegration";
import { LocalStorageMcpToolRegistryRepository } from "../browser/mcp/LocalStorageMcpToolRegistryRepository";
import { LocalStorageMcpToolSecretRepository } from "../browser/mcp/LocalStorageMcpToolSecretRepository";
import { LocalStorageMcpToolExecutionAuditSink } from "../browser/mcp/LocalStorageMcpToolExecutionAuditSink";
import { createCompositeNodeImplementationRegistry } from "../nodes/NodeProviderRegistryIndex";
import { CompositeToolCapabilityCatalog } from "../tools/CompositeToolCapabilityCatalog";
import { StaticLocalToolCapabilityCatalog, LOCAL_TOOL_CAPABILITY_PROVIDER } from "../tools/StaticLocalToolCapabilityCatalog";
import { CompositeToolCapabilityExecutor } from "../tools/CompositeToolCapabilityExecutor";
import { StaticLocalToolCapabilityExecutor } from "../tools/StaticLocalToolCapabilityExecutor";
import { McpToolCapabilityCatalog, MCP_TOOL_CAPABILITY_PROVIDER } from "../tools/McpToolCapabilityCatalog";
import { McpToolCapabilityExecutor } from "../tools/McpToolCapabilityExecutor";
import { WorkflowProjectedToolCapabilityCatalog, WORKFLOW_TOOL_CAPABILITY_PROVIDER } from "../tools/WorkflowProjectedToolCapabilityCatalog";
import { WorkflowToolCapabilityExecutor } from "../tools/WorkflowToolCapabilityExecutor";
import { WorkflowToolProjectionService } from "../../application/projection/WorkflowToolProjectionService";
import { LoadToolDefinitionUseCase } from "../../application/tools/LoadToolDefinitionUseCase";
import { RunToolUseCase } from "../../application/tools/RunToolUseCase";
import { createExecutionApplicationInfrastructure, createExecutionRunRepository } from "../execution/createExecutionInfrastructure";
import { UnifiedExecutionEngine } from "../../application/execution/UnifiedExecutionEngine";
import { WorkflowContextService } from "../../application/context/WorkflowContextService";
import { RuntimeDependencyOperationalStates, type IRuntimeDependencyOrchestrator } from "../../application/runtime/RuntimeDependencyOrchestrator";
import type { IAssetRecordRepository } from "../../application/ports/interfaces/IAssetRecordRepository";
import type { IAssetVersionRepository } from "../../application/ports/interfaces/IAssetVersionRepository";
import type { IAssetLineageRepository } from "../../application/ports/interfaces/IAssetLineageRepository";
import type { IAssetTransformationRepository } from "../../application/ports/interfaces/IAssetTransformationRepository";
import type { IAssetLineageGraphProjectionSink } from "../../application/ports/interfaces/IAssetLineageGraphProjectionSink";
import { RegisterAssetUseCase } from "../../application/assets-system/RegisterAssetUseCase";
import { CreateAssetVersionUseCase } from "../../application/assets-system/CreateAssetVersionUseCase";
import { RecordAssetTransformationUseCase } from "../../application/assets-system/RecordAssetTransformationUseCase";
import { ProjectArtifactToAssetSystemUseCase } from "../../application/assets-system/ProjectArtifactToAssetSystemUseCase";
import { ExecutionAssetLineageRecorder } from "../../application/assets-system/ExecutionAssetLineageRecorder";
import { CanonicalAssetIdentityService } from "../../application/assets-system/CanonicalAssetIdentityService";
import { PublishDurableEntityToAssetSystemUseCase } from "../../application/assets-system/PublishDurableEntityToAssetSystemUseCase";
import type { IMcpToolRegistryRepository } from "../../application/ports/interfaces/IMcpToolRegistryRepository";
import type { IMcpToolSecretRepository } from "../../application/ports/interfaces/IMcpToolSecretRepository";
import type { IMcpToolExecutionAuditSink } from "../../application/ports/interfaces/IMcpToolExecutionAuditSink";
import type { IAgentRepository } from "../../application/ports/interfaces/IAgentRepository";
import type { IAgentExecutionSessionRepository } from "../../application/ports/interfaces/IAgentExecutionSessionRepository";

export const TOKENS = Object.freeze({
  EnvironmentConfig: Symbol("EnvironmentConfig"),
  EnvironmentConfigProvider: Symbol("EnvironmentConfigProvider"),
  McpRuntimeConfig: Symbol("McpRuntimeConfig"),
  McpRuntimeIntegration: Symbol("McpRuntimeIntegration"),
  RuntimeDependencyOrchestrator: Symbol("RuntimeDependencyOrchestrator"),
  McpRuntimeClient: Symbol("McpRuntimeClient"),
  McpServerCatalog: Symbol("McpServerCatalog"),
  McpServerManager: Symbol("McpServerManager"),
  McpToolCatalog: Symbol("McpToolCatalog"),
  McpToolExecutor: Symbol("McpToolExecutor"),
  McpToolRegistryRepository: Symbol("McpToolRegistryRepository"),
  McpToolSecretRepository: Symbol("McpToolSecretRepository"),
  McpToolExecutionAuditSink: Symbol("McpToolExecutionAuditSink"),
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
  UnifiedExecutionEngine: Symbol("UnifiedExecutionEngine"),
  ExecutionRunRepository: Symbol("ExecutionRunRepository"),
  WorkflowRepository: Symbol("WorkflowRepository"),
  ContextPackageRepository: Symbol("ContextPackageRepository"),
  ContextRecipeRepository: Symbol("ContextRecipeRepository"),
  AssetRepository: Symbol("AssetRepository"),
  ModelRepository: Symbol("ModelRepository"),
  NodeImplementationRegistry: Symbol("NodeImplementationRegistry"),
  ExecutionApplicationInfrastructure: Symbol("ExecutionApplicationInfrastructure"),
  AssetSystemRepository: Symbol("AssetSystemRepository"),
  AgentRepository: Symbol("AgentRepository"),
  AgentExecutionSessionRepository: Symbol("AgentExecutionSessionRepository"),
  AssetLineageGraphProjectionSink: Symbol("AssetLineageGraphProjectionSink"),
  ExecutionAssetLineageRecorder: Symbol("ExecutionAssetLineageRecorder"),
  CanonicalAssetIdentityService: Symbol("CanonicalAssetIdentityService"),
  DurableAssetPublisher: Symbol("DurableAssetPublisher"),
}) satisfies Record<string, DependencyToken>;

export interface IInfrastructureRegistryPaths {
  readonly workflowsDirectory: string;
  readonly assetsDirectory: string;
  readonly modelsDirectory: string;
  readonly executionRunsDirectory?: string;
  readonly executionRunDatabasePath?: string;
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

    container.registerSingleton<IRuntimeDependencyOrchestrator>(TOKENS.RuntimeDependencyOrchestrator, (c) => {
      const config = c.resolve<EnvironmentConfig>(TOKENS.EnvironmentConfig);
      const pythonRuntimeConfig = PythonRuntimeConfig.fromEnv(toStringEnv(config.toObject()));
      const pythonRuntimeClient = pythonRuntimeConfig.isEnabled
        ? new HttpPythonRuntimeClient(pythonRuntimeConfig)
        : undefined;

      return createRuntimeDependencyOrchestrator({
        pythonRuntime: {
          providerId: "python-runtime-http-health",
          ensureAvailable: async () => {
            if (!pythonRuntimeConfig.isEnabled || !pythonRuntimeClient) {
              return {
                state: RuntimeDependencyOperationalStates.disabled,
                detail: "Python runtime is disabled in settings.",
                remediationHints: ["Enable the Python runtime to unlock MCP-backed capabilities."],
              };
            }

            try {
              const health = await pythonRuntimeClient.health();
              return {
                state: health.status === "unavailable"
                  ? RuntimeDependencyOperationalStates.unavailable
                  : RuntimeDependencyOperationalStates.healthy,
                detail: health.status === "unavailable"
                  ? "Python runtime is unavailable, so dependent runtimes remain gated."
                  : "Python runtime dependency is reachable.",
                metadata: health.details,
                remediationHints: health.status === "unavailable"
                  ? ["Start the configured Python runtime endpoint or verify the runtime base URL."]
                  : [],
              };
            } catch (error) {
              return {
                state: RuntimeDependencyOperationalStates.failed,
                detail: error instanceof Error ? error.message : "Python runtime health check failed.",
                remediationHints: ["Verify network connectivity to the configured Python runtime endpoint."],
              };
            }
          },
        },
      });
    });

    container.registerSingleton(TOKENS.McpRuntimeIntegration, (c) => {
      const config = c.resolve<EnvironmentConfig>(TOKENS.EnvironmentConfig);
      const pythonRuntimeConfig = PythonRuntimeConfig.fromEnv(toStringEnv(config.toObject()));
      const eventSink = c.tryResolve<IRuntimeEventSink>(Symbol.for("RuntimeEventSink"));
      return createMcpRuntimeIntegration(
        pythonRuntimeConfig,
        eventSink,
        fetch,
        c.resolve<IRuntimeDependencyOrchestrator>(TOKENS.RuntimeDependencyOrchestrator),
      );
    });

    container.registerSingleton<IMcpRuntimeClient>(TOKENS.McpRuntimeClient, (c) => {
      return c.resolve<ReturnType<typeof createMcpRuntimeIntegration>>(TOKENS.McpRuntimeIntegration).runtimeClient;
    });

    container.registerSingleton<IMcpServerCatalog>(TOKENS.McpServerCatalog, (c) => {
      return c.resolve<ReturnType<typeof createMcpRuntimeIntegration>>(TOKENS.McpRuntimeIntegration).serverCatalog;
    });

    container.registerSingleton<IMcpServerManager>(TOKENS.McpServerManager, (c) => {
      return c.resolve<ReturnType<typeof createMcpRuntimeIntegration>>(TOKENS.McpRuntimeIntegration).serverManager;
    });

    container.registerSingleton<IMcpToolCatalog>(TOKENS.McpToolCatalog, (c) => {
      return c.resolve<ReturnType<typeof createMcpRuntimeIntegration>>(TOKENS.McpRuntimeIntegration).toolCatalog;
    });

    container.registerSingleton<IMcpToolExecutor>(TOKENS.McpToolExecutor, (c) => {
      return c.resolve<ReturnType<typeof createMcpRuntimeIntegration>>(TOKENS.McpRuntimeIntegration).toolExecutor;
    });

    container.registerSingleton<IMcpToolRegistryRepository>(TOKENS.McpToolRegistryRepository, () => {
      return new LocalStorageMcpToolRegistryRepository();
    });

    container.registerSingleton<IMcpToolSecretRepository>(TOKENS.McpToolSecretRepository, () => {
      return new LocalStorageMcpToolSecretRepository();
    });

    container.registerSingleton<IMcpToolExecutionAuditSink>(TOKENS.McpToolExecutionAuditSink, () => {
      return new LocalStorageMcpToolExecutionAuditSink();
    });

    container.registerSingleton<IToolCapabilityCatalog>(TOKENS.ToolCapabilityCatalog, (c) => {
      return new CompositeToolCapabilityCatalog([
        new WorkflowProjectedToolCapabilityCatalog(
          c.resolve(TOKENS.WorkflowRepository),
          new WorkflowToolProjectionService()
        ),
        new StaticLocalToolCapabilityCatalog([]),
        new McpToolCapabilityCatalog(c.resolve<IMcpToolCatalog>(TOKENS.McpToolCatalog)),
      ]);
    });

    container.registerSingleton<IToolCapabilityExecutor>(TOKENS.ToolCapabilityExecutor, (c) => {
      const workflowRepository = c.resolve<IWorkflowRepository>(TOKENS.WorkflowRepository);
      const workflowToolProjectionService = new WorkflowToolProjectionService();
      const loadToolDefinitionUseCase = new LoadToolDefinitionUseCase(
        workflowRepository,
        workflowToolProjectionService
      );
      const workflowContextService = new WorkflowContextService(
        c.resolve<IContextPackageRepository>(TOKENS.ContextPackageRepository),
        c.resolve<IContextRecipeRepository>(TOKENS.ContextRecipeRepository)
      );
      const workflowExecutor = c.resolve<IWorkflowExecutor>(TOKENS.WorkflowExecutor);
      const runToolUseCase = new RunToolUseCase(
        workflowRepository,
        workflowToolProjectionService,
        workflowExecutor,
        loadToolDefinitionUseCase,
        workflowContextService,
        c.resolve<UnifiedExecutionEngine>(TOKENS.UnifiedExecutionEngine)
      );

      return new CompositeToolCapabilityExecutor([
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
          executor: new McpToolCapabilityExecutor(
            c.resolve<IMcpToolExecutor>(TOKENS.McpToolExecutor)
          ),
        },
      ]);
    });

    container.registerSingleton<IFileStorage>(TOKENS.FileStorage, () => {
      return new LocalFileStorage();
    });

    container.registerSingleton<IContextPackageRepository>(TOKENS.ContextPackageRepository, (c) => {
      return new LocalContextPackageRepository({
        fileStorage: c.resolve<IFileStorage>(TOKENS.FileStorage),
        rootDirectory: `${options.paths.workflowsDirectory}/../context-packages`,
      });
    });

    container.registerSingleton<IContextRecipeRepository>(TOKENS.ContextRecipeRepository, (c) => {
      return new LocalContextRecipeRepository({
        fileStorage: c.resolve<IFileStorage>(TOKENS.FileStorage),
        rootDirectory: `${options.paths.workflowsDirectory}/../context-recipes`,
      });
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

    container.registerSingleton(TOKENS.AssetSystemRepository, () => {
      return new SqliteAssetSystemRepository(`${options.paths.assetsDirectory}/asset-system.sqlite`);
    });

    container.registerSingleton<IAgentRepository>(TOKENS.AgentRepository, () => {
      return new SqliteAgentRepository(`${options.paths.workflowsDirectory}/../agents/agents.sqlite`);
    });

    container.registerSingleton<IAgentExecutionSessionRepository>(TOKENS.AgentExecutionSessionRepository, () => {
      return new SqliteAgentExecutionSessionRepository(
        `${options.paths.workflowsDirectory}/../agents/agent-execution-sessions.sqlite`,
      );
    });

    container.registerSingleton<IAssetLineageGraphProjectionSink>(TOKENS.AssetLineageGraphProjectionSink, () => {
      // Neo4j is the default graph projection target contract; this local executor remains no-op until a real driver adapter is supplied.
      return new Neo4jAssetLineageGraphProjectionSink(new NoopNeo4jCypherExecutor());
    });

    container.registerSingleton<CanonicalAssetIdentityService>(TOKENS.CanonicalAssetIdentityService, (c) => {
      const systemRepository = c.resolve<SqliteAssetSystemRepository>(TOKENS.AssetSystemRepository);
      return new CanonicalAssetIdentityService(systemRepository, systemRepository);
    });

    container.registerSingleton<PublishDurableEntityToAssetSystemUseCase>(TOKENS.DurableAssetPublisher, (c) => {
      const systemRepository = c.resolve<SqliteAssetSystemRepository>(TOKENS.AssetSystemRepository);
      return new PublishDurableEntityToAssetSystemUseCase(
        new RegisterAssetUseCase(systemRepository),
        new CreateAssetVersionUseCase(systemRepository),
        systemRepository,
      );
    });

    container.registerSingleton<ExecutionAssetLineageRecorder>(TOKENS.ExecutionAssetLineageRecorder, (c) => {
      const systemRepository = c.resolve<SqliteAssetSystemRepository>(TOKENS.AssetSystemRepository);
      const registerAssetUseCase = new RegisterAssetUseCase(systemRepository);
      const createAssetVersionUseCase = new CreateAssetVersionUseCase(systemRepository);
      const recordTransformationUseCase = new RecordAssetTransformationUseCase(
        systemRepository,
        systemRepository,
        c.resolve<IAssetLineageGraphProjectionSink>(TOKENS.AssetLineageGraphProjectionSink),
      );
      const projectionUseCase = new ProjectArtifactToAssetSystemUseCase(
        registerAssetUseCase,
        createAssetVersionUseCase,
        recordTransformationUseCase,
      );

      return new ExecutionAssetLineageRecorder(projectionUseCase, systemRepository, c.resolve<CanonicalAssetIdentityService>(TOKENS.CanonicalAssetIdentityService));
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

    container.registerSingleton<IExecutionRunRepository>(TOKENS.ExecutionRunRepository, (c) => createExecutionRunRepository({
      sqliteDatabasePath: options.paths.executionRunDatabasePath,
      fileStorage: options.paths.executionRunDatabasePath ? undefined : c.resolve<IFileStorage>(TOKENS.FileStorage),
      rootDirectory: options.paths.executionRunDatabasePath ? undefined : (options.paths.executionRunsDirectory ?? `${options.paths.workflowsDirectory}/../execution-runs`),
    }));

    container.registerSingleton(TOKENS.ExecutionApplicationInfrastructure, (c) => createExecutionApplicationInfrastructure({
      workflowExecutor: c.resolve<IWorkflowExecutor>(TOKENS.WorkflowExecutor),
      executionRunRepository: c.resolve<IExecutionRunRepository>(TOKENS.ExecutionRunRepository),
      mcpServerManager: c.resolve<IMcpServerManager>(TOKENS.McpServerManager),
      executionAssetLineageRecorder: c.resolve<ExecutionAssetLineageRecorder>(TOKENS.ExecutionAssetLineageRecorder),
    }));

    container.registerSingleton<UnifiedExecutionEngine>(
      TOKENS.UnifiedExecutionEngine,
      (c) => c.resolve<ReturnType<typeof createExecutionApplicationInfrastructure>>(TOKENS.ExecutionApplicationInfrastructure).executionEngine,
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

/**
 * Deferred runtime composition layer that lazily instantiates optional desktop features and binds them to IPC registrations.
 */
import path from "node:path";
import { GetExecutionRunUseCase } from "../../src/application/execution/GetExecutionRunUseCase";
import type { IWorkflowRunSummaryRepository } from "../../src/application/ports/interfaces/IWorkflowRunSummaryRepository";
import { ListWorkflowRunSummariesUseCase } from "../../src/application/workflow-run-history/ListWorkflowRunSummariesUseCase";
import { DesktopWorkflowPersistence } from "../../src/infrastructure/desktop/DesktopWorkflowPersistence";
import type { AppRuntimeConfigValues } from "../../src/infrastructure/config/AppRuntimeConfig";
import {
  createExecutionHistoryInfrastructure,
  createExecutionRunRepository,
  type ExecutionHistoryInfrastructure,
} from "../../src/infrastructure/execution/createExecutionInfrastructure";
import { SqliteWorkflowPersistenceRepository } from "../../src/infrastructure/filesystem/SqliteWorkflowPersistenceRepository";
import { SqliteWorkflowRunSummaryRepository } from "../../src/infrastructure/filesystem/SqliteWorkflowRunSummaryRepository";
import { SqliteExecutionRunRepository } from "../../src/infrastructure/filesystem/execution/SqliteExecutionRunRepository";
import { SqliteStudioShellRepository } from "../../src/infrastructure/filesystem/studio-shell/SqliteStudioShellRepository";
import { SqliteExecutionAuditRepository } from "../../src/infrastructure/filesystem/system-runtime/SqliteExecutionAuditRepository";
import { LocalStorageInstanceLifecycleInfrastructure } from "../../src/infrastructure/filesystem/system-runtime/LocalStorageInstanceLifecycleInfrastructure";
import { LocalStorageInstanceProvisioner } from "../../src/infrastructure/filesystem/system-runtime/LocalStorageInstanceProvisioner";
import { LocalSystemOutputArtifactStorage } from "../../src/infrastructure/filesystem/system-runtime/LocalSystemOutputArtifactStorage";
import { SqliteImageRunHistoryRepository } from "../../src/infrastructure/filesystem/system-runtime/SqliteImageRunHistoryRepository";
import { SqliteSystemRuntimeExecutionStore } from "../../src/infrastructure/filesystem/system-runtime/SqliteSystemRuntimeExecutionStore";
import { StudioShellBackendApi } from "../../src/infrastructure/api/studio-shell/StudioShellBackendApi";
import { SystemRuntimeBackendApi } from "../../src/infrastructure/api/system-runtime/SystemRuntimeBackendApi";
import type { SystemRuntimeObservabilityLogger } from "../../src/infrastructure/api/system-runtime/SystemRuntimeObservability";
import { SystemStudioBackendApi } from "../../src/infrastructure/api/system-studio/SystemStudioBackendApi";
import { SqliteImageWorkflowSystemPersistenceAdapter } from "../../src/infrastructure/persistence/image-workflows/SqliteImageWorkflowSystemPersistenceAdapter";
import type { resolveDesktopStoragePaths } from "../../src/infrastructure/desktop/DesktopAppPaths";
import { logInitializationCheckpoint, logInitializationEnd, logInitializationMemory, logInitializationStart } from "./InitializationLogging";
import { DesktopStartupPhases } from "./DesktopStartupContract";

type DesktopStoragePaths = ReturnType<typeof resolveDesktopStoragePaths>;

type StudioShellDependencies = {
  readonly repository: SqliteStudioShellRepository;
  readonly workflowPersistenceRepository: SqliteWorkflowPersistenceRepository;
  readonly imageRunHistoryRepository: SqliteImageRunHistoryRepository;
  readonly imageWorkflowSystemPersistence: SqliteImageWorkflowSystemPersistenceAdapter;
};

type SystemRuntimeDependencies = {
  readonly repository: SqliteStudioShellRepository;
  readonly executionStore: SqliteSystemRuntimeExecutionStore;
  readonly executionAuditRepository: SqliteExecutionAuditRepository;
};

export type DeferredDesktopExecutionHistoryRuntime = {
  readonly repository: SqliteExecutionRunRepository;
  readonly getExecutionRunUseCase: GetExecutionRunUseCase;
  readonly listExecutionRunsUseCase: ExecutionHistoryInfrastructure["listExecutionRunsUseCase"];
};

export type DeferredDesktopWorkflowRunHistoryRuntime = {
  readonly repository: SqliteWorkflowRunSummaryRepository;
  readonly listWorkflowRunSummariesUseCase: ListWorkflowRunSummariesUseCase;
};

export interface DeferredDesktopFeatureRuntime {
  ensureWorkflowPersistence(): DesktopWorkflowPersistence;
  ensureExecutionHistory(): DeferredDesktopExecutionHistoryRuntime;
  ensureWorkflowRunHistory(): DeferredDesktopWorkflowRunHistoryRuntime;
  ensureWorkflowPersistenceRepository(): SqliteWorkflowPersistenceRepository;
  ensureStudioShellBackendApi(): StudioShellBackendApi;
  ensureSystemStudioBackendApi(): SystemStudioBackendApi;
  ensureSystemRuntimeBackendApi(): SystemRuntimeBackendApi;
  dispose(): void;
}

export interface DeferredDesktopFeatureRuntimeFactories {
  createWorkflowPersistence(args: {
    readonly workflowsDirectory: string;
    readonly workflowIndexDatabasePath: string;
  }): DesktopWorkflowPersistence;
  createExecutionRunRepository(args: { readonly sqliteDatabasePath: string }): SqliteExecutionRunRepository;
  createExecutionHistoryInfrastructure(repository: SqliteExecutionRunRepository): ExecutionHistoryInfrastructure;
  createGetExecutionRunUseCase(repository: SqliteExecutionRunRepository): GetExecutionRunUseCase;
  createWorkflowRunSummaryRepository(args: { readonly sqliteDatabasePath: string }): SqliteWorkflowRunSummaryRepository;
  createListWorkflowRunSummariesUseCase(repository: SqliteWorkflowRunSummaryRepository): ListWorkflowRunSummariesUseCase;
  createStudioShellRepository(args: { readonly sqliteDatabasePath: string }): SqliteStudioShellRepository;
  createWorkflowPersistenceRepository(args: { readonly sqliteDatabasePath: string }): SqliteWorkflowPersistenceRepository;
  createImageRunHistoryRepository(args: { readonly sqliteDatabasePath: string }): SqliteImageRunHistoryRepository;
  createImageWorkflowSystemPersistence(args: { readonly sqliteDatabasePath: string }): SqliteImageWorkflowSystemPersistenceAdapter;
  createStudioShellBackendApi(args: StudioShellDependencies & {
    readonly storageRootDirectory: string;
    readonly workflowRunSummaryRepository?: IWorkflowRunSummaryRepository;
  }): StudioShellBackendApi;
  createSystemStudioBackendApi(repository: SqliteStudioShellRepository): SystemStudioBackendApi;
  createSystemRuntimeExecutionStore(args: { readonly sqliteDatabasePath: string }): SqliteSystemRuntimeExecutionStore;
  createSystemRuntimeExecutionAuditRepository(args: { readonly sqliteDatabasePath: string }): SqliteExecutionAuditRepository;
  createSystemRuntimeBackendApi(args: SystemRuntimeDependencies): SystemRuntimeBackendApi;
}

export interface CreateDeferredDesktopFeatureRuntimeOptions {
  readonly storagePaths: DesktopStoragePaths;
  readonly runtimeConfigValues: AppRuntimeConfigValues;
  readonly repoRoot: string;
  readonly observabilityLogger?: SystemRuntimeObservabilityLogger;
  readonly factories?: Partial<DeferredDesktopFeatureRuntimeFactories>;
}

const DeferredRuntimeTimingPhases = Object.freeze({
  workflowPersistence: "desktop-startup.deferred-feature-runtime.workflow-persistence",
  executionHistory: "desktop-startup.deferred-feature-runtime.execution-history",
  workflowRunHistory: "desktop-startup.deferred-feature-runtime.workflow-run-history",
  studioShellBackendApi: "desktop-startup.deferred-feature-runtime.studio-shell-backend-api",
  systemStudioBackendApi: "desktop-startup.deferred-feature-runtime.system-studio-backend-api",
  systemRuntimeBackendApi: "desktop-startup.deferred-feature-runtime.system-runtime-backend-api",
});

function instrumentDeferredRuntimeCreation<T>(timingPhase: string, checkpoint: string, create: () => T): T {
  const startedAt = logInitializationStart(timingPhase);
  try {
    const created = create();
    logInitializationCheckpoint(DesktopStartupPhases.deferredFeatureRuntime, checkpoint, startedAt);
    logInitializationMemory(DesktopStartupPhases.deferredFeatureRuntime, checkpoint);
    return created;
  } finally {
    logInitializationEnd(timingPhase, startedAt);
  }
}

function createDefaultFactories(
  observabilityLogger?: SystemRuntimeObservabilityLogger,
): DeferredDesktopFeatureRuntimeFactories {
  return {
    createWorkflowPersistence({ workflowsDirectory, workflowIndexDatabasePath }) {
      return new DesktopWorkflowPersistence({
        workflowsDirectory,
        indexDatabasePath: workflowIndexDatabasePath,
      });
    },
    createExecutionRunRepository({ sqliteDatabasePath }) {
      return createExecutionRunRepository({
        sqliteDatabasePath,
      }) as SqliteExecutionRunRepository;
    },
    createExecutionHistoryInfrastructure(repository) {
      return createExecutionHistoryInfrastructure(repository);
    },
    createGetExecutionRunUseCase(repository) {
      return new GetExecutionRunUseCase(repository);
    },
    createWorkflowRunSummaryRepository({ sqliteDatabasePath }) {
      return new SqliteWorkflowRunSummaryRepository(sqliteDatabasePath);
    },
    createListWorkflowRunSummariesUseCase(repository) {
      return new ListWorkflowRunSummariesUseCase(repository);
    },
    createStudioShellRepository({ sqliteDatabasePath }) {
      return new SqliteStudioShellRepository(sqliteDatabasePath);
    },
    createWorkflowPersistenceRepository({ sqliteDatabasePath }) {
      return new SqliteWorkflowPersistenceRepository(sqliteDatabasePath);
    },
    createImageRunHistoryRepository({ sqliteDatabasePath }) {
      return new SqliteImageRunHistoryRepository(sqliteDatabasePath);
    },
    createImageWorkflowSystemPersistence({ sqliteDatabasePath }) {
      return new SqliteImageWorkflowSystemPersistenceAdapter(sqliteDatabasePath);
    },
    createStudioShellBackendApi(args) {
      return new StudioShellBackendApi(
        args.repository,
        args.workflowPersistenceRepository,
        args.workflowRunSummaryRepository,
        undefined,
        args.imageRunHistoryRepository,
        {
          storageInstanceProvisioner: new LocalStorageInstanceProvisioner({
            storageRootDirectory: args.storageRootDirectory,
          }),
          workflowOutputArtifactStorage: new LocalSystemOutputArtifactStorage(
            args.storageRootDirectory,
          ),
          storageLifecycleInfrastructure: new LocalStorageInstanceLifecycleInfrastructure(
            args.storageRootDirectory,
          ),
          imageSystemDefinitionRepository: args.imageWorkflowSystemPersistence,
        },
      );
    },
    createSystemStudioBackendApi(repository) {
      return new SystemStudioBackendApi(repository);
    },
    createSystemRuntimeExecutionStore({ sqliteDatabasePath }) {
      return new SqliteSystemRuntimeExecutionStore(sqliteDatabasePath);
    },
    createSystemRuntimeExecutionAuditRepository({ sqliteDatabasePath }) {
      return new SqliteExecutionAuditRepository(sqliteDatabasePath);
    },
    createSystemRuntimeBackendApi(args) {
      return new SystemRuntimeBackendApi(
        args.repository,
        args.executionStore,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        args.executionAuditRepository,
        undefined,
        {
          observabilityLogger,
        },
      );
    },
  };
}

function resolveWorkflowPaths(runtimeConfigValues: AppRuntimeConfigValues, repoRoot: string): {
  readonly workflowsDirectory: string;
  readonly workflowIndexDatabasePath: string;
} {
  return Object.freeze({
    workflowsDirectory: runtimeConfigValues.workflowStorageDirectory
      ? path.resolve(repoRoot, runtimeConfigValues.workflowStorageDirectory)
      : path.resolve(repoRoot, "dev/workflow-data/workflows"),
    workflowIndexDatabasePath: runtimeConfigValues.workflowIndexDatabasePath
      ? path.resolve(repoRoot, runtimeConfigValues.workflowIndexDatabasePath)
      : path.resolve(repoRoot, "dev/workflow-data/workflows/workflow-index.sqlite"),
  });
}

function disposeIfSupported(value: unknown): void {
  if (!value) {
    return;
  }
  const maybeDisposable = value as { readonly dispose?: () => void };
  maybeDisposable.dispose?.();
}

function createLazyWorkflowRunSummaryRepository(
  getRepository: () => SqliteWorkflowRunSummaryRepository,
): IWorkflowRunSummaryRepository {
  return Object.freeze({
    async upsert(record) {
      return getRepository().upsert(record);
    },
    async upsertDetail(record) {
      return getRepository().upsertDetail(record);
    },
    async getByRunId(runId) {
      return getRepository().getByRunId(runId);
    },
    async getDetailByRunId(runId) {
      return getRepository().getDetailByRunId(runId);
    },
    async list(query) {
      return getRepository().list(query);
    },
  });
}

export function createDeferredDesktopFeatureRuntime(
  options: CreateDeferredDesktopFeatureRuntimeOptions,
): DeferredDesktopFeatureRuntime {
  const factories = {
    ...createDefaultFactories(options.observabilityLogger),
    ...options.factories,
  };
  const workflowPaths = resolveWorkflowPaths(options.runtimeConfigValues, options.repoRoot);

  let workflowPersistence: DesktopWorkflowPersistence | undefined;
  let executionHistory: DeferredDesktopExecutionHistoryRuntime | undefined;
  let workflowRunHistory: DeferredDesktopWorkflowRunHistoryRuntime | undefined;
  let studioDependencies: StudioShellDependencies | undefined;
  let studioShellBackendApi: StudioShellBackendApi | undefined;
  let systemStudioBackendApi: SystemStudioBackendApi | undefined;
  let systemRuntimeDependencies: SystemRuntimeDependencies | undefined;
  let systemRuntimeBackendApi: SystemRuntimeBackendApi | undefined;

  const ensureWorkflowPersistence = (): DesktopWorkflowPersistence => {
    if (workflowPersistence) {
      return workflowPersistence;
    }
    workflowPersistence = instrumentDeferredRuntimeCreation(DeferredRuntimeTimingPhases.workflowPersistence, "workflow-persistence-ready", () => {
      return factories.createWorkflowPersistence({
        workflowsDirectory: workflowPaths.workflowsDirectory,
        workflowIndexDatabasePath: workflowPaths.workflowIndexDatabasePath,
      });
    });
    return workflowPersistence;
  };

  const ensureExecutionHistory = (): DeferredDesktopExecutionHistoryRuntime => {
    if (executionHistory) {
      return executionHistory;
    }
    executionHistory = instrumentDeferredRuntimeCreation(DeferredRuntimeTimingPhases.executionHistory, "execution-history-ready", () => {
      const repository = factories.createExecutionRunRepository({
        sqliteDatabasePath: options.storagePaths.databasePath,
      });
      const history = factories.createExecutionHistoryInfrastructure(repository);
      return Object.freeze({
        repository,
        getExecutionRunUseCase: factories.createGetExecutionRunUseCase(repository),
        listExecutionRunsUseCase: history.listExecutionRunsUseCase,
      });
    });
    return executionHistory;
  };

  const ensureWorkflowRunHistory = (): DeferredDesktopWorkflowRunHistoryRuntime => {
    if (workflowRunHistory) {
      return workflowRunHistory;
    }
    workflowRunHistory = instrumentDeferredRuntimeCreation(DeferredRuntimeTimingPhases.workflowRunHistory, "workflow-run-history-ready", () => {
      const repository = factories.createWorkflowRunSummaryRepository({
        sqliteDatabasePath: options.storagePaths.databasePath,
      });
      return Object.freeze({
        repository,
        listWorkflowRunSummariesUseCase: factories.createListWorkflowRunSummariesUseCase(repository),
      });
    });
    return workflowRunHistory;
  };

  const ensureStudioDependencies = (): StudioShellDependencies => {
    if (studioDependencies) {
      return studioDependencies;
    }
    const repository = factories.createStudioShellRepository({
      sqliteDatabasePath: path.join(options.storagePaths.storageDirectory, "studio-shell", "studio-shell.sqlite"),
    });
    const workflowPersistenceRepository = factories.createWorkflowPersistenceRepository({
      sqliteDatabasePath: path.join(options.storagePaths.storageDirectory, "workflow-studio", "workflow-persistence.sqlite"),
    });
    const imageRunHistoryRepository = factories.createImageRunHistoryRepository({
      sqliteDatabasePath: path.join(options.storagePaths.assetsDirectory, "system-image-run-history.sqlite"),
    });
    const imageWorkflowSystemPersistence = factories.createImageWorkflowSystemPersistence({
      sqliteDatabasePath: path.join(options.storagePaths.assetsDirectory, "image-workflow-system.sqlite"),
    });
    studioDependencies = Object.freeze({
      repository,
      workflowPersistenceRepository,
      imageRunHistoryRepository,
      imageWorkflowSystemPersistence,
    });
    return studioDependencies;
  };

  const ensureSystemRuntimeDependencies = (): SystemRuntimeDependencies => {
    if (systemRuntimeDependencies) {
      return systemRuntimeDependencies;
    }
    const dependencies = ensureStudioDependencies();
    systemRuntimeDependencies = Object.freeze({
      repository: dependencies.repository,
      executionStore: factories.createSystemRuntimeExecutionStore({
        sqliteDatabasePath: path.join(options.storagePaths.assetsDirectory, "system-runtime.sqlite"),
      }),
      executionAuditRepository: factories.createSystemRuntimeExecutionAuditRepository({
        sqliteDatabasePath: path.join(options.storagePaths.assetsDirectory, "system-runtime-audit.sqlite"),
      }),
    });
    return systemRuntimeDependencies;
  };

  return Object.freeze({
    ensureWorkflowPersistence,
    ensureExecutionHistory,
    ensureWorkflowRunHistory,
    ensureWorkflowPersistenceRepository() {
      return ensureStudioDependencies().workflowPersistenceRepository;
    },
    ensureStudioShellBackendApi() {
      if (studioShellBackendApi) {
        return studioShellBackendApi;
      }
      studioShellBackendApi = instrumentDeferredRuntimeCreation(DeferredRuntimeTimingPhases.studioShellBackendApi, "studio-shell-backend-api-ready", () => {
        const dependencies = ensureStudioDependencies();
        const workflowRunSummaryRepository = createLazyWorkflowRunSummaryRepository(
          () => ensureWorkflowRunHistory().repository,
        );
        return factories.createStudioShellBackendApi({
          ...dependencies,
          storageRootDirectory: path.join(options.storagePaths.storageDirectory, "storage"),
          workflowRunSummaryRepository,
        });
      });
      return studioShellBackendApi;
    },
    ensureSystemStudioBackendApi() {
      if (systemStudioBackendApi) {
        return systemStudioBackendApi;
      }
      systemStudioBackendApi = instrumentDeferredRuntimeCreation(DeferredRuntimeTimingPhases.systemStudioBackendApi, "system-studio-backend-api-ready", () => {
        return factories.createSystemStudioBackendApi(ensureStudioDependencies().repository);
      });
      return systemStudioBackendApi;
    },
    ensureSystemRuntimeBackendApi() {
      if (systemRuntimeBackendApi) {
        return systemRuntimeBackendApi;
      }
      systemRuntimeBackendApi = instrumentDeferredRuntimeCreation(DeferredRuntimeTimingPhases.systemRuntimeBackendApi, "system-runtime-backend-api-ready", () => {
        return factories.createSystemRuntimeBackendApi(ensureSystemRuntimeDependencies());
      });
      return systemRuntimeBackendApi;
    },
    dispose() {
      disposeIfSupported(executionHistory?.repository);
      disposeIfSupported(workflowRunHistory?.repository);
      disposeIfSupported(studioDependencies?.repository);
      disposeIfSupported(studioDependencies?.workflowPersistenceRepository);
      disposeIfSupported(studioDependencies?.imageWorkflowSystemPersistence);
      workflowPersistence = undefined;
      executionHistory = undefined;
      workflowRunHistory = undefined;
      studioDependencies = undefined;
      studioShellBackendApi = undefined;
      systemStudioBackendApi = undefined;
      systemRuntimeDependencies = undefined;
      systemRuntimeBackendApi = undefined;
    },
  });
}

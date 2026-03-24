import { UnifiedExecutionEngine, type IExecutionUnitHandler } from "../../application/execution/UnifiedExecutionEngine";
import { ExecutionRunDetailProjectionService } from "../../application/execution/ExecutionRunDetailProjectionService";
import { ExecutionRunProjectionService } from "../../application/execution/ExecutionRunProjectionService";
import { GetExecutionRunDetailUseCase } from "../../application/execution/GetExecutionRunDetailUseCase";
import { ListExecutionRunsUseCase } from "../../application/execution/ListExecutionRunsUseCase";
import { ListRelatedExecutionRunsUseCase } from "../../application/execution/ListRelatedExecutionRunsUseCase";
import type { IExecutionRunRepository } from "../../application/ports/interfaces/IExecutionRunRepository";
import type { IMcpServerManager } from "../../application/ports/interfaces/IMcpServerManager";
import type { IWorkflowExecutor } from "../../application/ports/interfaces/IWorkflowExecutor";
import type { IFileStorage } from "../../application/ports/interfaces/IFileStorage";
import type { DatasetGenerationService } from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import type { IModelTrainingRuntime } from "../../application/ports/interfaces/IModelTrainingRuntime";
import type { DesktopExecutionRunBridge } from "../../electron/shared/DesktopContracts";
import { LocalStorageExecutionRunRepository } from "../browser/execution/LocalStorageExecutionRunRepository";
import { DesktopBridgeExecutionRunRepository } from "../browser/execution/DesktopBridgeExecutionRunRepository";
import { LocalExecutionRunRepository } from "../filesystem/execution/LocalExecutionRunRepository";
import { SqliteExecutionRunRepository } from "../filesystem/execution/SqliteExecutionRunRepository";
import { DatasetGenerationExecutionUnitHandler } from "./DatasetGenerationExecutionUnitHandler";
import { McpServerOperationExecutionUnitHandler } from "./McpServerOperationExecutionUnitHandler";
import { ModelPreparationExecutionUnitHandler } from "./ModelPreparationExecutionUnitHandler";
import { ModelTrainingExecutionUnitHandler } from "./ModelTrainingExecutionUnitHandler";
import { WorkflowExecutionUnitHandler } from "./WorkflowExecutionUnitHandler";
import type { ExecutionAssetLineageRecorder } from "../../application/assets-system/ExecutionAssetLineageRecorder";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface CreateExecutionRunRepositoryOptions {
  readonly desktopExecutionRunBridge?: DesktopExecutionRunBridge;
  readonly sqliteDatabasePath?: string;
  readonly fileStorage?: IFileStorage;
  readonly rootDirectory?: string;
  readonly storage?: StorageLike;
}

export function createExecutionRunRepository(
  options: CreateExecutionRunRepositoryOptions,
): IExecutionRunRepository {
  if (options.desktopExecutionRunBridge) {
    return new DesktopBridgeExecutionRunRepository(options.desktopExecutionRunBridge);
  }

  if (options.sqliteDatabasePath) {
    return new SqliteExecutionRunRepository(options.sqliteDatabasePath);
  }

  if (options.fileStorage && options.rootDirectory) {
    return new LocalExecutionRunRepository({
      fileStorage: options.fileStorage,
      rootDirectory: options.rootDirectory,
    });
  }

  return new LocalStorageExecutionRunRepository(undefined, options.storage);
}

export interface CreateUnifiedExecutionInfrastructureOptions {
  readonly workflowExecutor: IWorkflowExecutor;
  readonly executionRunRepository?: IExecutionRunRepository;
  readonly datasetGenerationService?: DatasetGenerationService;
  readonly modelTrainingRuntime?: IModelTrainingRuntime;
  readonly mcpServerManager?: IMcpServerManager;
  readonly executionAssetLineageRecorder?: ExecutionAssetLineageRecorder;
}

export function createUnifiedExecutionInfrastructure(
  options: CreateUnifiedExecutionInfrastructureOptions,
): UnifiedExecutionEngine {
  const handlers: IExecutionUnitHandler[] = [new WorkflowExecutionUnitHandler(options.workflowExecutor, options.executionAssetLineageRecorder)];

  if (options.datasetGenerationService) {
    handlers.push(new DatasetGenerationExecutionUnitHandler(options.datasetGenerationService, options.executionAssetLineageRecorder));
  }

  if (options.modelTrainingRuntime) {
    handlers.push(new ModelPreparationExecutionUnitHandler(options.modelTrainingRuntime));
    handlers.push(new ModelTrainingExecutionUnitHandler(options.modelTrainingRuntime, options.executionAssetLineageRecorder));
  }

  if (options.mcpServerManager) {
    handlers.push(new McpServerOperationExecutionUnitHandler(options.mcpServerManager));
  }

  return new UnifiedExecutionEngine(handlers, options.executionRunRepository);
}

export interface ExecutionHistoryInfrastructure {
  readonly executionRunProjectionService: ExecutionRunProjectionService;
  readonly executionRunDetailProjectionService: ExecutionRunDetailProjectionService;
  readonly listExecutionRunsUseCase: ListExecutionRunsUseCase;
  readonly listRelatedExecutionRunsUseCase: ListRelatedExecutionRunsUseCase;
  readonly getExecutionRunDetailUseCase: GetExecutionRunDetailUseCase;
}

export function createExecutionHistoryInfrastructure(
  executionRunRepository: IExecutionRunRepository,
): ExecutionHistoryInfrastructure {
  const executionRunProjectionService = new ExecutionRunProjectionService();
  const executionRunDetailProjectionService = new ExecutionRunDetailProjectionService(executionRunProjectionService);

  return Object.freeze({
    executionRunProjectionService,
    executionRunDetailProjectionService,
    listExecutionRunsUseCase: new ListExecutionRunsUseCase(executionRunRepository),
    listRelatedExecutionRunsUseCase: new ListRelatedExecutionRunsUseCase(executionRunRepository),
    getExecutionRunDetailUseCase: new GetExecutionRunDetailUseCase(
      executionRunRepository,
      executionRunDetailProjectionService,
    ),
  });
}

export interface CreateExecutionApplicationInfrastructureOptions extends CreateUnifiedExecutionInfrastructureOptions {
  readonly executionRunRepository: IExecutionRunRepository;
}

export interface ExecutionApplicationInfrastructure extends ExecutionHistoryInfrastructure {
  readonly executionEngine: UnifiedExecutionEngine;
  readonly executionRunRepository: IExecutionRunRepository;
}

export function createExecutionApplicationInfrastructure(
  options: CreateExecutionApplicationInfrastructureOptions,
): ExecutionApplicationInfrastructure {
  const executionEngine = createUnifiedExecutionInfrastructure({
    workflowExecutor: options.workflowExecutor,
    executionRunRepository: options.executionRunRepository,
    datasetGenerationService: options.datasetGenerationService,
    modelTrainingRuntime: options.modelTrainingRuntime,
    mcpServerManager: options.mcpServerManager,
    executionAssetLineageRecorder: options.executionAssetLineageRecorder,
  });
  const history = createExecutionHistoryInfrastructure(options.executionRunRepository);

  return Object.freeze({
    executionEngine,
    executionRunRepository: options.executionRunRepository,
    executionRunProjectionService: history.executionRunProjectionService,
    executionRunDetailProjectionService: history.executionRunDetailProjectionService,
    listExecutionRunsUseCase: history.listExecutionRunsUseCase,
    listRelatedExecutionRunsUseCase: history.listRelatedExecutionRunsUseCase,
    getExecutionRunDetailUseCase: history.getExecutionRunDetailUseCase,
  });
}

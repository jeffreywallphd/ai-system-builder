import { UnifiedExecutionEngine, type IExecutionUnitHandler } from "../../application/execution/UnifiedExecutionEngine";
import type { IExecutionRunRepository } from "../../application/ports/interfaces/IExecutionRunRepository";
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
import { ModelPreparationExecutionUnitHandler } from "./ModelPreparationExecutionUnitHandler";
import { ModelTrainingExecutionUnitHandler } from "./ModelTrainingExecutionUnitHandler";
import { WorkflowExecutionUnitHandler } from "./WorkflowExecutionUnitHandler";

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
}

export function createUnifiedExecutionInfrastructure(
  options: CreateUnifiedExecutionInfrastructureOptions,
): UnifiedExecutionEngine {
  const handlers: IExecutionUnitHandler[] = [new WorkflowExecutionUnitHandler(options.workflowExecutor)];

  if (options.datasetGenerationService) {
    handlers.push(new DatasetGenerationExecutionUnitHandler(options.datasetGenerationService));
  }

  if (options.modelTrainingRuntime) {
    handlers.push(new ModelPreparationExecutionUnitHandler(options.modelTrainingRuntime));
    handlers.push(new ModelTrainingExecutionUnitHandler(options.modelTrainingRuntime));
  }

  return new UnifiedExecutionEngine(handlers, options.executionRunRepository);
}

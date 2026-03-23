import type { IExecutionRunRepository } from "../../application/ports/interfaces/IExecutionRunRepository";
import type { IMcpServerManager } from "../../application/ports/interfaces/IMcpServerManager";
import type { IWorkflowExecutor } from "../../application/ports/interfaces/IWorkflowExecutor";
import type { IModelTrainingRuntime } from "../../application/ports/interfaces/IModelTrainingRuntime";
import type { DatasetGenerationService } from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import { createUnifiedExecutionInfrastructure } from "./createExecutionInfrastructure";

export interface ICreateUnifiedExecutionEngineOptions {
  readonly workflowExecutor: IWorkflowExecutor;
  readonly executionRunRepository?: IExecutionRunRepository;
  readonly datasetGenerationService?: DatasetGenerationService;
  readonly modelTrainingRuntime?: IModelTrainingRuntime;
  readonly mcpServerManager?: IMcpServerManager;
}

export function createUnifiedExecutionEngine(
  options: ICreateUnifiedExecutionEngineOptions,
) {
  return createUnifiedExecutionInfrastructure(options);
}

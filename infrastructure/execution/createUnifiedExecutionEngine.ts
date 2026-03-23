import { UnifiedExecutionEngine, type IExecutionUnitHandler } from "../../application/execution/UnifiedExecutionEngine";
import type { IExecutionRunRepository } from "../../application/ports/interfaces/IExecutionRunRepository";
import type { IWorkflowExecutor } from "../../application/ports/interfaces/IWorkflowExecutor";
import type { DatasetGenerationService } from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import { DatasetGenerationExecutionUnitHandler } from "./DatasetGenerationExecutionUnitHandler";
import { WorkflowExecutionUnitHandler } from "./WorkflowExecutionUnitHandler";

export interface ICreateUnifiedExecutionEngineOptions {
  readonly workflowExecutor: IWorkflowExecutor;
  readonly executionRunRepository?: IExecutionRunRepository;
  readonly datasetGenerationService?: DatasetGenerationService;
}

export function createUnifiedExecutionEngine(
  options: ICreateUnifiedExecutionEngineOptions,
): UnifiedExecutionEngine {
  const handlers: IExecutionUnitHandler[] = [new WorkflowExecutionUnitHandler(options.workflowExecutor)];

  if (options.datasetGenerationService) {
    handlers.push(new DatasetGenerationExecutionUnitHandler(options.datasetGenerationService));
  }

  return new UnifiedExecutionEngine(handlers, options.executionRunRepository);
}

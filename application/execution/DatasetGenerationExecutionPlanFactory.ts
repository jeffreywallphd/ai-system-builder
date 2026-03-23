import { ExecutionPlan, ExecutionUnitKinds } from "../../domain/execution/ExecutionPlan";
import type {
  DatasetGenerationRequest,
  DatasetGenerationResult,
} from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import type { IExecutionPlanResult, IExecutionUnitExecutionResult } from "./UnifiedExecutionEngine";
import { getDatasetGenerationResult } from "./DatasetGenerationExecutionAdapter";

export interface IDatasetGenerationExecutionPlanEnvelope {
  readonly unitId: string;
  readonly plan: ExecutionPlan;
  readonly unitInputs: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export function createDatasetGenerationExecutionPlan(
  request: DatasetGenerationRequest,
): IDatasetGenerationExecutionPlanEnvelope {
  const unitId = `dataset-generation:${request.datasetId}:${request.versionId}`;

  return Object.freeze({
    unitId,
    plan: new ExecutionPlan({
      id: `dataset-generation:${request.datasetId}:${request.versionId}`,
      units: [
        {
          id: unitId,
          kind: ExecutionUnitKinds.datasetGeneration,
          label: `${request.taskType} dataset generation`,
        },
      ],
    }),
    unitInputs: Object.freeze({
      [unitId]: request,
    }),
    metadata: Object.freeze({
      executionKind: "dataset-generation",
      datasetId: request.datasetId,
      versionId: request.versionId,
      taskType: request.taskType,
      sourceDocumentCount: request.sourceDocuments.length,
    }),
  });
}

export function requireDatasetGenerationResult(
  planResult: IExecutionPlanResult,
  unitId: string,
): DatasetGenerationResult {
  const result = getDatasetGenerationResult(planResult.unitResults[unitId]);
  if (!result) {
    throw new Error(`Execution plan '${planResult.planId}' did not return a dataset generation result.`);
  }
  return result;
}

export function requireDatasetGenerationResultFromUnitResult(
  result: IExecutionUnitExecutionResult,
): DatasetGenerationResult {
  const datasetGenerationResult = getDatasetGenerationResult(result);
  if (!datasetGenerationResult) {
    throw new Error(`Execution unit '${result.unitId}' did not return a dataset generation result.`);
  }
  return datasetGenerationResult;
}

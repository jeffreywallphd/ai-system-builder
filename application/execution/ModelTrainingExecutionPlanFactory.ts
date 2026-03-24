import { ExecutionPlan, ExecutionUnitKinds } from "../../domain/execution/ExecutionPlan";
import type { SubmitModelTrainingJobRequest } from "../ports/interfaces/IModelTrainingRuntime";
import type { ModelTrainingJob } from "../../domain/model-training/ModelTrainingTypes";
import type { IExecutionPlanResult, IExecutionUnitExecutionResult } from "./UnifiedExecutionEngine";
import { getModelTrainingJob } from "./ModelTrainingExecutionAdapter";
import { ExecutionRuntimeCapabilityProfiles, toExecutionRuntimeCapabilityMetadata } from "./ExecutionRuntimeCapabilities";

export interface IModelTrainingExecutionPlanEnvelope {
  readonly unitId: string;
  readonly plan: ExecutionPlan;
  readonly unitInputs: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export function createModelTrainingExecutionPlan(
  request: SubmitModelTrainingJobRequest,
): IModelTrainingExecutionPlanEnvelope {
  const unitId = `model-training:${request.id}`;

  return Object.freeze({
    unitId,
    plan: new ExecutionPlan({
      id: `model-training:${request.id}`,
      units: [
        {
          id: unitId,
          kind: ExecutionUnitKinds.modelTraining,
          label: request.name,
        },
      ],
    }),
    unitInputs: Object.freeze({
      [unitId]: request,
    }),
    metadata: Object.freeze({
      executionKind: "model-training",
      trainingJobId: request.id,
      baseModelId: request.baseModelId,
      baseModelName: request.baseModelName,
      datasetId: request.datasetId,
      datasetName: request.datasetName,
      datasetVersionId: request.datasetVersionId,
      versionLabel: `v${request.datasetVersionNumber}`,
      executionMode: request.executionKind,
      exampleCount: request.examples.length,
      runtimeCapabilities: toExecutionRuntimeCapabilityMetadata(ExecutionRuntimeCapabilityProfiles.modelTraining),
      ...toExecutionRuntimeCapabilityMetadata(ExecutionRuntimeCapabilityProfiles.modelTraining),
    }),
  });
}

export function requireModelTrainingJob(
  planResult: IExecutionPlanResult,
  unitId: string,
): ModelTrainingJob {
  const job = getModelTrainingJob(planResult.unitResults[unitId]);
  if (!job) {
    throw new Error(`Execution plan '${planResult.planId}' did not return a model training job.`);
  }
  return job;
}

export function requireModelTrainingJobFromUnitResult(
  result: IExecutionUnitExecutionResult,
): ModelTrainingJob {
  const job = getModelTrainingJob(result);
  if (!job) {
    throw new Error(`Execution unit '${result.unitId}' did not return a model training job.`);
  }
  return job;
}

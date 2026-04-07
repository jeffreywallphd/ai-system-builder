import { ExecutionPlan, ExecutionUnitKinds } from "@domain/execution/ExecutionPlan";
import type { SubmitModelTrainingJobRequest } from "../ports/interfaces/IModelTrainingRuntime";
import type { ModelTrainingJob } from "@domain/model-training/ModelTrainingTypes";
import type { IExecutionPlanResult, IExecutionUnitExecutionResult } from "./UnifiedExecutionEngine";
import { getModelPreparationJob } from "./ModelPreparationExecutionAdapter";
import { ExecutionRuntimeCapabilityProfiles, toExecutionRuntimeCapabilityMetadata } from "./ExecutionRuntimeCapabilities";

export interface IModelPreparationExecutionPlanEnvelope {
  readonly unitId: string;
  readonly plan: ExecutionPlan;
  readonly unitInputs: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export function createModelPreparationExecutionPlan(
  request: SubmitModelTrainingJobRequest,
): IModelPreparationExecutionPlanEnvelope {
  const unitId = `model-preparation:${request.id}`;

  return Object.freeze({
    unitId,
    plan: new ExecutionPlan({
      id: `model-preparation:${request.id}`,
      units: [
        {
          id: unitId,
          kind: ExecutionUnitKinds.modelPreparation,
          label: request.name,
        },
      ],
    }),
    unitInputs: Object.freeze({
      [unitId]: request,
    }),
    metadata: Object.freeze({
      executionKind: "model-preparation",
      trainingJobId: request.id,
      baseModelId: request.baseModelId,
      baseModelName: request.baseModelName,
      datasetId: request.datasetId,
      datasetName: request.datasetName,
      datasetVersionId: request.datasetVersionId,
      versionLabel: `v${request.datasetVersionNumber}`,
      executionMode: request.executionKind,
      exampleCount: request.examples.length,
      runtimeCapabilities: toExecutionRuntimeCapabilityMetadata(ExecutionRuntimeCapabilityProfiles.modelPreparation),
      ...toExecutionRuntimeCapabilityMetadata(ExecutionRuntimeCapabilityProfiles.modelPreparation),
    }),
  });
}

export function requireModelPreparationJob(
  planResult: IExecutionPlanResult,
  unitId: string,
): ModelTrainingJob {
  const job = getModelPreparationJob(planResult.unitResults[unitId]);
  if (!job) {
    throw new Error(`Execution plan '${planResult.planId}' did not return a model preparation job.`);
  }
  return job;
}

export function requireModelPreparationJobFromUnitResult(
  result: IExecutionUnitExecutionResult,
): ModelTrainingJob {
  const job = getModelPreparationJob(result);
  if (!job) {
    throw new Error(`Execution unit '${result.unitId}' did not return a model preparation job.`);
  }
  return job;
}


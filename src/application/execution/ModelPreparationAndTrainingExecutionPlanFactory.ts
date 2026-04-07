import { ExecutionPlan, ExecutionUnitKinds } from "../../domain/execution/ExecutionPlan";
import type { SubmitModelTrainingJobRequest } from "../ports/interfaces/IModelTrainingRuntime";
import type { IExecutionPlanResult, IExecutionUnitExecutionResult } from "./UnifiedExecutionEngine";
import { getModelPreparationJob } from "./ModelPreparationExecutionAdapter";
import { getModelTrainingJob } from "./ModelTrainingExecutionAdapter";
import { ExecutionRuntimeCapabilityProfiles, toExecutionRuntimeCapabilityMetadata } from "./ExecutionRuntimeCapabilities";

export interface IModelPreparationAndTrainingExecutionPlanEnvelope {
  readonly preparationUnitId: string;
  readonly trainingUnitId: string;
  readonly plan: ExecutionPlan;
  readonly unitInputs: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export function createModelPreparationAndTrainingExecutionPlan(
  request: SubmitModelTrainingJobRequest,
): IModelPreparationAndTrainingExecutionPlanEnvelope {
  const preparationUnitId = `model-preparation:${request.id}:preflight`;
  const trainingUnitId = `model-training:${request.id}`;
  const flowId = `model-preparation-training:${request.id}`;
  const preparationRequest = Object.freeze({
    ...request,
    id: `${request.id}:preflight`,
    executionKind: "preparation-only" as const,
  });

  return Object.freeze({
    preparationUnitId,
    trainingUnitId,
    plan: new ExecutionPlan({
      id: flowId,
      units: [
        {
          id: preparationUnitId,
          kind: ExecutionUnitKinds.modelPreparation,
          label: `${request.name} (prepare)`,
        },
        {
          id: trainingUnitId,
          kind: ExecutionUnitKinds.modelTraining,
          label: `${request.name} (train)`,
          dependsOn: [preparationUnitId],
        },
      ],
    }),
    unitInputs: Object.freeze({
      [preparationUnitId]: preparationRequest,
      [trainingUnitId]: request,
    }),
    metadata: Object.freeze({
      executionKind: "model-training",
      executionFlowId: flowId,
      trainingJobId: request.id,
      preparationJobId: preparationRequest.id,
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
      supportsMultiUnitComposition: true,
      truthfulnessSummary: "Preparation and training are executed as a dependency-aware flow with durable execution history.",
    }),
  });
}

export function requireModelPreparationAndTrainingResult(
  planResult: IExecutionPlanResult,
  trainingUnitId: string,
): IExecutionUnitExecutionResult {
  const trainingResult = planResult.unitResults[trainingUnitId];
  if (!trainingResult) {
    throw new Error(`Execution plan '${planResult.planId}' did not return a model training unit result.`);
  }
  return trainingResult;
}

export function requireModelPreparationAndTrainingArtifacts(
  planResult: IExecutionPlanResult,
  preparationUnitId: string,
): { readonly preparationReturned: boolean } {
  return Object.freeze({
    preparationReturned: Boolean(getModelPreparationJob(planResult.unitResults[preparationUnitId])),
  });
}

export function requireModelPreparationAndTrainingJob(
  result: IExecutionUnitExecutionResult,
) {
  const job = getModelTrainingJob(result);
  if (!job) {
    throw new Error(`Execution unit '${result.unitId}' did not return a model training job.`);
  }
  return job;
}

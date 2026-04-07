import { ExecutionStatuses, ExecutionUnitKinds } from "../../src/domain/execution/ExecutionPlan";
import type { IModelTrainingRuntime, SubmitModelTrainingJobRequest } from "../../application/ports/interfaces/IModelTrainingRuntime";
import {
  createModelPreparationExecutionArtifact,
  ModelPreparationExecutionArtifacts,
  toModelPreparationExecutionProvenance,
} from "../../application/execution/ModelPreparationExecutionAdapter";
import type {
  IExecutionUnitExecutionRequest,
  IExecutionUnitExecutionResult,
  IExecutionUnitHandler,
} from "../../application/execution/UnifiedExecutionEngine";

export class ModelPreparationExecutionUnitHandler implements IExecutionUnitHandler {
  constructor(private readonly modelTrainingRuntime: IModelTrainingRuntime) {}

  public canHandle(unit: IExecutionUnitExecutionRequest["unit"]): boolean {
    return unit.kind === ExecutionUnitKinds.modelPreparation;
  }

  public async execute(
    request: IExecutionUnitExecutionRequest,
  ): Promise<IExecutionUnitExecutionResult> {
    const input = request.unitInputs?.[request.unit.id] as SubmitModelTrainingJobRequest | undefined;
    if (!input) {
      throw new Error(`Execution unit '${request.unit.id}' is missing model preparation input.`);
    }

    const job = await this.modelTrainingRuntime.submitJob(input);
    const diagnostics = Object.freeze(job.diagnostics.map((diagnostic) => Object.freeze({
      code: diagnostic.code,
      severity: diagnostic.level,
      message: diagnostic.message,
      detail: diagnostic.detail,
    })));

    return Object.freeze({
      unitId: request.unit.id,
      status: mapJobStatus(job.status),
      outputMetadata: Object.freeze({
        trainingJobId: job.id,
        jobStatus: job.status,
        artifactCount: job.artifacts.length,
        truthfulness: job.provenance.truthfulness,
        path: job.provenance.path,
      }),
      outputSummary: Object.freeze({
        headline: job.summary ?? "Prepared model bundle",
        detail: job.provenance.detail ?? `Recorded ${job.artifacts.length} preparation artifact${job.artifacts.length === 1 ? "" : "s"}.`,
        metadata: Object.freeze({
          trainingJobId: job.id,
          artifactCount: job.artifacts.length,
        }),
      }),
      provenance: toModelPreparationExecutionProvenance(job),
      diagnostics,
      artifacts: Object.freeze([
        createModelPreparationExecutionArtifact(ModelPreparationExecutionArtifacts.modelPreparationJob, job),
      ]),
      errorMessage: job.status === "failed" ? job.summary ?? "Model preparation failed." : undefined,
    });
  }
}

function mapJobStatus(status: string): IExecutionUnitExecutionResult["status"] {
  switch (status) {
    case "failed":
    case "partially-completed":
    case "reconciliation-needed":
      return ExecutionStatuses.failed;
    case "cancelled":
      return ExecutionStatuses.cancelled;
    case "exported-without-training":
    case "completed":
      return ExecutionStatuses.completed;
    default:
      return ExecutionStatuses.completed;
  }
}

import { ExecutionStatuses, ExecutionUnitKinds } from "@domain/execution/ExecutionPlan";
import type { IExecutionEngineEvent } from "@application/execution/ExecutionContracts";
import type { IExecutionDiagnostics } from "@application/execution/ExecutionContracts";
import type { IModelTrainingRuntime, SubmitModelTrainingJobRequest } from "@application/ports/interfaces/IModelTrainingRuntime";
import {
  createModelTrainingExecutionArtifact,
  ModelTrainingExecutionArtifacts,
  toModelTrainingExecutionOutputMetadata,
  toModelTrainingExecutionOutputSummary,
  toModelTrainingExecutionProvenance,
} from "@application/execution/ModelTrainingExecutionAdapter";
import type {
  IExecutionUnitExecutionRequest,
  IExecutionUnitExecutionResult,
  IExecutionUnitHandler,
  IExecutionUnitRunHandle,
} from "@application/execution/UnifiedExecutionEngine";
import type { ModelTrainingJob } from "@domain/model-training/ModelTrainingTypes";
import type { ExecutionAssetLineageRecorder } from "@application/assets-system/ExecutionAssetLineageRecorder";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTerminalStatus(status: ModelTrainingJob["status"]): boolean {
  return ["completed", "failed", "cancelled", "reconciliation-needed", "partially-completed", "exported-without-training"].includes(status);
}

function mapJobStatus(status: ModelTrainingJob["status"]): IExecutionUnitExecutionResult["status"] {
  switch (status) {
    case "failed":
    case "partially-completed":
    case "reconciliation-needed":
      return ExecutionStatuses.failed;
    case "cancelled":
      return ExecutionStatuses.cancelled;
    case "completed":
    case "exported-without-training":
    default:
      return ExecutionStatuses.completed;
  }
}

function mapEventStatus(status: ModelTrainingJob["status"]): IExecutionEngineEvent["status"] {
  switch (status) {
    case "completed":
    case "exported-without-training":
      return ExecutionStatuses.completed;
    case "failed":
    case "partially-completed":
    case "reconciliation-needed":
      return ExecutionStatuses.failed;
    case "cancelled":
      return ExecutionStatuses.cancelled;
    case "submitted":
    case "queued":
    case "running":
    default:
      return ExecutionStatuses.running;
  }
}

function toDiagnostics(job: ModelTrainingJob): ReadonlyArray<IExecutionDiagnostics> {
  return Object.freeze(job.diagnostics.map((diagnostic) => Object.freeze({
    code: diagnostic.code,
    severity: diagnostic.level,
    message: diagnostic.message,
    detail: diagnostic.detail,
  })));
}

function toUnitResult(unitId: string, job: ModelTrainingJob): IExecutionUnitExecutionResult {
  return Object.freeze({
    unitId,
    status: mapJobStatus(job.status),
    outputMetadata: toModelTrainingExecutionOutputMetadata(job),
    outputSummary: toModelTrainingExecutionOutputSummary(job),
    errorMessage: job.status === "failed" || job.status === "partially-completed" || job.status === "reconciliation-needed"
      ? job.summary ?? job.progress?.statusDetail ?? "Model training did not complete cleanly."
      : job.status === "cancelled"
        ? job.progress?.statusDetail ?? job.summary ?? "Model training was cancelled."
        : undefined,
    provenance: toModelTrainingExecutionProvenance(job),
    diagnostics: toDiagnostics(job),
    artifacts: Object.freeze([
      createModelTrainingExecutionArtifact(ModelTrainingExecutionArtifacts.modelTrainingJob, job),
    ]),
  });
}

function toExecutionEvent(
  request: IExecutionUnitExecutionRequest,
  job: ModelTrainingJob,
): IExecutionEngineEvent {
  return Object.freeze({
    planId: request.plan.id,
    runId: request.runId,
    unitId: request.unit.id,
    status: mapEventStatus(job.status),
    message: job.progress?.statusDetail ?? job.summary,
    provenance: toModelTrainingExecutionProvenance(job),
    diagnostics: toDiagnostics(job),
    outputMetadata: toModelTrainingExecutionOutputMetadata(job),
    outputSummary: toModelTrainingExecutionOutputSummary(job),
    artifacts: Object.freeze([
      createModelTrainingExecutionArtifact(ModelTrainingExecutionArtifacts.modelTrainingJob, job),
    ]),
    detail: createModelTrainingExecutionArtifact(ModelTrainingExecutionArtifacts.modelTrainingJob, job),
  });
}

export class ModelTrainingExecutionUnitHandler implements IExecutionUnitHandler {
  constructor(
    private readonly modelTrainingRuntime: IModelTrainingRuntime,
    private readonly executionAssetLineageRecorder?: ExecutionAssetLineageRecorder,
    private readonly pollIntervalMs = 250,
  ) {}

  public canHandle(unit: IExecutionUnitExecutionRequest["unit"]): boolean {
    return unit.kind === ExecutionUnitKinds.modelTraining;
  }

  public async execute(
    request: IExecutionUnitExecutionRequest,
    onEvent?: (event: IExecutionEngineEvent) => void,
  ): Promise<IExecutionUnitExecutionResult> {
    const handle = await this.startExecution(request, onEvent);
    return handle.waitForCompletion();
  }

  public async startExecution(
    request: IExecutionUnitExecutionRequest,
    onEvent?: (event: IExecutionEngineEvent) => void,
  ): Promise<IExecutionUnitRunHandle> {
    const input = request.unitInputs?.[request.unit.id] as SubmitModelTrainingJobRequest | undefined;
    if (!input) {
      throw new Error(`Execution unit '${request.unit.id}' is missing model training input.`);
    }

    let currentJob = await this.modelTrainingRuntime.submitJob(input);
    const emit = (job: ModelTrainingJob) => onEvent?.(toExecutionEvent(request, job));
    emit(currentJob);

    const completionPromise = (async (): Promise<IExecutionUnitExecutionResult> => {
      while (!isTerminalStatus(currentJob.status)) {
        await delay(this.pollIntervalMs);
        currentJob = await this.modelTrainingRuntime.refreshJob(currentJob.id) ?? currentJob;
        emit(currentJob);
      }
      await this.executionAssetLineageRecorder?.recordModelTraining({
        request: input,
        job: currentJob,
      });

      return toUnitResult(request.unit.id, currentJob);
    })();

    return Object.freeze({
      unitId: request.unit.id,
      waitForCompletion: async () => completionPromise,
      cancel: async () => {
        currentJob = await this.modelTrainingRuntime.cancelJob(currentJob.id);
        emit(currentJob);
      },
    });
  }
}


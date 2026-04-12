import type { IExecutionRunSummary } from "@domain/execution/ExecutionRun";
import type { ModelTrainingJob } from "@domain/model-training/ModelTrainingTypes";
import type { IExecutionArtifact, IExecutionEngineEvent, IExecutionProvenance } from "./ExecutionContracts";
import type { IExecutionUnitExecutionResult } from "./UnifiedExecutionEngine";

export const ModelTrainingExecutionArtifacts = Object.freeze({
  modelTrainingJob: "model-training-job",
});

export function createModelTrainingExecutionArtifact<TValue>(kind: string, value: TValue): IExecutionArtifact<TValue> {
  return Object.freeze({ kind, value });
}

export function getModelTrainingJob(
  result: IExecutionUnitExecutionResult | undefined,
): ModelTrainingJob | undefined {
  const artifact = result?.artifacts?.find((candidate) => candidate.kind === ModelTrainingExecutionArtifacts.modelTrainingJob);
  return artifact?.value as ModelTrainingJob | undefined;
}

export function getModelTrainingJobFromEvent(event: IExecutionEngineEvent | undefined): ModelTrainingJob | undefined {
  if (event?.detail?.kind !== ModelTrainingExecutionArtifacts.modelTrainingJob) {
    return undefined;
  }

  return event.detail.value as ModelTrainingJob | undefined;
}

export function toModelTrainingExecutionProvenance(job: ModelTrainingJob): IExecutionProvenance {
  const classification = job.provenance.truthfulness === "fallback"
    ? "hybrid"
    : job.provenance.truthfulness === "exported-without-training"
      ? "delegated"
      : "real";

  return Object.freeze({
    classification,
    executorId: job.provenance.backend,
    runtime: job.provenance.runtime,
    detail: job.provenance.detail ?? job.summary,
    fallback: job.provenance.fallbackReason
      ? Object.freeze({ kind: "model-training-fallback", isActive: true, reason: job.provenance.fallbackReason })
      : undefined,
    diagnostics: Object.freeze(job.provenance.diagnostics.map((diagnostic) => Object.freeze({
      code: diagnostic.code,
      severity: diagnostic.level,
      message: diagnostic.message,
      detail: diagnostic.detail,
    }))),
    metadata: Object.freeze({
      path: job.provenance.path,
      backend: job.provenance.backend,
      truthfulness: job.provenance.truthfulness,
      runMode: job.provenance.runMode,
      provider: job.provenance.provider,
      modelIdentity: job.provenance.modelIdentity,
      supportsGradientTraining: job.provenance.supportsGradientTraining,
      isPreparationOnly: job.provenance.isPreparationOnly,
    }),
    sourceKind: "model-training",
  });
}

export function toModelTrainingExecutionOutputMetadata(job: ModelTrainingJob): Readonly<Record<string, unknown>> {
  return Object.freeze({
    trainingJobId: job.id,
    jobStatus: job.status,
    truthfulness: job.provenance.truthfulness,
    executionKind: job.executionKind,
    artifactCount: job.artifacts.length,
    checkpointCount: job.checkpoints.length,
    progressPercent: job.progress?.percent,
    currentEpoch: job.progress?.currentEpoch,
    totalEpochs: job.progress?.totalEpochs,
    currentStep: job.progress?.currentStep,
    totalSteps: job.progress?.totalSteps,
    latestMetricName: job.progress?.latestMetricName,
    latestMetricValue: job.progress?.latestMetricValue,
    outputModelName: job.outputModelName,
    path: job.provenance.path,
  });
}

export function toModelTrainingExecutionOutputSummary(job: ModelTrainingJob): IExecutionRunSummary {
  return Object.freeze({
    headline: describeModelTrainingHeadline(job),
    detail: job.progress?.statusDetail
      ?? job.summary
      ?? describeModelTrainingDetail(job),
    metadata: Object.freeze({
      trainingJobId: job.id,
      jobStatus: job.status,
      artifactCount: job.artifacts.length,
      checkpointCount: job.checkpoints.length,
      progressPercent: job.progress?.percent,
    }),
  });
}

function describeModelTrainingHeadline(job: ModelTrainingJob): string {
  switch (job.status) {
    case "submitted":
      return "Local training submitted";
    case "queued":
      return "Local training queued";
    case "running":
      return "Local training running";
    case "completed":
      return "Local training completed";
    case "cancelled":
      return "Local training cancelled";
    case "partially-completed":
      return "Local training partially completed";
    case "reconciliation-needed":
      return "Training reconciliation needed";
    case "failed":
      return "Local training failed";
    case "exported-without-training":
      return "Exported without training";
    default:
      return "Model training update";
  }
}

function describeModelTrainingDetail(job: ModelTrainingJob): string {
  if (job.status === "completed") {
    return `Recorded ${job.artifacts.length} artifact${job.artifacts.length === 1 ? "" : "s"} and ${job.checkpoints.length} checkpoint${job.checkpoints.length === 1 ? "" : "s"}.`;
  }

  if (job.status === "running" || job.status === "queued" || job.status === "submitted") {
    return `Progress ${job.progress?.percent ?? 0}%${job.progress?.currentEpoch ? ` at epoch ${job.progress.currentEpoch}/${job.progress.totalEpochs ?? job.configuration.epochs}` : ""}.`;
  }

  if (job.status === "cancelled") {
    return job.summary ?? "Training was cancelled before clean completion.";
  }

  if (job.status === "partially-completed") {
    return "Training stopped after persisting partial checkpoints and diagnostics.";
  }

  if (job.status === "reconciliation-needed") {
    return "The runtime requires reconciliation before the final durable state can be trusted.";
  }

  return job.summary ?? "Training did not complete cleanly.";
}


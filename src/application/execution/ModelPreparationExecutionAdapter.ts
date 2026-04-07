import type { ModelTrainingJob } from "../../domain/model-training/ModelTrainingTypes";
import type { IExecutionArtifact, IExecutionProvenance } from "./ExecutionContracts";
import type { IExecutionUnitExecutionResult } from "./UnifiedExecutionEngine";

export const ModelPreparationExecutionArtifacts = Object.freeze({
  modelPreparationJob: "model-preparation-job",
});

export function createModelPreparationExecutionArtifact<TValue>(kind: string, value: TValue): IExecutionArtifact<TValue> {
  return Object.freeze({ kind, value });
}

export function getModelPreparationJob(
  result: IExecutionUnitExecutionResult | undefined,
): ModelTrainingJob | undefined {
  const artifact = result?.artifacts?.find((candidate) => candidate.kind === ModelPreparationExecutionArtifacts.modelPreparationJob);
  return artifact?.value as ModelTrainingJob | undefined;
}

export function toModelPreparationExecutionProvenance(job: ModelTrainingJob): IExecutionProvenance {
  const classification = job.provenance.truthfulness === "exported-without-training"
    ? "delegated"
    : job.provenance.truthfulness === "fallback"
      ? "hybrid"
      : job.provenance.truthfulness === "preparation-only"
        ? "real"
        : "real";

  return Object.freeze({
    classification,
    executorId: job.provenance.backend,
    runtime: job.provenance.runtime,
    detail: job.provenance.detail ?? job.summary,
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
    sourceKind: "model-preparation",
  });
}

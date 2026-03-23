import type {
  DatasetGenerationProvenance,
  DatasetGenerationResult,
} from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import type {
  IExecutionArtifact,
  IExecutionProvenance,
} from "./ExecutionContracts";
import type { IExecutionUnitExecutionResult } from "./UnifiedExecutionEngine";

export const DatasetGenerationExecutionArtifacts = Object.freeze({
  datasetGenerationResult: "dataset-generation-result",
});

export function toDatasetGenerationExecutionProvenance(
  provenance: DatasetGenerationProvenance,
): IExecutionProvenance {
  const classification = provenance.executionKind === "heuristic-fallback"
    ? "scaffolded"
    : provenance.isFallback || provenance.isDegraded
      ? "hybrid"
      : "delegated";

  return Object.freeze({
    classification,
    executorId: provenance.generatorId,
    runtime: provenance.provider,
    detail: provenance.detail ?? provenance.path,
    fallback: provenance.fallback
      ? Object.freeze({
          kind: provenance.fallback.fromMode ?? provenance.mode,
          isActive: true,
          reason: provenance.fallback.reason,
        })
      : undefined,
    diagnostics: Object.freeze(
      provenance.diagnostics.map((diagnostic) => Object.freeze({
        code: diagnostic.code,
        severity: diagnostic.level,
        message: diagnostic.message,
        detail: diagnostic.detail,
      }))
    ),
    metadata: Object.freeze({
      mode: provenance.mode,
      executionKind: provenance.executionKind,
      provider: provenance.provider,
      modelId: provenance.modelId,
      modelDisplayName: provenance.modelDisplayName,
      batchId: provenance.batchId,
      path: provenance.path,
      isFallback: provenance.isFallback,
      isDegraded: provenance.isDegraded,
      parameters: provenance.parameters,
      startedAt: provenance.startedAt.toISOString(),
      executedAt: provenance.executedAt.toISOString(),
      durationMs: provenance.durationMs,
      fallbackReason: provenance.fallbackReason,
    }),
    sourceKind: "dataset-generation",
  });
}

export function createDatasetGenerationExecutionArtifact<TValue>(kind: string, value: TValue): IExecutionArtifact<TValue> {
  return Object.freeze({ kind, value });
}

export function getDatasetGenerationResult(
  result: IExecutionUnitExecutionResult | undefined,
): DatasetGenerationResult | undefined {
  const artifact = result?.artifacts?.find(
    (candidate) => candidate.kind === DatasetGenerationExecutionArtifacts.datasetGenerationResult,
  );
  return artifact?.value as DatasetGenerationResult | undefined;
}

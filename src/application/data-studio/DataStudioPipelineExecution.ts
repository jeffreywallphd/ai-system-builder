import { ExecutionPlan, ExecutionStatuses, ExecutionUnitKinds } from "@domain/execution/ExecutionPlan";
import type { IExecutionProvenance } from "../execution/ExecutionContracts";
import type {
  IExecutionPlanResult,
  IExecutionUnitExecutionResult,
} from "../execution/UnifiedExecutionEngine";
import type { PipelineStageId } from "@domain/dataset-studio/PipelineStageDomain";
import type { DataStudioPipelineState } from "./DataStudioPipelineState";

export const DataStudioPipelineExecutionArtifacts = Object.freeze({
  pipelineExecutionResult: "data-studio-pipeline-execution-result",
});

export interface DataStudioPipelineExecutionUnitInput {
  readonly pipelineState: DataStudioPipelineState;
  readonly initiatedBy?: string;
  readonly executionReason?: string;
}

export interface DataStudioPipelineStageExecutionRecord {
  readonly stageId: PipelineStageId;
  readonly order: number;
  readonly status: "completed" | "skipped" | "failed";
  readonly message: string;
  readonly resolvedAssetIds: ReadonlyArray<string>;
  readonly startedAt: string;
  readonly completedAt: string;
}

export type DataStudioPipelineExecutionStageRecord = DataStudioPipelineStageExecutionRecord;

export interface DataStudioPipelineExecutionPreparedOutput {
  readonly preparedAssetId: string;
  readonly preparedAssetVersionId: string;
  readonly storageTargetId: string;
  readonly storageReference: string;
  readonly lineageId: string;
}

export interface DataStudioPipelineExecutionResult {
  readonly pipelineId: string;
  readonly pipelineAssetId: string;
  readonly status: "completed" | "failed";
  readonly stageResults: ReadonlyArray<DataStudioPipelineStageExecutionRecord>;
  readonly preparedOutput?: DataStudioPipelineExecutionPreparedOutput;
  readonly lineageId?: string;
  readonly reusableAssetId?: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly warnings: ReadonlyArray<string>;
  readonly errors: ReadonlyArray<string>;
}

export interface DataStudioPipelineExecutionPlanEnvelope {
  readonly unitId: string;
  readonly plan: ExecutionPlan;
  readonly unitInputs: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export function createDataStudioPipelineExecutionPlan(
  input: DataStudioPipelineExecutionUnitInput,
): DataStudioPipelineExecutionPlanEnvelope {
  const pipelineId = input.pipelineState.identity.pipelineId;
  const unitId = `data-pipeline:${pipelineId}`;

  return Object.freeze({
    unitId,
    plan: new ExecutionPlan({
      id: unitId,
      units: Object.freeze([
        Object.freeze({
          id: unitId,
          kind: ExecutionUnitKinds.dataPipeline,
          label: `Data Pipeline ${pipelineId}`,
        }),
      ]),
    }),
    unitInputs: Object.freeze({
      [unitId]: Object.freeze({ ...input }),
    }),
    metadata: Object.freeze({
      executionKind: "data-pipeline",
      pipelineId,
      pipelineAssetId: input.pipelineState.identity.assetId,
      draftId: input.pipelineState.identity.draftId,
      authoringMode: input.pipelineState.flow.authoringMode,
      currentStageId: input.pipelineState.flow.currentStageId,
    }),
  });
}

export function createDataStudioPipelineExecutionProvenance(
  result: DataStudioPipelineExecutionResult,
): IExecutionProvenance {
  const classification = result.status === "completed" ? "real" : "hybrid";
  return Object.freeze({
    classification,
    executorId: "data-studio-pipeline-runtime",
    runtime: "data-studio-stage-runtime",
    detail: result.status === "completed"
      ? "Data Studio stage pipeline executed through unified execution engine."
      : "Data Studio stage pipeline failed during stage runtime execution.",
    metadata: Object.freeze({
      pipelineId: result.pipelineId,
      pipelineAssetId: result.pipelineAssetId,
      stageCount: result.stageResults.length,
      completedStageCount: result.stageResults.filter((stage) => stage.status === "completed").length,
      warningCount: result.warnings.length,
      errorCount: result.errors.length,
      lineageId: result.lineageId,
      reusableAssetId: result.reusableAssetId,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
    }),
    diagnostics: Object.freeze([
      ...result.warnings.map((message) => Object.freeze({
        code: "data-pipeline-warning",
        severity: "warning" as const,
        message,
      })),
      ...result.errors.map((message) => Object.freeze({
        code: "data-pipeline-error",
        severity: "error" as const,
        message,
      })),
    ]),
    sourceKind: "data-pipeline",
  });
}

export function getDataStudioPipelineExecutionResult(
  result: IExecutionUnitExecutionResult | undefined,
): DataStudioPipelineExecutionResult | undefined {
  const artifact = result?.artifacts?.find(
    (candidate) => candidate.kind === DataStudioPipelineExecutionArtifacts.pipelineExecutionResult,
  );
  return artifact?.value as DataStudioPipelineExecutionResult | undefined;
}

export function requireDataStudioPipelineExecutionResult(
  planResult: IExecutionPlanResult,
  unitId: string,
): DataStudioPipelineExecutionResult {
  const result = getDataStudioPipelineExecutionResult(planResult.unitResults[unitId]);
  if (!result) {
    throw new Error(`Execution plan '${planResult.planId}' did not return a Data Studio pipeline execution result.`);
  }
  return result;
}

export function isDataStudioPipelineExecutionSuccessful(planResult: IExecutionPlanResult): boolean {
  return planResult.status === ExecutionStatuses.completed;
}


import type { SystemContextContract } from "../../src/domain/system-studio/SystemContextContract";
import type {
  PersistReferenceImageOutputsReadModel,
  PersistReferenceImageOutputsRequest,
} from "../../src/infrastructure/api/studio-shell/StudioShellBackendApi";
import type { RuntimeExecutionResultReadModel } from "../../src/infrastructure/api/system-runtime/SystemRuntimeBackendApi";
import {
  ReferenceImagePerformancePhaseIds,
  ReferenceImagePerformanceTelemetrySession,
  type ReferenceImagePerformanceRunReport,
} from "./ReferenceImagePerformanceTelemetry";

export const ReferenceImageExecutionStepIds = Object.freeze({
  trigger: "trigger",
  execution: "execution",
  persistence: "persistence",
  refresh: "refresh",
});

export type ReferenceImageExecutionStepId =
  typeof ReferenceImageExecutionStepIds[keyof typeof ReferenceImageExecutionStepIds];

export type ReferenceImageExecutionStepStatus =
  | "started"
  | "running"
  | "completed"
  | "failed"
  | "partially-completed";

export interface ReferenceImageExecutionFlowIssue {
  readonly stepId: ReferenceImageExecutionStepId;
  readonly code: string;
  readonly userMessage: string;
  readonly technicalMessage?: string;
}

export interface ReferenceImageExecutionFlowStep {
  readonly stepId: ReferenceImageExecutionStepId;
  readonly status: ReferenceImageExecutionStepStatus;
  readonly userLabel: string;
  readonly details?: string;
}

export interface ReferenceImageExecutionFlowSnapshot {
  readonly executionId?: string;
  readonly overallStatus: "running" | "completed" | "failed" | "partially-completed";
  readonly steps: ReadonlyArray<ReferenceImageExecutionFlowStep>;
  readonly issues: ReadonlyArray<ReferenceImageExecutionFlowIssue>;
}

export interface RunReferenceImageExecutionFlowRequest {
  readonly startExecution: () => Promise<{ readonly ok: boolean; readonly executionId?: string; readonly errorMessage?: string }>;
  readonly getExecutionResult: (executionId: string) => Promise<{ readonly ok: boolean; readonly data?: RuntimeExecutionResultReadModel; readonly errorMessage?: string }>;
  readonly persistOutputs: (request: PersistReferenceImageOutputsRequest) => Promise<{ readonly ok: boolean; readonly data?: PersistReferenceImageOutputsReadModel; readonly errorMessage?: string }>;
  readonly refreshViews: () => Promise<void>;
  readonly persistenceRequestFactory: (input: {
    readonly executionId: string;
    readonly runtimeResult?: RuntimeExecutionResultReadModel;
  }) => PersistReferenceImageOutputsRequest;
  readonly onSnapshot: (snapshot: ReferenceImageExecutionFlowSnapshot) => void;
  readonly onPerformanceReport?: (report: ReferenceImagePerformanceRunReport) => void;
}

function labelForStep(stepId: ReferenceImageExecutionStepId): string {
  if (stepId === ReferenceImageExecutionStepIds.trigger) {
    return "Preparing";
  }
  if (stepId === ReferenceImageExecutionStepIds.execution) {
    return "Working";
  }
  if (stepId === ReferenceImageExecutionStepIds.persistence) {
    return "Saving";
  }
  return "Finished";
}

export class ReferenceImageExecutionFlowService {
  public async run(request: RunReferenceImageExecutionFlowRequest): Promise<ReferenceImageExecutionFlowSnapshot> {
    const issues: ReferenceImageExecutionFlowIssue[] = [];
    const steps = new Map<ReferenceImageExecutionStepId, ReferenceImageExecutionFlowStep>();
    let executionId: string | undefined;
    let persistedItemCount = 0;
    let batchItemCount = 0;
    const telemetry = new ReferenceImagePerformanceTelemetrySession();

    const publish = (overallStatus: ReferenceImageExecutionFlowSnapshot["overallStatus"]) => {
      const snapshot = Object.freeze({
        executionId,
        overallStatus,
        steps: Object.freeze(Array.from(steps.values())),
        issues: Object.freeze([...issues]),
      });
      request.onSnapshot(snapshot);
      return snapshot;
    };

    const upsertStep = (stepId: ReferenceImageExecutionStepId, status: ReferenceImageExecutionStepStatus, details?: string) => {
      steps.set(stepId, Object.freeze({ stepId, status, userLabel: labelForStep(stepId), details }));
    };

    telemetry.startPhase(ReferenceImagePerformancePhaseIds.preparation);
    upsertStep(ReferenceImageExecutionStepIds.trigger, "started");
    publish("running");

    upsertStep(ReferenceImageExecutionStepIds.trigger, "running");
    publish("running");
    const started = await request.startExecution();
    if (!started.ok || !started.executionId) {
      upsertStep(ReferenceImageExecutionStepIds.trigger, "failed", "Couldn’t finish this image.");
      issues.push(Object.freeze({
        stepId: ReferenceImageExecutionStepIds.trigger,
        code: "start-failed",
        userMessage: "Couldn’t finish this image.",
        technicalMessage: started.errorMessage,
      }));
      telemetry.endPhase(ReferenceImagePerformancePhaseIds.preparation);
      const failed = publish("failed");
      request.onPerformanceReport?.(telemetry.finalize({ runId: executionId, status: failed.overallStatus, persistedItemCount, batchItemCount }));
      return failed;
    }
    executionId = started.executionId;
    telemetry.endPhase(ReferenceImagePerformancePhaseIds.preparation);
    upsertStep(ReferenceImageExecutionStepIds.trigger, "completed", executionId);

    telemetry.startPhase(ReferenceImagePerformancePhaseIds.execution);
    upsertStep(ReferenceImageExecutionStepIds.execution, "running");
    publish("running");
    const result = await request.getExecutionResult(executionId);
    const runtimeResult = result.ok ? result.data : undefined;
    if (!result.ok) {
      upsertStep(ReferenceImageExecutionStepIds.execution, "failed", "Couldn’t finish this image.");
      issues.push(Object.freeze({
        stepId: ReferenceImageExecutionStepIds.execution,
        code: "execution-result-read-failed",
        userMessage: "Couldn’t finish this image.",
        technicalMessage: result.errorMessage,
      }));
    } else if (runtimeResult?.status === "failed" || runtimeResult?.status === "cancelled") {
      upsertStep(ReferenceImageExecutionStepIds.execution, "failed", "Couldn’t finish this image.");
      issues.push(Object.freeze({
        stepId: ReferenceImageExecutionStepIds.execution,
        code: `execution-${runtimeResult.status}`,
        userMessage: "Couldn’t finish this image.",
        technicalMessage: runtimeResult.diagnostics[0]?.message,
      }));
    } else {
      upsertStep(ReferenceImageExecutionStepIds.execution, "completed");
    }
    telemetry.endPhase(ReferenceImagePerformancePhaseIds.execution);

    telemetry.startPhase(ReferenceImagePerformancePhaseIds.persistence);
    upsertStep(ReferenceImageExecutionStepIds.persistence, "running");
    publish("running");
    const persisted = await request.persistOutputs(request.persistenceRequestFactory({ executionId, runtimeResult }));
    const appendPersistenceDiagnostics = (codePrefix: string, userFallback: string) => {
      for (const diagnostic of persisted.data?.diagnostics ?? []) {
        issues.push(Object.freeze({
          stepId: ReferenceImageExecutionStepIds.persistence,
          code: `${codePrefix}:${diagnostic.code}`,
          userMessage: diagnostic.userMessage || persisted.data?.userMessage || userFallback,
          technicalMessage: diagnostic.technicalMessage,
        }));
      }
    };
    if (!persisted.ok || !persisted.data) {
      upsertStep(ReferenceImageExecutionStepIds.persistence, "failed", "We couldn’t save this result.");
      issues.push(Object.freeze({
        stepId: ReferenceImageExecutionStepIds.persistence,
        code: "save-failed",
        userMessage: "We couldn’t save this result.",
        technicalMessage: persisted.errorMessage,
      }));
    } else if (persisted.data.executionOutcome === "partial-failure" || persisted.data.status === "partial") {
      persistedItemCount = persisted.data.persistedRecordIds.length;
      batchItemCount = Math.max(batchItemCount, persisted.data.persistedRecordIds.length);
      upsertStep(
        ReferenceImageExecutionStepIds.persistence,
        "partially-completed",
        persisted.data.userMessage || "Some results were saved.",
      );
      for (const message of persisted.data.failureMessages) {
        issues.push(Object.freeze({
          stepId: ReferenceImageExecutionStepIds.persistence,
          code: "save-partial",
          userMessage: persisted.data.userMessage || "Some results could not be saved.",
          technicalMessage: message,
        }));
      }
      appendPersistenceDiagnostics("save-partial", "Some results could not be saved.");
    } else if (persisted.data.executionOutcome === "non-recoverable-failure") {
      persistedItemCount = persisted.data.persistedRecordIds.length;
      batchItemCount = Math.max(batchItemCount, persisted.data.persistedRecordIds.length);
      upsertStep(
        ReferenceImageExecutionStepIds.persistence,
        "failed",
        persisted.data.userMessage || "Something went wrong while creating this image.",
      );
      for (const message of persisted.data.failureMessages) {
        issues.push(Object.freeze({
          stepId: ReferenceImageExecutionStepIds.persistence,
          code: "save-non-recoverable",
          userMessage: persisted.data.userMessage || "Something went wrong while creating this image.",
          technicalMessage: message,
        }));
      }
      appendPersistenceDiagnostics("save-non-recoverable", "Something went wrong while creating this image.");
    } else if (persisted.data.executionOutcome === "recoverable-failure" || persisted.data.status === "failed") {
      persistedItemCount = persisted.data.persistedRecordIds.length;
      batchItemCount = Math.max(batchItemCount, persisted.data.persistedRecordIds.length);
      upsertStep(
        ReferenceImageExecutionStepIds.persistence,
        "failed",
        persisted.data.userMessage || "Something went wrong while creating this image.",
      );
      for (const message of persisted.data.failureMessages) {
        issues.push(Object.freeze({
          stepId: ReferenceImageExecutionStepIds.persistence,
          code: "save-rejected",
          userMessage: persisted.data.userMessage || "Something went wrong while creating this image.",
          technicalMessage: message,
        }));
      }
      appendPersistenceDiagnostics("save-rejected", "Something went wrong while creating this image.");
    } else {
      persistedItemCount = persisted.data.persistedRecordIds.length;
      batchItemCount = Math.max(batchItemCount, persisted.data.persistedRecordIds.length);
      upsertStep(ReferenceImageExecutionStepIds.persistence, "completed", `Saved ${persisted.data.persistedRecordIds.length} image(s).`);
    }
    telemetry.endPhase(ReferenceImagePerformancePhaseIds.persistence);

    telemetry.startPhase(ReferenceImagePerformancePhaseIds.refresh);
    upsertStep(ReferenceImageExecutionStepIds.refresh, "running", "Refreshing saved results");
    publish("running");
    try {
      await request.refreshViews();
      upsertStep(ReferenceImageExecutionStepIds.refresh, "completed");
    } catch (error) {
      upsertStep(ReferenceImageExecutionStepIds.refresh, "failed", "Couldn’t refresh results.");
      issues.push(Object.freeze({
        stepId: ReferenceImageExecutionStepIds.refresh,
        code: "refresh-failed",
        userMessage: "Couldn’t refresh results.",
        technicalMessage: error instanceof Error ? error.message : "Result refresh failed.",
      }));
    }
    telemetry.endPhase(ReferenceImagePerformancePhaseIds.refresh);

    const hasFailed = Array.from(steps.values()).some((entry) => entry.status === "failed");
    const hasPartial = Array.from(steps.values()).some((entry) => entry.status === "partially-completed");
    const finalSnapshot = publish(hasFailed ? "failed" : hasPartial ? "partially-completed" : "completed");
    request.onPerformanceReport?.(telemetry.finalize({
      runId: executionId,
      status: finalSnapshot.overallStatus,
      persistedItemCount,
      batchItemCount: batchItemCount > 0 ? batchItemCount : persistedItemCount,
    }));
    return finalSnapshot;
  }
}

export function createReferenceImageOutputPersistenceRequest(input: {
  readonly studioId: string;
  readonly draftId: string;
  readonly executionId: string;
  readonly sourceRecordId?: string;
  readonly sourceAssetId?: string;
  readonly parameterSnapshot: Readonly<Record<string, unknown>>;
  readonly runtimeContext: SystemContextContract;
  readonly workflowAssetId: string;
  readonly workflowAssetVersionId: string;
  readonly systemAssetId: string;
  readonly runtimeResult?: RuntimeExecutionResultReadModel;
}): PersistReferenceImageOutputsRequest {
  return Object.freeze({
    studioId: input.studioId,
    draftId: input.draftId,
    executionId: input.executionId,
    sourceRecordId: input.sourceRecordId,
    sourceAssetId: input.sourceAssetId,
    parameterSnapshot: input.parameterSnapshot,
    runtimeContext: input.runtimeContext,
    workflowAssetId: input.workflowAssetId,
    workflowAssetVersionId: input.workflowAssetVersionId,
    systemAssetId: input.systemAssetId,
    runtimeResult: input.runtimeResult
      ? {
        output: input.runtimeResult.output,
        status: input.runtimeResult.status,
        diagnostics: input.runtimeResult.diagnostics,
      }
      : undefined,
  });
}

import type { SystemContextContract } from "../../domain/system-studio/SystemContextContract";
import type {
  PersistReferenceImageOutputsReadModel,
  PersistReferenceImageOutputsRequest,
} from "../../infrastructure/api/studio-shell/StudioShellBackendApi";
import type { RuntimeExecutionResultReadModel } from "../../infrastructure/api/system-runtime/SystemRuntimeBackendApi";

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
}

function labelForStep(stepId: ReferenceImageExecutionStepId): string {
  if (stepId === ReferenceImageExecutionStepIds.trigger) {
    return "Run started";
  }
  if (stepId === ReferenceImageExecutionStepIds.execution) {
    return "Generating result";
  }
  if (stepId === ReferenceImageExecutionStepIds.persistence) {
    return "Saving result";
  }
  return "Refreshing results";
}

export class ReferenceImageExecutionFlowService {
  public async run(request: RunReferenceImageExecutionFlowRequest): Promise<ReferenceImageExecutionFlowSnapshot> {
    const issues: ReferenceImageExecutionFlowIssue[] = [];
    const steps = new Map<ReferenceImageExecutionStepId, ReferenceImageExecutionFlowStep>();
    let executionId: string | undefined;

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
      return publish("failed");
    }
    executionId = started.executionId;
    upsertStep(ReferenceImageExecutionStepIds.trigger, "completed", executionId);

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

    upsertStep(ReferenceImageExecutionStepIds.persistence, "running");
    publish("running");
    const persisted = await request.persistOutputs(request.persistenceRequestFactory({ executionId, runtimeResult }));
    if (!persisted.ok || !persisted.data) {
      upsertStep(ReferenceImageExecutionStepIds.persistence, "failed", "We couldn’t save this result.");
      issues.push(Object.freeze({
        stepId: ReferenceImageExecutionStepIds.persistence,
        code: "save-failed",
        userMessage: "We couldn’t save this result.",
        technicalMessage: persisted.errorMessage,
      }));
    } else if (persisted.data.executionOutcome === "partial-failure" || persisted.data.status === "partial") {
      upsertStep(ReferenceImageExecutionStepIds.persistence, "partially-completed", "Some results were saved.");
      for (const message of persisted.data.failureMessages) {
        issues.push(Object.freeze({
          stepId: ReferenceImageExecutionStepIds.persistence,
          code: "save-partial",
          userMessage: "Some results could not be saved.",
          technicalMessage: message,
        }));
      }
    } else if (persisted.data.executionOutcome === "non-recoverable-failure") {
      upsertStep(ReferenceImageExecutionStepIds.persistence, "failed", "Something went wrong while creating this image.");
      for (const message of persisted.data.failureMessages) {
        issues.push(Object.freeze({
          stepId: ReferenceImageExecutionStepIds.persistence,
          code: "save-non-recoverable",
          userMessage: "Something went wrong while creating this image.",
          technicalMessage: message,
        }));
      }
    } else if (persisted.data.executionOutcome === "recoverable-failure" || persisted.data.status === "failed") {
      upsertStep(ReferenceImageExecutionStepIds.persistence, "failed", "Something went wrong while creating this image.");
      for (const message of persisted.data.failureMessages) {
        issues.push(Object.freeze({
          stepId: ReferenceImageExecutionStepIds.persistence,
          code: "save-rejected",
          userMessage: "Something went wrong while creating this image.",
          technicalMessage: message,
        }));
      }
    } else {
      upsertStep(ReferenceImageExecutionStepIds.persistence, "completed", `Saved ${persisted.data.persistedRecordIds.length} image(s).`);
    }

    upsertStep(ReferenceImageExecutionStepIds.refresh, "running", "Preparing image preview");
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

    const hasFailed = Array.from(steps.values()).some((entry) => entry.status === "failed");
    const hasPartial = Array.from(steps.values()).some((entry) => entry.status === "partially-completed");
    return publish(hasFailed ? "failed" : hasPartial ? "partially-completed" : "completed");
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
      }
      : undefined,
  });
}

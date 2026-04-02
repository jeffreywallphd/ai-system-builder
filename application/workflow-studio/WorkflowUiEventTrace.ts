import type { UiTriggerEvent } from "./UiTriggerEventContract";
import type { WorkflowUiInteractionDispatchRecord, WorkflowUiInteractionIssue } from "./WorkflowUiInteractionContracts";

export const WorkflowUiEventTraceStages = Object.freeze({
  received: "received",
  bindingResolved: "binding-resolved",
  dispatchStarted: "dispatch-started",
  dispatchSucceeded: "dispatch-succeeded",
  dispatchFailed: "dispatch-failed",
});

export type WorkflowUiEventTraceStage = typeof WorkflowUiEventTraceStages[keyof typeof WorkflowUiEventTraceStages];

export interface WorkflowUiEventTraceEntry {
  readonly traceId: string;
  readonly occurredAt: string;
  readonly stage: WorkflowUiEventTraceStage;
  readonly event: {
    readonly eventId: string;
    readonly kind: UiTriggerEvent["kind"];
    readonly name: string;
    readonly sourceStudio: UiTriggerEvent["source"]["studio"];
    readonly sourceComponentId: string;
    readonly sourceActionId?: string;
  };
  readonly binding?: {
    readonly triggerId?: string;
    readonly triggerType?: string;
    readonly bindingId?: string;
  };
  readonly workflow?: {
    readonly workflowAssetId?: string;
    readonly workflowRunId?: string;
    readonly systemAssetId?: string;
  };
  readonly parameterSummary: {
    readonly keyCount: number;
    readonly keys: ReadonlyArray<string>;
  };
  readonly dispatchStatus: "pending" | "accepted" | "rejected";
  readonly outcome?: "success" | "failed";
  readonly issues?: ReadonlyArray<Pick<WorkflowUiInteractionIssue, "code" | "message" | "stage">>;
  readonly correlation?: {
    readonly uiEventId: string;
    readonly executionId?: string;
    readonly workflowRunId?: string;
  };
}

export interface WorkflowUiEventTraceSink {
  readonly record: (entry: WorkflowUiEventTraceEntry) => void;
}

export function createWorkflowUiEventTraceId(eventId: string, stage: WorkflowUiEventTraceStage): string {
  return `ui-trace:${eventId}:${stage}:${Date.now().toString(36)}`;
}

export function summarizeUiEventPayload(payload: Readonly<Record<string, unknown>>): WorkflowUiEventTraceEntry["parameterSummary"] {
  const keys = Object.keys(payload)
    .map((key) => key.trim())
    .filter((key) => key.length > 0)
    .slice(0, 12);
  return Object.freeze({
    keyCount: keys.length,
    keys: Object.freeze(keys),
  });
}

export function mapDispatchRecordToTraceIssue(
  record: WorkflowUiInteractionDispatchRecord,
): WorkflowUiEventTraceEntry["issues"] | undefined {
  if (record.launchStatus !== "failed" && record.launchStatus !== "blocked") {
    return undefined;
  }
  const codes = record.blockingIssueCodes.length > 0 ? record.blockingIssueCodes : ["workflow-dispatch-failed"];
  return Object.freeze(codes.map((code) => Object.freeze({
    code,
    message: code,
    stage: "execution" as const,
  })));
}

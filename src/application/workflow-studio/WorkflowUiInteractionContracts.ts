import type { RunWorkflowDraftManualResult } from "./WorkflowStudioApplicationService";
import type { UiTriggerEvent } from "./UiTriggerEventContract";

export const WorkflowUiInteractionIssueCodes = Object.freeze({
  invalidUiEventPayload: "invalid-ui-event-payload",
  missingOrInvalidBinding: "missing-or-invalid-binding",
  parameterMappingFailed: "parameter-mapping-failed",
  dispatchFailure: "dispatch-failure",
  workflowExecutionLaunchFailed: "workflow-execution-launch-failed",
});

export type WorkflowUiInteractionIssueCode =
  typeof WorkflowUiInteractionIssueCodes[keyof typeof WorkflowUiInteractionIssueCodes];

export const WorkflowUiInteractionStatusKinds = Object.freeze({
  received: "received",
  validationFailed: "validation-failed",
  noBindingMatched: "no-binding-matched",
  dispatching: "dispatching",
  launchBlocked: "launch-blocked",
  launchFailed: "launch-failed",
  launched: "launched",
  executionFailed: "execution-failed",
});

export type WorkflowUiInteractionStatusKind =
  typeof WorkflowUiInteractionStatusKinds[keyof typeof WorkflowUiInteractionStatusKinds];

export interface WorkflowUiInteractionIssue {
  readonly code: WorkflowUiInteractionIssueCode;
  readonly message: string;
  readonly category: "validation" | "binding" | "parameters" | "dispatch" | "execution";
  readonly stage: "event" | "binding" | "parameter-mapping" | "dispatch" | "execution";
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface WorkflowUiInteractionDispatchRecord {
  readonly triggerId?: string;
  readonly triggerType?: string;
  readonly launchStatus: RunWorkflowDraftManualResult["launchStatus"];
  readonly executionId: string;
  readonly blockingIssueCodes: ReadonlyArray<string>;
  readonly warningIssueCodes: ReadonlyArray<string>;
}

export interface WorkflowUiInteractionFeedbackStatus {
  readonly status: WorkflowUiInteractionStatusKind;
  readonly event: Pick<UiTriggerEvent, "eventId" | "kind" | "name" | "occurredAt">;
  readonly source: {
    readonly studio: UiTriggerEvent["source"]["studio"];
    readonly componentId: string;
    readonly actionId?: string;
  };
  readonly correlation?: Readonly<Record<string, string>>;
}

export interface WorkflowUiInteractionFeedbackSink {
  readonly onStatus?: (update: WorkflowUiInteractionFeedbackStatus) => void;
  readonly onIssue?: (issue: WorkflowUiInteractionIssue) => void;
  readonly onDispatchRecord?: (record: WorkflowUiInteractionDispatchRecord) => void;
}

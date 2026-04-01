import { WorkflowDraftTriggerTypes, type WorkflowDraft } from "../../domain/workflow-studio/WorkflowStudioDomain";
import { mapWorkflowDraftTriggersToExecutionTriggerPlan } from "./WorkflowDraftTriggerExecutionPlanner";
import type { WorkflowExecutionTriggerEntry } from "./WorkflowTriggerExecutionEntryService";
import {
  UiTriggerEventKinds,
  createUiTriggerEvent,
  mapUiTriggerKindToWorkflowSourceKind,
  validateUiTriggerEvent,
  type UiTriggerEvent,
} from "./UiTriggerEventContract";

export interface WorkflowUiTriggerEventMappingIssue {
  readonly code: "ui-trigger-invalid" | "ui-trigger-unsupported";
  readonly message: string;
}

export interface MapUiTriggerEventToWorkflowTriggerEntriesResult {
  readonly entries: ReadonlyArray<WorkflowExecutionTriggerEntry>;
  readonly issues: ReadonlyArray<WorkflowUiTriggerEventMappingIssue>;
}

function matchesManualTrigger(event: UiTriggerEvent, plan: ReturnType<typeof mapWorkflowDraftTriggersToExecutionTriggerPlan>[number]): boolean {
  if (plan.runtimeKind !== "manual") {
    return false;
  }

  if (plan.triggerType === WorkflowDraftTriggerTypes.userButtonClick) {
    if (event.kind !== UiTriggerEventKinds.click) {
      return false;
    }
    const configured = plan.buttonId?.trim().toLowerCase();
    const actionId = event.source.actionId?.trim().toLowerCase();
    return Boolean(configured && actionId && configured === actionId);
  }

  if (plan.triggerType === WorkflowDraftTriggerTypes.userManual || plan.triggerType === WorkflowDraftTriggerTypes.userInitiatedRun) {
    return event.kind === UiTriggerEventKinds.click
      || event.kind === UiTriggerEventKinds.submit
      || event.kind === UiTriggerEventKinds.selection;
  }

  return false;
}

export function mapUiTriggerEventToWorkflowTriggerEntries(input: {
  readonly draft: WorkflowDraft;
  readonly event: UiTriggerEvent;
}): MapUiTriggerEventToWorkflowTriggerEntriesResult {
  const event = createUiTriggerEvent(input.event);
  const validationIssues = validateUiTriggerEvent(event);
  if (validationIssues.length > 0) {
    return Object.freeze({
      entries: Object.freeze([]),
      issues: Object.freeze(validationIssues.map((issue) => Object.freeze({
        code: "ui-trigger-invalid",
        message: issue.message,
      }))),
    });
  }

  const entries = mapWorkflowDraftTriggersToExecutionTriggerPlan(input.draft)
    .filter((plan) => matchesManualTrigger(event, plan))
    .map((plan) => Object.freeze({
      sourceKind: mapUiTriggerKindToWorkflowSourceKind(event.kind),
      triggerId: plan.triggerId,
      triggerType: plan.triggerType,
      activationType: `ui-${event.kind}`,
      payload: Object.freeze({
        uiEventId: event.eventId,
        uiEventName: event.name,
        uiEventKind: event.kind,
        source: event.source,
        payload: event.payload,
        context: event.context,
      }),
      metadata: Object.freeze({
        uiEventName: event.name,
        uiEventKind: event.kind,
        uiSourceStudio: event.source.studio,
        uiComponentId: event.source.componentId,
      }),
    } satisfies WorkflowExecutionTriggerEntry));

  return Object.freeze({
    entries: Object.freeze(entries),
    issues: Object.freeze([]),
  });
}

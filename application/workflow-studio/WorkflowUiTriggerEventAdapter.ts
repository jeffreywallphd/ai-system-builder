import { WorkflowDraftTriggerTypes, type WorkflowDraft } from "../../domain/workflow-studio/WorkflowStudioDomain";
import {
  matchesUiTriggerBindingEvent,
  type ImageWorkflowUiTriggerBindingConfiguration,
} from "../contracts/ImageWorkflowUiTriggerBindingConfiguration";
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
  readonly bindings?: ImageWorkflowUiTriggerBindingConfiguration;
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

  const triggerPlan = mapWorkflowDraftTriggersToExecutionTriggerPlan(input.draft);
  const declarativeBindings = input.bindings?.bindings ?? [];

  const matchesByBinding = (plan: typeof triggerPlan[number]) => declarativeBindings
    .filter((binding) => matchesUiTriggerBindingEvent({ binding, event }))
    .filter((binding) => {
      if (binding.target.triggerId && binding.target.triggerId !== plan.triggerId) {
        return false;
      }
      if (binding.target.triggerType && binding.target.triggerType !== plan.triggerType) {
        return false;
      }
      return true;
    });

  const matches = triggerPlan
    .flatMap((plan) => {
      const matchingBindings = matchesByBinding(plan);
      if (matchingBindings.length === 0) {
        if (declarativeBindings.length > 0) {
          return [];
        }
        if (!matchesManualTrigger(event, plan)) {
          return [];
        }
        return [Object.freeze({ plan })];
      }
      return matchingBindings.map((binding) => Object.freeze({ plan, binding }));
    });

  const entries = matches
    .map(({ plan, binding }) => Object.freeze({
      sourceKind: mapUiTriggerKindToWorkflowSourceKind(event.kind),
      triggerId: binding?.target.triggerId ?? plan.triggerId,
      triggerType: binding?.target.triggerType ?? plan.triggerType,
      activationType: `ui-${event.kind}`,
      payload: Object.freeze({
        ...event.payload,
        uiEventId: event.eventId,
        uiEventName: event.name,
        uiEventKind: event.kind,
        source: event.source,
        context: event.context,
      }),
      contextReferences: event.context ? Object.freeze({ ...event.context, references: event.context.references }) : undefined,
      bindingMetadata: binding
        ? Object.freeze({
          bindingId: binding.bindingId,
          bindingContractVersion: input.bindings?.contractVersion,
          source: "ui-trigger-binding",
          ...binding.metadata,
        })
        : undefined,
      metadata: Object.freeze({
        uiEventName: event.name,
        uiEventKind: event.kind,
        uiSourceStudio: event.source.studio,
        uiComponentId: event.source.componentId,
      }),
    } satisfies WorkflowExecutionTriggerEntry))
    .filter((entry) => Boolean(entry.triggerId || entry.triggerType));

  return Object.freeze({
    entries: Object.freeze(entries),
    issues: Object.freeze([]),
  });
}

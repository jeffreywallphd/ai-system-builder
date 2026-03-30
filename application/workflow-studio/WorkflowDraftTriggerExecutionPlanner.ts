import {
  WorkflowDraftTemporalScheduleModes,
  WorkflowDraftTriggerTypes,
  WorkflowDraftUserTriggerScopes,
  type WorkflowDraft,
  type WorkflowDraftStateTriggerConfig,
  type WorkflowDraftTemporalTriggerConfig,
  type WorkflowDraftUserTriggerConfig,
} from "../../domain/workflow-studio/WorkflowStudioDomain";
import {
  mapWorkflowDraftTriggersToRuntimeDescriptors,
  type WorkflowRuntimeManualTriggerDescriptor,
  type WorkflowRuntimeStateTriggerDescriptor,
  type WorkflowRuntimeTemporalTriggerDescriptor,
  type WorkflowRuntimeTriggerDescriptor,
} from "./WorkflowTriggerRuntimeMapper";

export interface WorkflowExecutionTriggerPlanBase {
  readonly triggerId: string;
  readonly triggerType: string;
  readonly triggerKind: string;
  readonly title?: string;
  readonly description?: string;
  readonly runtimeKind: WorkflowRuntimeTriggerDescriptor["runtimeKind"];
}

export interface WorkflowExecutionManualTriggerPlan extends WorkflowExecutionTriggerPlanBase {
  readonly runtimeKind: "manual";
  readonly executionSemantics: "user-invocation";
  readonly invocationScope: WorkflowDraftUserTriggerConfig["invocationScope"];
  readonly requiresConfirmation?: boolean;
  readonly allowedRoles?: ReadonlyArray<string>;
  readonly buttonId?: string;
  readonly continuationStepId?: string;
  readonly continuationTokenRef?: string;
}

export interface WorkflowExecutionTemporalTriggerPlan extends WorkflowExecutionTriggerPlanBase {
  readonly runtimeKind: "temporal";
  readonly executionSemantics: "temporal-schedule";
  readonly scheduleMode: WorkflowDraftTemporalTriggerConfig["scheduleMode"];
  readonly runAt?: string;
  readonly cronExpression?: string;
  readonly every?: number;
  readonly unit?: WorkflowDraftTemporalTriggerConfig["unit"];
  readonly timezone?: string;
  readonly startAt?: string;
  readonly endAt?: string;
}

export interface WorkflowExecutionStateTriggerPlan extends WorkflowExecutionTriggerPlanBase {
  readonly runtimeKind: "state";
  readonly executionSemantics: "state-event";
  readonly sourceType?: WorkflowDraftStateTriggerConfig["sourceType"];
  readonly eventCategory?: WorkflowDraftStateTriggerConfig["eventCategory"];
  readonly subject?: WorkflowDraftStateTriggerConfig["subject"];
  readonly eventName?: string;
  readonly stateKey?: string;
  readonly stateValue?: string;
  readonly assetId?: string;
  readonly assetVersionId?: string;
  readonly criteria?: Readonly<Record<string, unknown>>;
  readonly filter?: Readonly<Record<string, unknown>>;
}

export type WorkflowExecutionTriggerPlan =
  | WorkflowExecutionManualTriggerPlan
  | WorkflowExecutionTemporalTriggerPlan
  | WorkflowExecutionStateTriggerPlan;

function mapManualTrigger(
  descriptor: WorkflowRuntimeManualTriggerDescriptor,
): WorkflowExecutionManualTriggerPlan {
  if (
    descriptor.triggerType !== WorkflowDraftTriggerTypes.userManual
    && descriptor.triggerType !== WorkflowDraftTriggerTypes.userButtonClick
    && descriptor.triggerType !== WorkflowDraftTriggerTypes.userInitiatedRun
  ) {
    throw new Error(
      `Workflow trigger type '${descriptor.triggerType}' is not supported for manual execution planning semantics.`,
    );
  }

  const invocationScope = descriptor.invocationScope ?? WorkflowDraftUserTriggerScopes.workflowStart;
  if (
    invocationScope !== WorkflowDraftUserTriggerScopes.workflowStart
    && invocationScope !== WorkflowDraftUserTriggerScopes.workflowContinuation
  ) {
    throw new Error(
      `Workflow user trigger scope '${String(invocationScope)}' is not supported for execution planning.`,
    );
  }

  return Object.freeze({
    triggerId: descriptor.triggerId,
    triggerType: descriptor.triggerType,
    triggerKind: descriptor.triggerKind,
    title: descriptor.title,
    description: descriptor.description,
    runtimeKind: "manual",
    executionSemantics: "user-invocation",
    invocationScope,
    requiresConfirmation: descriptor.requiresConfirmation,
    allowedRoles: descriptor.allowedRoles,
    buttonId: descriptor.buttonId,
    continuationStepId: descriptor.continuationStepId,
    continuationTokenRef: descriptor.continuationTokenRef,
  });
}

function mapTemporalTrigger(
  descriptor: WorkflowRuntimeTemporalTriggerDescriptor,
): WorkflowExecutionTemporalTriggerPlan {
  if (
    descriptor.triggerType !== WorkflowDraftTriggerTypes.temporalSchedule
    && descriptor.triggerType !== WorkflowDraftTriggerTypes.temporalRecurring
  ) {
    throw new Error(
      `Workflow trigger type '${descriptor.triggerType}' is not supported for temporal execution planning semantics.`,
    );
  }

  if (
    descriptor.scheduleMode !== WorkflowDraftTemporalScheduleModes.oneTime
    && descriptor.scheduleMode !== WorkflowDraftTemporalScheduleModes.cron
    && descriptor.scheduleMode !== WorkflowDraftTemporalScheduleModes.interval
  ) {
    throw new Error(
      `Workflow temporal trigger schedule mode '${String(descriptor.scheduleMode)}' is not supported for execution planning.`,
    );
  }

  return Object.freeze({
    triggerId: descriptor.triggerId,
    triggerType: descriptor.triggerType,
    triggerKind: descriptor.triggerKind,
    title: descriptor.title,
    description: descriptor.description,
    runtimeKind: "temporal",
    executionSemantics: "temporal-schedule",
    scheduleMode: descriptor.scheduleMode,
    runAt: descriptor.runAt,
    cronExpression: descriptor.cronExpression,
    every: descriptor.every,
    unit: descriptor.unit,
    timezone: descriptor.timezone,
    startAt: descriptor.startAt,
    endAt: descriptor.endAt,
  });
}

function mapStateTrigger(
  descriptor: WorkflowRuntimeStateTriggerDescriptor,
): WorkflowExecutionStateTriggerPlan {
  if (
    descriptor.triggerType !== WorkflowDraftTriggerTypes.stateDataAvailable
    && descriptor.triggerType !== WorkflowDraftTriggerTypes.stateAssetStateChanged
    && descriptor.triggerType !== WorkflowDraftTriggerTypes.stateSystemEvent
  ) {
    throw new Error(
      `Workflow trigger type '${descriptor.triggerType}' is not supported for state execution planning semantics.`,
    );
  }

  return Object.freeze({
    triggerId: descriptor.triggerId,
    triggerType: descriptor.triggerType,
    triggerKind: descriptor.triggerKind,
    title: descriptor.title,
    description: descriptor.description,
    runtimeKind: "state",
    executionSemantics: "state-event",
    sourceType: descriptor.sourceType,
    eventCategory: descriptor.eventCategory,
    subject: descriptor.subject,
    eventName: descriptor.eventName,
    stateKey: descriptor.stateKey,
    stateValue: descriptor.stateValue,
    assetId: descriptor.assetId,
    assetVersionId: descriptor.assetVersionId,
    criteria: descriptor.criteria,
    filter: descriptor.filter,
  });
}

function mapDescriptorToExecutionTriggerPlan(descriptor: WorkflowRuntimeTriggerDescriptor): WorkflowExecutionTriggerPlan {
  if (descriptor.runtimeKind === "manual") {
    return mapManualTrigger(descriptor);
  }
  if (descriptor.runtimeKind === "temporal") {
    return mapTemporalTrigger(descriptor);
  }
  if (descriptor.runtimeKind === "state") {
    return mapStateTrigger(descriptor);
  }

  throw new Error(
    `Workflow trigger runtime kind '${String((descriptor as { readonly runtimeKind?: string }).runtimeKind)}' is not supported for execution planning.`,
  );
}

export function mapWorkflowDraftTriggersToExecutionTriggerPlan(
  draft: WorkflowDraft,
): ReadonlyArray<WorkflowExecutionTriggerPlan> {
  const runtimeDescriptors = mapWorkflowDraftTriggersToRuntimeDescriptors(draft);
  return Object.freeze(runtimeDescriptors.map((descriptor) => mapDescriptorToExecutionTriggerPlan(descriptor)));
}

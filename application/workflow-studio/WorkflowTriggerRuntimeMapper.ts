import {
  createEmptyWorkflowDraft,
  normalizeWorkflowDraft,
  normalizeWorkflowDraftTriggerConfig,
  WorkflowDraftTemporalScheduleModes,
  WorkflowDraftTriggerKinds,
  WorkflowDraftUserTriggerScopes,
  type WorkflowDraft,
  type WorkflowDraftStateTriggerConfig,
  type WorkflowDraftTemporalTriggerConfig,
  type WorkflowDraftTrigger,
  type WorkflowDraftUserTriggerConfig,
} from "../../domain/workflow-studio/WorkflowStudioDomain";

export interface WorkflowRuntimeTriggerDescriptorBase {
  readonly triggerId: string;
  readonly title?: string;
  readonly description?: string;
  readonly triggerKind: WorkflowDraftTrigger["kind"];
  readonly triggerType: WorkflowDraftTrigger["type"];
}

export interface WorkflowRuntimeManualTriggerDescriptor extends WorkflowRuntimeTriggerDescriptorBase {
  readonly runtimeKind: "manual";
  readonly invocationScope: WorkflowDraftUserTriggerConfig["invocationScope"];
  readonly requiresConfirmation?: boolean;
  readonly allowedRoles?: ReadonlyArray<string>;
  readonly buttonId?: string;
  readonly continuationStepId?: string;
  readonly continuationTokenRef?: string;
}

export interface WorkflowRuntimeTemporalTriggerDescriptor extends WorkflowRuntimeTriggerDescriptorBase {
  readonly runtimeKind: "temporal";
  readonly scheduleMode: WorkflowDraftTemporalTriggerConfig["scheduleMode"];
  readonly runAt?: string;
  readonly cronExpression?: string;
  readonly every?: number;
  readonly unit?: WorkflowDraftTemporalTriggerConfig["unit"];
  readonly timezone?: string;
  readonly startAt?: string;
  readonly endAt?: string;
}

export interface WorkflowRuntimeStateTriggerDescriptor extends WorkflowRuntimeTriggerDescriptorBase {
  readonly runtimeKind: "state";
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

export type WorkflowRuntimeTriggerDescriptor =
  | WorkflowRuntimeManualTriggerDescriptor
  | WorkflowRuntimeTemporalTriggerDescriptor
  | WorkflowRuntimeStateTriggerDescriptor;

function assertRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function mapManualTriggerConfig(
  trigger: WorkflowDraftTrigger,
  config: WorkflowDraftUserTriggerConfig,
): WorkflowRuntimeManualTriggerDescriptor {
  return Object.freeze({
    runtimeKind: "manual",
    triggerId: trigger.id,
    title: trigger.title,
    description: trigger.description,
    triggerKind: trigger.kind,
    triggerType: trigger.type,
    invocationScope: config.invocationScope ?? WorkflowDraftUserTriggerScopes.workflowStart,
    requiresConfirmation: config.requiresConfirmation,
    allowedRoles: config.allowedRoles,
    buttonId: config.buttonId,
    continuationStepId: config.continuationStepId,
    continuationTokenRef: config.continuationTokenRef,
  });
}

function resolveTemporalScheduleMode(config: WorkflowDraftTemporalTriggerConfig): WorkflowDraftTemporalTriggerConfig["scheduleMode"] {
  if (config.scheduleMode) {
    return config.scheduleMode;
  }
  if (config.runAt) {
    return WorkflowDraftTemporalScheduleModes.oneTime;
  }
  if (config.cronExpression) {
    return WorkflowDraftTemporalScheduleModes.cron;
  }
  return WorkflowDraftTemporalScheduleModes.interval;
}

function mapTemporalTriggerConfig(
  trigger: WorkflowDraftTrigger,
  config: WorkflowDraftTemporalTriggerConfig,
): WorkflowRuntimeTemporalTriggerDescriptor {
  return Object.freeze({
    runtimeKind: "temporal",
    triggerId: trigger.id,
    title: trigger.title,
    description: trigger.description,
    triggerKind: trigger.kind,
    triggerType: trigger.type,
    scheduleMode: resolveTemporalScheduleMode(config),
    runAt: config.runAt,
    cronExpression: config.cronExpression,
    every: config.every,
    unit: config.unit,
    timezone: config.timezone,
    startAt: config.startAt,
    endAt: config.endAt,
  });
}

function mapStateTriggerConfig(
  trigger: WorkflowDraftTrigger,
  config: WorkflowDraftStateTriggerConfig,
): WorkflowRuntimeStateTriggerDescriptor {
  return Object.freeze({
    runtimeKind: "state",
    triggerId: trigger.id,
    title: trigger.title,
    description: trigger.description,
    triggerKind: trigger.kind,
    triggerType: trigger.type,
    sourceType: config.sourceType,
    eventCategory: config.eventCategory,
    subject: config.subject,
    eventName: config.eventName,
    stateKey: config.stateKey,
    stateValue: config.stateValue,
    assetId: config.asset?.assetId,
    assetVersionId: config.asset?.versionId,
    criteria: config.criteria ?? config.filter,
    filter: config.filter,
  });
}

export function mapWorkflowDraftTriggerToRuntimeDescriptor(trigger: WorkflowDraftTrigger): WorkflowRuntimeTriggerDescriptor {
  const normalizedTrigger = normalizeWorkflowDraft({
    ...createEmptyWorkflowDraft(),
    triggers: [trigger],
  }).triggers[0] as WorkflowDraftTrigger;
  const config = normalizeWorkflowDraftTriggerConfig(
    normalizedTrigger.type,
    assertRecord(normalizedTrigger.config ?? {}, "Workflow draft trigger config"),
  );

  if (normalizedTrigger.kind === WorkflowDraftTriggerKinds.user) {
    return mapManualTriggerConfig(normalizedTrigger, config as WorkflowDraftUserTriggerConfig);
  }
  if (normalizedTrigger.kind === WorkflowDraftTriggerKinds.temporal) {
    return mapTemporalTriggerConfig(normalizedTrigger, config as WorkflowDraftTemporalTriggerConfig);
  }
  if (normalizedTrigger.kind === WorkflowDraftTriggerKinds.state) {
    return mapStateTriggerConfig(normalizedTrigger, config as WorkflowDraftStateTriggerConfig);
  }

  throw new Error(`Workflow trigger kind '${String(normalizedTrigger.kind)}' is not supported.`);
}

export function mapWorkflowDraftTriggersToRuntimeDescriptors(
  draft: WorkflowDraft,
): ReadonlyArray<WorkflowRuntimeTriggerDescriptor> {
  const normalized = normalizeWorkflowDraft(draft);
  return Object.freeze(normalized.triggers.map((trigger) => mapWorkflowDraftTriggerToRuntimeDescriptor(trigger)));
}

export function inferWorkflowTriggerRuntimeReadiness(trigger: WorkflowDraftTrigger): {
  readonly ready: boolean;
  readonly reason: "ready";
} {
  mapWorkflowDraftTriggerToRuntimeDescriptor(trigger);
  return Object.freeze({
    ready: true,
    reason: "ready",
  });
}

export function inferWorkflowDraftTriggerRuntimeReadiness(draft: WorkflowDraft): {
  readonly ready: boolean;
  readonly reason: "ready";
} {
  mapWorkflowDraftTriggersToRuntimeDescriptors(draft);
  return Object.freeze({
    ready: true,
    reason: "ready",
  });
}

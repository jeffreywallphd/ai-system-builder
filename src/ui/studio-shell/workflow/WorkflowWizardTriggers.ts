import {
  WorkflowDraftTriggerTypes,
  type WorkflowDraftStateTriggerConfig,
  WorkflowDraftTriggerKinds,
  type WorkflowDraft,
  type WorkflowDraftTemporalTriggerConfig,
  type WorkflowDraftTrigger,
  type WorkflowDraftTriggerConfig,
  type WorkflowDraftTriggerKind,
  type WorkflowDraftTriggerType,
  type WorkflowDraftUserTriggerConfig,
  type WorkflowValidationIssue,
} from "@domain/workflow-studio/WorkflowStudioDomain";
import { createDefaultWorkflowTriggerTypeRegistry } from "@application/workflow-studio/WorkflowTriggerTypeRegistry";
import { validateSingleWorkflowTriggerDefinition } from "@application/workflow-studio/WorkflowTriggerValidationPipeline";

export interface WorkflowWizardTriggerTypeDefinition {
  readonly kind: WorkflowDraftTriggerKind;
  readonly type: WorkflowDraftTriggerType;
  readonly label: string;
  readonly description: string;
  readonly configSchemaId: string;
  readonly capabilities: {
    readonly supportsManualInvocation: boolean;
    readonly supportsTemporalScheduling: boolean;
    readonly supportsStateSubscription: boolean;
    readonly supportsIntermediateContinuation: boolean;
  };
}

const triggerTypeRegistry = createDefaultWorkflowTriggerTypeRegistry();

export const workflowTriggerTypeDefinitions: ReadonlyArray<WorkflowWizardTriggerTypeDefinition> = Object.freeze(
  triggerTypeRegistry.list().map((entry) => Object.freeze({
    kind: entry.kind,
    type: entry.type,
    label: entry.label,
    description: entry.description,
    configSchemaId: entry.configSchemaId,
    capabilities: entry.capabilities,
  })),
);

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function buildNextTriggerId(triggers: ReadonlyArray<WorkflowDraftTrigger>): string {
  const existing = new Set(triggers.map((trigger) => trigger.id));
  let index = triggers.length + 1;
  let candidate = `trigger-${index}`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `trigger-${index}`;
  }
  return candidate;
}

function getDefaultTriggerType(): WorkflowDraftTriggerType {
  const first = workflowTriggerTypeDefinitions[0];
  if (!first) {
    throw new Error("Workflow trigger registry must expose at least one trigger type.");
  }
  return first.type;
}

function buildDefaultConfig(triggerType: WorkflowDraftTriggerType): Readonly<WorkflowDraftTriggerConfig> {
  return triggerTypeRegistry.createDefaultConfig(triggerType);
}

function updateTriggerById(
  draft: WorkflowDraft,
  triggerId: string,
  updater: (trigger: WorkflowDraftTrigger) => WorkflowDraftTrigger,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const index = draft.triggers.findIndex((trigger) => trigger.id === triggerId);
  if (index < 0) {
    return Object.freeze({ draft, changed: false });
  }

  const current = draft.triggers[index] as WorkflowDraftTrigger;
  const next = updater(current);
  if (next === current) {
    return Object.freeze({ draft, changed: false });
  }

  const updated = [...draft.triggers];
  updated[index] = next;
  return Object.freeze({
    draft: Object.freeze({
      ...draft,
      triggers: Object.freeze(updated),
    }),
    changed: true,
  });
}

function moveTrigger(
  draft: WorkflowDraft,
  triggerId: string,
  direction: -1 | 1,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const index = draft.triggers.findIndex((trigger) => trigger.id === triggerId);
  if (index < 0) {
    return Object.freeze({ draft, changed: false });
  }

  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= draft.triggers.length) {
    return Object.freeze({ draft, changed: false });
  }

  const updated = [...draft.triggers];
  const current = updated[index];
  const target = updated[targetIndex];
  if (!current || !target) {
    return Object.freeze({ draft, changed: false });
  }

  updated[index] = target;
  updated[targetIndex] = current;
  return Object.freeze({
    draft: Object.freeze({
      ...draft,
      triggers: Object.freeze(updated),
    }),
    changed: true,
  });
}

export function addWorkflowTrigger(
  draft: WorkflowDraft,
  options?: {
    readonly type?: WorkflowDraftTriggerType;
  },
): { readonly draft: WorkflowDraft; readonly triggerId: string } {
  const triggerType = options?.type ?? getDefaultTriggerType();
  const definition = workflowTriggerTypeDefinitions.find((entry) => entry.type === triggerType);
  if (!definition) {
    throw new Error(`Workflow trigger type '${triggerType}' is not supported.`);
  }

  const triggerId = buildNextTriggerId(draft.triggers);
  const nextTrigger: WorkflowDraftTrigger = Object.freeze({
    id: triggerId,
    kind: definition.kind,
    type: definition.type,
    config: buildDefaultConfig(definition.type),
  });

  return Object.freeze({
    triggerId,
    draft: Object.freeze({
      ...draft,
      triggers: Object.freeze([...draft.triggers, nextTrigger]),
    }),
  });
}

export function removeWorkflowTrigger(
  draft: WorkflowDraft,
  triggerId: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const nextTriggers = draft.triggers.filter((trigger) => trigger.id !== triggerId);
  if (nextTriggers.length === draft.triggers.length) {
    return Object.freeze({ draft, changed: false });
  }

  return Object.freeze({
    draft: Object.freeze({
      ...draft,
      triggers: Object.freeze(nextTriggers),
    }),
    changed: true,
  });
}

export function moveWorkflowTriggerUp(
  draft: WorkflowDraft,
  triggerId: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return moveTrigger(draft, triggerId, -1);
}

export function moveWorkflowTriggerDown(
  draft: WorkflowDraft,
  triggerId: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return moveTrigger(draft, triggerId, 1);
}

export function canMoveWorkflowTrigger(
  draft: WorkflowDraft,
  triggerId: string,
  direction: "up" | "down",
): boolean {
  const index = draft.triggers.findIndex((trigger) => trigger.id === triggerId);
  if (index < 0) {
    return false;
  }
  if (direction === "up") {
    return index > 0;
  }
  return index < draft.triggers.length - 1;
}

export function setWorkflowTriggerType(
  draft: WorkflowDraft,
  triggerId: string,
  triggerType: WorkflowDraftTriggerType,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const definition = workflowTriggerTypeDefinitions.find((entry) => entry.type === triggerType);
  if (!definition) {
    return Object.freeze({ draft, changed: false });
  }

  return updateTriggerById(draft, triggerId, (current) => {
    if (current.type === definition.type && current.kind === definition.kind) {
      return current;
    }
    return Object.freeze({
      ...current,
      kind: definition.kind,
      type: definition.type,
      config: buildDefaultConfig(definition.type),
    });
  });
}

export function setWorkflowTriggerTitle(
  draft: WorkflowDraft,
  triggerId: string,
  title: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const normalizedTitle = normalizeOptional(title);
  return updateTriggerById(draft, triggerId, (current) => {
    if (current.title === normalizedTitle) {
      return current;
    }
    return Object.freeze({
      ...current,
      title: normalizedTitle,
    });
  });
}

export function patchWorkflowTriggerConfig(
  draft: WorkflowDraft,
  triggerId: string,
  configPatch: Readonly<Record<string, unknown>>,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return updateTriggerById(draft, triggerId, (current) => Object.freeze({
    ...current,
    config: Object.freeze({
      ...(current.config ?? {}),
      ...configPatch,
    }) as WorkflowDraftTriggerConfig,
  }));
}

export function setWorkflowTriggerUserConfig(
  draft: WorkflowDraft,
  triggerId: string,
  configPatch: Readonly<Partial<WorkflowDraftUserTriggerConfig>>,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return patchWorkflowTriggerConfig(draft, triggerId, configPatch as Readonly<Record<string, unknown>>);
}

export function setWorkflowTriggerTemporalConfig(
  draft: WorkflowDraft,
  triggerId: string,
  configPatch: Readonly<Partial<WorkflowDraftTemporalTriggerConfig>>,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return patchWorkflowTriggerConfig(draft, triggerId, configPatch as Readonly<Record<string, unknown>>);
}

export function setWorkflowTriggerStateConfig(
  draft: WorkflowDraft,
  triggerId: string,
  configPatch: Readonly<Partial<WorkflowDraftStateTriggerConfig>>,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return patchWorkflowTriggerConfig(draft, triggerId, configPatch as Readonly<Record<string, unknown>>);
}

export function getWorkflowTriggerValidationMessages(input: {
  readonly trigger: WorkflowDraftTrigger;
  readonly draftIssueMessages?: ReadonlyArray<string>;
  readonly stepIds?: ReadonlyArray<string>;
}): ReadonlyArray<string> {
  const stepIds = input.stepIds?.filter((entry) => entry.trim().length > 0);
  const localValidation = validateSingleWorkflowTriggerDefinition({
    trigger: input.trigger,
    stepIds: stepIds && stepIds.length > 0 ? Object.freeze([...stepIds]) : undefined,
  });
  const messages = new Set<string>();
  for (const message of input.draftIssueMessages ?? []) {
    if (message.trim().length > 0) {
      messages.add(message);
    }
  }
  for (const issue of localValidation.issues) {
    if (issue.message.trim().length > 0) {
      messages.add(issue.message);
    }
  }
  return Object.freeze([...messages]);
}

export function resolveWorkflowTriggerSelectionId(
  draft: WorkflowDraft,
  preferredTriggerId?: string,
): string | undefined {
  const normalizedPreferred = preferredTriggerId?.trim();
  if (normalizedPreferred && draft.triggers.some((trigger) => trigger.id === normalizedPreferred)) {
    return normalizedPreferred;
  }
  return draft.triggers[0]?.id;
}

export function getWorkflowTriggerSummary(trigger: WorkflowDraftTrigger): string {
  if (trigger.kind === WorkflowDraftTriggerKinds.user) {
    if (trigger.type === WorkflowDraftTriggerTypes.userButtonClick) {
      return `Button: ${trigger.config.buttonId ?? "not set"}`;
    }
    return `Scope: ${trigger.config.invocationScope ?? "workflow-start"}`;
  }
  if (trigger.kind === WorkflowDraftTriggerKinds.temporal) {
    if (trigger.type === WorkflowDraftTriggerTypes.temporalRecurring) {
      return `Every ${trigger.config.every ?? "?"} ${trigger.config.unit ?? "days"}`;
    }
    return trigger.config.runAt ? `Run at ${trigger.config.runAt}` : `Cron: ${trigger.config.cronExpression ?? "not set"}`;
  }
  if (trigger.type === WorkflowDraftTriggerTypes.stateAssetStateChanged) {
    return `Asset: ${trigger.config.asset?.assetId ?? "not set"}`;
  }
  return `Event: ${trigger.config.eventName ?? "not set"}`;
}

export function getWorkflowTriggerIssuesForIndex(
  draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>,
  index: number,
): ReadonlyArray<string> {
  return Object.freeze(
    draftValidationIssues
      .filter((issue) => issue.path?.startsWith(`draft.triggers[${index}]`))
      .map((issue) => issue.message),
  );
}

export function getWorkflowTriggerTypeDefinition(
  type: WorkflowDraftTriggerType,
): WorkflowWizardTriggerTypeDefinition | undefined {
  return workflowTriggerTypeDefinitions.find((entry) => entry.type === type);
}

export function getWorkflowTriggerKindLabel(kind: WorkflowDraftTriggerKind): string {
  if (kind === WorkflowDraftTriggerKinds.user) {
    return "User";
  }
  if (kind === WorkflowDraftTriggerKinds.temporal) {
    return "Temporal";
  }
  return "State";
}


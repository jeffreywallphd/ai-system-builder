import {
  WorkflowDraftTriggerKinds,
  type WorkflowDraft,
  type WorkflowDraftTrigger,
  type WorkflowDraftTriggerConfig,
  type WorkflowDraftTriggerKind,
  type WorkflowDraftTriggerType,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import { createDefaultWorkflowTriggerTypeRegistry } from "../../../application/workflow-studio/WorkflowTriggerTypeRegistry";

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

import type { WorkflowExecutionPlanTranslationRequest } from "./WorkflowExecutionAlignmentContracts";
import { WorkflowExecutionTriggerSourceKinds, type WorkflowExecutionTriggerSourceKind } from "./WorkflowExecutionAlignmentContracts";

export interface WorkflowExecutionTriggerEntry {
  readonly sourceKind: WorkflowExecutionTriggerSourceKind;
  readonly triggerId?: string;
  readonly triggerType?: string;
  readonly activationType?: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly contextReferences?: Readonly<Record<string, unknown>>;
  readonly bindingMetadata?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

function toDefaultActivationType(sourceKind: WorkflowExecutionTriggerSourceKind): string {
  if (sourceKind === WorkflowExecutionTriggerSourceKinds.temporal) {
    return "temporal";
  }
  if (sourceKind === WorkflowExecutionTriggerSourceKinds.stateData) {
    return "state-data";
  }
  return "manual";
}

export function normalizeWorkflowExecutionTriggerEntry(
  entry: WorkflowExecutionTriggerEntry,
): WorkflowExecutionTriggerEntry {
  return Object.freeze({
    sourceKind: entry.sourceKind,
    triggerId: entry.triggerId?.trim() || undefined,
    triggerType: entry.triggerType?.trim() || undefined,
    activationType: entry.activationType?.trim() || toDefaultActivationType(entry.sourceKind),
    payload: entry.payload ? Object.freeze({ ...entry.payload }) : undefined,
    contextReferences: entry.contextReferences ? Object.freeze({ ...entry.contextReferences }) : undefined,
    bindingMetadata: entry.bindingMetadata ? Object.freeze({ ...entry.bindingMetadata }) : undefined,
    metadata: entry.metadata ? Object.freeze({ ...entry.metadata }) : undefined,
  });
}

export function applyTriggerExecutionEntryToContext(input: {
  readonly context?: WorkflowExecutionPlanTranslationRequest["context"];
  readonly entry: WorkflowExecutionTriggerEntry;
}): WorkflowExecutionPlanTranslationRequest["context"] {
  const normalizedEntry = normalizeWorkflowExecutionTriggerEntry(input.entry);
  const existingContext = input.context ?? {};
  const hasTriggerId = Boolean(normalizedEntry.triggerId);

  return Object.freeze({
    ...existingContext,
    triggerActivation: hasTriggerId
      ? Object.freeze({
        triggerId: normalizedEntry.triggerId!,
        sourceKind: normalizedEntry.sourceKind,
        triggerType: normalizedEntry.triggerType,
        activationType: normalizedEntry.activationType,
        payload: normalizedEntry.payload,
      })
      : existingContext.triggerActivation,
    metadata: Object.freeze({
      ...(existingContext.metadata ?? {}),
      triggerEntry: Object.freeze({
        sourceKind: normalizedEntry.sourceKind,
        triggerId: normalizedEntry.triggerId,
        triggerType: normalizedEntry.triggerType,
        activationType: normalizedEntry.activationType,
        contextReferences: normalizedEntry.contextReferences,
        bindingMetadata: normalizedEntry.bindingMetadata,
      }),
      ...(normalizedEntry.metadata ?? {}),
    }),
  });
}

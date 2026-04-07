import {
  createWorkflowInputBindingDescriptor,
  type WorkflowInputBindingDescriptor,
  type WorkflowInputBindingSourceDescriptor,
  WorkflowInputBindingSourceKinds,
} from "../../../domain/workflow-studio/WorkflowInputBindingDomain";
import type { WorkflowDraft, WorkflowDraftInput } from "../../../domain/workflow-studio/WorkflowStudioDomain";

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Readonly<Record<string, unknown>>;
}

function toBindingDescriptor(input: WorkflowDraftInput): WorkflowInputBindingDescriptor | undefined {
  const metadata = asRecord(input.metadata);
  const authored = asRecord(metadata?.systemInputBinding);
  if (!authored) {
    return undefined;
  }
  try {
    return createWorkflowInputBindingDescriptor({
      bindingId: typeof authored.bindingId === "string" ? authored.bindingId : `binding.input.${input.id}`,
      inputId: input.id,
      required: input.required ?? false,
      valueType: input.valueType,
      ...(Object.prototype.hasOwnProperty.call(input, "defaultValue") ? { defaultValue: (input as Record<string, unknown>).defaultValue } : {}),
      sources: authored.sources,
    });
  } catch {
    return undefined;
  }
}

export function listWorkflowInputBindings(draft: WorkflowDraft): ReadonlyArray<WorkflowInputBindingDescriptor> {
  return Object.freeze(draft.inputs.map((input) => toBindingDescriptor(input)).filter((binding): binding is WorkflowInputBindingDescriptor => Boolean(binding)));
}

export function upsertWorkflowInputBinding(draft: WorkflowDraft, descriptor: WorkflowInputBindingDescriptor): WorkflowDraft {
  const nextInputs = draft.inputs.map((input) => {
    if (input.id !== descriptor.inputId) {
      return input;
    }
    const metadata = asRecord(input.metadata) ?? {};
    return Object.freeze({
      ...input,
      metadata: Object.freeze({
        ...metadata,
        systemInputBinding: Object.freeze({
          bindingId: descriptor.bindingId,
          sources: Object.freeze(descriptor.sources.map((source) => Object.freeze({ ...source }))),
        }),
      }),
    });
  });

  return Object.freeze({
    ...draft,
    inputs: Object.freeze(nextInputs),
  });
}

export function removeWorkflowInputBinding(draft: WorkflowDraft, inputId: string): WorkflowDraft {
  const nextInputs = draft.inputs.map((input) => {
    if (input.id !== inputId) {
      return input;
    }
    const metadata = asRecord(input.metadata);
    if (!metadata?.systemInputBinding) {
      return input;
    }
    const nextMetadata: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (key !== "systemInputBinding") {
        nextMetadata[key] = value;
      }
    }
    return Object.freeze({
      ...input,
      metadata: Object.keys(nextMetadata).length > 0 ? Object.freeze(nextMetadata) : undefined,
    });
  });

  return Object.freeze({
    ...draft,
    inputs: Object.freeze(nextInputs),
  });
}

export function createSingleSourceBinding(input: {
  readonly inputId: string;
  readonly bindingId?: string;
  readonly required?: boolean;
  readonly valueType?: WorkflowInputBindingDescriptor["valueType"];
  readonly defaultValue?: unknown;
  readonly source: WorkflowInputBindingSourceDescriptor;
}): WorkflowInputBindingDescriptor {
  return createWorkflowInputBindingDescriptor({
    bindingId: input.bindingId?.trim() || `binding.input.${input.inputId}`,
    inputId: input.inputId,
    required: input.required ?? false,
    valueType: input.valueType,
    ...(Object.prototype.hasOwnProperty.call(input, "defaultValue") ? { defaultValue: input.defaultValue } : {}),
    sources: [input.source],
  });
}

export function createDefaultBindingSource(input: {
  readonly inputId: string;
  readonly kind: WorkflowInputBindingSourceDescriptor["kind"];
  readonly reference?: string;
}): WorkflowInputBindingSourceDescriptor {
  const sourceId = `source.${input.inputId}.${input.kind}`;
  switch (input.kind) {
    case WorkflowInputBindingSourceKinds.uiFormValue:
      return Object.freeze({ sourceId, kind: input.kind, formKey: input.reference?.trim() || input.inputId, priority: 1, required: false });
    case WorkflowInputBindingSourceKinds.runtimeParameter:
      return Object.freeze({ sourceId, kind: input.kind, parameterKey: input.reference?.trim() || input.inputId, priority: 1, required: false });
    case WorkflowInputBindingSourceKinds.triggerPayload:
      return Object.freeze({ sourceId, kind: input.kind, payloadKey: input.reference?.trim() || input.inputId, priority: 1, required: false });
    case WorkflowInputBindingSourceKinds.selectedImage:
      return Object.freeze({ sourceId, kind: input.kind, path: input.reference?.trim() || "assetRef", priority: 1, required: false });
    case WorkflowInputBindingSourceKinds.datasetInstanceReference:
      return Object.freeze({
        sourceId,
        kind: input.kind,
        purpose: input.reference?.trim() || "active-input",
        priority: 1,
        required: false,
        resolution: Object.freeze({ shape: "record", index: 0 }),
      });
    case WorkflowInputBindingSourceKinds.constantValue:
      return Object.freeze({ sourceId, kind: input.kind, value: input.reference ?? "", priority: 1, required: false });
    default:
      return Object.freeze({ sourceId, kind: WorkflowInputBindingSourceKinds.runtimeParameter, parameterKey: input.inputId, priority: 1, required: false });
  }
}

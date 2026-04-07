import type {
  WorkflowInputBindingDescriptor,
  WorkflowInputBindingResolutionContext,
  WorkflowInputBindingResolutionDiagnostic,
  WorkflowInputBindingSourceDescriptor,
  WorkflowInputBindingSourceKind,
} from "@domain/workflow-studio/WorkflowInputBindingDomain";
import { resolveWorkflowInputBindings } from "./WorkflowInputBindingResolutionService";

export interface WorkflowInputBindingValueSummary {
  readonly shape: "string" | "number" | "boolean" | "array" | "object" | "null" | "undefined";
  readonly summary: string;
}

export interface WorkflowInputBindingSourcePreviewRecord {
  readonly sourceId: string;
  readonly sourceKind: WorkflowInputBindingSourceKind;
  readonly required: boolean;
  readonly priority: number;
  readonly declaredSource: string;
  readonly selected: boolean;
}

export interface WorkflowInputBindingPreviewItem {
  readonly bindingId: string;
  readonly inputId: string;
  readonly required: boolean;
  readonly resolved: boolean;
  readonly selectedSourceId?: string;
  readonly selectedSourceKind?: WorkflowInputBindingSourceKind;
  readonly resolutionKind?: "source" | "default";
  readonly valueSummary?: WorkflowInputBindingValueSummary;
  readonly sources: ReadonlyArray<WorkflowInputBindingSourcePreviewRecord>;
  readonly diagnostics: ReadonlyArray<WorkflowInputBindingResolutionDiagnostic>;
}

export interface WorkflowInputBindingPreviewResult {
  readonly items: ReadonlyArray<WorkflowInputBindingPreviewItem>;
  readonly unresolvedItems: ReadonlyArray<Pick<WorkflowInputBindingPreviewItem, "bindingId" | "inputId" | "required">>;
  readonly diagnostics: ReadonlyArray<WorkflowInputBindingResolutionDiagnostic>;
}

function summarizeValue(value: unknown): WorkflowInputBindingValueSummary {
  if (value === undefined) {
    return Object.freeze({ shape: "undefined", summary: "No value" });
  }
  if (value === null) {
    return Object.freeze({ shape: "null", summary: "Null" });
  }
  if (Array.isArray(value)) {
    return Object.freeze({ shape: "array", summary: `Array(${value.length})` });
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return Object.freeze({ shape: "object", summary: keys.length === 0 ? "Object{}" : `Object{${keys.slice(0, 3).join(",")}${keys.length > 3 ? ",â€¦" : ""}}` });
  }
  if (typeof value === "string") {
    return Object.freeze({ shape: "string", summary: value.length > 48 ? `${value.slice(0, 48)}â€¦` : value });
  }
  if (typeof value === "number") {
    return Object.freeze({ shape: "number", summary: `${value}` });
  }
  return Object.freeze({ shape: "boolean", summary: value ? "true" : "false" });
}

function declaredSourceSummary(source: WorkflowInputBindingSourceDescriptor): string {
  switch (source.kind) {
    case "ui-form-value":
      return `form:${source.formKey}`;
    case "runtime-parameter":
      return `runtime:${source.parameterKey}`;
    case "trigger-payload":
      return `trigger:${source.payloadKey}`;
    case "selected-image":
      return `selected-image${source.path ? `.${source.path}` : ""}`;
    case "dataset-instance-reference":
      return `dataset:${source.instanceId ?? source.purpose ?? "unknown"}`;
    case "constant-value":
      return "constant";
    default:
      return source.kind;
  }
}

export function previewWorkflowInputBindings(input: {
  readonly bindings: ReadonlyArray<WorkflowInputBindingDescriptor>;
  readonly context?: WorkflowInputBindingResolutionContext;
}): WorkflowInputBindingPreviewResult {
  const resolution = resolveWorkflowInputBindings({ bindings: input.bindings, context: input.context });

  const items = input.bindings.map((binding) => {
    const resolutionRecord = resolution.records.find((record) => record.bindingId === binding.bindingId);
    const selectedSourceId = resolutionRecord?.sourceId;
    const diagnostics = resolution.diagnostics.filter((diagnostic) => diagnostic.bindingId === binding.bindingId);

    return Object.freeze({
      bindingId: binding.bindingId,
      inputId: binding.inputId,
      required: binding.required,
      resolved: resolutionRecord?.resolved ?? false,
      selectedSourceId,
      selectedSourceKind: resolutionRecord?.sourceKind,
      resolutionKind: resolutionRecord?.resolutionKind,
      valueSummary: resolutionRecord ? summarizeValue(resolutionRecord.value) : undefined,
      sources: Object.freeze(binding.sources.map((source) => Object.freeze({
        sourceId: source.sourceId,
        sourceKind: source.kind,
        required: source.required,
        priority: source.priority,
        declaredSource: declaredSourceSummary(source),
        selected: source.sourceId === selectedSourceId,
      }))),
      diagnostics: Object.freeze(diagnostics),
    });
  });

  return Object.freeze({
    items: Object.freeze(items),
    unresolvedItems: Object.freeze(items
      .filter((item) => !item.resolved)
      .map((item) => Object.freeze({ bindingId: item.bindingId, inputId: item.inputId, required: item.required }))),
    diagnostics: resolution.diagnostics,
  });
}


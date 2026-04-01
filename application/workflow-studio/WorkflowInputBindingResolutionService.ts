import {
  createDatasetInstanceReference,
  type WorkflowInputBindingDescriptor,
  type WorkflowInputBindingResolutionContext,
  type WorkflowInputBindingResolutionDiagnostic,
  type WorkflowInputBindingResolutionDiagnosticCode,
  WorkflowInputBindingResolutionDiagnosticCodes,
  type WorkflowInputBindingResolutionRecord,
  type WorkflowInputBindingResolutionResult,
  type WorkflowInputBindingSourceDescriptor,
  WorkflowInputBindingSourceKinds,
} from "../../domain/workflow-studio/WorkflowInputBindingDomain";

export interface ResolveWorkflowInputBindingsRequest {
  readonly bindings: ReadonlyArray<WorkflowInputBindingDescriptor>;
  readonly context?: WorkflowInputBindingResolutionContext;
}

function hasOwn(record: Readonly<Record<string, unknown>>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function readByPath(record: Readonly<Record<string, unknown>>, path?: string): unknown {
  if (!path) {
    return record;
  }
  const tokens = path.split(".").map((token) => token.trim()).filter((token) => token.length > 0);
  let current: unknown = record;
  for (const token of tokens) {
    if (!current || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, token)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

type SourceResolutionStatus =
  | "resolved"
  | "source-value-missing"
  | "missing-field-reference"
  | "selected-image-missing"
  | "invalid-selection-reference"
  | "dataset-instance-missing";

interface SourceResolutionResult {
  readonly status: SourceResolutionStatus;
  readonly value?: unknown;
}

function hasRecordValues(record: Readonly<Record<string, unknown>>): boolean {
  return Object.keys(record).length > 0;
}

function matchDatasetInstance(
  source: Extract<WorkflowInputBindingSourceDescriptor, { kind: typeof WorkflowInputBindingSourceKinds.datasetInstanceReference }>,
  instances: ReadonlyArray<NonNullable<WorkflowInputBindingResolutionContext["datasetInstances"]>[number]>,
): unknown {
  const matched = instances.find((instance) => {
    if (source.instanceId && source.instanceId !== instance.instanceId) {
      return false;
    }
    if (source.systemId && source.systemId !== instance.systemId) {
      return false;
    }
    if (source.purpose && source.purpose !== instance.purpose) {
      return false;
    }
    return true;
  });

  if (!matched) {
    return undefined;
  }

  return createDatasetInstanceReference({
    systemId: matched.systemId,
    instanceId: matched.instanceId,
    datasetAssetId: matched.datasetAssetId,
    datasetVersionId: matched.datasetVersionId,
    purpose: matched.purpose,
  });
}

function resolveSourceValue(
  source: WorkflowInputBindingSourceDescriptor,
  context: Required<WorkflowInputBindingResolutionContext>,
): SourceResolutionResult {
  switch (source.kind) {
    case WorkflowInputBindingSourceKinds.uiFormValue:
      if (!hasOwn(context.uiFormValues, source.formKey)) {
        return Object.freeze({ status: "missing-field-reference" });
      }
      return Object.freeze({ status: "resolved", value: context.uiFormValues[source.formKey] });
    case WorkflowInputBindingSourceKinds.runtimeParameter:
      if (!hasOwn(context.runtimeParameters, source.parameterKey)) {
        return Object.freeze({ status: "source-value-missing" });
      }
      return Object.freeze({ status: "resolved", value: context.runtimeParameters[source.parameterKey] });
    case WorkflowInputBindingSourceKinds.triggerPayload:
      if (!hasOwn(context.triggerPayload, source.payloadKey)) {
        return Object.freeze({ status: "source-value-missing" });
      }
      return Object.freeze({ status: "resolved", value: context.triggerPayload[source.payloadKey] });
    case WorkflowInputBindingSourceKinds.selectedImage: {
      if (!hasRecordValues(context.selectedImage)) {
        return Object.freeze({ status: "selected-image-missing" });
      }
      const value = readByPath(context.selectedImage, source.path);
      if (value === undefined) {
        return Object.freeze({ status: "invalid-selection-reference" });
      }
      return Object.freeze({ status: "resolved", value });
    }
    case WorkflowInputBindingSourceKinds.datasetInstanceReference: {
      const value = matchDatasetInstance(source, context.datasetInstances);
      if (value === undefined) {
        return Object.freeze({ status: "dataset-instance-missing" });
      }
      return Object.freeze({ status: "resolved", value });
    }
    case WorkflowInputBindingSourceKinds.constantValue:
      return Object.freeze({ status: "resolved", value: source.value });
    default:
      return Object.freeze({ status: "source-value-missing" });
  }
}

function valueTypeMatches(valueType: WorkflowInputBindingDescriptor["valueType"], value: unknown): boolean {
  if (!valueType || valueType === "unknown") {
    return true;
  }
  if (valueType === "string") {
    return typeof value === "string";
  }
  if (valueType === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }
  if (valueType === "boolean") {
    return typeof value === "boolean";
  }
  if (valueType === "array") {
    return Array.isArray(value);
  }
  if (valueType === "object") {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  return true;
}

function createDiagnostic(input: {
  readonly code: WorkflowInputBindingResolutionDiagnosticCode;
  readonly severity: "error" | "warning";
  readonly bindingId: string;
  readonly inputId: string;
  readonly source?: WorkflowInputBindingSourceDescriptor;
  readonly message: string;
}): WorkflowInputBindingResolutionDiagnostic {
  return Object.freeze({
    code: input.code,
    severity: input.severity,
    bindingId: input.bindingId,
    inputId: input.inputId,
    sourceId: input.source?.sourceId,
    sourceKind: input.source?.kind,
    message: input.message,
    path: `workflow.inputBindings.${input.bindingId}`,
  });
}

export function resolveWorkflowInputBindings(
  request: ResolveWorkflowInputBindingsRequest,
): WorkflowInputBindingResolutionResult {
  const context: Required<WorkflowInputBindingResolutionContext> = Object.freeze({
    uiFormValues: Object.freeze({ ...(request.context?.uiFormValues ?? {}) }),
    runtimeParameters: Object.freeze({ ...(request.context?.runtimeParameters ?? {}) }),
    triggerPayload: Object.freeze({ ...(request.context?.triggerPayload ?? {}) }),
    selectedImage: Object.freeze({ ...(request.context?.selectedImage ?? {}) }),
    datasetInstances: Object.freeze([...(request.context?.datasetInstances ?? [])]),
  });

  const records: WorkflowInputBindingResolutionRecord[] = [];
  const diagnostics: WorkflowInputBindingResolutionDiagnostic[] = [];
  const resolvedValues: Record<string, unknown> = {};

  for (const binding of request.bindings) {
    const candidateSources = [...binding.sources].sort((a, b) => a.priority - b.priority);
    const candidateSourceIds = Object.freeze(candidateSources.map((source) => source.sourceId));
    let resolvedRecord: WorkflowInputBindingResolutionRecord | undefined;

    for (const source of candidateSources) {
      const resolution = resolveSourceValue(source, context);
      if (resolution.status !== "resolved") {
        const diagnosticCode = resolution.status === "selected-image-missing"
          ? WorkflowInputBindingResolutionDiagnosticCodes.selectedImageMissing
          : resolution.status === "dataset-instance-missing"
            ? WorkflowInputBindingResolutionDiagnosticCodes.datasetInstanceMissing
            : resolution.status === "missing-field-reference"
              ? WorkflowInputBindingResolutionDiagnosticCodes.missingFieldReference
              : resolution.status === "invalid-selection-reference"
                ? WorkflowInputBindingResolutionDiagnosticCodes.invalidSelectionReference
                : WorkflowInputBindingResolutionDiagnosticCodes.sourceValueMissing;
        if (source.required) {
          diagnostics.push(createDiagnostic({
            code: diagnosticCode,
            severity: "warning",
            bindingId: binding.bindingId,
            inputId: binding.inputId,
            source,
            message: `Binding source '${source.sourceId}' did not resolve a value.`,
          }));
        }
        continue;
      }
      const value = resolution.value;
      if (!valueTypeMatches(binding.valueType, value)) {
        diagnostics.push(createDiagnostic({
          code: WorkflowInputBindingResolutionDiagnosticCodes.typeMismatch,
          severity: source.required || binding.required ? "error" : "warning",
          bindingId: binding.bindingId,
          inputId: binding.inputId,
          source,
          message: `Binding source '${source.sourceId}' resolved value incompatible with expected type '${binding.valueType ?? "unknown"}'.`,
        }));
        continue;
      }

      resolvedValues[binding.inputId] = value;
      resolvedRecord = Object.freeze({
        inputId: binding.inputId,
        bindingId: binding.bindingId,
        required: binding.required,
        valueType: binding.valueType,
        resolved: true,
        value,
        resolutionKind: "source",
        sourceId: source.sourceId,
        sourceKind: source.kind,
        preview: Object.freeze({
          selectedSourceId: source.sourceId,
          selectedSourceKind: source.kind,
          selectedPriority: source.priority,
          candidateSourceIds,
        }),
      });
      break;
    }

    if (resolvedRecord) {
      records.push(resolvedRecord);
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(binding, "defaultValue")) {
      resolvedValues[binding.inputId] = binding.defaultValue;
      records.push(Object.freeze({
        inputId: binding.inputId,
        bindingId: binding.bindingId,
        required: binding.required,
        valueType: binding.valueType,
        resolved: true,
        value: binding.defaultValue,
        resolutionKind: "default",
        preview: Object.freeze({
          candidateSourceIds,
        }),
      }));
      continue;
    }

    const unresolvedCode = binding.required
      ? WorkflowInputBindingResolutionDiagnosticCodes.unresolvedRequiredInput
      : WorkflowInputBindingResolutionDiagnosticCodes.unresolvedOptionalInput;
    const unresolvedSeverity: "error" | "warning" = binding.required ? "error" : "warning";
    diagnostics.push(createDiagnostic({
      code: unresolvedCode,
      severity: unresolvedSeverity,
      bindingId: binding.bindingId,
      inputId: binding.inputId,
      message: binding.required
        ? `Required input '${binding.inputId}' could not be resolved from any binding source.`
        : `Optional input '${binding.inputId}' could not be resolved from any binding source.`,
    }));
    records.push(Object.freeze({
      inputId: binding.inputId,
      bindingId: binding.bindingId,
      required: binding.required,
      valueType: binding.valueType,
      resolved: false,
      preview: Object.freeze({
        candidateSourceIds,
      }),
    }));
  }

  return Object.freeze({
    contractVersion: "1.0.0",
    resolvedValues: Object.freeze({ ...resolvedValues }),
    records: Object.freeze(records),
    diagnostics: Object.freeze(diagnostics),
  });
}

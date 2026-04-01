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
): unknown {
  switch (source.kind) {
    case WorkflowInputBindingSourceKinds.uiFormValue:
      return hasOwn(context.uiFormValues, source.formKey) ? context.uiFormValues[source.formKey] : undefined;
    case WorkflowInputBindingSourceKinds.runtimeParameter:
      return hasOwn(context.runtimeParameters, source.parameterKey)
        ? context.runtimeParameters[source.parameterKey]
        : undefined;
    case WorkflowInputBindingSourceKinds.triggerPayload:
      return hasOwn(context.triggerPayload, source.payloadKey) ? context.triggerPayload[source.payloadKey] : undefined;
    case WorkflowInputBindingSourceKinds.selectedImage:
      return readByPath(context.selectedImage, source.path);
    case WorkflowInputBindingSourceKinds.datasetInstanceReference:
      return matchDatasetInstance(source, context.datasetInstances);
    case WorkflowInputBindingSourceKinds.constantValue:
      return source.value;
    default:
      return undefined;
  }
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
      const value = resolveSourceValue(source, context);
      if (value === undefined) {
        const diagnosticCode = source.kind === WorkflowInputBindingSourceKinds.selectedImage
          ? WorkflowInputBindingResolutionDiagnosticCodes.selectedImageMissing
          : source.kind === WorkflowInputBindingSourceKinds.datasetInstanceReference
            ? WorkflowInputBindingResolutionDiagnosticCodes.datasetInstanceMissing
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

import {
  type WorkflowExecutionContext,
  type WorkflowExecutionInputBinding,
  type WorkflowExecutionResolvedDatasetAsset,
  type WorkflowExecutionResolvedInputValue,
  type WorkflowExecutionTranslationIssue,
  type WorkflowExecutionUnresolvedInput,
  WorkflowExecutionValidationStages,
} from "./WorkflowExecutionAlignmentContracts";
import {
  createWorkflowInputBindingDescriptor,
  WorkflowInputBindingResolutionDiagnosticCodes,
  WorkflowInputBindingSourceKinds,
  type WorkflowInputBindingDescriptor,
} from "../../domain/workflow-studio/WorkflowInputBindingDomain";
import { resolveWorkflowInputBindings } from "./WorkflowInputBindingResolutionService";

export interface AssembleWorkflowExecutionContextRequest {
  readonly inputBindings: ReadonlyArray<WorkflowExecutionInputBinding>;
  readonly context: WorkflowExecutionContext;
}

export interface AssembleWorkflowExecutionContextResult {
  readonly context: WorkflowExecutionContext;
  readonly issues: ReadonlyArray<WorkflowExecutionTranslationIssue>;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Readonly<Record<string, unknown>>;
}

function toDomainBindingDescriptor(binding: WorkflowExecutionInputBinding): {
  readonly descriptor?: WorkflowInputBindingDescriptor;
  readonly issues: ReadonlyArray<WorkflowExecutionTranslationIssue>;
} {
  const metadata = asRecord(binding.metadata);
  const authoredBinding = asRecord(metadata?.systemInputBinding);

  if (authoredBinding) {
    try {
      return Object.freeze({
        descriptor: createWorkflowInputBindingDescriptor({
          bindingId: typeof authoredBinding.bindingId === "string" ? authoredBinding.bindingId : binding.bindingKey,
          inputId: binding.inputId,
          required: binding.required,
          valueType: binding.valueType,
          ...(Object.prototype.hasOwnProperty.call(binding, "defaultValue") ? { defaultValue: binding.defaultValue } : {}),
          sources: authoredBinding.sources,
        }),
        issues: Object.freeze([]),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Workflow input binding metadata is malformed.";
      return Object.freeze({
        issues: Object.freeze([Object.freeze({
          code: WorkflowInputBindingResolutionDiagnosticCodes.invalidBindingConfiguration,
          stage: WorkflowExecutionValidationStages.preExecution,
          severity: "error",
          message,
          path: `draft.inputs.${binding.inputId}.metadata.systemInputBinding`,
        })]),
      });
    }
  }

  if (binding.sourceType === "dataset-asset" && binding.dataset) {
    return Object.freeze({
      descriptor: createWorkflowInputBindingDescriptor({
        bindingId: binding.bindingKey,
        inputId: binding.inputId,
        required: binding.required,
        valueType: binding.valueType,
        sources: [
          {
            sourceId: `${binding.bindingKey}.dataset`,
            kind: WorkflowInputBindingSourceKinds.constantValue,
            priority: 1,
            required: binding.required,
            value: {
              assetId: binding.dataset.assetId,
              versionId: binding.dataset.versionId,
              format: binding.dataset.format,
              selection: binding.dataset.selection ? { ...binding.dataset.selection } : undefined,
              compatibility: binding.dataset.compatibility,
            },
          },
        ],
      }),
      issues: Object.freeze([]),
    });
  }

  if (binding.sourceType === "static-value") {
    return Object.freeze({
      descriptor: createWorkflowInputBindingDescriptor({
        bindingId: binding.bindingKey,
        inputId: binding.inputId,
        required: binding.required,
        valueType: binding.valueType,
        sources: [
          {
            sourceId: `${binding.bindingKey}.static`,
            kind: WorkflowInputBindingSourceKinds.constantValue,
            priority: 1,
            required: binding.required,
            value: binding.staticValue,
          },
        ],
      }),
      issues: Object.freeze([]),
    });
  }

  const formValues = asRecord(metadata?.formValues) ?? asRecord(metadata?.uiFormValues);
  if (formValues && Object.keys(formValues).length > 0) {
    try {
      return Object.freeze({
        descriptor: createWorkflowInputBindingDescriptor({
          bindingId: binding.bindingKey,
          inputId: binding.inputId,
          required: binding.required,
          valueType: binding.valueType,
          ...(Object.prototype.hasOwnProperty.call(binding, "defaultValue") ? { defaultValue: binding.defaultValue } : {}),
          sources: [
            {
              sourceId: `${binding.bindingKey}.ui-form`,
              kind: WorkflowInputBindingSourceKinds.uiFormValue,
              formKey: binding.inputId,
              priority: 1,
              required: binding.required,
            },
            {
              sourceId: `${binding.bindingKey}.runtime`,
              kind: WorkflowInputBindingSourceKinds.runtimeParameter,
              parameterKey: binding.bindingKey.startsWith("inputs.")
                ? binding.bindingKey.slice("inputs.".length)
                : binding.bindingKey,
              priority: 2,
            },
            {
              sourceId: `${binding.bindingKey}.trigger`,
              kind: WorkflowInputBindingSourceKinds.triggerPayload,
              payloadKey: binding.bindingKey.startsWith("inputs.")
                ? binding.bindingKey.slice("inputs.".length)
                : binding.bindingKey,
              priority: 3,
            },
          ],
        }),
        issues: Object.freeze([]),
      });
    } catch {
      // fall through to default behavior if generated descriptor fails.
    }
  }

  const parameterKey = binding.bindingKey.startsWith("inputs.")
    ? binding.bindingKey.slice("inputs.".length)
    : binding.bindingKey;

  return Object.freeze({
    descriptor: createWorkflowInputBindingDescriptor({
      bindingId: binding.bindingKey,
      inputId: binding.inputId,
      required: binding.required,
      valueType: binding.valueType,
      ...(Object.prototype.hasOwnProperty.call(binding, "defaultValue") ? { defaultValue: binding.defaultValue } : {}),
      sources: [
        {
          sourceId: `${binding.bindingKey}.runtime`,
          kind: WorkflowInputBindingSourceKinds.runtimeParameter,
          parameterKey,
          priority: 1,
        },
        {
          sourceId: `${binding.bindingKey}.trigger`,
          kind: WorkflowInputBindingSourceKinds.triggerPayload,
          payloadKey: parameterKey,
          priority: 2,
        },
      ],
    }),
    issues: Object.freeze([]),
  });
}

export function assembleWorkflowExecutionContext(
  request: AssembleWorkflowExecutionContextRequest,
): AssembleWorkflowExecutionContextResult {
  const runtimeInputValues = Object.freeze({ ...(request.context.inputValues ?? {}) });
  const triggerPayload = Object.freeze({ ...(request.context.triggerPayload ?? {}) });
  const resolvedInputs: WorkflowExecutionResolvedInputValue[] = [];
  const unresolvedInputs: WorkflowExecutionUnresolvedInput[] = [];
  const resolvedInputValues: Record<string, unknown> = {};
  const resolvedInputBindings: Record<string, unknown> = {};
  const resolvedRuntimeInputs: Record<string, unknown> = { ...runtimeInputValues };
  const datasets: WorkflowExecutionResolvedDatasetAsset[] = [];

  const bindingIssues: WorkflowExecutionTranslationIssue[] = [];
  const domainBindings: WorkflowInputBindingDescriptor[] = [];
  for (const binding of request.inputBindings) {
    const mapped = toDomainBindingDescriptor(binding);
    bindingIssues.push(...mapped.issues);
    if (mapped.descriptor) {
      domainBindings.push(mapped.descriptor);
    }
  }
  const resolution = resolveWorkflowInputBindings({
    bindings: domainBindings,
    context: {
      uiFormValues: asRecord(request.context.metadata?.uiFormValues)
        ?? asRecord(request.context.metadata?.formValues)
        ?? asRecord(request.context.metadata?.systemFormValues)
        ?? {},
      runtimeParameters: runtimeInputValues,
      triggerPayload,
      selectedImage: (request.context.metadata?.selectedImage ?? {}) as Readonly<Record<string, unknown>>,
      datasetInstances: (request.context.metadata?.datasetInstances as ReadonlyArray<{
        readonly systemId?: string;
        readonly instanceId: string;
        readonly datasetAssetId?: string;
        readonly datasetVersionId?: string;
        readonly purpose?: string;
      }> | undefined) ?? [],
    },
  });

  for (const binding of request.inputBindings) {
    const record = resolution.records.find((candidate) => candidate.inputId === binding.inputId);
    if (!record || !record.resolved) {
      unresolvedInputs.push(Object.freeze({
        inputId: binding.inputId,
        sourceType: binding.sourceType,
        required: binding.required,
        valueType: binding.valueType,
        bindingKey: binding.bindingKey,
        reasonCode: binding.required ? "required-input-missing" : "runtime-parameter-unresolved",
        message: binding.required
          ? `Required input '${binding.inputId}' was not provided and has no default value.`
          : `Optional input '${binding.inputId}' was not provided; execution will continue without a value.`,
      }));
      continue;
    }

    const resolutionSource = binding.sourceType === "dataset-asset"
      ? "dataset-asset"
      : binding.sourceType === "static-value"
        ? "static-value"
        : record.sourceKind === WorkflowInputBindingSourceKinds.uiFormValue
          ? "ui-form-value"
          : record.sourceKind === WorkflowInputBindingSourceKinds.selectedImage
            ? "selected-image-context"
            : record.sourceKind === WorkflowInputBindingSourceKinds.datasetInstanceReference
              ? "dataset-instance-reference"
        : record.sourceKind === WorkflowInputBindingSourceKinds.triggerPayload
          ? "trigger-activation"
          : record.resolutionKind === "default"
            ? "runtime-default"
            : "runtime-parameter";

    resolvedInputs.push(Object.freeze({
      inputId: binding.inputId,
      sourceType: binding.sourceType,
      required: binding.required,
      valueType: binding.valueType,
      bindingKey: binding.bindingKey,
      resolved: true,
      resolutionSource,
      value: record.value,
    }));

    resolvedInputValues[binding.inputId] = record.value;
    resolvedInputBindings[binding.bindingKey] = record.value;
    if (binding.sourceType !== "runtime-parameter" && !Object.prototype.hasOwnProperty.call(resolvedRuntimeInputs, binding.inputId)) {
      resolvedRuntimeInputs[binding.inputId] = record.value;
    }

    if (binding.sourceType === "runtime-parameter") {
      const parameterKey = binding.bindingKey.startsWith("inputs.")
        ? binding.bindingKey.slice("inputs.".length)
        : binding.bindingKey;
      if (!Object.prototype.hasOwnProperty.call(resolvedRuntimeInputs, parameterKey)) {
        resolvedRuntimeInputs[parameterKey] = record.value;
      }
    }

    if (binding.sourceType === "dataset-asset" && binding.dataset && record.value && typeof record.value === "object") {
      const datasetValue = record.value as {
        readonly assetId: string;
        readonly versionId?: string;
        readonly format?: "jsonl" | "json" | "csv" | "parquet";
        readonly selection?: Readonly<Record<string, unknown>>;
        readonly compatibility?: WorkflowExecutionResolvedDatasetAsset["compatibility"];
      };
      datasets.push(Object.freeze({
        inputId: binding.inputId,
        assetId: datasetValue.assetId,
        versionId: datasetValue.versionId,
        format: datasetValue.format,
        selection: datasetValue.selection ? Object.freeze({ ...datasetValue.selection }) : undefined,
        compatibility: datasetValue.compatibility,
      }));
    }
  }

  const issues = Object.freeze([
    ...bindingIssues,
    ...resolution.diagnostics.map((diagnostic) => Object.freeze({
    code: diagnostic.code,
    stage: WorkflowExecutionValidationStages.preExecution,
    severity: diagnostic.severity,
    message: diagnostic.message,
    path: diagnostic.path ?? `draft.inputs.${diagnostic.inputId}`,
  })),
  ]);

  return Object.freeze({
    context: Object.freeze({
      ...request.context,
      resolvedRuntimeInputs: Object.freeze({ ...resolvedRuntimeInputs }),
      resolvedInputValues: Object.freeze({ ...resolvedInputValues }),
      resolvedInputBindings: Object.freeze({ ...resolvedInputBindings }),
      resolvedInputs: Object.freeze([...resolvedInputs]),
      unresolvedInputs: Object.freeze([...unresolvedInputs]),
      selectedAssets: Object.freeze({
        datasets: Object.freeze([...datasets]),
      }),
      triggerPayload,
      sessionContext: request.context.sessionContext
        ? Object.freeze({ ...request.context.sessionContext })
        : undefined,
    }),
    issues: Object.freeze(issues),
  });
}

import {
  type WorkflowExecutionContext,
  type WorkflowExecutionInputBinding,
  type WorkflowExecutionResolvedDatasetAsset,
  type WorkflowExecutionResolvedInputValue,
  type WorkflowExecutionTranslationIssue,
  type WorkflowExecutionUnresolvedInput,
  WorkflowExecutionValidationStages,
} from "./WorkflowExecutionAlignmentContracts";

export interface AssembleWorkflowExecutionContextRequest {
  readonly inputBindings: ReadonlyArray<WorkflowExecutionInputBinding>;
  readonly context: WorkflowExecutionContext;
}

export interface AssembleWorkflowExecutionContextResult {
  readonly context: WorkflowExecutionContext;
  readonly issues: ReadonlyArray<WorkflowExecutionTranslationIssue>;
}

function resolveRuntimeParameterValue(input: {
  readonly binding: WorkflowExecutionInputBinding;
  readonly runtimeInputValues: Readonly<Record<string, unknown>>;
  readonly triggerPayload: Readonly<Record<string, unknown>>;
}): {
  readonly resolvedInput?: WorkflowExecutionResolvedInputValue;
  readonly unresolvedInput?: WorkflowExecutionUnresolvedInput;
} {
  const parameterKey = input.binding.bindingKey.startsWith("inputs.")
    ? input.binding.bindingKey.slice("inputs.".length)
    : input.binding.bindingKey;
  const hasRuntimeValue = Object.prototype.hasOwnProperty.call(input.runtimeInputValues, parameterKey);
  if (hasRuntimeValue) {
    return Object.freeze({
      resolvedInput: Object.freeze({
        inputId: input.binding.inputId,
        sourceType: input.binding.sourceType,
        required: input.binding.required,
        valueType: input.binding.valueType,
        bindingKey: input.binding.bindingKey,
        resolved: true,
        resolutionSource: "runtime-parameter" as const,
        value: input.runtimeInputValues[parameterKey],
      }),
    });
  }

  const hasTriggerValue = Object.prototype.hasOwnProperty.call(input.triggerPayload, parameterKey);
  if (hasTriggerValue) {
    return Object.freeze({
      resolvedInput: Object.freeze({
        inputId: input.binding.inputId,
        sourceType: input.binding.sourceType,
        required: input.binding.required,
        valueType: input.binding.valueType,
        bindingKey: input.binding.bindingKey,
        resolved: true,
        resolutionSource: "trigger-activation" as const,
        value: input.triggerPayload[parameterKey],
      }),
    });
  }

  if (Object.prototype.hasOwnProperty.call(input.binding, "defaultValue")) {
    return Object.freeze({
      resolvedInput: Object.freeze({
        inputId: input.binding.inputId,
        sourceType: input.binding.sourceType,
        required: input.binding.required,
        valueType: input.binding.valueType,
        bindingKey: input.binding.bindingKey,
        resolved: true,
        resolutionSource: "runtime-default" as const,
        value: input.binding.defaultValue,
      }),
    });
  }

  return Object.freeze({
    unresolvedInput: Object.freeze({
      inputId: input.binding.inputId,
      sourceType: input.binding.sourceType,
      required: input.binding.required,
      valueType: input.binding.valueType,
      bindingKey: input.binding.bindingKey,
      reasonCode: input.binding.required ? "required-input-missing" : "runtime-parameter-unresolved",
      message: input.binding.required
        ? `Required runtime input '${parameterKey}' was not provided and has no default value.`
        : `Optional runtime input '${parameterKey}' was not provided; execution will continue without a value.`,
    }),
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

  for (const binding of request.inputBindings) {
    if (binding.sourceType === "dataset-asset" && binding.dataset) {
      const datasetValue = Object.freeze({
        assetId: binding.dataset.assetId,
        versionId: binding.dataset.versionId,
        format: binding.dataset.format,
        selection: binding.dataset.selection ? Object.freeze({ ...binding.dataset.selection }) : undefined,
      });
      resolvedInputs.push(Object.freeze({
        inputId: binding.inputId,
        sourceType: binding.sourceType,
        required: binding.required,
        valueType: binding.valueType,
        bindingKey: binding.bindingKey,
        resolved: true,
        resolutionSource: "dataset-asset",
        value: datasetValue,
      }));
      resolvedInputValues[binding.inputId] = datasetValue;
      resolvedInputBindings[binding.bindingKey] = datasetValue;
      if (!Object.prototype.hasOwnProperty.call(resolvedRuntimeInputs, binding.inputId)) {
        resolvedRuntimeInputs[binding.inputId] = datasetValue;
      }
      datasets.push(Object.freeze({
        inputId: binding.inputId,
        assetId: binding.dataset.assetId,
        versionId: binding.dataset.versionId,
        format: binding.dataset.format,
        selection: binding.dataset.selection ? Object.freeze({ ...binding.dataset.selection }) : undefined,
      }));
      continue;
    }

    if (binding.sourceType === "static-value") {
      const staticValue = binding.staticValue;
      resolvedInputs.push(Object.freeze({
        inputId: binding.inputId,
        sourceType: binding.sourceType,
        required: binding.required,
        valueType: binding.valueType,
        bindingKey: binding.bindingKey,
        resolved: true,
        resolutionSource: "static-value",
        value: staticValue,
      }));
      resolvedInputValues[binding.inputId] = staticValue;
      resolvedInputBindings[binding.bindingKey] = staticValue;
      if (!Object.prototype.hasOwnProperty.call(resolvedRuntimeInputs, binding.inputId)) {
        resolvedRuntimeInputs[binding.inputId] = staticValue;
      }
      continue;
    }

    const runtimeResolution = resolveRuntimeParameterValue({
      binding,
      runtimeInputValues,
      triggerPayload,
    });
    if (runtimeResolution.resolvedInput) {
      resolvedInputs.push(runtimeResolution.resolvedInput);
      resolvedInputValues[binding.inputId] = runtimeResolution.resolvedInput.value;
      resolvedInputBindings[binding.bindingKey] = runtimeResolution.resolvedInput.value;
      const parameterKey = binding.bindingKey.startsWith("inputs.")
        ? binding.bindingKey.slice("inputs.".length)
        : binding.bindingKey;
      if (!Object.prototype.hasOwnProperty.call(resolvedRuntimeInputs, parameterKey)) {
        resolvedRuntimeInputs[parameterKey] = runtimeResolution.resolvedInput.value;
      }
      continue;
    }

    if (runtimeResolution.unresolvedInput) {
      unresolvedInputs.push(runtimeResolution.unresolvedInput);
    }
  }

  const issues = unresolvedInputs.map((input) => Object.freeze({
    code: input.required ? "input-resolution-required-missing" : "input-resolution-optional-unresolved",
    stage: WorkflowExecutionValidationStages.preExecution,
    severity: input.required ? "error" : "warning",
    message: input.message,
    path: `draft.inputs.${input.inputId}`,
  }));

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

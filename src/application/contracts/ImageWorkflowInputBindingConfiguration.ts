import {
  WorkflowInputBindingContractVersion,
  WorkflowInputBindingDescriptorSchema,
  createWorkflowInputBindingDescriptor,
  validateWorkflowInputBindingDefinitions,
  type WorkflowInputBindingDescriptor,
} from "@domain/workflow-studio/WorkflowInputBindingDomain";

export interface ImageWorkflowInputBindingConfiguration {
  readonly contractVersion: string;
  readonly bindings: ReadonlyArray<WorkflowInputBindingDescriptor>;
}

export function createImageWorkflowInputBindingConfiguration(input: {
  readonly bindings: ReadonlyArray<unknown>;
  readonly contractVersion?: string;
}): ImageWorkflowInputBindingConfiguration {
  const bindings = Object.freeze(input.bindings.map((binding) => createWorkflowInputBindingDescriptor(binding)));
  const diagnostics = validateWorkflowInputBindingDefinitions({ bindings });
  const blocking = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (blocking.length > 0) {
    const message = blocking.map((diagnostic) => diagnostic.message).join("; ");
    throw new Error(`Invalid image workflow input binding configuration: ${message}`);
  }

  return Object.freeze({
    contractVersion: (input.contractVersion?.trim() || WorkflowInputBindingContractVersion),
    bindings,
  });
}

export function serializeImageWorkflowInputBindingConfiguration(input: ImageWorkflowInputBindingConfiguration): Readonly<Record<string, unknown>> {
  return Object.freeze({
    contractVersion: input.contractVersion,
    bindings: Object.freeze(input.bindings.map((binding) => WorkflowInputBindingDescriptorSchema.parse(binding))),
  });
}

export function duplicateImageWorkflowInputBindingConfiguration(
  input: ImageWorkflowInputBindingConfiguration,
): ImageWorkflowInputBindingConfiguration {
  return createImageWorkflowInputBindingConfiguration({
    contractVersion: input.contractVersion,
    bindings: input.bindings,
  });
}


import {
  AssetContractShapeKinds,
  createAssetContractDescriptor,
  type AssetContractDescriptor,
} from "@domain/contracts/AssetContract";
import type { WorkflowTemplateDefinition } from "@domain/workflow-template-studio/WorkflowTemplateDomain";

function mapTemplateInputValueType(
  valueType: WorkflowTemplateDefinition["inputRequirements"][number]["valueType"],
): string {
  if (valueType === "text") {
    return "string";
  }
  if (valueType === "number") {
    return "number";
  }
  if (valueType === "boolean") {
    return "boolean";
  }
  if (valueType === "json") {
    return "object";
  }
  return "image-reference";
}

function mapTemplateOutputValueType(
  valueType: WorkflowTemplateDefinition["outputExpectations"][number]["valueType"],
): string {
  if (valueType === "json") {
    return "object";
  }
  if (valueType === "images") {
    return "image-metadata-records";
  }
  return "image-reference";
}

function mapTemplateParameterValueType(
  valueType: NonNullable<WorkflowTemplateDefinition["parameters"]>[number]["type"],
): string {
  if (valueType === "number" || valueType === "integer") {
    return "number";
  }
  if (valueType === "boolean") {
    return "boolean";
  }
  if (valueType === "json") {
    return "object";
  }
  return "string";
}

export function createWorkflowTemplateContractProjection(
  definition: WorkflowTemplateDefinition,
): AssetContractDescriptor {
  const inputProperties: Record<string, { readonly type: string }> = {};
  const outputProperties: Record<string, { readonly type: string }> = {};
  const requiredInputIds: string[] = [];
  for (const entry of definition.inputRequirements) {
    inputProperties[entry.inputId] = Object.freeze({
      type: mapTemplateInputValueType(entry.valueType),
    });
    if (entry.required) {
      requiredInputIds.push(entry.inputId);
    }
  }
  for (const entry of definition.outputExpectations) {
    outputProperties[entry.outputId] = Object.freeze({
      type: mapTemplateOutputValueType(entry.valueType),
    });
  }

  const parameters = (definition.parameters ?? []).map((entry) => Object.freeze({
    id: entry.parameterId,
    required: entry.required,
    valueType: mapTemplateParameterValueType(entry.type),
    defaultValue: entry.defaultValue,
    description: entry.description,
  }));

  return createAssetContractDescriptor({
    version: "1.0.0",
    input: {
      kind: AssetContractShapeKinds.jsonSchema,
      description: `Workflow template '${definition.templateId}' invocation inputs.`,
      schema: Object.freeze({
        type: "object",
        properties: Object.freeze(inputProperties),
        required: Object.freeze(requiredInputIds),
      }),
    },
    output: {
      kind: AssetContractShapeKinds.jsonSchema,
      description: `Workflow template '${definition.templateId}' produced outputs.`,
      schema: Object.freeze({
        type: "object",
        properties: Object.freeze(outputProperties),
      }),
    },
    parameters: Object.freeze(parameters),
    execution: {
      invocationMode: "deferred",
      sideEffects: "bounded",
    },
  });
}


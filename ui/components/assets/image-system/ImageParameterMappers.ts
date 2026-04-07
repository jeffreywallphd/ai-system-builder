import type { AssetContractParameterDescriptor } from "../../../../src/domain/contracts/AssetContract";
import type { ImageParameterDefinition } from "./ImageUiContracts";

function normalizeType(valueType?: string): ImageParameterDefinition["type"] {
  const normalized = valueType?.trim().toLowerCase();
  if (normalized === "number" || normalized === "integer" || normalized === "float") {
    return "number";
  }
  if (normalized === "boolean" || normalized === "bool") {
    return "boolean";
  }
  if (normalized === "select" || normalized === "enum") {
    return "select";
  }
  if (normalized === "range" || normalized === "slider") {
    return "range";
  }
  return "text";
}

export function mapAssetContractParametersToImageParameters(
  parameters: ReadonlyArray<AssetContractParameterDescriptor>,
): ReadonlyArray<ImageParameterDefinition> {
  return Object.freeze(parameters.map((parameter) => Object.freeze({
    parameterId: parameter.id,
    label: parameter.id,
    type: normalizeType(parameter.valueType),
    required: parameter.required,
    description: parameter.description,
    defaultValue: parameter.defaultValue,
  })));
}

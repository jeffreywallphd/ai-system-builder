import {
  ImageWorkflowParameterSpecificationError,
  normalizeImageWorkflowParameterSpecification,
  validateImageWorkflowParameterValue,
  type ImageWorkflowParameterSpecification,
} from "@domain/image-workflows/ImageWorkflowParameterSpecification";

export class ImageWorkflowParameterContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageWorkflowParameterContractError";
  }
}

export const ImageWorkflowParameterContractVersions = Object.freeze({
  v1: "image-workflow-parameter-contract/v1",
} as const);

export type ImageWorkflowParameterContractVersion =
  typeof ImageWorkflowParameterContractVersions[keyof typeof ImageWorkflowParameterContractVersions];

export const ImageSystemParameterValueSources = Object.freeze({
  baseline: "baseline",
  profile: "profile",
  runtimeOverride: "runtime-override",
} as const);

export type ImageSystemParameterValueSource =
  typeof ImageSystemParameterValueSources[keyof typeof ImageSystemParameterValueSources];

export const ImageSystemParameterValidationIssueCodes = Object.freeze({
  unknownParameter: "unknown-parameter",
  requiredValueMissing: "required-value-missing",
  invalidValue: "invalid-value",
} as const);

export type ImageSystemParameterValidationIssueCode =
  typeof ImageSystemParameterValidationIssueCodes[keyof typeof ImageSystemParameterValidationIssueCodes];

export interface ImageWorkflowParameterDefinitionContract {
  readonly contractVersion: ImageWorkflowParameterContractVersion;
  readonly workflowId: string;
  readonly workflowVersionTag: string;
  readonly specification: ImageWorkflowParameterSpecification;
}

export interface ImageSystemParameterValueContract {
  readonly parameterId: string;
  readonly value: unknown;
  readonly source: ImageSystemParameterValueSource;
}

export interface ImageSystemParameterSetContract {
  readonly contractVersion: ImageWorkflowParameterContractVersion;
  readonly systemId: string;
  readonly workflowId: string;
  readonly values: ReadonlyArray<ImageSystemParameterValueContract>;
}

export interface ImageSystemParameterValidationIssue {
  readonly code: ImageSystemParameterValidationIssueCode;
  readonly parameterId: string;
  readonly message: string;
}

export interface ImageSystemParameterValidationResult {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<ImageSystemParameterValidationIssue>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageWorkflowParameterContractError(`${field} is required.`);
  }
  return normalized;
}

export function createImageWorkflowParameterDefinitionContract(input: {
  readonly workflowId: string;
  readonly workflowVersionTag: string;
  readonly specification: ImageWorkflowParameterSpecification;
  readonly contractVersion?: ImageWorkflowParameterContractVersion;
}): ImageWorkflowParameterDefinitionContract {
  try {
    return Object.freeze({
      contractVersion: input.contractVersion ?? ImageWorkflowParameterContractVersions.v1,
      workflowId: normalizeRequired(input.workflowId, "Image workflow parameter contract workflowId"),
      workflowVersionTag: normalizeRequired(input.workflowVersionTag, "Image workflow parameter contract workflowVersionTag"),
      specification: normalizeImageWorkflowParameterSpecification(input.specification),
    });
  } catch (error) {
    if (error instanceof ImageWorkflowParameterSpecificationError) {
      throw new ImageWorkflowParameterContractError(error.message);
    }
    throw error;
  }
}

export function validateImageSystemParameterSetContract(input: {
  readonly parameterSpecifications: ReadonlyArray<ImageWorkflowParameterSpecification>;
  readonly values: ReadonlyArray<ImageSystemParameterValueContract>;
}): ImageSystemParameterValidationResult {
  const specificationMap = new Map<string, ImageWorkflowParameterSpecification>();
  for (const specification of input.parameterSpecifications) {
    const normalized = normalizeImageWorkflowParameterSpecification(specification);
    if (specificationMap.has(normalized.parameterId)) {
      throw new ImageWorkflowParameterContractError(
        `Image workflow parameter specification '${normalized.parameterId}' must be unique.`,
      );
    }
    specificationMap.set(normalized.parameterId, normalized);
  }

  const issues: ImageSystemParameterValidationIssue[] = [];
  const valueByParameterId = new Map<string, ImageSystemParameterValueContract>();

  for (const value of input.values) {
    const parameterId = normalizeRequired(value.parameterId, "Image system parameter value parameterId");
    if (!Object.values(ImageSystemParameterValueSources).includes(value.source)) {
      throw new ImageWorkflowParameterContractError(
        `Image system parameter '${parameterId}' has invalid source '${String(value.source)}'.`,
      );
    }

    if (!specificationMap.has(parameterId)) {
      issues.push(Object.freeze({
        code: ImageSystemParameterValidationIssueCodes.unknownParameter,
        parameterId,
        message: `Parameter '${parameterId}' is not declared by workflow parameter specifications.`,
      }));
      continue;
    }

    valueByParameterId.set(parameterId, Object.freeze({
      parameterId,
      value: value.value,
      source: value.source,
    }));
  }

  for (const specification of specificationMap.values()) {
    const parameterValue = valueByParameterId.get(specification.parameterId);
    if (!parameterValue) {
      if (specification.required && specification.defaultValue === undefined) {
        issues.push(Object.freeze({
          code: ImageSystemParameterValidationIssueCodes.requiredValueMissing,
          parameterId: specification.parameterId,
          message: `Required parameter '${specification.parameterId}' is missing and has no default value.`,
        }));
      }
      continue;
    }

    const valueIssues = validateImageWorkflowParameterValue(specification, parameterValue.value);
    for (const issue of valueIssues) {
      issues.push(Object.freeze({
        code: ImageSystemParameterValidationIssueCodes.invalidValue,
        parameterId: specification.parameterId,
        message: issue,
      }));
    }
  }

  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze(issues),
  });
}

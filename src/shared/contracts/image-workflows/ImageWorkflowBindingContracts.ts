export class ImageWorkflowBindingContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageWorkflowBindingContractError";
  }
}

export const ImageWorkflowBindingContractVersions = Object.freeze({
  v1: "image-workflow-binding-contract/v1",
} as const);

export type ImageWorkflowBindingContractVersion =
  typeof ImageWorkflowBindingContractVersions[keyof typeof ImageWorkflowBindingContractVersions];

export const ImageWorkflowInputSlotPurposes = Object.freeze({
  sourceImage: "source-image",
  maskImage: "mask-image",
  referenceImage: "reference-image",
  runtimeValue: "runtime-value",
} as const);

export type ImageWorkflowInputSlotPurpose =
  typeof ImageWorkflowInputSlotPurposes[keyof typeof ImageWorkflowInputSlotPurposes]
  | (string & {});

export const ImageWorkflowOutputSlotPurposes = Object.freeze({
  generatedImage: "generated-image",
  generatedImageCollection: "generated-image-collection",
  metadata: "metadata",
} as const);

export type ImageWorkflowOutputSlotPurpose =
  typeof ImageWorkflowOutputSlotPurposes[keyof typeof ImageWorkflowOutputSlotPurposes]
  | (string & {});

export const ImageWorkflowSlotCardinalities = Object.freeze({
  one: "one",
  many: "many",
} as const);

export type ImageWorkflowSlotCardinality =
  typeof ImageWorkflowSlotCardinalities[keyof typeof ImageWorkflowSlotCardinalities];

export interface ImageWorkflowInputSlotBindingContract {
  readonly slotId: string;
  readonly label: string;
  readonly description?: string;
  readonly purpose: ImageWorkflowInputSlotPurpose;
  readonly required: boolean;
  readonly cardinality: ImageWorkflowSlotCardinality;
  readonly minimumAssetCount: number;
  readonly maximumAssetCount?: number;
  readonly allowedAssetClasses: ReadonlyArray<string>;
  readonly allowedMediaClasses: ReadonlyArray<string>;
}

export interface ImageWorkflowOutputSlotBindingContract {
  readonly slotId: string;
  readonly label: string;
  readonly description?: string;
  readonly purpose: ImageWorkflowOutputSlotPurpose;
  readonly required: boolean;
  readonly cardinality: ImageWorkflowSlotCardinality;
  readonly minimumAssetCount: number;
  readonly maximumAssetCount?: number;
  readonly emittedAssetClasses: ReadonlyArray<string>;
  readonly emittedMediaClasses: ReadonlyArray<string>;
}

export interface ImageWorkflowBindingContract {
  readonly contractVersion: ImageWorkflowBindingContractVersion;
  readonly workflowId: string;
  readonly workflowVersionTag: string;
  readonly inputSlots: ReadonlyArray<ImageWorkflowInputSlotBindingContract>;
  readonly outputSlots: ReadonlyArray<ImageWorkflowOutputSlotBindingContract>;
}

export interface ImageSystemLogicalAssetReference {
  readonly assetReferenceId: string;
  readonly assetClass: string;
  readonly mediaClass?: string;
}

export interface ImageSystemInputSlotBindingContract {
  readonly bindingId: string;
  readonly slotId: string;
  readonly assets: ReadonlyArray<ImageSystemLogicalAssetReference>;
}

export interface ImageSystemOutputSlotBindingContract {
  readonly bindingId: string;
  readonly slotId: string;
  readonly targetReference: string;
  readonly acceptedAssetClasses: ReadonlyArray<string>;
  readonly acceptedMediaClasses: ReadonlyArray<string>;
}

export interface ImageSystemBindingContract {
  readonly contractVersion: ImageWorkflowBindingContractVersion;
  readonly systemId: string;
  readonly workflowId: string;
  readonly inputBindings: ReadonlyArray<ImageSystemInputSlotBindingContract>;
  readonly outputBindings: ReadonlyArray<ImageSystemOutputSlotBindingContract>;
}

export const ImageSystemBindingValidationIssueCodes = Object.freeze({
  workflowMismatch: "workflow-mismatch",
  unknownInputSlot: "unknown-input-slot",
  unknownOutputSlot: "unknown-output-slot",
  requiredInputBindingMissing: "required-input-binding-missing",
  requiredOutputBindingMissing: "required-output-binding-missing",
  inputCardinalityUnderflow: "input-cardinality-underflow",
  inputCardinalityOverflow: "input-cardinality-overflow",
  outputCardinalityUnderflow: "output-cardinality-underflow",
  outputCardinalityOverflow: "output-cardinality-overflow",
  inputAssetClassIncompatible: "input-asset-class-incompatible",
  inputMediaClassIncompatible: "input-media-class-incompatible",
  outputAssetClassIncompatible: "output-asset-class-incompatible",
  outputMediaClassIncompatible: "output-media-class-incompatible",
} as const);

export type ImageSystemBindingValidationIssueCode =
  typeof ImageSystemBindingValidationIssueCodes[keyof typeof ImageSystemBindingValidationIssueCodes];

export interface ImageSystemBindingValidationIssue {
  readonly code: ImageSystemBindingValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface ImageSystemBindingValidationResult {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<ImageSystemBindingValidationIssue>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageWorkflowBindingContractError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeLogicalReference(value: string, field: string): string {
  const normalized = normalizeRequired(value, field);
  if (/^[a-zA-Z]:\\/.test(normalized) || normalized.startsWith("/") || normalized.includes("\\")) {
    throw new ImageWorkflowBindingContractError(`${field} must be a logical reference and cannot be a filesystem path.`);
  }
  return normalized;
}

function normalizeVersionTag(value: string): string {
  const normalized = normalizeRequired(value, "Image workflow binding contract workflowVersionTag");
  if (!/^\d+\.\d+\.\d+$/.test(normalized)) {
    throw new ImageWorkflowBindingContractError("Image workflow binding contract workflowVersionTag must use semantic version format '<major>.<minor>.<patch>'.");
  }
  return normalized;
}

function normalizeUniqueStringList(values: ReadonlyArray<string> | undefined): ReadonlyArray<string> {
  return Object.freeze([
    ...new Set((values ?? [])
      .map((entry) => normalizeOptional(entry))
      .filter((entry): entry is string => Boolean(entry))),
  ]);
}

function assertUnique(values: ReadonlyArray<string>, field: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new ImageWorkflowBindingContractError(`${field} '${value}' must be unique.`);
    }
    seen.add(value);
  }
}

function normalizeMinimumMaximum(input: {
  readonly cardinality: ImageWorkflowSlotCardinality;
  readonly required: boolean;
  readonly minimumAssetCount?: number;
  readonly maximumAssetCount?: number;
  readonly fieldPrefix: string;
}): { minimumAssetCount: number; maximumAssetCount?: number } {
  const minimumAssetCount = input.minimumAssetCount ?? (input.required ? 1 : 0);
  if (!Number.isInteger(minimumAssetCount) || minimumAssetCount < 0) {
    throw new ImageWorkflowBindingContractError(`${input.fieldPrefix} minimumAssetCount must be a non-negative integer.`);
  }

  const maximumAssetCount = input.maximumAssetCount;
  if (maximumAssetCount !== undefined && (!Number.isInteger(maximumAssetCount) || maximumAssetCount < 1)) {
    throw new ImageWorkflowBindingContractError(`${input.fieldPrefix} maximumAssetCount must be a positive integer.`);
  }

  if (maximumAssetCount !== undefined && minimumAssetCount > maximumAssetCount) {
    throw new ImageWorkflowBindingContractError(`${input.fieldPrefix} minimumAssetCount cannot exceed maximumAssetCount.`);
  }

  if (input.cardinality === ImageWorkflowSlotCardinalities.one) {
    if (minimumAssetCount > 1) {
      throw new ImageWorkflowBindingContractError(`${input.fieldPrefix} cardinality 'one' cannot set minimumAssetCount > 1.`);
    }
    if (maximumAssetCount !== undefined && maximumAssetCount > 1) {
      throw new ImageWorkflowBindingContractError(`${input.fieldPrefix} cardinality 'one' cannot set maximumAssetCount > 1.`);
    }
  }

  return Object.freeze({
    minimumAssetCount,
    maximumAssetCount,
  });
}

function normalizeInputSlot(
  input: ImageWorkflowInputSlotBindingContract,
): ImageWorkflowInputSlotBindingContract {
  const slotId = normalizeRequired(input.slotId, "Image workflow input slotId");
  const cardinality = input.cardinality;
  if (!Object.values(ImageWorkflowSlotCardinalities).includes(cardinality)) {
    throw new ImageWorkflowBindingContractError(`Image workflow input slot '${slotId}' cardinality '${String(cardinality)}' is invalid.`);
  }

  const purpose = normalizeRequired(input.purpose, `Image workflow input slot '${slotId}' purpose`);
  const required = Boolean(input.required);
  const bounds = normalizeMinimumMaximum({
    cardinality,
    required,
    minimumAssetCount: input.minimumAssetCount,
    maximumAssetCount: input.maximumAssetCount,
    fieldPrefix: `Image workflow input slot '${slotId}'`,
  });

  return Object.freeze({
    slotId,
    label: normalizeRequired(input.label, `Image workflow input slot '${slotId}' label`),
    description: normalizeOptional(input.description),
    purpose,
    required,
    cardinality,
    minimumAssetCount: bounds.minimumAssetCount,
    maximumAssetCount: bounds.maximumAssetCount,
    allowedAssetClasses: normalizeUniqueStringList(input.allowedAssetClasses),
    allowedMediaClasses: normalizeUniqueStringList(input.allowedMediaClasses),
  });
}

function normalizeOutputSlot(
  input: ImageWorkflowOutputSlotBindingContract,
): ImageWorkflowOutputSlotBindingContract {
  const slotId = normalizeRequired(input.slotId, "Image workflow output slotId");
  const cardinality = input.cardinality;
  if (!Object.values(ImageWorkflowSlotCardinalities).includes(cardinality)) {
    throw new ImageWorkflowBindingContractError(`Image workflow output slot '${slotId}' cardinality '${String(cardinality)}' is invalid.`);
  }

  const required = Boolean(input.required);
  const bounds = normalizeMinimumMaximum({
    cardinality,
    required,
    minimumAssetCount: input.minimumAssetCount,
    maximumAssetCount: input.maximumAssetCount,
    fieldPrefix: `Image workflow output slot '${slotId}'`,
  });

  return Object.freeze({
    slotId,
    label: normalizeRequired(input.label, `Image workflow output slot '${slotId}' label`),
    description: normalizeOptional(input.description),
    purpose: normalizeRequired(input.purpose, `Image workflow output slot '${slotId}' purpose`),
    required,
    cardinality,
    minimumAssetCount: bounds.minimumAssetCount,
    maximumAssetCount: bounds.maximumAssetCount,
    emittedAssetClasses: normalizeUniqueStringList(input.emittedAssetClasses),
    emittedMediaClasses: normalizeUniqueStringList(input.emittedMediaClasses),
  });
}

function normalizeSystemAssetReference(input: ImageSystemLogicalAssetReference): ImageSystemLogicalAssetReference {
  return Object.freeze({
    assetReferenceId: normalizeLogicalReference(input.assetReferenceId, "Image system input assetReferenceId"),
    assetClass: normalizeRequired(input.assetClass, `Image system input asset '${input.assetReferenceId}' assetClass`),
    mediaClass: normalizeOptional(input.mediaClass),
  });
}

function normalizeSystemInputBinding(input: ImageSystemInputSlotBindingContract): ImageSystemInputSlotBindingContract {
  const slotId = normalizeRequired(input.slotId, "Image system input binding slotId");
  const bindingId = normalizeRequired(input.bindingId, `Image system input binding for '${slotId}' bindingId`);
  return Object.freeze({
    bindingId,
    slotId,
    assets: Object.freeze((input.assets ?? []).map((asset) => normalizeSystemAssetReference(asset))),
  });
}

function normalizeSystemOutputBinding(input: ImageSystemOutputSlotBindingContract): ImageSystemOutputSlotBindingContract {
  const slotId = normalizeRequired(input.slotId, "Image system output binding slotId");
  const bindingId = normalizeRequired(input.bindingId, `Image system output binding for '${slotId}' bindingId`);
  return Object.freeze({
    bindingId,
    slotId,
    targetReference: normalizeLogicalReference(input.targetReference, `Image system output binding '${bindingId}' targetReference`),
    acceptedAssetClasses: normalizeUniqueStringList(input.acceptedAssetClasses),
    acceptedMediaClasses: normalizeUniqueStringList(input.acceptedMediaClasses),
  });
}

export function createImageWorkflowBindingContract(input: {
  readonly workflowId: string;
  readonly workflowVersionTag: string;
  readonly inputSlots: ReadonlyArray<ImageWorkflowInputSlotBindingContract>;
  readonly outputSlots: ReadonlyArray<ImageWorkflowOutputSlotBindingContract>;
  readonly contractVersion?: ImageWorkflowBindingContractVersion;
}): ImageWorkflowBindingContract {
  const inputSlots = Object.freeze((input.inputSlots ?? []).map((slot) => normalizeInputSlot(slot)));
  const outputSlots = Object.freeze((input.outputSlots ?? []).map((slot) => normalizeOutputSlot(slot)));

  assertUnique(inputSlots.map((slot) => slot.slotId), "Image workflow input slotId");
  assertUnique(outputSlots.map((slot) => slot.slotId), "Image workflow output slotId");

  const requiredSourceSlots = inputSlots.filter((slot) => slot.purpose === ImageWorkflowInputSlotPurposes.sourceImage && slot.required);
  if (requiredSourceSlots.length === 0) {
    throw new ImageWorkflowBindingContractError("Image workflow binding contracts require at least one required source-image input slot.");
  }

  return Object.freeze({
    contractVersion: input.contractVersion ?? ImageWorkflowBindingContractVersions.v1,
    workflowId: normalizeRequired(input.workflowId, "Image workflow binding contract workflowId"),
    workflowVersionTag: normalizeVersionTag(input.workflowVersionTag),
    inputSlots,
    outputSlots,
  });
}

export function createImageSystemBindingContract(input: {
  readonly systemId: string;
  readonly workflowId: string;
  readonly inputBindings: ReadonlyArray<ImageSystemInputSlotBindingContract>;
  readonly outputBindings: ReadonlyArray<ImageSystemOutputSlotBindingContract>;
  readonly contractVersion?: ImageWorkflowBindingContractVersion;
}): ImageSystemBindingContract {
  const inputBindings = Object.freeze((input.inputBindings ?? []).map((binding) => normalizeSystemInputBinding(binding)));
  const outputBindings = Object.freeze((input.outputBindings ?? []).map((binding) => normalizeSystemOutputBinding(binding)));

  assertUnique(inputBindings.map((binding) => binding.bindingId), "Image system input bindingId");
  assertUnique(outputBindings.map((binding) => binding.bindingId), "Image system output bindingId");
  assertUnique(inputBindings.map((binding) => binding.slotId), "Image system input binding slotId");
  assertUnique(outputBindings.map((binding) => binding.slotId), "Image system output binding slotId");

  return Object.freeze({
    contractVersion: input.contractVersion ?? ImageWorkflowBindingContractVersions.v1,
    systemId: normalizeRequired(input.systemId, "Image system binding contract systemId"),
    workflowId: normalizeRequired(input.workflowId, "Image system binding contract workflowId"),
    inputBindings,
    outputBindings,
  });
}

export function validateImageSystemBindingContract(input: {
  readonly workflowContract: ImageWorkflowBindingContract;
  readonly systemContract: ImageSystemBindingContract;
}): ImageSystemBindingValidationResult {
  const issues: ImageSystemBindingValidationIssue[] = [];

  if (input.workflowContract.workflowId !== input.systemContract.workflowId) {
    issues.push(Object.freeze({
      code: ImageSystemBindingValidationIssueCodes.workflowMismatch,
      path: "workflowId",
      message: "Image system binding workflowId must match the workflow binding contract workflowId.",
    }));
  }

  const inputSlotById = new Map(input.workflowContract.inputSlots.map((slot) => [slot.slotId, slot] as const));
  const outputSlotById = new Map(input.workflowContract.outputSlots.map((slot) => [slot.slotId, slot] as const));

  const inputBindingsBySlotId = new Map(input.systemContract.inputBindings.map((binding) => [binding.slotId, binding] as const));
  const outputBindingsBySlotId = new Map(input.systemContract.outputBindings.map((binding) => [binding.slotId, binding] as const));

  for (const slot of input.workflowContract.inputSlots) {
    const binding = inputBindingsBySlotId.get(slot.slotId);
    if (slot.required && !binding) {
      issues.push(Object.freeze({
        code: ImageSystemBindingValidationIssueCodes.requiredInputBindingMissing,
        path: `inputBindings.${slot.slotId}`,
        message: `Required workflow input slot '${slot.slotId}' must be bound in the image system contract.`,
      }));
      continue;
    }

    if (!binding) {
      continue;
    }

    const count = binding.assets.length;
    if (count < slot.minimumAssetCount) {
      issues.push(Object.freeze({
        code: ImageSystemBindingValidationIssueCodes.inputCardinalityUnderflow,
        path: `inputBindings.${slot.slotId}.assets`,
        message: `Input slot '${slot.slotId}' requires at least ${slot.minimumAssetCount} asset reference(s).`,
      }));
    }

    if ((slot.maximumAssetCount !== undefined && count > slot.maximumAssetCount) || (slot.cardinality === ImageWorkflowSlotCardinalities.one && count > 1)) {
      issues.push(Object.freeze({
        code: ImageSystemBindingValidationIssueCodes.inputCardinalityOverflow,
        path: `inputBindings.${slot.slotId}.assets`,
        message: `Input slot '${slot.slotId}' accepts at most ${slot.maximumAssetCount ?? 1} asset reference(s).`,
      }));
    }

    for (const asset of binding.assets) {
      if (slot.allowedAssetClasses.length > 0 && !slot.allowedAssetClasses.includes(asset.assetClass)) {
        issues.push(Object.freeze({
          code: ImageSystemBindingValidationIssueCodes.inputAssetClassIncompatible,
          path: `inputBindings.${slot.slotId}.assets.${asset.assetReferenceId}`,
          message: `Asset class '${asset.assetClass}' is not allowed for input slot '${slot.slotId}'.`,
        }));
      }

      if (slot.allowedMediaClasses.length > 0 && asset.mediaClass && !slot.allowedMediaClasses.includes(asset.mediaClass)) {
        issues.push(Object.freeze({
          code: ImageSystemBindingValidationIssueCodes.inputMediaClassIncompatible,
          path: `inputBindings.${slot.slotId}.assets.${asset.assetReferenceId}`,
          message: `Media class '${asset.mediaClass}' is not allowed for input slot '${slot.slotId}'.`,
        }));
      }
    }
  }

  for (const binding of input.systemContract.inputBindings) {
    if (!inputSlotById.has(binding.slotId)) {
      issues.push(Object.freeze({
        code: ImageSystemBindingValidationIssueCodes.unknownInputSlot,
        path: `inputBindings.${binding.slotId}`,
        message: `Image system input binding references unknown workflow input slot '${binding.slotId}'.`,
      }));
    }
  }

  for (const slot of input.workflowContract.outputSlots) {
    const binding = outputBindingsBySlotId.get(slot.slotId);
    if (slot.required && !binding) {
      issues.push(Object.freeze({
        code: ImageSystemBindingValidationIssueCodes.requiredOutputBindingMissing,
        path: `outputBindings.${slot.slotId}`,
        message: `Required workflow output slot '${slot.slotId}' must be bound in the image system contract.`,
      }));
      continue;
    }

    if (!binding) {
      continue;
    }

    const minimumOutputCount = slot.minimumAssetCount;
    if (minimumOutputCount > 1) {
      issues.push(Object.freeze({
        code: ImageSystemBindingValidationIssueCodes.outputCardinalityUnderflow,
        path: `outputBindings.${slot.slotId}`,
        message: `Output slot '${slot.slotId}' requires minimum cardinality ${minimumOutputCount} and a single target may be insufficient.`,
      }));
    }

    if (slot.cardinality === ImageWorkflowSlotCardinalities.one && slot.maximumAssetCount !== undefined && slot.maximumAssetCount > 1) {
      issues.push(Object.freeze({
        code: ImageSystemBindingValidationIssueCodes.outputCardinalityOverflow,
        path: `outputBindings.${slot.slotId}`,
        message: `Output slot '${slot.slotId}' declares conflicting one-cardinality and maximumAssetCount=${slot.maximumAssetCount}.`,
      }));
    }

    for (const acceptedAssetClass of binding.acceptedAssetClasses) {
      if (slot.emittedAssetClasses.length > 0 && !slot.emittedAssetClasses.includes(acceptedAssetClass)) {
        issues.push(Object.freeze({
          code: ImageSystemBindingValidationIssueCodes.outputAssetClassIncompatible,
          path: `outputBindings.${slot.slotId}.acceptedAssetClasses`,
          message: `Output binding accepted asset class '${acceptedAssetClass}' is incompatible with slot '${slot.slotId}'.`,
        }));
      }
    }

    for (const acceptedMediaClass of binding.acceptedMediaClasses) {
      if (slot.emittedMediaClasses.length > 0 && !slot.emittedMediaClasses.includes(acceptedMediaClass)) {
        issues.push(Object.freeze({
          code: ImageSystemBindingValidationIssueCodes.outputMediaClassIncompatible,
          path: `outputBindings.${slot.slotId}.acceptedMediaClasses`,
          message: `Output binding accepted media class '${acceptedMediaClass}' is incompatible with slot '${slot.slotId}'.`,
        }));
      }
    }
  }

  for (const binding of input.systemContract.outputBindings) {
    if (!outputSlotById.has(binding.slotId)) {
      issues.push(Object.freeze({
        code: ImageSystemBindingValidationIssueCodes.unknownOutputSlot,
        path: `outputBindings.${binding.slotId}`,
        message: `Image system output binding references unknown workflow output slot '${binding.slotId}'.`,
      }));
    }
  }

  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze(issues),
  });
}

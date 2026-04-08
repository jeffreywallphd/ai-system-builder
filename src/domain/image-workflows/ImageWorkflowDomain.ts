
import type { WorkspaceVisibility } from "@shared/workspaces/WorkspaceOwnership";

export class ImageWorkflowDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageWorkflowDomainError";
  }
}

export class ImageWorkflowLifecycleTransitionError extends ImageWorkflowDomainError {
  constructor(fromState: ImageWorkflowLifecycleState, toState: ImageWorkflowLifecycleState, reason?: string) {
    super(
      reason
        ? `Image workflow lifecycle cannot transition from '${fromState}' to '${toState}': ${reason}.`
        : `Image workflow lifecycle cannot transition from '${fromState}' to '${toState}'.`,
    );
    this.name = "ImageWorkflowLifecycleTransitionError";
  }
}

export class ImageWorkflowActivationError extends ImageWorkflowDomainError {
  constructor(message: string) {
    super(message);
    this.name = "ImageWorkflowActivationError";
  }
}

export const ImageWorkflowCategories = Object.freeze({
  imageManipulation: "image-manipulation",
});

export type ImageWorkflowCategory =
  typeof ImageWorkflowCategories[keyof typeof ImageWorkflowCategories] | (string & {});

export const ImageWorkflowTypes = Object.freeze({
  imageWorkflow: "image-workflow",
});

export type ImageWorkflowType = typeof ImageWorkflowTypes[keyof typeof ImageWorkflowTypes] | (string & {});

export const ImageWorkflowOperationKinds = Object.freeze({
  imageToImage: "image-to-image",
  restyle: "restyle",
  enhanceUpscale: "enhance-upscale",
  batchTransform: "batch-transform",
});

export type ImageWorkflowOperationKind =
  typeof ImageWorkflowOperationKinds[keyof typeof ImageWorkflowOperationKinds] | (string & {});

export const ImageWorkflowLifecycleStates = Object.freeze({
  draft: "draft",
  review: "review",
  published: "published",
  deprecated: "deprecated",
  retired: "retired",
});

export type ImageWorkflowLifecycleState =
  typeof ImageWorkflowLifecycleStates[keyof typeof ImageWorkflowLifecycleStates];

export const ImageWorkflowActivationStatuses = Object.freeze({
  active: "active",
  inactive: "inactive",
});

export type ImageWorkflowActivationStatus =
  typeof ImageWorkflowActivationStatuses[keyof typeof ImageWorkflowActivationStatuses];

export const ImageWorkflowInputSlotKinds = Object.freeze({
  sourceImage: "source-image",
  referenceImage: "reference-image",
  maskImage: "mask-image",
  imageCollection: "image-collection",
  textPrompt: "text-prompt",
  stylePreset: "style-preset",
  runtimeValue: "runtime-value",
});

export type ImageWorkflowInputSlotKind =
  typeof ImageWorkflowInputSlotKinds[keyof typeof ImageWorkflowInputSlotKinds];

export const ImageWorkflowValueTypes = Object.freeze({
  imageAssetReference: "image-asset-reference",
  imageAssetReferenceList: "image-asset-reference-list",
  datasetInstanceReference: "dataset-instance-reference",
  string: "string",
  number: "number",
  integer: "integer",
  boolean: "boolean",
  object: "object",
});

export type ImageWorkflowValueType = typeof ImageWorkflowValueTypes[keyof typeof ImageWorkflowValueTypes] | (string & {});

export const ImageWorkflowInputBindingSourceKinds = Object.freeze({
  selectedImage: "selected-image",
  datasetInstance: "dataset-instance",
  runtimeParameter: "runtime-parameter",
  systemContext: "system-context",
  uiField: "ui-field",
  constant: "constant",
});

export type ImageWorkflowInputBindingSourceKind =
  typeof ImageWorkflowInputBindingSourceKinds[keyof typeof ImageWorkflowInputBindingSourceKinds];

export const ImageWorkflowParameterKinds = Object.freeze({
  string: "string",
  number: "number",
  integer: "integer",
  boolean: "boolean",
  enum: "enum",
});

export type ImageWorkflowParameterKind = typeof ImageWorkflowParameterKinds[keyof typeof ImageWorkflowParameterKinds];

export const ImageWorkflowOutputKinds = Object.freeze({
  generatedImage: "generated-image",
  generatedImageCollection: "generated-image-collection",
  runMetadata: "run-metadata",
});

export type ImageWorkflowOutputKind = typeof ImageWorkflowOutputKinds[keyof typeof ImageWorkflowOutputKinds];

export const ImageWorkflowOutputTargetTypes = Object.freeze({
  outputDataset: "output-dataset",
  historyDataset: "history-dataset",
  comparisonDataset: "comparison-dataset",
  systemRecord: "system-record",
});

export type ImageWorkflowOutputTargetType =
  typeof ImageWorkflowOutputTargetTypes[keyof typeof ImageWorkflowOutputTargetTypes] | (string & {});

export interface ImageWorkflowVersionMetadata {
  readonly lineageId: string;
  readonly versionTag: string;
  readonly revision: number;
  readonly supersedesWorkflowId?: string;
}

export interface ImageWorkflowInputSlot {
  readonly inputId: string;
  readonly label: string;
  readonly description?: string;
  readonly kind: ImageWorkflowInputSlotKind;
  readonly valueType: ImageWorkflowValueType;
  readonly required: boolean;
  readonly allowsMultiple: boolean;
  readonly acceptedAssetKinds: ReadonlyArray<string>;
}

export interface ImageWorkflowInputBindingRule {
  readonly bindingId: string;
  readonly inputId: string;
  readonly sourceKind: ImageWorkflowInputBindingSourceKind;
  readonly sourceKey: string;
  readonly required: boolean;
  readonly defaultValue?: unknown;
}

export interface ImageWorkflowParameterSpecification {
  readonly parameterId: string;
  readonly label: string;
  readonly description?: string;
  readonly kind: ImageWorkflowParameterKind;
  readonly required: boolean;
  readonly defaultValue?: unknown;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly allowedValues?: ReadonlyArray<string>;
}

export interface ImageWorkflowOutputExpectation {
  readonly outputId: string;
  readonly label: string;
  readonly description?: string;
  readonly kind: ImageWorkflowOutputKind;
  readonly valueType: ImageWorkflowValueType;
  readonly required: boolean;
  readonly allowsMultiple: boolean;
}

export interface ImageWorkflowOutputBindingRule {
  readonly bindingId: string;
  readonly outputId: string;
  readonly targetType: ImageWorkflowOutputTargetType;
  readonly requiredTargetId: boolean;
  readonly defaultTargetId?: string;
}

export interface ImageWorkflowBackendTranslationReference {
  readonly translatorId: string;
  readonly contractVersion: string;
  readonly templateId: string;
  readonly templateVersion?: string;
  readonly inputBindings: ReadonlyArray<{
    readonly inputId: string;
    readonly backendField: string;
  }>;
  readonly parameterBindings: ReadonlyArray<{
    readonly parameterId: string;
    readonly backendField: string;
  }>;
  readonly outputBindings: ReadonlyArray<{
    readonly outputId: string;
    readonly backendField: string;
  }>;
}

export interface ImageWorkflowDisplayMetadata {
  readonly title: string;
  readonly summary?: string;
  readonly tags: ReadonlyArray<string>;
}

export interface ImageWorkflowOwnership {
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly visibility: WorkspaceVisibility;
}

export interface ImageWorkflowDefinition {
  readonly workflowId: string;
  readonly workflowType: ImageWorkflowType;
  readonly category: ImageWorkflowCategory;
  readonly operationKind: ImageWorkflowOperationKind;
  readonly ownership: ImageWorkflowOwnership;
  readonly display: ImageWorkflowDisplayMetadata;
  readonly version: ImageWorkflowVersionMetadata;
  readonly lifecycleState: ImageWorkflowLifecycleState;
  readonly activationStatus: ImageWorkflowActivationStatus;
  readonly inputSlots: ReadonlyArray<ImageWorkflowInputSlot>;
  readonly inputBindings: ReadonlyArray<ImageWorkflowInputBindingRule>;
  readonly parameterSpecifications: ReadonlyArray<ImageWorkflowParameterSpecification>;
  readonly outputExpectations: ReadonlyArray<ImageWorkflowOutputExpectation>;
  readonly outputBindings: ReadonlyArray<ImageWorkflowOutputBindingRule>;
  readonly backendTranslation: ImageWorkflowBackendTranslationReference;
  readonly createdBy: string;
  readonly lastModifiedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ImageWorkflowCompletenessIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export const ImageWorkflowCompletenessIssueCodes = Object.freeze({
  inputSlotMissing: "input-slot-missing",
  outputExpectationMissing: "output-expectation-missing",
  inputBindingMissing: "input-binding-missing",
  requiredOutputBindingMissing: "required-output-binding-missing",
  backendInputBindingMissing: "backend-input-binding-missing",
  backendParameterBindingMissing: "backend-parameter-binding-missing",
  backendOutputBindingMissing: "backend-output-binding-missing",
});

export const ImageWorkflowLifecycleTransitions: Readonly<
  Record<ImageWorkflowLifecycleState, ReadonlyArray<ImageWorkflowLifecycleState>>
> = Object.freeze({
  [ImageWorkflowLifecycleStates.draft]: Object.freeze([
    ImageWorkflowLifecycleStates.review,
    ImageWorkflowLifecycleStates.retired,
  ]),
  [ImageWorkflowLifecycleStates.review]: Object.freeze([
    ImageWorkflowLifecycleStates.draft,
    ImageWorkflowLifecycleStates.published,
    ImageWorkflowLifecycleStates.retired,
  ]),
  [ImageWorkflowLifecycleStates.published]: Object.freeze([
    ImageWorkflowLifecycleStates.deprecated,
    ImageWorkflowLifecycleStates.retired,
  ]),
  [ImageWorkflowLifecycleStates.deprecated]: Object.freeze([
    ImageWorkflowLifecycleStates.published,
    ImageWorkflowLifecycleStates.retired,
  ]),
  [ImageWorkflowLifecycleStates.retired]: Object.freeze([]),
});

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageWorkflowDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeIsoTimestamp(value: Date | string, field: string): string {
  const normalized = value instanceof Date ? value.toISOString() : normalizeRequired(value, field);
  if (Number.isNaN(Date.parse(normalized))) {
    throw new ImageWorkflowDomainError(`${field} must be a valid ISO timestamp.`);
  }
  return new Date(normalized).toISOString();
}

function normalizeLogicalReference(value: string, field: string): string {
  const normalized = normalizeRequired(value, field);
  if (/^[a-zA-Z]:\\/.test(normalized) || normalized.startsWith("/") || normalized.includes("\\")) {
    throw new ImageWorkflowDomainError(`${field} must be a logical reference and cannot be a filesystem path.`);
  }
  return normalized;
}

function normalizeVersionTag(value: string): string {
  const normalized = normalizeRequired(value, "Image workflow versionTag");
  if (!/^\d+\.\d+\.\d+$/.test(normalized)) {
    throw new ImageWorkflowDomainError("Image workflow versionTag must use semantic version format '<major>.<minor>.<patch>'.");
  }
  return normalized;
}

function normalizeOperationKind(value: ImageWorkflowOperationKind): ImageWorkflowOperationKind {
  const normalized = normalizeRequired(value, "Image workflow operationKind");
  if (!isImageWorkflowOperationKind(normalized)) {
    throw new ImageWorkflowDomainError(`Image workflow operationKind '${normalized}' is not supported.`);
  }
  return normalized;
}

function normalizeLifecycleState(value: ImageWorkflowLifecycleState): ImageWorkflowLifecycleState {
  if (!Object.values(ImageWorkflowLifecycleStates).includes(value)) {
    throw new ImageWorkflowDomainError(`Image workflow lifecycleState '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeActivationStatus(value: ImageWorkflowActivationStatus): ImageWorkflowActivationStatus {
  if (!Object.values(ImageWorkflowActivationStatuses).includes(value)) {
    throw new ImageWorkflowDomainError(`Image workflow activationStatus '${String(value)}' is invalid.`);
  }
  return value;
}
function normalizeInputSlot(slot: ImageWorkflowInputSlot): ImageWorkflowInputSlot {
  const kind = slot.kind;
  if (!Object.values(ImageWorkflowInputSlotKinds).includes(kind)) {
    throw new ImageWorkflowDomainError(`Image workflow input kind '${String(kind)}' is invalid.`);
  }

  const valueType = normalizeRequired(slot.valueType, `Input slot '${slot.inputId}' valueType`);
  const allowsMultiple = slot.allowsMultiple;
  const acceptedAssetKinds = Object.freeze(
    [...new Set((slot.acceptedAssetKinds ?? []).map((entry) => normalizeOptional(entry)).filter(Boolean) as string[])],
  );

  if (kind === ImageWorkflowInputSlotKinds.imageCollection && !allowsMultiple) {
    throw new ImageWorkflowDomainError("Image collection input slots must allow multiple values.");
  }
  if (valueType === ImageWorkflowValueTypes.imageAssetReferenceList && !allowsMultiple) {
    throw new ImageWorkflowDomainError("Input slots with valueType 'image-asset-reference-list' must allow multiple values.");
  }

  return Object.freeze({
    inputId: normalizeRequired(slot.inputId, "Image workflow inputId"),
    label: normalizeRequired(slot.label, `Input slot '${slot.inputId}' label`),
    description: normalizeOptional(slot.description),
    kind,
    valueType,
    required: Boolean(slot.required),
    allowsMultiple,
    acceptedAssetKinds,
  });
}

function normalizeInputBinding(binding: ImageWorkflowInputBindingRule): ImageWorkflowInputBindingRule {
  if (!Object.values(ImageWorkflowInputBindingSourceKinds).includes(binding.sourceKind)) {
    throw new ImageWorkflowDomainError(`Image workflow input binding source kind '${String(binding.sourceKind)}' is invalid.`);
  }

  return Object.freeze({
    bindingId: normalizeRequired(binding.bindingId, "Image workflow input bindingId"),
    inputId: normalizeRequired(binding.inputId, "Image workflow input binding inputId"),
    sourceKind: binding.sourceKind,
    sourceKey: normalizeLogicalReference(binding.sourceKey, "Image workflow input binding sourceKey"),
    required: Boolean(binding.required),
    defaultValue: binding.defaultValue,
  });
}

function validateParameterDefaultValue(
  kind: ImageWorkflowParameterKind,
  defaultValue: unknown,
  metadata: {
    readonly parameterId: string;
    readonly minimum?: number;
    readonly maximum?: number;
    readonly allowedValues: ReadonlyArray<string>;
  },
): void {
  if (defaultValue === undefined) {
    return;
  }

  if (kind === ImageWorkflowParameterKinds.string && typeof defaultValue !== "string") {
    throw new ImageWorkflowDomainError(`Image workflow parameter '${metadata.parameterId}' defaultValue must be a string.`);
  }
  if (kind === ImageWorkflowParameterKinds.boolean && typeof defaultValue !== "boolean") {
    throw new ImageWorkflowDomainError(`Image workflow parameter '${metadata.parameterId}' defaultValue must be a boolean.`);
  }
  if (kind === ImageWorkflowParameterKinds.number) {
    if (typeof defaultValue !== "number" || !Number.isFinite(defaultValue)) {
      throw new ImageWorkflowDomainError(`Image workflow parameter '${metadata.parameterId}' defaultValue must be a finite number.`);
    }
  }
  if (kind === ImageWorkflowParameterKinds.integer) {
    if (typeof defaultValue !== "number" || !Number.isInteger(defaultValue)) {
      throw new ImageWorkflowDomainError(`Image workflow parameter '${metadata.parameterId}' defaultValue must be an integer.`);
    }
  }
  if (kind === ImageWorkflowParameterKinds.enum) {
    if (typeof defaultValue !== "string" || !metadata.allowedValues.includes(defaultValue)) {
      throw new ImageWorkflowDomainError(
        `Image workflow parameter '${metadata.parameterId}' defaultValue must be one of allowedValues.`,
      );
    }
  }

  if (typeof defaultValue === "number") {
    if (metadata.minimum !== undefined && defaultValue < metadata.minimum) {
      throw new ImageWorkflowDomainError(`Image workflow parameter '${metadata.parameterId}' defaultValue cannot be less than minimum.`);
    }
    if (metadata.maximum !== undefined && defaultValue > metadata.maximum) {
      throw new ImageWorkflowDomainError(`Image workflow parameter '${metadata.parameterId}' defaultValue cannot be greater than maximum.`);
    }
  }
}

function normalizeParameter(specification: ImageWorkflowParameterSpecification): ImageWorkflowParameterSpecification {
  const kind = specification.kind;
  if (!Object.values(ImageWorkflowParameterKinds).includes(kind)) {
    throw new ImageWorkflowDomainError(`Image workflow parameter kind '${String(kind)}' is invalid.`);
  }

  const minimum = specification.minimum;
  const maximum = specification.maximum;
  if (minimum !== undefined && !Number.isFinite(minimum)) {
    throw new ImageWorkflowDomainError(`Image workflow parameter '${specification.parameterId}' minimum must be a finite number.`);
  }
  if (maximum !== undefined && !Number.isFinite(maximum)) {
    throw new ImageWorkflowDomainError(`Image workflow parameter '${specification.parameterId}' maximum must be a finite number.`);
  }
  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    throw new ImageWorkflowDomainError(`Image workflow parameter '${specification.parameterId}' minimum cannot exceed maximum.`);
  }

  const allowedValues = Object.freeze([
    ...new Set((specification.allowedValues ?? []).map((entry) => normalizeOptional(entry)).filter(Boolean) as string[]),
  ]);

  if (kind === ImageWorkflowParameterKinds.enum && allowedValues.length === 0) {
    throw new ImageWorkflowDomainError(`Image workflow enum parameter '${specification.parameterId}' requires allowedValues.`);
  }
  if (kind !== ImageWorkflowParameterKinds.enum && allowedValues.length > 0) {
    throw new ImageWorkflowDomainError(`Image workflow parameter '${specification.parameterId}' allowedValues are only valid for enum kind.`);
  }

  validateParameterDefaultValue(kind, specification.defaultValue, {
    parameterId: specification.parameterId,
    minimum,
    maximum,
    allowedValues,
  });

  return Object.freeze({
    parameterId: normalizeRequired(specification.parameterId, "Image workflow parameterId"),
    label: normalizeRequired(specification.label, `Image workflow parameter '${specification.parameterId}' label`),
    description: normalizeOptional(specification.description),
    kind,
    required: Boolean(specification.required),
    defaultValue: specification.defaultValue,
    minimum,
    maximum,
    allowedValues,
  });
}

function normalizeOutputExpectation(expectation: ImageWorkflowOutputExpectation): ImageWorkflowOutputExpectation {
  const kind = expectation.kind;
  if (!Object.values(ImageWorkflowOutputKinds).includes(kind)) {
    throw new ImageWorkflowDomainError(`Image workflow output kind '${String(kind)}' is invalid.`);
  }

  return Object.freeze({
    outputId: normalizeRequired(expectation.outputId, "Image workflow outputId"),
    label: normalizeRequired(expectation.label, `Image workflow output '${expectation.outputId}' label`),
    description: normalizeOptional(expectation.description),
    kind,
    valueType: normalizeRequired(expectation.valueType, `Image workflow output '${expectation.outputId}' valueType`),
    required: Boolean(expectation.required),
    allowsMultiple: Boolean(expectation.allowsMultiple),
  });
}

function normalizeOutputBinding(binding: ImageWorkflowOutputBindingRule): ImageWorkflowOutputBindingRule {
  const targetType = normalizeRequired(binding.targetType, "Image workflow output binding targetType");
  return Object.freeze({
    bindingId: normalizeRequired(binding.bindingId, "Image workflow output bindingId"),
    outputId: normalizeRequired(binding.outputId, "Image workflow output binding outputId"),
    targetType,
    requiredTargetId: Boolean(binding.requiredTargetId),
    defaultTargetId: normalizeOptional(binding.defaultTargetId),
  });
}

function normalizeBackendTranslation(
  reference: ImageWorkflowBackendTranslationReference,
): ImageWorkflowBackendTranslationReference {
  const normalizeBackendField = (value: string, label: string): string => {
    const normalized = normalizeRequired(value, label);
    if (normalized.includes("\\")) {
      throw new ImageWorkflowDomainError(`${label} cannot include filesystem separators.`);
    }
    return normalized;
  };

  return Object.freeze({
    translatorId: normalizeRequired(reference.translatorId, "Image workflow backend translatorId"),
    contractVersion: normalizeRequired(reference.contractVersion, "Image workflow backend contractVersion"),
    templateId: normalizeRequired(reference.templateId, "Image workflow backend templateId"),
    templateVersion: normalizeOptional(reference.templateVersion),
    inputBindings: Object.freeze(reference.inputBindings.map((binding) => Object.freeze({
      inputId: normalizeRequired(binding.inputId, "Image workflow backend input binding inputId"),
      backendField: normalizeBackendField(binding.backendField, "Image workflow backend input binding backendField"),
    }))),
    parameterBindings: Object.freeze(reference.parameterBindings.map((binding) => Object.freeze({
      parameterId: normalizeRequired(binding.parameterId, "Image workflow backend parameter binding parameterId"),
      backendField: normalizeBackendField(binding.backendField, "Image workflow backend parameter binding backendField"),
    }))),
    outputBindings: Object.freeze(reference.outputBindings.map((binding) => Object.freeze({
      outputId: normalizeRequired(binding.outputId, "Image workflow backend output binding outputId"),
      backendField: normalizeBackendField(binding.backendField, "Image workflow backend output binding backendField"),
    }))),
  });
}

function assertUnique(values: ReadonlyArray<string>, label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new ImageWorkflowDomainError(`${label} '${value}' must be unique.`);
    }
    seen.add(value);
  }
}

function assertBindingReferences(
  definition: {
    readonly inputSlots: ReadonlyArray<ImageWorkflowInputSlot>;
    readonly inputBindings: ReadonlyArray<ImageWorkflowInputBindingRule>;
    readonly parameterSpecifications: ReadonlyArray<ImageWorkflowParameterSpecification>;
    readonly outputExpectations: ReadonlyArray<ImageWorkflowOutputExpectation>;
    readonly outputBindings: ReadonlyArray<ImageWorkflowOutputBindingRule>;
    readonly backendTranslation: ImageWorkflowBackendTranslationReference;
  },
): void {
  const inputIds = new Set(definition.inputSlots.map((slot) => slot.inputId));
  const parameterIds = new Set(definition.parameterSpecifications.map((parameter) => parameter.parameterId));
  const outputIds = new Set(definition.outputExpectations.map((output) => output.outputId));

  for (const binding of definition.inputBindings) {
    if (!inputIds.has(binding.inputId)) {
      throw new ImageWorkflowDomainError(`Image workflow input binding '${binding.bindingId}' references unknown input '${binding.inputId}'.`);
    }
  }

  for (const binding of definition.outputBindings) {
    if (!outputIds.has(binding.outputId)) {
      throw new ImageWorkflowDomainError(`Image workflow output binding '${binding.bindingId}' references unknown output '${binding.outputId}'.`);
    }
    if (binding.requiredTargetId && !binding.defaultTargetId) {
      throw new ImageWorkflowDomainError(
        `Image workflow output binding '${binding.bindingId}' requires defaultTargetId when requiredTargetId=true.`,
      );
    }
  }

  for (const binding of definition.backendTranslation.inputBindings) {
    if (!inputIds.has(binding.inputId)) {
      throw new ImageWorkflowDomainError(`Image workflow backend input binding references unknown input '${binding.inputId}'.`);
    }
  }
  for (const binding of definition.backendTranslation.parameterBindings) {
    if (!parameterIds.has(binding.parameterId)) {
      throw new ImageWorkflowDomainError(`Image workflow backend parameter binding references unknown parameter '${binding.parameterId}'.`);
    }
  }
  for (const binding of definition.backendTranslation.outputBindings) {
    if (!outputIds.has(binding.outputId)) {
      throw new ImageWorkflowDomainError(`Image workflow backend output binding references unknown output '${binding.outputId}'.`);
    }
  }
}
function normalizeDisplayMetadata(metadata: ImageWorkflowDisplayMetadata): ImageWorkflowDisplayMetadata {
  const tags = Object.freeze([
    ...new Set((metadata.tags ?? []).map((entry) => normalizeOptional(entry)).filter(Boolean) as string[]),
  ]);

  return Object.freeze({
    title: normalizeRequired(metadata.title, "Image workflow title"),
    summary: normalizeOptional(metadata.summary),
    tags,
  });
}

function normalizeOwnership(input: ImageWorkflowOwnership): ImageWorkflowOwnership {
  const visibility = normalizeRequired(input.visibility, "Image workflow visibility") as WorkspaceVisibility;
  if (!["private", "team", "public"].includes(visibility)) {
    throw new ImageWorkflowDomainError(`Image workflow visibility '${String(visibility)}' is invalid.`);
  }

  const ownership: ImageWorkflowOwnership = Object.freeze({
    workspaceId: normalizeRequired(input.workspaceId, "Image workflow workspaceId"),
    ownerUserId: normalizeOptional(input.ownerUserId),
    visibility,
  });

  if (ownership.visibility === "private" && !ownership.ownerUserId) {
    throw new ImageWorkflowDomainError("Private image workflows require ownerUserId.");
  }

  return ownership;
}

function normalizeVersion(
  input: ImageWorkflowVersionMetadata,
  workflowId: string,
): ImageWorkflowVersionMetadata {
  const revision = input.revision;
  if (!Number.isInteger(revision) || revision < 0) {
    throw new ImageWorkflowDomainError("Image workflow revision must be a non-negative integer.");
  }

  const supersedesWorkflowId = normalizeOptional(input.supersedesWorkflowId);
  if (supersedesWorkflowId && supersedesWorkflowId === workflowId) {
    throw new ImageWorkflowDomainError("Image workflow supersedesWorkflowId cannot equal workflowId.");
  }

  return Object.freeze({
    lineageId: normalizeRequired(input.lineageId, "Image workflow lineageId"),
    versionTag: normalizeVersionTag(input.versionTag),
    revision,
    supersedesWorkflowId,
  });
}

function assertTimestampOrder(createdAt: string, updatedAt: string): void {
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new ImageWorkflowDomainError("Image workflow updatedAt cannot be earlier than createdAt.");
  }
}

function assertLifecycleActivationCompatibility(
  lifecycleState: ImageWorkflowLifecycleState,
  activationStatus: ImageWorkflowActivationStatus,
): void {
  if (activationStatus === ImageWorkflowActivationStatuses.active && lifecycleState !== ImageWorkflowLifecycleStates.published) {
    throw new ImageWorkflowActivationError("Only published image workflows can be active.");
  }
  if (lifecycleState === ImageWorkflowLifecycleStates.retired && activationStatus !== ImageWorkflowActivationStatuses.inactive) {
    throw new ImageWorkflowActivationError("Retired image workflows must be inactive.");
  }
}

export function evaluateImageWorkflowDefinitionCompleteness(
  workflow: ImageWorkflowDefinition,
): ReadonlyArray<ImageWorkflowCompletenessIssue> {
  const issues: ImageWorkflowCompletenessIssue[] = [];

  if (workflow.inputSlots.length === 0) {
    issues.push(Object.freeze({
      code: ImageWorkflowCompletenessIssueCodes.inputSlotMissing,
      path: "inputSlots",
      message: "Image workflow must declare at least one input slot.",
    }));
  }

  if (workflow.outputExpectations.length === 0) {
    issues.push(Object.freeze({
      code: ImageWorkflowCompletenessIssueCodes.outputExpectationMissing,
      path: "outputExpectations",
      message: "Image workflow must declare at least one output expectation.",
    }));
  }

  const boundInputIds = new Set(workflow.inputBindings.map((binding) => binding.inputId));
  for (const input of workflow.inputSlots) {
    if (input.required && !boundInputIds.has(input.inputId)) {
      issues.push(Object.freeze({
        code: ImageWorkflowCompletenessIssueCodes.inputBindingMissing,
        path: `inputBindings.${input.inputId}`,
        message: `Required input '${input.inputId}' must have at least one input binding rule.`,
      }));
    }
  }

  const boundOutputIds = new Set(workflow.outputBindings.map((binding) => binding.outputId));
  for (const output of workflow.outputExpectations) {
    if (output.required && !boundOutputIds.has(output.outputId)) {
      issues.push(Object.freeze({
        code: ImageWorkflowCompletenessIssueCodes.requiredOutputBindingMissing,
        path: `outputBindings.${output.outputId}`,
        message: `Required output '${output.outputId}' must have at least one output binding rule.`,
      }));
    }
  }

  const translatedInputIds = new Set(workflow.backendTranslation.inputBindings.map((binding) => binding.inputId));
  for (const input of workflow.inputSlots) {
    if (input.required && !translatedInputIds.has(input.inputId)) {
      issues.push(Object.freeze({
        code: ImageWorkflowCompletenessIssueCodes.backendInputBindingMissing,
        path: `backendTranslation.inputBindings.${input.inputId}`,
        message: `Required input '${input.inputId}' must be translated to a backend field.`,
      }));
    }
  }

  const translatedParameterIds = new Set(workflow.backendTranslation.parameterBindings.map((binding) => binding.parameterId));
  for (const parameter of workflow.parameterSpecifications) {
    if (parameter.required && !translatedParameterIds.has(parameter.parameterId)) {
      issues.push(Object.freeze({
        code: ImageWorkflowCompletenessIssueCodes.backendParameterBindingMissing,
        path: `backendTranslation.parameterBindings.${parameter.parameterId}`,
        message: `Required parameter '${parameter.parameterId}' must be translated to a backend field.`,
      }));
    }
  }

  const translatedOutputIds = new Set(workflow.backendTranslation.outputBindings.map((binding) => binding.outputId));
  for (const output of workflow.outputExpectations) {
    if (output.required && !translatedOutputIds.has(output.outputId)) {
      issues.push(Object.freeze({
        code: ImageWorkflowCompletenessIssueCodes.backendOutputBindingMissing,
        path: `backendTranslation.outputBindings.${output.outputId}`,
        message: `Required output '${output.outputId}' must be translated from a backend field.`,
      }));
    }
  }

  return Object.freeze(issues);
}

export function isImageWorkflowOperationKind(value: string): value is ImageWorkflowOperationKind {
  return Object.values(ImageWorkflowOperationKinds).includes(value as ImageWorkflowOperationKind);
}

export function isImageWorkflowLifecycleTransitionAllowed(
  fromState: ImageWorkflowLifecycleState,
  toState: ImageWorkflowLifecycleState,
): boolean {
  if (fromState === toState) {
    return true;
  }
  return ImageWorkflowLifecycleTransitions[fromState].includes(toState);
}

function normalizeImageWorkflowDefinition(input: {
  readonly workflowId: string;
  readonly workflowType: ImageWorkflowType;
  readonly category: ImageWorkflowCategory;
  readonly operationKind: ImageWorkflowOperationKind;
  readonly ownership: ImageWorkflowOwnership;
  readonly display: ImageWorkflowDisplayMetadata;
  readonly version: ImageWorkflowVersionMetadata;
  readonly lifecycleState: ImageWorkflowLifecycleState;
  readonly activationStatus: ImageWorkflowActivationStatus;
  readonly inputSlots: ReadonlyArray<ImageWorkflowInputSlot>;
  readonly inputBindings: ReadonlyArray<ImageWorkflowInputBindingRule>;
  readonly parameterSpecifications: ReadonlyArray<ImageWorkflowParameterSpecification>;
  readonly outputExpectations: ReadonlyArray<ImageWorkflowOutputExpectation>;
  readonly outputBindings: ReadonlyArray<ImageWorkflowOutputBindingRule>;
  readonly backendTranslation: ImageWorkflowBackendTranslationReference;
  readonly createdBy: string;
  readonly lastModifiedBy: string;
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
}): ImageWorkflowDefinition {
  const workflowId = normalizeRequired(input.workflowId, "Image workflow workflowId");
  const lifecycleState = normalizeLifecycleState(input.lifecycleState);
  const activationStatus = normalizeActivationStatus(input.activationStatus);

  const inputSlots = Object.freeze(input.inputSlots.map((slot) => normalizeInputSlot(slot)));
  const inputBindings = Object.freeze(input.inputBindings.map((binding) => normalizeInputBinding(binding)));
  const parameterSpecifications = Object.freeze(
    input.parameterSpecifications.map((parameter) => normalizeParameter(parameter)),
  );
  const outputExpectations = Object.freeze(input.outputExpectations.map((output) => normalizeOutputExpectation(output)));
  const outputBindings = Object.freeze(input.outputBindings.map((binding) => normalizeOutputBinding(binding)));

  assertUnique(inputSlots.map((slot) => slot.inputId), "Image workflow inputId");
  assertUnique(inputBindings.map((binding) => binding.bindingId), "Image workflow input bindingId");
  assertUnique(parameterSpecifications.map((parameter) => parameter.parameterId), "Image workflow parameterId");
  assertUnique(outputExpectations.map((output) => output.outputId), "Image workflow outputId");
  assertUnique(outputBindings.map((binding) => binding.bindingId), "Image workflow output bindingId");

  const backendTranslation = normalizeBackendTranslation(input.backendTranslation);

  const definition: ImageWorkflowDefinition = Object.freeze({
    workflowId,
    workflowType: normalizeRequired(input.workflowType, "Image workflow workflowType"),
    category: normalizeRequired(input.category, "Image workflow category"),
    operationKind: normalizeOperationKind(input.operationKind),
    ownership: normalizeOwnership(input.ownership),
    display: normalizeDisplayMetadata(input.display),
    version: normalizeVersion(input.version, workflowId),
    lifecycleState,
    activationStatus,
    inputSlots,
    inputBindings,
    parameterSpecifications,
    outputExpectations,
    outputBindings,
    backendTranslation,
    createdBy: normalizeRequired(input.createdBy, "Image workflow createdBy"),
    lastModifiedBy: normalizeRequired(input.lastModifiedBy, "Image workflow lastModifiedBy"),
    createdAt: normalizeIsoTimestamp(input.createdAt, "Image workflow createdAt"),
    updatedAt: normalizeIsoTimestamp(input.updatedAt, "Image workflow updatedAt"),
  });

  assertBindingReferences(definition);
  assertLifecycleActivationCompatibility(definition.lifecycleState, definition.activationStatus);
  assertTimestampOrder(definition.createdAt, definition.updatedAt);

  return definition;
}
export function createImageWorkflowDefinition(input: {
  readonly workflowId: string;
  readonly workflowType?: ImageWorkflowType;
  readonly category?: ImageWorkflowCategory;
  readonly operationKind: ImageWorkflowOperationKind;
  readonly ownership: ImageWorkflowOwnership;
  readonly display: ImageWorkflowDisplayMetadata;
  readonly version: ImageWorkflowVersionMetadata;
  readonly lifecycleState?: ImageWorkflowLifecycleState;
  readonly activationStatus?: ImageWorkflowActivationStatus;
  readonly inputSlots: ReadonlyArray<ImageWorkflowInputSlot>;
  readonly inputBindings?: ReadonlyArray<ImageWorkflowInputBindingRule>;
  readonly parameterSpecifications?: ReadonlyArray<ImageWorkflowParameterSpecification>;
  readonly outputExpectations: ReadonlyArray<ImageWorkflowOutputExpectation>;
  readonly outputBindings?: ReadonlyArray<ImageWorkflowOutputBindingRule>;
  readonly backendTranslation: ImageWorkflowBackendTranslationReference;
  readonly createdBy: string;
  readonly now?: Date;
}): ImageWorkflowDefinition {
  const now = input.now ?? new Date();
  const definition = normalizeImageWorkflowDefinition({
    workflowId: input.workflowId,
    workflowType: input.workflowType ?? ImageWorkflowTypes.imageWorkflow,
    category: input.category ?? ImageWorkflowCategories.imageManipulation,
    operationKind: input.operationKind,
    ownership: input.ownership,
    display: input.display,
    version: input.version,
    lifecycleState: input.lifecycleState ?? ImageWorkflowLifecycleStates.draft,
    activationStatus: input.activationStatus ?? ImageWorkflowActivationStatuses.inactive,
    inputSlots: input.inputSlots,
    inputBindings: input.inputBindings ?? [],
    parameterSpecifications: input.parameterSpecifications ?? [],
    outputExpectations: input.outputExpectations,
    outputBindings: input.outputBindings ?? [],
    backendTranslation: input.backendTranslation,
    createdBy: input.createdBy,
    lastModifiedBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });

  if (definition.lifecycleState === ImageWorkflowLifecycleStates.published) {
    const completenessIssues = evaluateImageWorkflowDefinitionCompleteness(definition);
    if (completenessIssues.length > 0) {
      throw new ImageWorkflowDomainError("Published image workflows must satisfy completeness requirements.");
    }
  }

  return definition;
}

export function rehydrateImageWorkflowDefinition(input: ImageWorkflowDefinition): ImageWorkflowDefinition {
  const definition = normalizeImageWorkflowDefinition({
    ...input,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });

  if (definition.lifecycleState === ImageWorkflowLifecycleStates.published) {
    const completenessIssues = evaluateImageWorkflowDefinitionCompleteness(definition);
    if (completenessIssues.length > 0) {
      throw new ImageWorkflowDomainError("Published image workflows must satisfy completeness requirements.");
    }
  }

  return definition;
}

export function transitionImageWorkflowLifecycle(
  workflow: ImageWorkflowDefinition,
  input: {
    readonly targetState: ImageWorkflowLifecycleState;
    readonly actorUserId: string;
    readonly now?: Date;
  },
): ImageWorkflowDefinition {
  const targetState = normalizeLifecycleState(input.targetState);
  if (!isImageWorkflowLifecycleTransitionAllowed(workflow.lifecycleState, targetState)) {
    throw new ImageWorkflowLifecycleTransitionError(workflow.lifecycleState, targetState);
  }

  if (targetState === workflow.lifecycleState) {
    return workflow;
  }

  const nextActivationStatus = targetState === ImageWorkflowLifecycleStates.retired
    ? ImageWorkflowActivationStatuses.inactive
    : workflow.activationStatus;

  const candidate = normalizeImageWorkflowDefinition({
    ...workflow,
    lifecycleState: targetState,
    activationStatus: nextActivationStatus,
    lastModifiedBy: input.actorUserId,
    updatedAt: input.now ?? new Date(),
  });

  if (targetState === ImageWorkflowLifecycleStates.published) {
    const completenessIssues = evaluateImageWorkflowDefinitionCompleteness(candidate);
    if (completenessIssues.length > 0) {
      throw new ImageWorkflowLifecycleTransitionError(
        workflow.lifecycleState,
        targetState,
        "workflow is not complete for publication",
      );
    }
  }

  return candidate;
}

export function setImageWorkflowActivationStatus(
  workflow: ImageWorkflowDefinition,
  input: {
    readonly activationStatus: ImageWorkflowActivationStatus;
    readonly actorUserId: string;
    readonly now?: Date;
  },
): ImageWorkflowDefinition {
  const activationStatus = normalizeActivationStatus(input.activationStatus);
  if (workflow.activationStatus === activationStatus) {
    return workflow;
  }

  return normalizeImageWorkflowDefinition({
    ...workflow,
    activationStatus,
    lastModifiedBy: input.actorUserId,
    updatedAt: input.now ?? new Date(),
  });
}

export function bumpImageWorkflowVersion(
  workflow: ImageWorkflowDefinition,
  input: {
    readonly nextWorkflowId: string;
    readonly versionTag: string;
    readonly actorUserId: string;
    readonly now?: Date;
  },
): ImageWorkflowDefinition {
  return createImageWorkflowDefinition({
    workflowId: input.nextWorkflowId,
    workflowType: workflow.workflowType,
    category: workflow.category,
    operationKind: workflow.operationKind,
    ownership: workflow.ownership,
    display: workflow.display,
    version: {
      lineageId: workflow.version.lineageId,
      versionTag: input.versionTag,
      revision: workflow.version.revision + 1,
      supersedesWorkflowId: workflow.workflowId,
    },
    lifecycleState: ImageWorkflowLifecycleStates.draft,
    activationStatus: ImageWorkflowActivationStatuses.inactive,
    inputSlots: workflow.inputSlots,
    inputBindings: workflow.inputBindings,
    parameterSpecifications: workflow.parameterSpecifications,
    outputExpectations: workflow.outputExpectations,
    outputBindings: workflow.outputBindings,
    backendTranslation: workflow.backendTranslation,
    createdBy: input.actorUserId,
    now: input.now,
  });
}

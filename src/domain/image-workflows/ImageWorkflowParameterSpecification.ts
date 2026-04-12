export class ImageWorkflowParameterSpecificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageWorkflowParameterSpecificationError";
  }
}

export const ImageWorkflowParameterValueKinds = Object.freeze({
  text: "text",
  integer: "integer",
  float: "float",
  boolean: "boolean",
  select: "select",
  imageAssetReference: "image-asset-reference",
  maskAssetReference: "mask-asset-reference",
  referenceAssetReference: "reference-asset-reference",
} as const);

export type ImageWorkflowParameterValueKind =
  typeof ImageWorkflowParameterValueKinds[keyof typeof ImageWorkflowParameterValueKinds];

export const ImageWorkflowParameterSemanticMeanings = Object.freeze({
  prompt: "prompt",
  guidanceScale: "guidance-scale",
  variationStrength: "variation-strength",
  seed: "seed",
  outputCount: "output-count",
  styleReference: "style-reference",
  maskReference: "mask-reference",
  imageReference: "image-reference",
  custom: "custom",
} as const);

export type ImageWorkflowParameterSemanticMeaning =
  typeof ImageWorkflowParameterSemanticMeanings[keyof typeof ImageWorkflowParameterSemanticMeanings]
  | (string & {});

export const ImageWorkflowParameterUiControlKinds = Object.freeze({
  textInput: "text-input",
  textArea: "text-area",
  numberInput: "number-input",
  slider: "slider",
  switch: "switch",
  select: "select",
  assetPicker: "asset-picker",
  maskSlot: "mask-slot",
  referenceSlot: "reference-slot",
  hidden: "hidden",
} as const);

export type ImageWorkflowParameterUiControlKind =
  typeof ImageWorkflowParameterUiControlKinds[keyof typeof ImageWorkflowParameterUiControlKinds];

export const ImageWorkflowParameterVisibilityOperators = Object.freeze({
  equals: "equals",
  notEquals: "not-equals",
  in: "in",
  notIn: "not-in",
  greaterThan: "greater-than",
  greaterThanOrEqual: "greater-than-or-equal",
  lessThan: "less-than",
  lessThanOrEqual: "less-than-or-equal",
  exists: "exists",
} as const);

export type ImageWorkflowParameterVisibilityOperator =
  typeof ImageWorkflowParameterVisibilityOperators[keyof typeof ImageWorkflowParameterVisibilityOperators];

export const ImageWorkflowParameterSensitivityLevels = Object.freeze({
  normal: "normal",
  sensitive: "sensitive",
  secret: "secret",
} as const);

export type ImageWorkflowParameterSensitivityLevel =
  typeof ImageWorkflowParameterSensitivityLevels[keyof typeof ImageWorkflowParameterSensitivityLevels];

export interface ImageWorkflowParameterSelectOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
}

export interface ImageWorkflowParameterVisibilityRule {
  readonly parameterId: string;
  readonly operator: ImageWorkflowParameterVisibilityOperator;
  readonly value?: unknown;
}

export interface ImageWorkflowParameterVisibility {
  readonly rules: ReadonlyArray<ImageWorkflowParameterVisibilityRule>;
  readonly mode: "all" | "any";
}

export interface ImageWorkflowParameterUiSchema {
  readonly control: ImageWorkflowParameterUiControlKind;
  readonly placeholder?: string;
  readonly group?: string;
  readonly unitLabel?: string;
  readonly order?: number;
  readonly helpText?: string;
  readonly advanced?: boolean;
}

export interface ImageWorkflowParameterValidation {
  readonly minimum?: number;
  readonly maximum?: number;
  readonly step?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly options?: ReadonlyArray<ImageWorkflowParameterSelectOption>;
  readonly acceptedAssetKinds?: ReadonlyArray<string>;
}

export interface ImageWorkflowParameterSpecification {
  readonly parameterId: string;
  readonly label: string;
  readonly description?: string;
  readonly valueKind: ImageWorkflowParameterValueKind;
  readonly semanticMeaning: ImageWorkflowParameterSemanticMeaning;
  readonly required: boolean;
  readonly defaultValue?: unknown;
  readonly sensitivity: ImageWorkflowParameterSensitivityLevel;
  readonly validation: ImageWorkflowParameterValidation;
  readonly visibility?: ImageWorkflowParameterVisibility;
  readonly ui: ImageWorkflowParameterUiSchema;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageWorkflowParameterSpecificationError(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalNonNegativeInteger(value: number | undefined, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new ImageWorkflowParameterSpecificationError(`${field} must be a non-negative integer.`);
  }
  return value;
}

function normalizeOptionalFiniteNumber(value: number | undefined, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isFinite(value)) {
    throw new ImageWorkflowParameterSpecificationError(`${field} must be a finite number.`);
  }
  return value;
}

function normalizeValidation(
  validation: ImageWorkflowParameterValidation | undefined,
  valueKind: ImageWorkflowParameterValueKind,
  parameterId: string,
): ImageWorkflowParameterValidation {
  const minimum = normalizeOptionalFiniteNumber(validation?.minimum, `Image workflow parameter '${parameterId}' minimum`);
  const maximum = normalizeOptionalFiniteNumber(validation?.maximum, `Image workflow parameter '${parameterId}' maximum`);
  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    throw new ImageWorkflowParameterSpecificationError(
      `Image workflow parameter '${parameterId}' minimum cannot exceed maximum.`,
    );
  }

  const step = normalizeOptionalFiniteNumber(validation?.step, `Image workflow parameter '${parameterId}' step`);
  if (step !== undefined && step <= 0) {
    throw new ImageWorkflowParameterSpecificationError(
      `Image workflow parameter '${parameterId}' step must be greater than zero.`,
    );
  }

  const minLength = normalizeOptionalNonNegativeInteger(
    validation?.minLength,
    `Image workflow parameter '${parameterId}' minLength`,
  );
  const maxLength = normalizeOptionalNonNegativeInteger(
    validation?.maxLength,
    `Image workflow parameter '${parameterId}' maxLength`,
  );
  if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
    throw new ImageWorkflowParameterSpecificationError(
      `Image workflow parameter '${parameterId}' minLength cannot exceed maxLength.`,
    );
  }

  const pattern = normalizeOptional(validation?.pattern);
  if (pattern) {
    try {
      new RegExp(pattern);
    } catch {
      throw new ImageWorkflowParameterSpecificationError(
        `Image workflow parameter '${parameterId}' pattern must be a valid regular expression.`,
      );
    }
  }

  const options = Object.freeze([
    ...new Map((validation?.options ?? []).map((option) => {
      const value = normalizeRequired(option.value, `Image workflow parameter '${parameterId}' option value`);
      return [
        value,
        Object.freeze({
          value,
          label: normalizeRequired(option.label, `Image workflow parameter '${parameterId}' option label`),
          description: normalizeOptional(option.description),
        }),
      ] as const;
    })).values(),
  ]);

  const acceptedAssetKinds = Object.freeze([
    ...new Set((validation?.acceptedAssetKinds ?? [])
      .map((entry) => normalizeOptional(entry))
      .filter((entry): entry is string => Boolean(entry))),
  ]);

  if (valueKind === ImageWorkflowParameterValueKinds.select && options.length === 0) {
    throw new ImageWorkflowParameterSpecificationError(
      `Image workflow select parameter '${parameterId}' requires validation.options.`,
    );
  }

  if (valueKind !== ImageWorkflowParameterValueKinds.select && options.length > 0) {
    throw new ImageWorkflowParameterSpecificationError(
      `Image workflow parameter '${parameterId}' validation.options are only valid for select values.`,
    );
  }

  const isNumeric = valueKind === ImageWorkflowParameterValueKinds.integer || valueKind === ImageWorkflowParameterValueKinds.float;
  if (!isNumeric && (minimum !== undefined || maximum !== undefined || step !== undefined)) {
    throw new ImageWorkflowParameterSpecificationError(
      `Image workflow parameter '${parameterId}' numeric bounds are only valid for integer/float values.`,
    );
  }

  if (valueKind === ImageWorkflowParameterValueKinds.text) {
    if (minimum !== undefined || maximum !== undefined || step !== undefined) {
      throw new ImageWorkflowParameterSpecificationError(
        `Image workflow text parameter '${parameterId}' cannot define numeric bounds.`,
      );
    }
  }

  if (valueKind !== ImageWorkflowParameterValueKinds.text && (minLength !== undefined || maxLength !== undefined || pattern)) {
    throw new ImageWorkflowParameterSpecificationError(
      `Image workflow parameter '${parameterId}' text validation is only valid for text values.`,
    );
  }

  const isAssetReference = valueKind === ImageWorkflowParameterValueKinds.imageAssetReference
    || valueKind === ImageWorkflowParameterValueKinds.maskAssetReference
    || valueKind === ImageWorkflowParameterValueKinds.referenceAssetReference;

  if (!isAssetReference && acceptedAssetKinds.length > 0) {
    throw new ImageWorkflowParameterSpecificationError(
      `Image workflow parameter '${parameterId}' acceptedAssetKinds are only valid for asset reference values.`,
    );
  }

  return Object.freeze({
    minimum,
    maximum,
    step,
    minLength,
    maxLength,
    pattern,
    options,
    acceptedAssetKinds,
  });
}

function normalizeVisibility(
  visibility: ImageWorkflowParameterVisibility | undefined,
  parameterId: string,
): ImageWorkflowParameterVisibility | undefined {
  if (!visibility) {
    return undefined;
  }

  const mode = visibility.mode;
  if (mode !== "all" && mode !== "any") {
    throw new ImageWorkflowParameterSpecificationError(
      `Image workflow parameter '${parameterId}' visibility mode must be 'all' or 'any'.`,
    );
  }

  const rules = Object.freeze(visibility.rules.map((rule) => {
    const ruleParameterId = normalizeRequired(
      rule.parameterId,
      `Image workflow parameter '${parameterId}' visibility rule parameterId`,
    );

    if (ruleParameterId === parameterId) {
      throw new ImageWorkflowParameterSpecificationError(
        `Image workflow parameter '${parameterId}' visibility cannot self-reference.`,
      );
    }

    if (!Object.values(ImageWorkflowParameterVisibilityOperators).includes(rule.operator)) {
      throw new ImageWorkflowParameterSpecificationError(
        `Image workflow parameter '${parameterId}' has invalid visibility operator '${String(rule.operator)}'.`,
      );
    }

    if (rule.operator === ImageWorkflowParameterVisibilityOperators.exists && rule.value !== undefined) {
      throw new ImageWorkflowParameterSpecificationError(
        `Image workflow parameter '${parameterId}' visibility operator 'exists' cannot include a value.`,
      );
    }

    if (rule.operator !== ImageWorkflowParameterVisibilityOperators.exists && rule.value === undefined) {
      throw new ImageWorkflowParameterSpecificationError(
        `Image workflow parameter '${parameterId}' visibility operator '${rule.operator}' requires a value.`,
      );
    }

    if (
      (rule.operator === ImageWorkflowParameterVisibilityOperators.in || rule.operator === ImageWorkflowParameterVisibilityOperators.notIn)
      && (!Array.isArray(rule.value) || rule.value.length === 0)
    ) {
      throw new ImageWorkflowParameterSpecificationError(
        `Image workflow parameter '${parameterId}' visibility operator '${rule.operator}' requires a non-empty array value.`,
      );
    }

    return Object.freeze({
      parameterId: ruleParameterId,
      operator: rule.operator,
      value: rule.value,
    });
  }));

  return Object.freeze({
    mode,
    rules,
  });
}

function normalizeUiSchema(
  ui: ImageWorkflowParameterUiSchema,
  valueKind: ImageWorkflowParameterValueKind,
  parameterId: string,
): ImageWorkflowParameterUiSchema {
  const allowedControlsByValueKind: Readonly<Record<ImageWorkflowParameterValueKind, ReadonlyArray<ImageWorkflowParameterUiControlKind>>> = {
    [ImageWorkflowParameterValueKinds.text]: Object.freeze([
      ImageWorkflowParameterUiControlKinds.textInput,
      ImageWorkflowParameterUiControlKinds.textArea,
      ImageWorkflowParameterUiControlKinds.hidden,
    ]),
    [ImageWorkflowParameterValueKinds.integer]: Object.freeze([
      ImageWorkflowParameterUiControlKinds.numberInput,
      ImageWorkflowParameterUiControlKinds.slider,
      ImageWorkflowParameterUiControlKinds.hidden,
    ]),
    [ImageWorkflowParameterValueKinds.float]: Object.freeze([
      ImageWorkflowParameterUiControlKinds.numberInput,
      ImageWorkflowParameterUiControlKinds.slider,
      ImageWorkflowParameterUiControlKinds.hidden,
    ]),
    [ImageWorkflowParameterValueKinds.boolean]: Object.freeze([
      ImageWorkflowParameterUiControlKinds.switch,
      ImageWorkflowParameterUiControlKinds.hidden,
    ]),
    [ImageWorkflowParameterValueKinds.select]: Object.freeze([
      ImageWorkflowParameterUiControlKinds.select,
      ImageWorkflowParameterUiControlKinds.hidden,
    ]),
    [ImageWorkflowParameterValueKinds.imageAssetReference]: Object.freeze([
      ImageWorkflowParameterUiControlKinds.assetPicker,
      ImageWorkflowParameterUiControlKinds.hidden,
    ]),
    [ImageWorkflowParameterValueKinds.maskAssetReference]: Object.freeze([
      ImageWorkflowParameterUiControlKinds.maskSlot,
      ImageWorkflowParameterUiControlKinds.assetPicker,
      ImageWorkflowParameterUiControlKinds.hidden,
    ]),
    [ImageWorkflowParameterValueKinds.referenceAssetReference]: Object.freeze([
      ImageWorkflowParameterUiControlKinds.referenceSlot,
      ImageWorkflowParameterUiControlKinds.assetPicker,
      ImageWorkflowParameterUiControlKinds.hidden,
    ]),
  };

  if (!Object.values(ImageWorkflowParameterUiControlKinds).includes(ui.control)) {
    throw new ImageWorkflowParameterSpecificationError(
      `Image workflow parameter '${parameterId}' has invalid ui.control '${String(ui.control)}'.`,
    );
  }

  if (!allowedControlsByValueKind[valueKind].includes(ui.control)) {
    throw new ImageWorkflowParameterSpecificationError(
      `Image workflow parameter '${parameterId}' ui.control '${ui.control}' is not valid for '${valueKind}' values.`,
    );
  }

  const order = ui.order;
  if (order !== undefined && (!Number.isInteger(order) || order < 0)) {
    throw new ImageWorkflowParameterSpecificationError(
      `Image workflow parameter '${parameterId}' ui.order must be a non-negative integer.`,
    );
  }

  return Object.freeze({
    control: ui.control,
    placeholder: normalizeOptional(ui.placeholder),
    group: normalizeOptional(ui.group),
    unitLabel: normalizeOptional(ui.unitLabel),
    order,
    helpText: normalizeOptional(ui.helpText),
    advanced: Boolean(ui.advanced),
  });
}

function assertDefaultValueMatchesSpecification(specification: {
  readonly parameterId: string;
  readonly valueKind: ImageWorkflowParameterValueKind;
  readonly defaultValue: unknown;
  readonly validation: ImageWorkflowParameterValidation;
}): void {
  const { parameterId, valueKind, defaultValue, validation } = specification;

  if (defaultValue === undefined) {
    return;
  }

  if (valueKind === ImageWorkflowParameterValueKinds.text) {
    if (typeof defaultValue !== "string") {
      throw new ImageWorkflowParameterSpecificationError(
        `Image workflow parameter '${parameterId}' defaultValue must be a string.`,
      );
    }
    if (validation.minLength !== undefined && defaultValue.length < validation.minLength) {
      throw new ImageWorkflowParameterSpecificationError(
        `Image workflow parameter '${parameterId}' defaultValue cannot be shorter than minLength.`,
      );
    }
    if (validation.maxLength !== undefined && defaultValue.length > validation.maxLength) {
      throw new ImageWorkflowParameterSpecificationError(
        `Image workflow parameter '${parameterId}' defaultValue cannot exceed maxLength.`,
      );
    }
    if (validation.pattern && !(new RegExp(validation.pattern).test(defaultValue))) {
      throw new ImageWorkflowParameterSpecificationError(
        `Image workflow parameter '${parameterId}' defaultValue must match validation pattern.`,
      );
    }
    return;
  }

  if (valueKind === ImageWorkflowParameterValueKinds.boolean) {
    if (typeof defaultValue !== "boolean") {
      throw new ImageWorkflowParameterSpecificationError(
        `Image workflow parameter '${parameterId}' defaultValue must be a boolean.`,
      );
    }
    return;
  }

  if (valueKind === ImageWorkflowParameterValueKinds.integer || valueKind === ImageWorkflowParameterValueKinds.float) {
    if (typeof defaultValue !== "number" || !Number.isFinite(defaultValue)) {
      throw new ImageWorkflowParameterSpecificationError(
        `Image workflow parameter '${parameterId}' defaultValue must be a finite number.`,
      );
    }
    if (valueKind === ImageWorkflowParameterValueKinds.integer && !Number.isInteger(defaultValue)) {
      throw new ImageWorkflowParameterSpecificationError(
        `Image workflow parameter '${parameterId}' defaultValue must be an integer.`,
      );
    }
    if (validation.minimum !== undefined && defaultValue < validation.minimum) {
      throw new ImageWorkflowParameterSpecificationError(
        `Image workflow parameter '${parameterId}' defaultValue cannot be less than minimum.`,
      );
    }
    if (validation.maximum !== undefined && defaultValue > validation.maximum) {
      throw new ImageWorkflowParameterSpecificationError(
        `Image workflow parameter '${parameterId}' defaultValue cannot exceed maximum.`,
      );
    }
    return;
  }

  if (valueKind === ImageWorkflowParameterValueKinds.select) {
    if (typeof defaultValue !== "string") {
      throw new ImageWorkflowParameterSpecificationError(
        `Image workflow parameter '${parameterId}' defaultValue must be a string option value.`,
      );
    }

    const optionValues = new Set((validation.options ?? []).map((option) => option.value));
    if (!optionValues.has(defaultValue)) {
      throw new ImageWorkflowParameterSpecificationError(
        `Image workflow parameter '${parameterId}' defaultValue must be one of validation.options values.`,
      );
    }
    return;
  }

  if (typeof defaultValue !== "string") {
    throw new ImageWorkflowParameterSpecificationError(
      `Image workflow parameter '${parameterId}' defaultValue must be a logical reference string.`,
    );
  }

  if (/^[a-zA-Z]:\\/.test(defaultValue) || defaultValue.startsWith("/") || defaultValue.includes("\\")) {
    throw new ImageWorkflowParameterSpecificationError(
      `Image workflow parameter '${parameterId}' defaultValue must be a logical reference and cannot be a filesystem path.`,
    );
  }
}

export function normalizeImageWorkflowParameterSpecification(
  specification: ImageWorkflowParameterSpecification,
): ImageWorkflowParameterSpecification {
  const valueKind = specification.valueKind;
  if (!Object.values(ImageWorkflowParameterValueKinds).includes(valueKind)) {
    throw new ImageWorkflowParameterSpecificationError(
      `Image workflow parameter '${specification.parameterId}' has invalid valueKind '${String(valueKind)}'.`,
    );
  }

  const sensitivity = specification.sensitivity;
  if (!Object.values(ImageWorkflowParameterSensitivityLevels).includes(sensitivity)) {
    throw new ImageWorkflowParameterSpecificationError(
      `Image workflow parameter '${specification.parameterId}' has invalid sensitivity '${String(sensitivity)}'.`,
    );
  }

  const normalized: ImageWorkflowParameterSpecification = Object.freeze({
    parameterId: normalizeRequired(specification.parameterId, "Image workflow parameterId"),
    label: normalizeRequired(specification.label, `Image workflow parameter '${specification.parameterId}' label`),
    description: normalizeOptional(specification.description),
    valueKind,
    semanticMeaning: normalizeRequired(specification.semanticMeaning, `Image workflow parameter '${specification.parameterId}' semanticMeaning`),
    required: Boolean(specification.required),
    defaultValue: specification.defaultValue,
    sensitivity,
    validation: normalizeValidation(specification.validation, valueKind, specification.parameterId),
    visibility: normalizeVisibility(specification.visibility, specification.parameterId),
    ui: normalizeUiSchema(specification.ui, valueKind, specification.parameterId),
  });

  assertDefaultValueMatchesSpecification(normalized);

  return normalized;
}

function testNumericStep(value: number, step: number, minimum: number): boolean {
  const distance = (value - minimum) / step;
  const rounded = Math.round(distance);
  return Math.abs(distance - rounded) < 1e-9;
}

export function validateImageWorkflowParameterValue(
  specification: ImageWorkflowParameterSpecification,
  value: unknown,
): ReadonlyArray<string> {
  const normalized = normalizeImageWorkflowParameterSpecification(specification);
  const issues: string[] = [];

  if (value === undefined || value === null) {
    if (normalized.required) {
      issues.push(`Parameter '${normalized.parameterId}' is required.`);
    }
    return Object.freeze(issues);
  }

  if (normalized.valueKind === ImageWorkflowParameterValueKinds.text) {
    if (typeof value !== "string") {
      issues.push(`Parameter '${normalized.parameterId}' must be a string.`);
      return Object.freeze(issues);
    }
    if (normalized.validation.minLength !== undefined && value.length < normalized.validation.minLength) {
      issues.push(`Parameter '${normalized.parameterId}' must be at least ${normalized.validation.minLength} characters.`);
    }
    if (normalized.validation.maxLength !== undefined && value.length > normalized.validation.maxLength) {
      issues.push(`Parameter '${normalized.parameterId}' must be at most ${normalized.validation.maxLength} characters.`);
    }
    if (normalized.validation.pattern && !(new RegExp(normalized.validation.pattern).test(value))) {
      issues.push(`Parameter '${normalized.parameterId}' must match pattern '${normalized.validation.pattern}'.`);
    }
    return Object.freeze(issues);
  }

  if (normalized.valueKind === ImageWorkflowParameterValueKinds.boolean) {
    if (typeof value !== "boolean") {
      issues.push(`Parameter '${normalized.parameterId}' must be a boolean.`);
    }
    return Object.freeze(issues);
  }

  if (normalized.valueKind === ImageWorkflowParameterValueKinds.integer || normalized.valueKind === ImageWorkflowParameterValueKinds.float) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push(`Parameter '${normalized.parameterId}' must be a finite number.`);
      return Object.freeze(issues);
    }

    if (normalized.valueKind === ImageWorkflowParameterValueKinds.integer && !Number.isInteger(value)) {
      issues.push(`Parameter '${normalized.parameterId}' must be an integer.`);
    }

    if (normalized.validation.minimum !== undefined && value < normalized.validation.minimum) {
      issues.push(`Parameter '${normalized.parameterId}' cannot be less than ${normalized.validation.minimum}.`);
    }

    if (normalized.validation.maximum !== undefined && value > normalized.validation.maximum) {
      issues.push(`Parameter '${normalized.parameterId}' cannot be greater than ${normalized.validation.maximum}.`);
    }

    if (
      normalized.validation.step !== undefined
      && normalized.validation.minimum !== undefined
      && !testNumericStep(value, normalized.validation.step, normalized.validation.minimum)
    ) {
      issues.push(`Parameter '${normalized.parameterId}' must increment by step ${normalized.validation.step}.`);
    }

    return Object.freeze(issues);
  }

  if (typeof value !== "string") {
    issues.push(`Parameter '${normalized.parameterId}' must be a logical reference string.`);
    return Object.freeze(issues);
  }

  if (/^[a-zA-Z]:\\/.test(value) || value.startsWith("/") || value.includes("\\")) {
    issues.push(`Parameter '${normalized.parameterId}' must use a logical reference, not a filesystem path.`);
    return Object.freeze(issues);
  }

  if (normalized.valueKind === ImageWorkflowParameterValueKinds.select) {
    const optionValues = new Set((normalized.validation.options ?? []).map((option) => option.value));
    if (!optionValues.has(value)) {
      issues.push(`Parameter '${normalized.parameterId}' must be one of the configured option values.`);
    }
  }

  return Object.freeze(issues);
}

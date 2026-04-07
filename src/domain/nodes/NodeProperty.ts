import type {
  INodeProperty,
  INodePropertyBindingProfile,
  INodePropertyConstraint,
  INodePropertyOption,
  INodePropertyProjectionMetadata,
  INodePropertyValidationResult,
  INodePropertyValueRange,
  NodePropertyType,
  NodePropertyValue,
} from "./interfaces/INodeProperty";
import type {
  IModelCompatibility,
  ModelModality,
  ModelTask,
  RuntimeEngine,
} from "../../domain/models/interfaces/IModelCompatibility";
import type { IModelDependency } from "../../domain/models/interfaces/IModelDependency";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

function asReadonlyArray<T>(value?: ReadonlyArray<T>): ReadonlyArray<T> | undefined {
  return value ? Object.freeze([...value]) : undefined;
}

function deepEquals(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeRange(
  range?: INodePropertyValueRange
): INodePropertyValueRange | undefined {
  if (!range) {
    return undefined;
  }

  const min = Math.min(range.min, range.max);
  const max = Math.max(range.min, range.max);

  return Object.freeze({
    min,
    max,
    step: range.step,
    defaultValue: clamp(range.defaultValue, min, max),
    clamp: range.clamp ?? true,
  });
}

function sanitizeConstraints(
  constraints?: INodePropertyConstraint
): INodePropertyConstraint | undefined {
  if (!constraints) {
    return undefined;
  }

  const range = sanitizeRange(constraints.range);

  return Object.freeze({
    ...constraints,
    min:
      range?.min !== undefined
        ? constraints.min !== undefined
          ? Math.max(constraints.min, range.min)
          : range.min
        : constraints.min,
    max:
      range?.max !== undefined
        ? constraints.max !== undefined
          ? Math.min(constraints.max, range.max)
          : range.max
        : constraints.max,
    range,
  });
}

function countStepDecimals(step: number): number {
  const parts = step.toString().split(".");
  return parts[1]?.length ?? 0;
}

function normalizeNumberToRange(
  value: number,
  type: NodePropertyType,
  constraints?: INodePropertyConstraint
): number {
  const range = constraints?.range;
  let normalized = value;

  if (range) {
    normalized = range.clamp === false
      ? normalized
      : clamp(normalized, range.min, range.max);

    if (range.step && range.step > 0) {
      const stepCount = Math.round((normalized - range.min) / range.step);
      normalized = range.min + stepCount * range.step;
      normalized = Number(normalized.toFixed(countStepDecimals(range.step)));

      if (range.clamp !== false) {
        normalized = clamp(normalized, range.min, range.max);
      }
    }
  }

  if (type === "integer") {
    normalized = Math.trunc(normalized);
  }

  return normalized;
}

export class NodePropertyValidationResult
  implements INodePropertyValidationResult
{
  public readonly isValid: boolean;
  public readonly messages: ReadonlyArray<string>;

  constructor(isValid: boolean, messages: ReadonlyArray<string> = []) {
    this.isValid = isValid;
    this.messages = Object.freeze([...messages]);
  }
}

export class NodePropertyBindingProfile implements INodePropertyBindingProfile {
  public readonly modalities?: ReadonlyArray<ModelModality>;
  public readonly tasks?: ReadonlyArray<ModelTask>;
  public readonly runtimes?: ReadonlyArray<RuntimeEngine>;
  public readonly modelCompatibility?: IModelCompatibility;
  public readonly dependencyConstraints?: ReadonlyArray<IModelDependency>;

  constructor(params: {
    modalities?: ReadonlyArray<ModelModality>;
    tasks?: ReadonlyArray<ModelTask>;
    runtimes?: ReadonlyArray<RuntimeEngine>;
    modelCompatibility?: IModelCompatibility;
    dependencyConstraints?: ReadonlyArray<IModelDependency>;
  } = {}) {
    this.modalities = asReadonlyArray(params.modalities);
    this.tasks = asReadonlyArray(params.tasks);
    this.runtimes = asReadonlyArray(params.runtimes);
    this.modelCompatibility = params.modelCompatibility;
    this.dependencyConstraints = asReadonlyArray(params.dependencyConstraints);
  }
}

export class NodeProperty<TValue = NodePropertyValue>
  implements INodeProperty<TValue>
{
  public readonly id: string;
  public readonly name: string;
  public readonly description?: string;
  public readonly type: NodePropertyType;
  public readonly value: TValue;
  public readonly defaultValue?: TValue;
  public readonly isEditable: boolean;
  public readonly isPersisted: boolean;
  public readonly isAdvanced: boolean;
  public readonly order: number;
  public readonly constraints?: INodePropertyConstraint;
  public readonly options?: ReadonlyArray<INodePropertyOption<TValue>>;
  public readonly bindingProfile?: INodePropertyBindingProfile;
  public readonly projection?: INodePropertyProjectionMetadata;

  constructor(params: {
    id: string;
    name: string;
    description?: string;
    type: NodePropertyType;
    value: TValue;
    defaultValue?: TValue;
    isEditable?: boolean;
    isPersisted?: boolean;
    isAdvanced?: boolean;
    order?: number;
    constraints?: INodePropertyConstraint;
    options?: ReadonlyArray<INodePropertyOption<TValue>>;
    bindingProfile?: INodePropertyBindingProfile;
    projection?: INodePropertyProjectionMetadata;
  }) {
    const constraints = sanitizeConstraints(params.constraints);
    const value =
      typeof params.value === "number"
        ? (normalizeNumberToRange(params.value, params.type, constraints) as TValue)
        : params.value;
    const defaultValue =
      typeof params.defaultValue === "number"
        ? (normalizeNumberToRange(
            params.defaultValue,
            params.type,
            constraints
          ) as TValue)
        : params.defaultValue;

    this.id = params.id;
    this.name = params.name;
    this.description = params.description;
    this.type = params.type;
    this.value = value;
    this.defaultValue =
      defaultValue !== undefined
        ? defaultValue
        : (constraints?.range?.defaultValue as TValue | undefined);
    this.isEditable = params.isEditable ?? true;
    this.isPersisted = params.isPersisted ?? true;
    this.isAdvanced = params.isAdvanced ?? false;
    this.order = params.order ?? 0;
    this.constraints = constraints;
    this.options = params.options ? Object.freeze([...params.options]) : undefined;
    this.bindingProfile = params.bindingProfile;
    this.projection = params.projection ? Object.freeze({ ...params.projection }) : undefined;
  }

  public withValue(value: TValue): INodeProperty<TValue> {
    const normalizedValue =
      typeof value === "number"
        ? (normalizeNumberToRange(value, this.type, this.constraints) as TValue)
        : value;

    return new NodeProperty<TValue>({
      id: this.id,
      name: this.name,
      description: this.description,
      type: this.type,
      value: normalizedValue,
      defaultValue: this.defaultValue,
      isEditable: this.isEditable,
      isPersisted: this.isPersisted,
      isAdvanced: this.isAdvanced,
      order: this.order,
      constraints: this.constraints,
      options: this.options,
      bindingProfile: this.bindingProfile,
      projection: this.projection,
    });
  }

  public validate(): INodePropertyValidationResult {
    const messages: string[] = [];
    const constraints = this.constraints;

    if (!constraints) {
      return new NodePropertyValidationResult(true);
    }

    if (constraints.required && this.isEmpty()) {
      messages.push(`${this.name} is required.`);
    }

    if (!this.isEmpty()) {
      if (
        typeof this.value === "number" &&
        constraints.min !== undefined &&
        this.value < constraints.min
      ) {
        messages.push(`${this.name} must be at least ${constraints.min}.`);
      }

      if (
        typeof this.value === "number" &&
        constraints.max !== undefined &&
        this.value > constraints.max
      ) {
        messages.push(`${this.name} must be at most ${constraints.max}.`);
      }

      if (
        typeof this.value === "string" &&
        constraints.minLength !== undefined &&
        this.value.length < constraints.minLength
      ) {
        messages.push(
          `${this.name} must be at least ${constraints.minLength} characters.`
        );
      }

      if (
        typeof this.value === "string" &&
        constraints.maxLength !== undefined &&
        this.value.length > constraints.maxLength
      ) {
        messages.push(
          `${this.name} must be at most ${constraints.maxLength} characters.`
        );
      }

      if (
        typeof this.value === "string" &&
        constraints.pattern &&
        !new RegExp(constraints.pattern).test(this.value)
      ) {
        messages.push(`${this.name} has an invalid format.`);
      }

      if (
        constraints.allowedValues &&
        constraints.allowedValues.length > 0 &&
        !constraints.allowedValues.some((allowedValue) =>
          deepEquals(allowedValue, this.value)
        )
      ) {
        messages.push(`${this.name} contains an unsupported value.`);
      }

      if (
        this.options &&
        this.options.length > 0 &&
        !this.options.some((option) => deepEquals(option.value, this.value))
      ) {
        messages.push(`${this.name} must match one of the available options.`);
      }

      if (
        constraints.acceptedFileExtensions &&
        constraints.acceptedFileExtensions.length > 0 &&
        (this.type === "file" || this.type === "directory") &&
        typeof this.value === "string"
      ) {
        const normalizedValue = normalize(this.value);
        const accepted = constraints.acceptedFileExtensions.map(normalize);
        const matches = accepted.some((extension) =>
          normalizedValue.endsWith(extension)
        );

        if (!matches) {
          messages.push(`${this.name} must use an accepted file extension.`);
        }
      }
    }

    return new NodePropertyValidationResult(messages.length === 0, messages);
  }

  public isEmpty(): boolean {
    if (isNil(this.value)) {
      return true;
    }

    if (typeof this.value === "string") {
      return this.value.trim().length === 0;
    }

    if (Array.isArray(this.value)) {
      return this.value.length === 0;
    }

    if (
      typeof this.value === "object" &&
      this.value !== null &&
      !Array.isArray(this.value)
    ) {
      return Object.keys(this.value as object).length === 0;
    }

    return false;
  }

  public isModelBound(): boolean {
    return (
      this.type === "model-reference" ||
      this.type === "model-list" ||
      !!this.bindingProfile?.modelCompatibility ||
      !!(
        this.bindingProfile?.dependencyConstraints &&
        this.bindingProfile.dependencyConstraints.length > 0
      )
    );
  }
}

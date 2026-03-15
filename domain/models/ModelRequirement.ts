import type {
  IModelRequirement,
  IModelRequirementEvaluationTarget,
} from "./interfaces/IModelRequirement";
import type { IModelDependency } from "./interfaces/IModelDependency";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeArray(values?: ReadonlyArray<string>): string[] {
  if (!values) {
    return [];
  }

  return [...new Set(values.map(normalize).filter(Boolean))];
}

function includesAny(
  actual?: ReadonlyArray<string>,
  expected?: ReadonlyArray<string>
): boolean {
  const normalizedExpected = normalizeArray(expected);

  if (normalizedExpected.length === 0) {
    return true;
  }

  const normalizedActual = new Set(normalizeArray(actual));
  return normalizedExpected.some((value) => normalizedActual.has(value));
}

function includesAll(
  actual?: ReadonlyArray<string>,
  expected?: ReadonlyArray<string>
): boolean {
  const normalizedExpected = normalizeArray(expected);

  if (normalizedExpected.length === 0) {
    return true;
  }

  const normalizedActual = new Set(normalizeArray(actual));
  return normalizedExpected.every((value) => normalizedActual.has(value));
}

function dependenciesSatisfy(
  actualDependencies: ReadonlyArray<IModelDependency> | undefined,
  requiredDependencies: ReadonlyArray<IModelDependency> | undefined
): boolean {
  if (!requiredDependencies || requiredDependencies.length === 0) {
    return true;
  }

  if (!actualDependencies || actualDependencies.length === 0) {
    return false;
  }

  return requiredDependencies.every((requiredDependency) =>
    actualDependencies.some(
      (actualDependency) =>
        requiredDependency.matches(actualDependency) ||
        actualDependency.matches(requiredDependency)
    )
  );
}

export class ModelRequirement implements IModelRequirement {
  public readonly id: string;
  public readonly label: string;
  public readonly kind: IModelRequirement["kind"];
  public readonly severity: IModelRequirement["severity"];
  public readonly description?: string;
  public readonly acceptedInputModalities?: IModelRequirement["acceptedInputModalities"];
  public readonly acceptedOutputModalities?: IModelRequirement["acceptedOutputModalities"];
  public readonly requiredTasks?: IModelRequirement["requiredTasks"];
  public readonly acceptedRuntimes?: IModelRequirement["acceptedRuntimes"];
  public readonly acceptedArchitectureFamilies?: ReadonlyArray<string>;
  public readonly acceptedFormats?: IModelRequirement["acceptedFormats"];
  public readonly requiredDependencies?: ReadonlyArray<IModelDependency>;
  public readonly acceptedQuantizations?: IModelRequirement["acceptedQuantizations"];
  public readonly acceptedLicenses?: ReadonlyArray<string>;
  public readonly minimumMemoryBytes?: number;
  public readonly maximumMemoryBytes?: number;

  constructor(params: {
    id: string;
    label: string;
    kind: IModelRequirement["kind"];
    severity?: IModelRequirement["severity"];
    description?: string;
    acceptedInputModalities?: IModelRequirement["acceptedInputModalities"];
    acceptedOutputModalities?: IModelRequirement["acceptedOutputModalities"];
    requiredTasks?: IModelRequirement["requiredTasks"];
    acceptedRuntimes?: IModelRequirement["acceptedRuntimes"];
    acceptedArchitectureFamilies?: ReadonlyArray<string>;
    acceptedFormats?: IModelRequirement["acceptedFormats"];
    requiredDependencies?: ReadonlyArray<IModelDependency>;
    acceptedQuantizations?: IModelRequirement["acceptedQuantizations"];
    acceptedLicenses?: ReadonlyArray<string>;
    minimumMemoryBytes?: number;
    maximumMemoryBytes?: number;
  }) {
    this.id = params.id;
    this.label = params.label;
    this.kind = params.kind;
    this.severity = params.severity ?? "required";
    this.description = params.description;
    this.acceptedInputModalities = params.acceptedInputModalities;
    this.acceptedOutputModalities = params.acceptedOutputModalities;
    this.requiredTasks = params.requiredTasks;
    this.acceptedRuntimes = params.acceptedRuntimes;
    this.acceptedArchitectureFamilies = params.acceptedArchitectureFamilies
      ? Object.freeze([...params.acceptedArchitectureFamilies])
      : undefined;
    this.acceptedFormats = params.acceptedFormats
      ? Object.freeze([...params.acceptedFormats])
      : undefined;
    this.requiredDependencies = params.requiredDependencies
      ? Object.freeze([...params.requiredDependencies])
      : undefined;
    this.acceptedQuantizations = params.acceptedQuantizations
      ? Object.freeze([...params.acceptedQuantizations])
      : undefined;
    this.acceptedLicenses = params.acceptedLicenses
      ? Object.freeze([...params.acceptedLicenses])
      : undefined;
    this.minimumMemoryBytes = params.minimumMemoryBytes;
    this.maximumMemoryBytes = params.maximumMemoryBytes;
  }

  public isSatisfiedBy(target: IModelRequirementEvaluationTarget): boolean {
    if (
      this.acceptedInputModalities &&
      !includesAny(target.inputModalities, this.acceptedInputModalities)
    ) {
      return false;
    }

    if (
      this.acceptedOutputModalities &&
      !includesAny(target.outputModalities, this.acceptedOutputModalities)
    ) {
      return false;
    }

    if (this.requiredTasks && !includesAll(target.tasks, this.requiredTasks)) {
      return false;
    }

    if (
      this.acceptedRuntimes &&
      (!target.runtime ||
        !normalizeArray(this.acceptedRuntimes).includes(normalize(target.runtime)))
    ) {
      return false;
    }

    if (
      this.acceptedArchitectureFamilies &&
      (!target.architectureFamily ||
        !normalizeArray(this.acceptedArchitectureFamilies).includes(
          normalize(target.architectureFamily)
        ))
    ) {
      return false;
    }

    if (
      this.acceptedFormats &&
      this.acceptedFormats.length > 0 &&
      (!target.format || !this.acceptedFormats.includes(target.format))
    ) {
      return false;
    }

    if (
      !dependenciesSatisfy(target.dependencies, this.requiredDependencies)
    ) {
      return false;
    }

    if (
      this.acceptedQuantizations &&
      this.acceptedQuantizations.length > 0 &&
      (!target.quantization ||
        !this.acceptedQuantizations.includes(target.quantization))
    ) {
      return false;
    }

    if (
      this.acceptedLicenses &&
      this.acceptedLicenses.length > 0 &&
      (!target.license ||
        !normalizeArray(this.acceptedLicenses).includes(normalize(target.license)))
    ) {
      return false;
    }

    if (
      this.minimumMemoryBytes !== undefined &&
      (target.estimatedMemoryBytes === undefined ||
        target.estimatedMemoryBytes < this.minimumMemoryBytes)
    ) {
      return false;
    }

    if (
      this.maximumMemoryBytes !== undefined &&
      target.estimatedMemoryBytes !== undefined &&
      target.estimatedMemoryBytes > this.maximumMemoryBytes
    ) {
      return false;
    }

    return true;
  }

  public getViolationMessage(): string {
    if (this.description?.trim()) {
      return this.description;
    }

    return `${this.label} requirement is not satisfied.`;
  }
}

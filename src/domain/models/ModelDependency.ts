import type {
  IModel,
  ModelArtifactFormat,
  ModelKind,
  ModelPrecision,
} from "./interfaces/IModel";
import type { ModelTask } from "./interfaces/IModelCompatibility";
import type {
  DependencySeverity,
  IModelDependency,
} from "./interfaces/IModelDependency";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeArray(values?: ReadonlyArray<string>): string[] {
  if (!values) {
    return [];
  }

  return [...new Set(values.map(normalize).filter(Boolean))];
}

function includesValue(values: ReadonlyArray<string> | undefined, target: string | undefined): boolean {
  if (!values || values.length === 0) {
    return true;
  }

  if (!target) {
    return false;
  }

  return normalizeArray(values).includes(normalize(target));
}

function includesAllValues(
  actual: ReadonlyArray<string> | undefined,
  expected: ReadonlyArray<string> | undefined
): boolean {
  const normalizedExpected = normalizeArray(expected);

  if (normalizedExpected.length === 0) {
    return true;
  }

  const normalizedActual = new Set(normalizeArray(actual));
  return normalizedExpected.every((value) => normalizedActual.has(value));
}

function hasIntersection(
  left: ReadonlyArray<string> | undefined,
  right: ReadonlyArray<string> | undefined
): boolean {
  const normalizedLeft = normalizeArray(left);
  const normalizedRight = new Set(normalizeArray(right));

  if (normalizedLeft.length === 0 || normalizedRight.size === 0) {
    return true;
  }

  return normalizedLeft.some((value) => normalizedRight.has(value));
}

export class ModelDependency implements IModelDependency {
  public readonly id: string;
  public readonly label: string;
  public readonly dependencyType: string;
  public readonly severity: DependencySeverity;
  public readonly description?: string;
  public readonly acceptedModelIds?: ReadonlyArray<string>;
  public readonly acceptedNames?: ReadonlyArray<string>;
  public readonly acceptedKinds?: ReadonlyArray<ModelKind>;
  public readonly acceptedArchitectureFamilies?: ReadonlyArray<string>;
  public readonly acceptedTasks?: ReadonlyArray<ModelTask>;
  public readonly acceptedFormats?: ReadonlyArray<ModelArtifactFormat>;
  public readonly acceptedPrecisions?: ReadonlyArray<ModelPrecision>;

  constructor(params: {
    id: string;
    label: string;
    dependencyType: string;
    severity?: DependencySeverity;
    description?: string;
    acceptedModelIds?: ReadonlyArray<string>;
    acceptedNames?: ReadonlyArray<string>;
    acceptedKinds?: ReadonlyArray<ModelKind>;
    acceptedArchitectureFamilies?: ReadonlyArray<string>;
    acceptedTasks?: ReadonlyArray<ModelTask>;
    acceptedFormats?: ReadonlyArray<ModelArtifactFormat>;
    acceptedPrecisions?: ReadonlyArray<ModelPrecision>;
  }) {
    this.id = params.id;
    this.label = params.label;
    this.dependencyType = params.dependencyType;
    this.severity = params.severity ?? "required";
    this.description = params.description;
    this.acceptedModelIds = params.acceptedModelIds
      ? Object.freeze([...params.acceptedModelIds])
      : undefined;
    this.acceptedNames = params.acceptedNames
      ? Object.freeze([...params.acceptedNames])
      : undefined;
    this.acceptedKinds = params.acceptedKinds
      ? Object.freeze([...params.acceptedKinds])
      : undefined;
    this.acceptedArchitectureFamilies = params.acceptedArchitectureFamilies
      ? Object.freeze([...params.acceptedArchitectureFamilies])
      : undefined;
    this.acceptedTasks = params.acceptedTasks
      ? Object.freeze([...params.acceptedTasks])
      : undefined;
    this.acceptedFormats = params.acceptedFormats
      ? Object.freeze([...params.acceptedFormats])
      : undefined;
    this.acceptedPrecisions = params.acceptedPrecisions
      ? Object.freeze([...params.acceptedPrecisions])
      : undefined;
  }

  public isSatisfiedBy(model: IModel): boolean {
    if (!includesValue(this.acceptedModelIds, model.id)) {
      return false;
    }

    if (!includesValue(this.acceptedNames, model.name)) {
      return false;
    }

    if (
      this.acceptedKinds &&
      this.acceptedKinds.length > 0 &&
      !this.acceptedKinds.includes(model.kind)
    ) {
      return false;
    }

    if (
      !includesValue(this.acceptedArchitectureFamilies, model.architectureFamily)
    ) {
      return false;
    }

    if (
      this.acceptedTasks &&
      !includesAllValues(model.compatibility.supportedTasks, this.acceptedTasks)
    ) {
      return false;
    }

    if (
      this.acceptedFormats &&
      this.acceptedFormats.length > 0 &&
      !this.acceptedFormats.includes(model.artifact.format)
    ) {
      return false;
    }

    if (
      this.acceptedPrecisions &&
      this.acceptedPrecisions.length > 0 &&
      (!model.precision || !this.acceptedPrecisions.includes(model.precision))
    ) {
      return false;
    }

    return true;
  }

  public matches(other: IModelDependency): boolean {
    if (normalize(this.dependencyType) !== normalize(other.dependencyType)) {
      return false;
    }

    if (!hasIntersection(this.acceptedModelIds, other.acceptedModelIds)) {
      return false;
    }

    if (!hasIntersection(this.acceptedNames, other.acceptedNames)) {
      return false;
    }

    if (!hasIntersection(this.acceptedKinds, other.acceptedKinds)) {
      return false;
    }

    if (
      !hasIntersection(
        this.acceptedArchitectureFamilies,
        other.acceptedArchitectureFamilies
      )
    ) {
      return false;
    }

    if (!hasIntersection(this.acceptedTasks, other.acceptedTasks)) {
      return false;
    }

    if (!hasIntersection(this.acceptedFormats, other.acceptedFormats)) {
      return false;
    }

    if (!hasIntersection(this.acceptedPrecisions, other.acceptedPrecisions)) {
      return false;
    }

    return true;
  }

  public getReferenceKey(): string {
    const parts = [normalize(this.dependencyType)];

    if (this.acceptedKinds && this.acceptedKinds.length > 0) {
      parts.push(`kinds:${this.acceptedKinds.join(",")}`);
    }

    if (
      this.acceptedArchitectureFamilies &&
      this.acceptedArchitectureFamilies.length > 0
    ) {
      parts.push(`families:${this.acceptedArchitectureFamilies.join(",")}`);
    }

    if (this.acceptedModelIds && this.acceptedModelIds.length > 0) {
      parts.push(`ids:${this.acceptedModelIds.join(",")}`);
    }

    return parts.join("|");
  }

  public getViolationMessage(): string {
    if (this.description?.trim()) {
      return this.description;
    }

    return `${this.label} dependency is not satisfied.`;
  }

  public static from(dependency: IModelDependency): ModelDependency {
    return new ModelDependency({
      id: dependency.id,
      label: dependency.label,
      dependencyType: dependency.dependencyType,
      severity: dependency.severity,
      description: dependency.description,
      acceptedModelIds: dependency.acceptedModelIds,
      acceptedNames: dependency.acceptedNames,
      acceptedKinds: dependency.acceptedKinds,
      acceptedArchitectureFamilies: dependency.acceptedArchitectureFamilies,
      acceptedTasks: dependency.acceptedTasks,
      acceptedFormats: dependency.acceptedFormats,
      acceptedPrecisions: dependency.acceptedPrecisions,
    });
  }
}

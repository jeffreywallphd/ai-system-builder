import type {
  INodePort,
  INodePortCompatibilityProfile,
  NodePortCardinality,
  NodePortDirection,
  NodePortValueType,
} from "./interfaces/INodePort";
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

function normalizeArray(values?: ReadonlyArray<string>): string[] {
  if (!values) {
    return [];
  }

  return [...new Set(values.map(normalize).filter(Boolean))];
}

function hasIntersection(
  left?: ReadonlyArray<string>,
  right?: ReadonlyArray<string>
): boolean {
  const normalizedLeft = normalizeArray(left);
  const normalizedRight = new Set(normalizeArray(right));

  if (normalizedLeft.length === 0 || normalizedRight.size === 0) {
    return false;
  }

  return normalizedLeft.some((value) => normalizedRight.has(value));
}

function dependenciesCompatible(
  left?: ReadonlyArray<IModelDependency>,
  right?: ReadonlyArray<IModelDependency>
): boolean {
  if (!left || left.length === 0 || !right || right.length === 0) {
    return true;
  }

  return left.some((leftDependency) =>
    right.some(
      (rightDependency) =>
        leftDependency.matches(rightDependency) ||
        rightDependency.matches(leftDependency)
    )
  );
}

export class NodePortCompatibilityProfile
  implements INodePortCompatibilityProfile
{
  public readonly valueTypes: ReadonlyArray<NodePortValueType>;
  public readonly modalities?: ReadonlyArray<ModelModality>;
  public readonly tasks?: ReadonlyArray<ModelTask>;
  public readonly runtimes?: ReadonlyArray<RuntimeEngine>;
  public readonly modelCompatibility?: IModelCompatibility;
  public readonly dependencyConstraints?: ReadonlyArray<IModelDependency>;
  public readonly allowsAnyValueType: boolean;
  public readonly isOptional: boolean;

  constructor(params: {
    valueTypes?: ReadonlyArray<NodePortValueType>;
    modalities?: ReadonlyArray<ModelModality>;
    tasks?: ReadonlyArray<ModelTask>;
    runtimes?: ReadonlyArray<RuntimeEngine>;
    modelCompatibility?: IModelCompatibility;
    dependencyConstraints?: ReadonlyArray<IModelDependency>;
    allowsAnyValueType?: boolean;
    isOptional?: boolean;
  } = {}) {
    this.valueTypes = Object.freeze([...(params.valueTypes ?? [])]);
    this.modalities = params.modalities
      ? Object.freeze([...params.modalities])
      : undefined;
    this.tasks = params.tasks ? Object.freeze([...params.tasks]) : undefined;
    this.runtimes = params.runtimes
      ? Object.freeze([...params.runtimes])
      : undefined;
    this.modelCompatibility = params.modelCompatibility;
    this.dependencyConstraints = params.dependencyConstraints
      ? Object.freeze([...params.dependencyConstraints])
      : undefined;
    this.allowsAnyValueType = params.allowsAnyValueType ?? false;
    this.isOptional = params.isOptional ?? false;
  }

  public supportsValueType(valueType: NodePortValueType): boolean {
    if (this.allowsAnyValueType) {
      return true;
    }

    return normalizeArray(this.valueTypes).includes(normalize(valueType));
  }

  public supportsModality(modality: ModelModality): boolean {
    if (!this.modalities || this.modalities.length === 0) {
      return true;
    }

    return normalizeArray(this.modalities).includes(normalize(modality));
  }

  public supportsTask(task: ModelTask): boolean {
    if (!this.tasks || this.tasks.length === 0) {
      return true;
    }

    return normalizeArray(this.tasks).includes(normalize(task));
  }

  public supportsRuntime(runtime: RuntimeEngine): boolean {
    if (!this.runtimes || this.runtimes.length === 0) {
      return true;
    }

    return normalizeArray(this.runtimes).includes(normalize(runtime));
  }

  public isCompatibleWith(other: INodePortCompatibilityProfile): boolean {
    const valueTypeCompatible =
      this.allowsAnyValueType ||
      other.allowsAnyValueType ||
      hasIntersection(this.valueTypes, other.valueTypes);

    if (!valueTypeCompatible) {
      return false;
    }

    const modalityCompatible =
      !this.modalities ||
      this.modalities.length === 0 ||
      !other.modalities ||
      other.modalities.length === 0 ||
      hasIntersection(this.modalities, other.modalities);

    if (!modalityCompatible) {
      return false;
    }

    const taskCompatible =
      !this.tasks ||
      this.tasks.length === 0 ||
      !other.tasks ||
      other.tasks.length === 0 ||
      hasIntersection(this.tasks, other.tasks);

    if (!taskCompatible) {
      return false;
    }

    const runtimeCompatible =
      !this.runtimes ||
      this.runtimes.length === 0 ||
      !other.runtimes ||
      other.runtimes.length === 0 ||
      hasIntersection(this.runtimes, other.runtimes);

    if (!runtimeCompatible) {
      return false;
    }

    const modelCompatibilityCompatible =
      !this.modelCompatibility ||
      !other.modelCompatibility ||
      this.modelCompatibility.isCompatibleWith(other.modelCompatibility) ||
      other.modelCompatibility.isCompatibleWith(this.modelCompatibility);

    if (!modelCompatibilityCompatible) {
      return false;
    }

    return dependenciesCompatible(
      this.dependencyConstraints,
      other.dependencyConstraints
    );
  }
}

export class NodePort implements INodePort {
  public readonly id: string;
  public readonly name: string;
  public readonly description?: string;
  public readonly direction: NodePortDirection;
  public readonly cardinality: NodePortCardinality;
  public readonly isControlPort: boolean;
  public readonly order: number;
  public readonly compatibility: INodePortCompatibilityProfile;

  constructor(params: {
    id: string;
    name: string;
    description?: string;
    direction: NodePortDirection;
    cardinality?: NodePortCardinality;
    isControlPort?: boolean;
    order?: number;
    compatibility?: INodePortCompatibilityProfile;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.description = params.description;
    this.direction = params.direction;
    this.cardinality = params.cardinality ?? "one";
    this.isControlPort = params.isControlPort ?? false;
    this.order = params.order ?? 0;
    this.compatibility =
      params.compatibility ?? new NodePortCompatibilityProfile();
  }

  public canConnectTo(other: INodePort): boolean {
    if (this.direction === other.direction) {
      return false;
    }

    if (this.isControlPort !== other.isControlPort) {
      return false;
    }

    const source = this.direction === "output" ? this : other;
    const target = this.direction === "input" ? this : other;

    if (source.direction !== "output" || target.direction !== "input") {
      return false;
    }

    if (!source.compatibility.isCompatibleWith(target.compatibility)) {
      return false;
    }

    if (!target.compatibility.isCompatibleWith(source.compatibility)) {
      return false;
    }

    return true;
  }

  public carriesModelData(): boolean {
    return this.compatibility.valueTypes.some(
      (valueType) => valueType === "model" || valueType === "model-reference"
    );
  }

  public expectsDependencies(): boolean {
    return !!(
      this.compatibility.dependencyConstraints &&
      this.compatibility.dependencyConstraints.length > 0
    );
  }
}

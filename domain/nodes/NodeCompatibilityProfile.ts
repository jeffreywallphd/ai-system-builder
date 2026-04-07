import type {
  IModelCompatibility,
  ModelModality,
  ModelTask,
  RuntimeEngine,
} from "../../src/domain/models/interfaces/IModelCompatibility";
import type { IModelDependency } from "../../src/domain/models/interfaces/IModelDependency";

/**
 * NodeCompatibilityProfile is a generic compatibility value object for nodes.
 *
 * It is deliberately broader than the definition capability profile because it is
 * useful in multiple places:
 * - node definitions
 * - instantiated nodes with resolved configuration
 * - filtering available nodes for a workflow/runtime/model context
 * - validating whether a node fits a workflow profile
 *
 * It is not tied to any one engine and does not depend on application/infrastructure.
 */

export interface INodeCompatibilityProfile {
  readonly modalities: ReadonlyArray<ModelModality>;
  readonly tasks: ReadonlyArray<ModelTask>;
  readonly runtimes: ReadonlyArray<RuntimeEngine>;
  readonly modelCompatibility?: IModelCompatibility;
  readonly dependencyConstraints?: ReadonlyArray<IModelDependency>;
  readonly allowsAnyRuntime: boolean;
  readonly allowsAnyTask: boolean;
  readonly allowsAnyModality: boolean;

  supportsModality(modality: ModelModality): boolean;
  supportsTask(task: ModelTask): boolean;
  supportsRuntime(runtime: RuntimeEngine): boolean;
  isCompatibleWith(other: INodeCompatibilityProfile): boolean;
  merge(other: INodeCompatibilityProfile): NodeCompatibilityProfile;
}

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

function union<T>(left?: ReadonlyArray<T>, right?: ReadonlyArray<T>): ReadonlyArray<T> {
  return Object.freeze([...(left ?? []), ...(right ?? [])].filter(
    (value, index, array) => array.indexOf(value) === index
  ));
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

export class NodeCompatibilityProfile implements INodeCompatibilityProfile {
  public readonly modalities: ReadonlyArray<ModelModality>;
  public readonly tasks: ReadonlyArray<ModelTask>;
  public readonly runtimes: ReadonlyArray<RuntimeEngine>;
  public readonly modelCompatibility?: IModelCompatibility;
  public readonly dependencyConstraints?: ReadonlyArray<IModelDependency>;
  public readonly allowsAnyRuntime: boolean;
  public readonly allowsAnyTask: boolean;
  public readonly allowsAnyModality: boolean;

  constructor(params: {
    modalities?: ReadonlyArray<ModelModality>;
    tasks?: ReadonlyArray<ModelTask>;
    runtimes?: ReadonlyArray<RuntimeEngine>;
    modelCompatibility?: IModelCompatibility;
    dependencyConstraints?: ReadonlyArray<IModelDependency>;
    allowsAnyRuntime?: boolean;
    allowsAnyTask?: boolean;
    allowsAnyModality?: boolean;
  } = {}) {
    this.modalities = Object.freeze([...(params.modalities ?? [])]);
    this.tasks = Object.freeze([...(params.tasks ?? [])]);
    this.runtimes = Object.freeze([...(params.runtimes ?? [])]);
    this.modelCompatibility = params.modelCompatibility;
    this.dependencyConstraints = params.dependencyConstraints
      ? Object.freeze([...params.dependencyConstraints])
      : undefined;
    this.allowsAnyRuntime = params.allowsAnyRuntime ?? false;
    this.allowsAnyTask = params.allowsAnyTask ?? false;
    this.allowsAnyModality = params.allowsAnyModality ?? false;
  }

  public supportsModality(modality: ModelModality): boolean {
    if (this.allowsAnyModality || this.modalities.length === 0) {
      return true;
    }

    return normalizeArray(this.modalities).includes(normalize(modality));
  }

  public supportsTask(task: ModelTask): boolean {
    if (this.allowsAnyTask || this.tasks.length === 0) {
      return true;
    }

    return normalizeArray(this.tasks).includes(normalize(task));
  }

  public supportsRuntime(runtime: RuntimeEngine): boolean {
    if (this.allowsAnyRuntime || this.runtimes.length === 0) {
      return true;
    }

    return normalizeArray(this.runtimes).includes(normalize(runtime));
  }

  public isCompatibleWith(other: INodeCompatibilityProfile): boolean {
    const modalityCompatible =
      this.allowsAnyModality ||
      other.allowsAnyModality ||
      this.modalities.length === 0 ||
      other.modalities.length === 0 ||
      hasIntersection(this.modalities, other.modalities);

    if (!modalityCompatible) {
      return false;
    }

    const taskCompatible =
      this.allowsAnyTask ||
      other.allowsAnyTask ||
      this.tasks.length === 0 ||
      other.tasks.length === 0 ||
      hasIntersection(this.tasks, other.tasks);

    if (!taskCompatible) {
      return false;
    }

    const runtimeCompatible =
      this.allowsAnyRuntime ||
      other.allowsAnyRuntime ||
      this.runtimes.length === 0 ||
      other.runtimes.length === 0 ||
      hasIntersection(this.runtimes, other.runtimes);

    if (!runtimeCompatible) {
      return false;
    }

    const modelCompatible =
      !this.modelCompatibility ||
      !other.modelCompatibility ||
      this.modelCompatibility.isCompatibleWith(other.modelCompatibility) ||
      other.modelCompatibility.isCompatibleWith(this.modelCompatibility);

    if (!modelCompatible) {
      return false;
    }

    return dependenciesCompatible(
      this.dependencyConstraints,
      other.dependencyConstraints
    );
  }

  public merge(other: INodeCompatibilityProfile): NodeCompatibilityProfile {
    return new NodeCompatibilityProfile({
      modalities: union(this.modalities, other.modalities) as ReadonlyArray<ModelModality>,
      tasks: union(this.tasks, other.tasks) as ReadonlyArray<ModelTask>,
      runtimes: union(this.runtimes, other.runtimes) as ReadonlyArray<RuntimeEngine>,
      modelCompatibility: this.modelCompatibility ?? other.modelCompatibility,
      dependencyConstraints: union(
        this.dependencyConstraints,
        other.dependencyConstraints
      ) as ReadonlyArray<IModelDependency>,
      allowsAnyRuntime: this.allowsAnyRuntime || other.allowsAnyRuntime,
      allowsAnyTask: this.allowsAnyTask || other.allowsAnyTask,
      allowsAnyModality: this.allowsAnyModality || other.allowsAnyModality,
    });
  }

  public static any(): NodeCompatibilityProfile {
    return new NodeCompatibilityProfile({
      allowsAnyRuntime: true,
      allowsAnyTask: true,
      allowsAnyModality: true,
    });
  }

  public static from(profile: INodeCompatibilityProfile): NodeCompatibilityProfile {
    return new NodeCompatibilityProfile({
      modalities: profile.modalities,
      tasks: profile.tasks,
      runtimes: profile.runtimes,
      modelCompatibility: profile.modelCompatibility,
      dependencyConstraints: profile.dependencyConstraints,
      allowsAnyRuntime: profile.allowsAnyRuntime,
      allowsAnyTask: profile.allowsAnyTask,
      allowsAnyModality: profile.allowsAnyModality,
    });
  }
}

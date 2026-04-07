import type { IModel, ModelArtifactFormat, ModelKind, ModelPrecision } from "./IModel";
import type { ModelTask } from "./IModelCompatibility";

export type DependencySeverity = "required" | "recommended" | "optional";

export interface IModelDependency {
  /**
   * Stable identifier for this dependency declaration.
   */
  readonly id: string;

  /**
   * Human-readable label for UI and validation messages.
   */
  readonly label: string;

  /**
   * Domain-level dependency type.
   * Examples:
   * - tokenizer
   * - lora
   * - vae
   * - adapter
   * - scheduler
   * - control-module
   * - prompt-template
   * - speaker-embedding
   */
  readonly dependencyType: string;

  /**
   * Whether this dependency is required, recommended, or optional.
   */
  readonly severity: DependencySeverity;

  /**
   * Optional explanatory text.
   */
  readonly description?: string;

  /**
   * Optional exact model IDs accepted for this dependency.
   */
  readonly acceptedModelIds?: ReadonlyArray<string>;

  /**
   * Optional exact model names accepted for this dependency.
   */
  readonly acceptedNames?: ReadonlyArray<string>;

  /**
   * Optional accepted model kinds.
   */
  readonly acceptedKinds?: ReadonlyArray<ModelKind>;

  /**
   * Optional accepted architecture families.
   */
  readonly acceptedArchitectureFamilies?: ReadonlyArray<string>;

  /**
   * Optional tasks the dependent model must support.
   */
  readonly acceptedTasks?: ReadonlyArray<ModelTask>;

  /**
   * Optional accepted artifact formats.
   */
  readonly acceptedFormats?: ReadonlyArray<ModelArtifactFormat>;

  /**
   * Optional accepted precisions / quantizations.
   */
  readonly acceptedPrecisions?: ReadonlyArray<ModelPrecision>;

  /**
   * Returns true when the provided model satisfies this dependency.
   */
  isSatisfiedBy(model: IModel): boolean;

  /**
   * Returns true when this dependency declaration semantically matches another.
   * Useful when requirements need to verify that a dependency has been declared.
   */
  matches(other: IModelDependency): boolean;

  /**
   * Returns a concise stable key for display/logging/comparison.
   */
  getReferenceKey(): string;

  /**
   * Returns a user-facing validation message if unsatisfied.
   */
  getViolationMessage(): string;
}

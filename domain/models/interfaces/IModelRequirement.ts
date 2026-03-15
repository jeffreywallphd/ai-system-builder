import {
  IModelCompatibility,
  ModelModality,
  ModelTask,
  RuntimeEngine,
} from "./IModelCompatibility";

export type RequirementSeverity = "required" | "recommended" | "optional";

export type ModelRequirementKind =
  | "input-modality"
  | "output-modality"
  | "task"
  | "runtime"
  | "architecture-family"
  | "format"
  | "dependency"
  | "license"
  | "memory"
  | "quantization"
  | "version"
  | "custom";

export interface IModelRequirementEvaluationTarget {
  readonly inputModalities?: ReadonlyArray<ModelModality>;
  readonly outputModalities?: ReadonlyArray<ModelModality>;
  readonly tasks?: ReadonlyArray<ModelTask>;
  readonly runtime?: RuntimeEngine;
  readonly architectureFamily?: string;
  readonly format?: string;
  readonly dependencies?: ReadonlyArray<string>;
  readonly quantization?: string;
  readonly license?: string;
  readonly estimatedMemoryBytes?: number;
  readonly compatibility?: IModelCompatibility;
}

export interface IModelRequirement {
  /**
   * Stable identifier for this requirement.
   */
  readonly id: string;

  /**
   * Human-readable name.
   */
  readonly label: string;

  /**
   * Requirement category.
   */
  readonly kind: ModelRequirementKind;

  /**
   * Required / recommended / optional.
   */
  readonly severity: RequirementSeverity;

  /**
   * Optional explanatory text for UI/validation.
   */
  readonly description?: string;

  /**
   * Accepted input modalities, if applicable.
   */
  readonly acceptedInputModalities?: ReadonlyArray<ModelModality>;

  /**
   * Accepted output modalities, if applicable.
   */
  readonly acceptedOutputModalities?: ReadonlyArray<ModelModality>;

  /**
   * Required supported tasks, if applicable.
   */
  readonly requiredTasks?: ReadonlyArray<ModelTask>;

  /**
   * Accepted runtimes, if applicable.
   */
  readonly acceptedRuntimes?: ReadonlyArray<RuntimeEngine>;

  /**
   * Accepted architecture families, if applicable.
   */
  readonly acceptedArchitectureFamilies?: ReadonlyArray<string>;

  /**
   * Accepted storage / artifact formats.
   * Examples:
   * - safetensors
   * - gguf
   * - onnx
   * - bin
   * - pt
   */
  readonly acceptedFormats?: ReadonlyArray<string>;

  /**
   * Required dependency identifiers or dependency types.
   */
  readonly requiredDependencies?: ReadonlyArray<string>;

  /**
   * Accepted quantization types.
   * Examples:
   * - fp16
   * - bf16
   * - int8
   * - q4_k_m
   */
  readonly acceptedQuantizations?: ReadonlyArray<string>;

  /**
   * Optional allowed licenses.
   */
  readonly acceptedLicenses?: ReadonlyArray<string>;

  /**
   * Optional minimum memory requirement in bytes.
   */
  readonly minimumMemoryBytes?: number;

  /**
   * Optional maximum memory requirement in bytes.
   */
  readonly maximumMemoryBytes?: number;

  isSatisfiedBy(target: IModelRequirementEvaluationTarget): boolean;

  getViolationMessage(): string;
}

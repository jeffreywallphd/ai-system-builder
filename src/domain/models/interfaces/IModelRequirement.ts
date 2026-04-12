import type {
  IModelCompatibility,
  ModelModality,
  ModelTask,
  RuntimeEngine,
} from "./IModelCompatibility";
import type { IModelDependency } from "./IModelDependency";
import type { ModelArtifactFormat, ModelPrecision } from "./IModel";

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
  readonly format?: ModelArtifactFormat;
  readonly dependencies?: ReadonlyArray<IModelDependency>;
  readonly quantization?: ModelPrecision;
  readonly license?: string;
  readonly estimatedMemoryBytes?: number;
  readonly compatibility?: IModelCompatibility;
}

export interface IModelRequirement {
  readonly id: string;
  readonly label: string;
  readonly kind: ModelRequirementKind;
  readonly severity: RequirementSeverity;
  readonly description?: string;

  readonly acceptedInputModalities?: ReadonlyArray<ModelModality>;
  readonly acceptedOutputModalities?: ReadonlyArray<ModelModality>;
  readonly requiredTasks?: ReadonlyArray<ModelTask>;
  readonly acceptedRuntimes?: ReadonlyArray<RuntimeEngine>;
  readonly acceptedArchitectureFamilies?: ReadonlyArray<string>;
  readonly acceptedFormats?: ReadonlyArray<ModelArtifactFormat>;
  readonly requiredDependencies?: ReadonlyArray<IModelDependency>;
  readonly acceptedQuantizations?: ReadonlyArray<ModelPrecision>;
  readonly acceptedLicenses?: ReadonlyArray<string>;
  readonly minimumMemoryBytes?: number;
  readonly maximumMemoryBytes?: number;

  isSatisfiedBy(target: IModelRequirementEvaluationTarget): boolean;
  getViolationMessage(): string;
}

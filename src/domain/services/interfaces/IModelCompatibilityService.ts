import type { IModel } from "../../models/interfaces/IModel";
import type {
  IModelCompatibility,
  ModelModality,
  ModelTask,
  RuntimeEngine,
} from "../../models/interfaces/IModelCompatibility";
import type { IModelDependency } from "../../models/interfaces/IModelDependency";
import type { IModelRequirement } from "../../models/interfaces/IModelRequirement";

export type ModelCompatibilitySeverity = "compatible" | "warning" | "incompatible";

export type ModelCompatibilityReasonCode =
  | "runtime-mismatch"
  | "architecture-family-mismatch"
  | "task-mismatch"
  | "input-modality-mismatch"
  | "output-modality-mismatch"
  | "dependency-mismatch"
  | "dependency-missing"
  | "requirement-unsatisfied"
  | "precision-mismatch"
  | "format-mismatch"
  | "license-mismatch"
  | "availability-mismatch"
  | "custom";

export interface IModelCompatibilityReason {
  readonly code: ModelCompatibilityReasonCode;
  readonly severity: Exclude<ModelCompatibilitySeverity, "compatible">;
  readonly message: string;
  readonly modelId?: string;
  readonly dependencyId?: string;
  readonly requirementId?: string;
}

export interface IModelCompatibilityResult {
  readonly severity: ModelCompatibilitySeverity;
  readonly isCompatible: boolean;
  readonly reasons: ReadonlyArray<IModelCompatibilityReason>;

  hasWarnings(): boolean;
  hasIncompatibilities(): boolean;
}

export interface IModelCompatibilityContext {
  /**
   * Optional runtime target for engine-specific validation.
   */
  readonly runtime?: RuntimeEngine;

  /**
   * Optional intended task for task-focused validation.
   */
  readonly task?: ModelTask;

  /**
   * Optional intended input modality.
   */
  readonly inputModality?: ModelModality;

  /**
   * Optional intended output modality.
   */
  readonly outputModality?: ModelModality;

  /**
   * Whether availability should be considered.
   */
  readonly requireAvailable?: boolean;
}

export interface IModelCompatibilityService {
  /**
   * Evaluates whether two concrete models can interoperate.
   */
  evaluateModelToModelCompatibility(
    sourceModel: IModel,
    targetModel: IModel,
    context?: IModelCompatibilityContext
  ): IModelCompatibilityResult;

  /**
   * Evaluates whether a concrete model satisfies a compatibility profile.
   */
  evaluateModelToProfileCompatibility(
    model: IModel,
    profile: IModelCompatibility,
    context?: IModelCompatibilityContext
  ): IModelCompatibilityResult;

  /**
   * Evaluates whether two compatibility profiles are mutually compatible.
   */
  evaluateProfileToProfileCompatibility(
    sourceProfile: IModelCompatibility,
    targetProfile: IModelCompatibility,
    context?: IModelCompatibilityContext
  ): IModelCompatibilityResult;

  /**
   * Evaluates whether a concrete model satisfies a dependency declaration.
   */
  evaluateDependencyCompatibility(
    dependency: IModelDependency,
    model: IModel,
    context?: IModelCompatibilityContext
  ): IModelCompatibilityResult;

  /**
   * Evaluates whether a concrete model satisfies a requirement declaration.
   */
  evaluateRequirementCompatibility(
    requirement: IModelRequirement,
    model: IModel,
    context?: IModelCompatibilityContext
  ): IModelCompatibilityResult;

  /**
   * Evaluates whether all requirements and dependencies of a model are satisfied.
   */
  evaluateModelReadiness(
    model: IModel,
    context?: IModelCompatibilityContext
  ): IModelCompatibilityResult;
}

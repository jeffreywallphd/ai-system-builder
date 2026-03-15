import type { IModel } from "../models/interfaces/IModel";
import type {
  IModelCompatibility,
  ModelModality,
  ModelTask,
  RuntimeEngine,
} from "../models/interfaces/IModelCompatibility";
import type { IModelDependency } from "../models/interfaces/IModelDependency";
import type { IModelRequirement } from "../models/interfaces/IModelRequirement";
import type {
  IModelCompatibilityContext,
  IModelCompatibilityReason,
  IModelCompatibilityResult,
  IModelCompatibilityService,
} from "./interfaces/IModelCompatibilityService";

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

function addReason(
  reasons: IModelCompatibilityReason[],
  reason: IModelCompatibilityReason
): void {
  reasons.push(reason);
}

function determineSeverity(
  reasons: ReadonlyArray<IModelCompatibilityReason>
): IModelCompatibilityResult["severity"] {
  if (reasons.some((reason) => reason.severity === "incompatible")) {
    return "incompatible";
  }

  if (reasons.some((reason) => reason.severity === "warning")) {
    return "warning";
  }

  return "compatible";
}

export class ModelCompatibilityResult implements IModelCompatibilityResult {
  public readonly severity: IModelCompatibilityResult["severity"];
  public readonly isCompatible: boolean;
  public readonly reasons: ReadonlyArray<IModelCompatibilityReason>;

  constructor(reasons: ReadonlyArray<IModelCompatibilityReason> = []) {
    this.reasons = Object.freeze([...reasons]);
    this.severity = determineSeverity(this.reasons);
    this.isCompatible = this.severity !== "incompatible";
  }

  public hasWarnings(): boolean {
    return this.reasons.some((reason) => reason.severity === "warning");
  }

  public hasIncompatibilities(): boolean {
    return this.reasons.some((reason) => reason.severity === "incompatible");
  }
}

export class ModelCompatibilityService implements IModelCompatibilityService {
  public evaluateModelToModelCompatibility(
    sourceModel: IModel,
    targetModel: IModel,
    context?: IModelCompatibilityContext
  ): IModelCompatibilityResult {
    const reasons: IModelCompatibilityReason[] = [];

    if (context?.requireAvailable) {
      if (!sourceModel.isAvailable()) {
        addReason(reasons, {
          code: "availability-mismatch",
          severity: "incompatible",
          message: `Model '${sourceModel.id}' is not available.`,
          modelId: sourceModel.id,
        });
      }

      if (!targetModel.isAvailable()) {
        addReason(reasons, {
          code: "availability-mismatch",
          severity: "incompatible",
          message: `Model '${targetModel.id}' is not available.`,
          modelId: targetModel.id,
        });
      }
    }

    const profileResult = this.evaluateProfileToProfileCompatibility(
      sourceModel.compatibility,
      targetModel.compatibility,
      context
    );

    reasons.push(...profileResult.reasons);

    if (
      sourceModel.architectureFamily &&
      targetModel.architectureFamily &&
      normalize(sourceModel.architectureFamily) !==
        normalize(targetModel.architectureFamily) &&
      !sourceModel.compatibility.supportsArchitectureFamily(
        targetModel.architectureFamily
      ) &&
      !targetModel.compatibility.supportsArchitectureFamily(
        sourceModel.architectureFamily
      )
    ) {
      addReason(reasons, {
        code: "architecture-family-mismatch",
        severity: "incompatible",
        message: `Model families '${sourceModel.architectureFamily}' and '${targetModel.architectureFamily}' are not compatible.`,
        modelId: sourceModel.id,
      });
    }

    const dependencyCompatible =
      sourceModel.dependencies.some((dependency) =>
        dependency.isSatisfiedBy(targetModel)
      ) ||
      targetModel.dependencies.some((dependency) =>
        dependency.isSatisfiedBy(sourceModel)
      ) ||
      sourceModel.isCompatibleWith(targetModel);

    if (!dependencyCompatible) {
      addReason(reasons, {
        code: "dependency-mismatch",
        severity: "warning",
        message:
          "No explicit dependency relationship was found between the two models.",
        modelId: sourceModel.id,
      });
    }

    return new ModelCompatibilityResult(reasons);
  }

  public evaluateModelToProfileCompatibility(
    model: IModel,
    profile: IModelCompatibility,
    context?: IModelCompatibilityContext
  ): IModelCompatibilityResult {
    const reasons: IModelCompatibilityReason[] = [];

    const profileResult = this.evaluateProfileToProfileCompatibility(
      model.compatibility,
      profile,
      context
    );

    reasons.push(...profileResult.reasons);

    if (context?.requireAvailable && !model.isAvailable()) {
      addReason(reasons, {
        code: "availability-mismatch",
        severity: "incompatible",
        message: `Model '${model.id}' is not available.`,
        modelId: model.id,
      });
    }

    return new ModelCompatibilityResult(reasons);
  }

  public evaluateProfileToProfileCompatibility(
    sourceProfile: IModelCompatibility,
    targetProfile: IModelCompatibility,
    context?: IModelCompatibilityContext
  ): IModelCompatibilityResult {
    const reasons: IModelCompatibilityReason[] = [];

    if (
      context?.runtime &&
      (!sourceProfile.supportsRuntime(context.runtime) ||
        !targetProfile.supportsRuntime(context.runtime))
    ) {
      addReason(reasons, {
        code: "runtime-mismatch",
        severity: "incompatible",
        message: `Runtime '${context.runtime}' is not supported by one or both profiles.`,
      });
    }

    if (
      context?.task &&
      (!sourceProfile.supportsTask(context.task) ||
        !targetProfile.supportsTask(context.task))
    ) {
      addReason(reasons, {
        code: "task-mismatch",
        severity: "incompatible",
        message: `Task '${context.task}' is not supported by one or both profiles.`,
      });
    }

    if (
      context?.inputModality &&
      !targetProfile.supportsInputModality(context.inputModality)
    ) {
      addReason(reasons, {
        code: "input-modality-mismatch",
        severity: "incompatible",
        message: `Target profile does not support input modality '${context.inputModality}'.`,
      });
    }

    if (
      context?.outputModality &&
      !sourceProfile.supportsOutputModality(context.outputModality)
    ) {
      addReason(reasons, {
        code: "output-modality-mismatch",
        severity: "incompatible",
        message: `Source profile does not support output modality '${context.outputModality}'.`,
      });
    }

    if (!sourceProfile.isCompatibleWith(targetProfile)) {
      if (
        !sourceProfile.allowsAnyRuntime &&
        !targetProfile.allowsAnyRuntime &&
        !hasIntersection(
          sourceProfile.supportedRuntimes,
          targetProfile.supportedRuntimes
        )
      ) {
        addReason(reasons, {
          code: "runtime-mismatch",
          severity: "incompatible",
          message: "The two profiles do not share a compatible runtime.",
        });
      }

      if (
        !sourceProfile.allowsAnyArchitectureFamily &&
        !targetProfile.allowsAnyArchitectureFamily &&
        !hasIntersection(
          sourceProfile.architectureFamilies,
          targetProfile.architectureFamilies
        )
      ) {
        addReason(reasons, {
          code: "architecture-family-mismatch",
          severity: "incompatible",
          message: "The two profiles do not share a compatible architecture family.",
        });
      }

      if (
        !hasIntersection(sourceProfile.supportedTasks, targetProfile.supportedTasks)
      ) {
        addReason(reasons, {
          code: "task-mismatch",
          severity: "warning",
          message: "The two profiles do not share an overlapping task set.",
        });
      }

      if (
        !hasIntersection(
          sourceProfile.outputModalities,
          targetProfile.inputModalities
        ) &&
        !hasIntersection(
          targetProfile.outputModalities,
          sourceProfile.inputModalities
        )
      ) {
        addReason(reasons, {
          code: "output-modality-mismatch",
          severity: "warning",
          message: "The two profiles do not expose a clear modality flow between them.",
        });
      }
    }

    return new ModelCompatibilityResult(reasons);
  }

  public evaluateDependencyCompatibility(
    dependency: IModelDependency,
    model: IModel,
    context?: IModelCompatibilityContext
  ): IModelCompatibilityResult {
    const reasons: IModelCompatibilityReason[] = [];

    if (!dependency.isSatisfiedBy(model)) {
      addReason(reasons, {
        code: "dependency-mismatch",
        severity: dependency.severity === "required" ? "incompatible" : "warning",
        message: dependency.getViolationMessage(),
        modelId: model.id,
        dependencyId: dependency.id,
      });
    }

    if (context?.runtime && !model.compatibility.supportsRuntime(context.runtime)) {
      addReason(reasons, {
        code: "runtime-mismatch",
        severity: "incompatible",
        message: `Model '${model.id}' does not support runtime '${context.runtime}'.`,
        modelId: model.id,
        dependencyId: dependency.id,
      });
    }

    return new ModelCompatibilityResult(reasons);
  }

  public evaluateRequirementCompatibility(
    requirement: IModelRequirement,
    model: IModel,
    context?: IModelCompatibilityContext
  ): IModelCompatibilityResult {
    const reasons: IModelCompatibilityReason[] = [];

    const estimatedMemoryBytes =
      model.resourceProfile?.estimatedRecommendedMemoryBytes ??
      model.resourceProfile?.estimatedMinMemoryBytes;

    if (
      !requirement.isSatisfiedBy({
        inputModalities: model.compatibility.inputModalities,
        outputModalities: model.compatibility.outputModalities,
        tasks: model.compatibility.supportedTasks,
        runtime:
          context?.runtime ??
          (model.compatibility.supportedRuntimes.length === 1
            ? model.compatibility.supportedRuntimes[0]
            : undefined),
        architectureFamily: model.architectureFamily,
        format: model.artifact.format,
        dependencies: model.dependencies,
        quantization: model.precision,
        license: model.license,
        estimatedMemoryBytes,
        compatibility: model.compatibility,
      })
    ) {
      addReason(reasons, {
        code: "requirement-unsatisfied",
        severity: requirement.severity === "required" ? "incompatible" : "warning",
        message: requirement.getViolationMessage(),
        modelId: model.id,
        requirementId: requirement.id,
      });
    }

    return new ModelCompatibilityResult(reasons);
  }

  public evaluateModelReadiness(
    model: IModel,
    context?: IModelCompatibilityContext
  ): IModelCompatibilityResult {
    const reasons: IModelCompatibilityReason[] = [];

    if (context?.requireAvailable && !model.isAvailable()) {
      addReason(reasons, {
        code: "availability-mismatch",
        severity: "incompatible",
        message: `Model '${model.id}' is not available.`,
        modelId: model.id,
      });
    }

    if (context?.runtime && !model.compatibility.supportsRuntime(context.runtime)) {
      addReason(reasons, {
        code: "runtime-mismatch",
        severity: "incompatible",
        message: `Model '${model.id}' does not support runtime '${context.runtime}'.`,
        modelId: model.id,
      });
    }

    if (context?.task && !model.compatibility.supportsTask(context.task)) {
      addReason(reasons, {
        code: "task-mismatch",
        severity: "incompatible",
        message: `Model '${model.id}' does not support task '${context.task}'.`,
        modelId: model.id,
      });
    }

    if (
      context?.inputModality &&
      !model.compatibility.supportsInputModality(context.inputModality)
    ) {
      addReason(reasons, {
        code: "input-modality-mismatch",
        severity: "incompatible",
        message: `Model '${model.id}' does not support input modality '${context.inputModality}'.`,
        modelId: model.id,
      });
    }

    if (
      context?.outputModality &&
      !model.compatibility.supportsOutputModality(context.outputModality)
    ) {
      addReason(reasons, {
        code: "output-modality-mismatch",
        severity: "incompatible",
        message: `Model '${model.id}' does not support output modality '${context.outputModality}'.`,
        modelId: model.id,
      });
    }

    for (const dependency of model.dependencies) {
      const dependencyResult = this.evaluateDependencyCompatibility(
        dependency,
        model,
        context
      );

      reasons.push(...dependencyResult.reasons);
    }

    for (const requirement of model.requirements) {
      const requirementResult = this.evaluateRequirementCompatibility(
        requirement,
        model,
        context
      );

      reasons.push(...requirementResult.reasons);
    }

    return new ModelCompatibilityResult(reasons);
  }
}

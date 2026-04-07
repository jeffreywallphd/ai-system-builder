import type { IModel } from "@domain/models/interfaces/IModel";
import type { IModelCompatibilityContext, IModelCompatibilityService } from "@domain/services/interfaces/IModelCompatibilityService";
import type { IModelCompatibility } from "@domain/models/interfaces/IModelCompatibility";
import type { IModelDependency } from "@domain/models/interfaces/IModelDependency";
import type { IModelRequirement } from "@domain/models/interfaces/IModelRequirement";

export type ResolveModelCompatibilityMode =
  | "model-to-model"
  | "model-to-profile"
  | "profile-to-profile"
  | "dependency"
  | "requirement"
  | "readiness";

export interface IResolveModelCompatibilityRequest {
  readonly mode: ResolveModelCompatibilityMode;
  readonly sourceModel?: IModel;
  readonly targetModel?: IModel;
  readonly sourceProfile?: IModelCompatibility;
  readonly targetProfile?: IModelCompatibility;
  readonly dependency?: IModelDependency;
  readonly requirement?: IModelRequirement;
  readonly model?: IModel;
  readonly context?: IModelCompatibilityContext;
}

export interface IResolveModelCompatibilityResult {
  readonly mode: ResolveModelCompatibilityMode;
  readonly compatibility: ReturnType<IModelCompatibilityService["evaluateModelReadiness"]>;
}

export class ResolveModelCompatibilityUseCase {
  private readonly modelCompatibilityService: IModelCompatibilityService;

  constructor(modelCompatibilityService: IModelCompatibilityService) {
    this.modelCompatibilityService = modelCompatibilityService;
  }

  public execute(
    request: IResolveModelCompatibilityRequest
  ): IResolveModelCompatibilityResult {
    switch (request.mode) {
      case "model-to-model": {
        if (!request.sourceModel || !request.targetModel) {
          throw new Error(
            "ResolveModelCompatibilityUseCase(model-to-model) requires sourceModel and targetModel."
          );
        }

        return Object.freeze({
          mode: request.mode,
          compatibility:
            this.modelCompatibilityService.evaluateModelToModelCompatibility(
              request.sourceModel,
              request.targetModel,
              request.context
            ),
        });
      }

      case "model-to-profile": {
        if (!request.model || !request.targetProfile) {
          throw new Error(
            "ResolveModelCompatibilityUseCase(model-to-profile) requires model and targetProfile."
          );
        }

        return Object.freeze({
          mode: request.mode,
          compatibility:
            this.modelCompatibilityService.evaluateModelToProfileCompatibility(
              request.model,
              request.targetProfile,
              request.context
            ),
        });
      }

      case "profile-to-profile": {
        if (!request.sourceProfile || !request.targetProfile) {
          throw new Error(
            "ResolveModelCompatibilityUseCase(profile-to-profile) requires sourceProfile and targetProfile."
          );
        }

        return Object.freeze({
          mode: request.mode,
          compatibility:
            this.modelCompatibilityService.evaluateProfileToProfileCompatibility(
              request.sourceProfile,
              request.targetProfile,
              request.context
            ),
        });
      }

      case "dependency": {
        if (!request.dependency || !request.model) {
          throw new Error(
            "ResolveModelCompatibilityUseCase(dependency) requires dependency and model."
          );
        }

        return Object.freeze({
          mode: request.mode,
          compatibility:
            this.modelCompatibilityService.evaluateDependencyCompatibility(
              request.dependency,
              request.model,
              request.context
            ),
        });
      }

      case "requirement": {
        if (!request.requirement || !request.model) {
          throw new Error(
            "ResolveModelCompatibilityUseCase(requirement) requires requirement and model."
          );
        }

        return Object.freeze({
          mode: request.mode,
          compatibility:
            this.modelCompatibilityService.evaluateRequirementCompatibility(
              request.requirement,
              request.model,
              request.context
            ),
        });
      }

      case "readiness": {
        if (!request.model) {
          throw new Error(
            "ResolveModelCompatibilityUseCase(readiness) requires model."
          );
        }

        return Object.freeze({
          mode: request.mode,
          compatibility:
            this.modelCompatibilityService.evaluateModelReadiness(
              request.model,
              request.context
            ),
        });
      }

      default: {
        const exhaustive: never = request.mode;
        throw new Error(`Unsupported compatibility mode '${String(exhaustive)}'.`);
      }
    }
  }
}


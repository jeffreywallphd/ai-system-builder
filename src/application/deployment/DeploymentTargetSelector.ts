import type { DeploymentTarget } from "@domain/deployment/DeploymentTargetDomain";
import type { SystemPackage } from "@domain/system-packaging/SystemPackagingDomain";
import {
  DeploymentTargetCompatibilityValidator,
  type DeploymentTargetCompatibilityResult,
} from "./DeploymentTargetCompatibilityValidator";

export interface DeploymentTargetSelectionResult {
  readonly selectedTarget?: DeploymentTarget;
  readonly evaluations: ReadonlyArray<{
    readonly target: DeploymentTarget;
    readonly compatibility: DeploymentTargetCompatibilityResult;
  }>;
}

export class DeploymentTargetSelector {
  public constructor(
    private readonly validator: DeploymentTargetCompatibilityValidator = new DeploymentTargetCompatibilityValidator(),
  ) {}

  public selectTarget(input: {
    readonly systemPackage: SystemPackage;
    readonly targets: ReadonlyArray<DeploymentTarget>;
    readonly preferredTargetId?: string;
  }): DeploymentTargetSelectionResult {
    const evaluations = input.targets.map((target) => Object.freeze({
      target,
      compatibility: this.validator.validate({ systemPackage: input.systemPackage, target }),
    }));

    const preferredTargetId = input.preferredTargetId?.trim();
    const preferredCompatible = preferredTargetId
      ? evaluations.find((entry) => entry.target.targetId.value === preferredTargetId && entry.compatibility.compatible)
      : undefined;

    const selectedTarget = preferredCompatible?.target
      ?? evaluations.find((entry) => entry.compatibility.compatible)?.target;

    return Object.freeze({
      selectedTarget,
      evaluations: Object.freeze(evaluations),
    });
  }
}


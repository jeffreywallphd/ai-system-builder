import type { SystemPackage } from "../../domain/system-packaging/SystemPackagingDomain";
import type { DeploymentTarget } from "../../domain/deployment/DeploymentTargetDomain";

export interface DeploymentTargetCompatibilityResult {
  readonly compatible: boolean;
  readonly issues: ReadonlyArray<{
    readonly code:
      | "nested-systems-not-supported"
      | "dependency-depth-exceeded"
      | "runtime-environment-unsupported"
      | "runtime-requirements-missing"
      | "export-target-unsupported";
    readonly message: string;
  }>;
}

function includesAll(required: ReadonlyArray<string>, provided: ReadonlyArray<string>): boolean {
  const available = new Set(provided.map((entry) => entry.trim()));
  return required.every((entry) => available.has(entry.trim()));
}

export class DeploymentTargetCompatibilityValidator {
  public validate(input: {
    readonly systemPackage: SystemPackage;
    readonly target: DeploymentTarget;
  }): DeploymentTargetCompatibilityResult {
    const issues: DeploymentTargetCompatibilityResult["issues"] = [];
    const requirements = input.systemPackage.manifest.requirements;
    const capabilities = input.target.capabilities;

    if (requirements.requiresNestedSystemSupport && !capabilities.supportsNestedSystems) {
      issues.push(Object.freeze({
        code: "nested-systems-not-supported",
        message: `Target '${input.target.name}' does not support nested systems.`,
      }));
    }

    if (requirements.maxDependencyDepth > capabilities.maxDependencyDepth) {
      issues.push(Object.freeze({
        code: "dependency-depth-exceeded",
        message: `Package dependency depth ${requirements.maxDependencyDepth} exceeds target limit ${capabilities.maxDependencyDepth}.`,
      }));
    }

    if (
      requirements.runtimeEnvironment
      && capabilities.supportedRuntimeEnvironments.length > 0
      && !capabilities.supportedRuntimeEnvironments.includes(requirements.runtimeEnvironment)
    ) {
      issues.push(Object.freeze({
        code: "runtime-environment-unsupported",
        message: `Target '${input.target.name}' does not support runtime environment '${requirements.runtimeEnvironment}'.`,
      }));
    }

    if (!includesAll(requirements.runtimeRequirements, capabilities.providedRuntimeRequirements)) {
      issues.push(Object.freeze({
        code: "runtime-requirements-missing",
        message: `Target '${input.target.name}' is missing one or more runtime requirements from the package manifest.`,
      }));
    }

    if (
      requirements.exportTargets.length > 0
      && capabilities.supportedExportTargets.length > 0
      && !includesAll(requirements.exportTargets, capabilities.supportedExportTargets)
    ) {
      issues.push(Object.freeze({
        code: "export-target-unsupported",
        message: `Target '${input.target.name}' does not support one or more package export targets.`,
      }));
    }

    return Object.freeze({
      compatible: issues.length === 0,
      issues: Object.freeze(issues),
    });
  }
}

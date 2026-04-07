import type { DeploymentTarget } from "@domain/deployment/DeploymentTargetDomain";
import type { DeploymentConfigurationContract } from "@domain/deployment/DeploymentConfigurationDomain";
import type { SystemPackage } from "@domain/system-packaging/SystemPackagingDomain";
import { DeploymentTargetCompatibilityValidator } from "./DeploymentTargetCompatibilityValidator";

export interface DeploymentConfigurationValidationIssue {
  readonly code:
    | "package-mismatch"
    | "target-mismatch"
    | "target-type-mismatch"
    | "missing-required-deployment-setting"
    | "missing-required-runtime-setting"
    | "unsupported-deployment-setting"
    | "unsupported-runtime-setting"
    | "runtime-environment-unsupported"
    | "runtime-requirements-missing"
    | "nested-binding-system-not-in-package"
    | "package-target-incompatible";
  readonly message: string;
}

export interface DeploymentConfigurationValidationResult {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<DeploymentConfigurationValidationIssue>;
}

function includesAll(required: ReadonlyArray<string>, provided: ReadonlyArray<string>): boolean {
  const available = new Set(provided.map((entry) => entry.trim()));
  return required.every((entry) => available.has(entry.trim()));
}

function missingRequired(required: ReadonlyArray<string>, actual: Readonly<Record<string, string>>): ReadonlyArray<string> {
  const keys = new Set(Object.keys(actual));
  return Object.freeze(required.filter((entry) => !keys.has(entry)).sort((left, right) => left.localeCompare(right)));
}

function unsupportedKeys(input: {
  readonly values: Readonly<Record<string, string>>;
  readonly allowed: ReadonlyArray<string>;
}): ReadonlyArray<string> {
  const allowed = new Set(input.allowed);
  return Object.freeze(Object.keys(input.values).filter((entry) => !allowed.has(entry)).sort((left, right) => left.localeCompare(right)));
}

export class DeploymentConfigurationValidator {
  public constructor(
    private readonly compatibilityValidator: DeploymentTargetCompatibilityValidator = new DeploymentTargetCompatibilityValidator(),
  ) {}

  public validate(input: {
    readonly systemPackage: SystemPackage;
    readonly target: DeploymentTarget;
    readonly deploymentConfiguration: DeploymentConfigurationContract;
  }): DeploymentConfigurationValidationResult {
    const issues: DeploymentConfigurationValidationIssue[] = [];
    const { systemPackage, target, deploymentConfiguration } = input;

    const compatibility = this.compatibilityValidator.validate({ systemPackage, target });
    for (const issue of compatibility.issues) {
      issues.push(Object.freeze({
        code: "package-target-incompatible",
        message: issue.message,
      }));
    }

    if (deploymentConfiguration.packageId !== systemPackage.packageId.value) {
      issues.push(Object.freeze({
        code: "package-mismatch",
        message: "Deployment configuration package id does not match the selected package.",
      }));
    }

    if (
      deploymentConfiguration.rootSystemAssetId !== systemPackage.manifest.rootSystemAssetId
      || deploymentConfiguration.rootSystemVersionId !== systemPackage.manifest.rootSystemVersionId
    ) {
      issues.push(Object.freeze({
        code: "package-mismatch",
        message: "Deployment configuration root system identity does not match the package manifest.",
      }));
    }

    if (deploymentConfiguration.targetId.value !== target.targetId.value) {
      issues.push(Object.freeze({
        code: "target-mismatch",
        message: "Deployment configuration target id does not match the selected deployment target.",
      }));
    }

    if (deploymentConfiguration.targetType !== target.type) {
      issues.push(Object.freeze({
        code: "target-type-mismatch",
        message: "Deployment configuration target type does not match the selected deployment target.",
      }));
    }

    const missingDeployment = missingRequired(
      deploymentConfiguration.schema.requiredDeploymentSettings,
      deploymentConfiguration.valueSet.deploymentSettings,
    );
    for (const key of missingDeployment) {
      issues.push(Object.freeze({
        code: "missing-required-deployment-setting",
        message: `Deployment setting '${key}' is required by the deployment configuration schema.`,
      }));
    }

    const missingRuntime = missingRequired(
      deploymentConfiguration.schema.requiredRuntimeSettings,
      deploymentConfiguration.valueSet.runtimeSettings,
    );
    for (const key of missingRuntime) {
      issues.push(Object.freeze({
        code: "missing-required-runtime-setting",
        message: `Runtime setting '${key}' is required by the deployment configuration schema.`,
      }));
    }

    const schemaAllowedDeployment = [
      ...deploymentConfiguration.schema.requiredDeploymentSettings,
      ...deploymentConfiguration.schema.optionalDeploymentSettings,
    ];
    const schemaAllowedRuntime = [
      ...deploymentConfiguration.schema.requiredRuntimeSettings,
      ...deploymentConfiguration.schema.optionalRuntimeSettings,
    ];

    for (const key of unsupportedKeys({ values: deploymentConfiguration.valueSet.deploymentSettings, allowed: schemaAllowedDeployment })) {
      issues.push(Object.freeze({
        code: "unsupported-deployment-setting",
        message: `Deployment setting '${key}' is not defined by the deployment configuration schema.`,
      }));
    }

    for (const key of unsupportedKeys({ values: deploymentConfiguration.valueSet.runtimeSettings, allowed: schemaAllowedRuntime })) {
      issues.push(Object.freeze({
        code: "unsupported-runtime-setting",
        message: `Runtime setting '${key}' is not defined by the deployment configuration schema.`,
      }));
    }

    if (target.capabilities.supportedDeploymentSettings.length > 0) {
      for (const key of unsupportedKeys({
        values: deploymentConfiguration.valueSet.deploymentSettings,
        allowed: target.capabilities.supportedDeploymentSettings,
      })) {
        issues.push(Object.freeze({
          code: "unsupported-deployment-setting",
          message: `Deployment setting '${key}' is not supported by target '${target.name}'.`,
        }));
      }
    }

    if (target.capabilities.supportedRuntimeSettings.length > 0) {
      for (const key of unsupportedKeys({
        values: deploymentConfiguration.valueSet.runtimeSettings,
        allowed: target.capabilities.supportedRuntimeSettings,
      })) {
        issues.push(Object.freeze({
          code: "unsupported-runtime-setting",
          message: `Runtime setting '${key}' is not supported by target '${target.name}'.`,
        }));
      }
    }

    const runtimeEnvironment = deploymentConfiguration.valueSet.runtimeSettings.runtimeEnvironment;
    if (
      runtimeEnvironment
      && target.capabilities.supportedRuntimeEnvironments.length > 0
      && !target.capabilities.supportedRuntimeEnvironments.includes(runtimeEnvironment)
    ) {
      issues.push(Object.freeze({
        code: "runtime-environment-unsupported",
        message: `Runtime environment '${runtimeEnvironment}' is not supported by target '${target.name}'.`,
      }));
    }

    const runtimeRequirements = (deploymentConfiguration.valueSet.runtimeSettings.runtimeRequirements ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (runtimeRequirements.length > 0 && !includesAll(runtimeRequirements, target.capabilities.providedRuntimeRequirements)) {
      issues.push(Object.freeze({
        code: "runtime-requirements-missing",
        message: `Target '${target.name}' is missing one or more runtime requirements from deployment configuration.`,
      }));
    }

    const packageSystemIds = new Set(systemPackage.manifest.dependencyGraph.nodes
      .filter((entry) => entry.structuralKind === "system")
      .map((entry) => `${entry.assetId}::${entry.versionId ?? ""}`));
    packageSystemIds.add(`${systemPackage.manifest.rootSystemAssetId}::${systemPackage.manifest.rootSystemVersionId}`);

    for (const binding of deploymentConfiguration.nestedSystemBindings) {
      const key = `${binding.systemAssetId}::${binding.systemVersionId ?? ""}`;
      const byAssetOnly = [...packageSystemIds].some((entry) => entry.startsWith(`${binding.systemAssetId}::`));
      if (!packageSystemIds.has(key) && !byAssetOnly) {
        issues.push(Object.freeze({
          code: "nested-binding-system-not-in-package",
          message: `Nested deployment configuration references system '${binding.systemAssetId}' that is not present in package dependency graph.`,
        }));
      }
    }

    return Object.freeze({
      valid: issues.length === 0,
      issues: Object.freeze(issues),
    });
  }
}


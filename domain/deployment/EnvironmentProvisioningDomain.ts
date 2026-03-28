import { createHash } from "node:crypto";
import type { DeploymentBundle } from "./DeploymentBundleDomain";
import type { DeploymentConfigurationContract } from "./DeploymentConfigurationDomain";
import type { DeploymentTarget, DeploymentTargetType } from "./DeploymentTargetDomain";

export const EnvironmentProvisioningStatuses = Object.freeze({
  ready: "ready",
  failed: "failed",
});

export type EnvironmentProvisioningStatus = typeof EnvironmentProvisioningStatuses[keyof typeof EnvironmentProvisioningStatuses];

export interface EnvironmentProvisioningRequest {
  readonly requestId: string;
  readonly bundle: DeploymentBundle;
  readonly deploymentConfiguration: DeploymentConfigurationContract;
  readonly target: DeploymentTarget;
  readonly requestedAt: string;
}

export interface EnvironmentProvisioningPlan {
  readonly planId: string;
  readonly targetId: string;
  readonly targetType: DeploymentTargetType;
  readonly requiredEnvironmentCapabilities: ReadonlyArray<string>;
  readonly steps: ReadonlyArray<{
    readonly stepId: string;
    readonly category: "target-verification" | "runtime-capability-alignment" | "environment-settings-application" | "bundle-preflight";
    readonly description: string;
  }>;
  readonly deterministicKey: string;
}

export interface ProvisionedDeploymentEnvironment {
  readonly environmentId: string;
  readonly targetId: string;
  readonly targetType: DeploymentTargetType;
  readonly bundleId: string;
  readonly bundleReproducibilityKey: string;
  readonly deploymentConfigurationId: string;
  readonly provisioningPlanId: string;
  readonly deterministicKey: string;
  readonly capabilitySnapshot: ReadonlyArray<string>;
  readonly provisionedAt: string;
}

export interface EnvironmentProvisioningResult {
  readonly requestId: string;
  readonly status: EnvironmentProvisioningStatus;
  readonly plan: EnvironmentProvisioningPlan;
  readonly provisionedEnvironment?: ProvisionedDeploymentEnvironment;
  readonly issues: ReadonlyArray<{ readonly code: string; readonly message: string }>;
}

export interface EnvironmentProvisioningInterface {
  provision(request: EnvironmentProvisioningRequest): EnvironmentProvisioningResult;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeCapabilities(input: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set(input.map((entry) => entry.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right)));
}

export function deriveProvisioningCapabilities(input: {
  readonly target: DeploymentTarget;
  readonly deploymentConfiguration: DeploymentConfigurationContract;
  readonly bundle: DeploymentBundle;
}): ReadonlyArray<string> {
  const runtimeEnvironment = input.deploymentConfiguration.valueSet.runtimeSettings.runtimeEnvironment?.trim();
  const runtimeRequirements = (input.deploymentConfiguration.valueSet.runtimeSettings.runtimeRequirements ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return normalizeCapabilities([
    ...(runtimeEnvironment ? [`runtime-environment:${runtimeEnvironment}`] : []),
    ...runtimeRequirements.map((entry) => `runtime-requirement:${entry}`),
    ...input.target.capabilities.supportedDeploymentSettings.map((entry) => `deployment-setting:${entry}`),
    ...input.target.capabilities.supportedRuntimeSettings.map((entry) => `runtime-setting:${entry}`),
    input.bundle.manifest.package.dependencyVersionSnapshot.some((entry) => entry.assetId.startsWith("system:"))
      ? "supports-nested-system-bundle"
      : "supports-flat-system-bundle",
  ]);
}

export function createEnvironmentProvisioningPlan(input: {
  readonly target: DeploymentTarget;
  readonly deploymentConfiguration: DeploymentConfigurationContract;
  readonly bundle: DeploymentBundle;
}): EnvironmentProvisioningPlan {
  const targetId = normalizeRequired(input.target.targetId.value, "Provisioning plan target id");
  const requiredEnvironmentCapabilities = deriveProvisioningCapabilities(input);

  const steps = Object.freeze([
    Object.freeze({
      stepId: "step:target-verification",
      category: "target-verification" as const,
      description: `Verify deployment target '${input.target.name}' capabilities and category alignment.`,
    }),
    Object.freeze({
      stepId: "step:runtime-capability-alignment",
      category: "runtime-capability-alignment" as const,
      description: "Validate runtime environment requirements and runtime setting compatibility.",
    }),
    Object.freeze({
      stepId: "step:environment-settings-application",
      category: "environment-settings-application" as const,
      description: "Apply deployment and runtime settings contract to the target environment scope.",
    }),
    Object.freeze({
      stepId: "step:bundle-preflight",
      category: "bundle-preflight" as const,
      description: "Prepare deployment bundle preflight metadata for deterministic activation.",
    }),
  ]);

  const deterministicPayload = JSON.stringify({
    targetId,
    targetType: input.target.type,
    bundleId: input.bundle.bundleId.value,
    bundleBuildKey: input.bundle.manifest.build.reproducibilityKey,
    configurationId: input.deploymentConfiguration.configurationId.value,
    requiredEnvironmentCapabilities,
    steps: steps.map((entry) => `${entry.stepId}:${entry.category}`),
  });
  const deterministicKey = createHash("sha256").update(deterministicPayload).digest("hex");

  return Object.freeze({
    planId: `provisioning-plan:${input.target.type}:${deterministicKey.slice(0, 18)}`,
    targetId,
    targetType: input.target.type,
    requiredEnvironmentCapabilities,
    steps,
    deterministicKey,
  });
}

export function createProvisionedDeploymentEnvironment(input: {
  readonly target: DeploymentTarget;
  readonly bundle: DeploymentBundle;
  readonly deploymentConfiguration: DeploymentConfigurationContract;
  readonly plan: EnvironmentProvisioningPlan;
  readonly provisionedAt: string;
}): ProvisionedDeploymentEnvironment {
  const deterministicPayload = JSON.stringify({
    targetId: input.target.targetId.value,
    targetType: input.target.type,
    bundleId: input.bundle.bundleId.value,
    buildKey: input.bundle.manifest.build.reproducibilityKey,
    configurationId: input.deploymentConfiguration.configurationId.value,
    planDeterministicKey: input.plan.deterministicKey,
  });
  const deterministicKey = createHash("sha256").update(deterministicPayload).digest("hex");

  return Object.freeze({
    environmentId: `provisioned-env:${input.target.type}:${deterministicKey.slice(0, 20)}`,
    targetId: input.target.targetId.value,
    targetType: input.target.type,
    bundleId: input.bundle.bundleId.value,
    bundleReproducibilityKey: input.bundle.manifest.build.reproducibilityKey,
    deploymentConfigurationId: input.deploymentConfiguration.configurationId.value,
    provisioningPlanId: input.plan.planId,
    deterministicKey,
    capabilitySnapshot: input.plan.requiredEnvironmentCapabilities,
    provisionedAt: normalizeRequired(input.provisionedAt, "Provisioned deployment environment provisionedAt"),
  });
}

export function createEnvironmentProvisioningRequest(input: EnvironmentProvisioningRequest): EnvironmentProvisioningRequest {
  return Object.freeze({
    requestId: normalizeRequired(input.requestId, "Environment provisioning request id"),
    bundle: input.bundle,
    deploymentConfiguration: input.deploymentConfiguration,
    target: input.target,
    requestedAt: normalizeRequired(input.requestedAt, "Environment provisioning requestedAt"),
  });
}

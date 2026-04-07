import type { DeploymentBundle } from "@domain/deployment/DeploymentBundleDomain";
import type { DeploymentConfigurationContract } from "@domain/deployment/DeploymentConfigurationDomain";
import type { DeploymentTarget } from "@domain/deployment/DeploymentTargetDomain";
import { createSystemPackage } from "@domain/system-packaging/SystemPackagingDomain";
import { DeploymentConfigurationValidator } from "./DeploymentConfigurationValidator";

export interface EnvironmentProvisioningCompatibilityResult {
  readonly compatible: boolean;
  readonly issues: ReadonlyArray<{
    readonly code:
      | "bundle-target-mismatch"
      | "bundle-configuration-mismatch"
      | "bundle-root-system-mismatch"
      | "configuration-target-mismatch"
      | "target-capability-mismatch"
      | "target-type-unsupported";
    readonly message: string;
  }>;
}

export class EnvironmentProvisioningCompatibilityValidator {
  public constructor(
    private readonly configurationValidator: DeploymentConfigurationValidator = new DeploymentConfigurationValidator(),
  ) {}

  public validate(input: {
    readonly bundle: DeploymentBundle;
    readonly deploymentConfiguration: DeploymentConfigurationContract;
    readonly target: DeploymentTarget;
  }): EnvironmentProvisioningCompatibilityResult {
    const issues: EnvironmentProvisioningCompatibilityResult["issues"][number][] = [];

    if (!(["local", "cloud", "edge"] as const).includes(input.target.type)) {
      issues.push(Object.freeze({
        code: "target-type-unsupported",
        message: `Deployment target type '${input.target.type}' is not supported by the provisioning interface.`,
      }));
    }

    if (input.bundle.manifest.target.targetId !== input.target.targetId.value || input.bundle.manifest.target.targetType !== input.target.type) {
      issues.push(Object.freeze({
        code: "bundle-target-mismatch",
        message: "Deployment bundle target identity/type does not match the selected target.",
      }));
    }

    if (input.bundle.manifest.deploymentConfiguration.configurationId !== input.deploymentConfiguration.configurationId.value) {
      issues.push(Object.freeze({
        code: "bundle-configuration-mismatch",
        message: "Deployment bundle does not reference the supplied deployment configuration.",
      }));
    }

    if (
      input.bundle.manifest.package.rootSystemAssetId !== input.deploymentConfiguration.rootSystemAssetId
      || input.bundle.manifest.package.rootSystemVersionId !== input.deploymentConfiguration.rootSystemVersionId
    ) {
      issues.push(Object.freeze({
        code: "bundle-root-system-mismatch",
        message: "Deployment bundle root system identity/version does not match deployment configuration.",
      }));
    }

    if (
      input.deploymentConfiguration.targetId.value !== input.target.targetId.value
      || input.deploymentConfiguration.targetType !== input.target.type
    ) {
      issues.push(Object.freeze({
        code: "configuration-target-mismatch",
        message: "Deployment configuration target identity/type does not match selected target.",
      }));
    }

    const configuredRuntimeEnvironment = input.deploymentConfiguration.valueSet.runtimeSettings.runtimeEnvironment?.trim();
    const configuredRuntimeRequirements = (input.deploymentConfiguration.valueSet.runtimeSettings.runtimeRequirements ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const nestedSystemNodes = input.bundle.manifest.package.dependencyVersionSnapshot
      .filter((entry) => entry.assetId.startsWith("system:"))
      .map((entry, index) => Object.freeze({
        nodeId: `nested:${index}:${entry.assetId}`,
        assetId: entry.assetId,
        versionId: entry.versionId,
        structuralKind: "system" as const,
        relation: "component" as const,
        discoveredAtDepth: Math.max(1, entry.discoveredAtDepth),
        parentNodeId: "root",
      }));

    const pseudoPackage = createSystemPackage({
      packageId: input.bundle.manifest.package.packageId,
      manifest: {
        rootSystemAssetId: input.bundle.manifest.package.rootSystemAssetId,
        rootSystemVersionId: input.bundle.manifest.package.rootSystemVersionId,
        dependencyGraph: {
          nodes: [
            {
              nodeId: "root",
              assetId: input.bundle.manifest.package.rootSystemAssetId,
              versionId: input.bundle.manifest.package.rootSystemVersionId,
              structuralKind: "system",
              relation: "root",
              discoveredAtDepth: 0,
            },
            ...nestedSystemNodes,
          ],
          edges: nestedSystemNodes.map((node) => Object.freeze({
            fromNodeId: "root",
            toNodeId: node.nodeId,
            relation: "contains" as const,
          })),
        },
        dependencyVersionSnapshot: input.bundle.manifest.package.dependencyVersionSnapshot,
        requirements: {
          runtimeEnvironment: configuredRuntimeEnvironment,
          runtimeRequirements: configuredRuntimeRequirements,
          exportTargets: [],
          requiresNestedSystemSupport: input.bundle.manifest.package.dependencyVersionSnapshot.some((entry) => entry.assetId.startsWith("system:")),
          maxDependencyDepth: Math.max(0, ...input.bundle.manifest.package.dependencyVersionSnapshot.map((entry) => entry.discoveredAtDepth)),
        },
        lineage: { upstreamVersionIds: [] },
        recursion: { status: "complete", unresolvedNestedSystemCount: 0, maxDepth: 1 },
        packagingMetadata: {
          packagingVersion: "v1",
          packagedAt: input.bundle.manifest.build.builtAt,
          determinismKey: input.bundle.manifest.package.packageDeterminismKey,
        },
      },
    });

    const configurationValidation = this.configurationValidator.validate({
      systemPackage: pseudoPackage,
      target: input.target,
      deploymentConfiguration: input.deploymentConfiguration,
    });
    if (!configurationValidation.valid) {
      issues.push(...configurationValidation.issues.map((issue) => Object.freeze({
        code: "target-capability-mismatch" as const,
        message: issue.message,
      })));
    }

    return Object.freeze({ compatible: issues.length === 0, issues: Object.freeze(issues) });
  }
}


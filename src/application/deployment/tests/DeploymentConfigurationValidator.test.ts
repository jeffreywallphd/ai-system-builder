import { describe, expect, it } from "bun:test";
import {
  createDeploymentConfigurationContract,
} from "../../../domain/deployment/DeploymentConfigurationDomain";
import {
  createDeploymentTarget,
  DeploymentTargetTypes,
} from "../../../domain/deployment/DeploymentTargetDomain";
import { createSystemPackage } from "../../../domain/system-packaging/SystemPackagingDomain";
import { DeploymentConfigurationValidator } from "../DeploymentConfigurationValidator";

function createSamplePackage() {
  return createSystemPackage({
    packageId: "system-package:system:root:v7:v1:abc123",
    manifest: {
      rootSystemAssetId: "system:root",
      rootSystemVersionId: "system:root:v7",
      dependencyGraph: {
        nodes: [
          { nodeId: "root", assetId: "system:root", versionId: "system:root:v7", structuralKind: "system", relation: "root", discoveredAtDepth: 0 },
          { nodeId: "nested", assetId: "system:child", versionId: "system:child:v3", structuralKind: "system", relation: "component", discoveredAtDepth: 1, parentNodeId: "root" },
        ],
        edges: [{ fromNodeId: "root", toNodeId: "nested", relation: "contains" }],
      },
      dependencyVersionSnapshot: [
        { assetId: "system:child", versionId: "system:child:v3", relation: "direct", discoveredInSystemAssetId: "system:root", discoveredAtDepth: 1 },
      ],
      requirements: {
        runtimeEnvironment: "container",
        runtimeRequirements: ["network"],
        exportTargets: ["registry"],
        requiresNestedSystemSupport: true,
        maxDependencyDepth: 2,
      },
      lineage: {
        upstreamVersionIds: ["asset:model:v1"],
      },
      recursion: {
        status: "complete",
        unresolvedNestedSystemCount: 0,
        maxDepth: 3,
      },
      packagingMetadata: {
        packagingVersion: "v1",
        packagedAt: "2026-03-28T08:00:00.000Z",
        determinismKey: "package-det-key",
      },
    },
  });
}

function createSampleTarget() {
  return createDeploymentTarget({
    targetId: "target:cloud-generic",
    name: "Cloud Generic",
    type: DeploymentTargetTypes.cloud,
    capabilities: {
      supportsNestedSystems: true,
      maxDependencyDepth: 5,
      supportedRuntimeEnvironments: ["container"],
      providedRuntimeRequirements: ["network", "gpu"],
      supportedExportTargets: ["registry", "archive"],
      supportedDeploymentSettings: ["region", "namespace"],
      supportedRuntimeSettings: ["runtimeEnvironment", "runtimeRequirements"],
    },
  });
}

describe("DeploymentConfigurationValidator", () => {
  it("accepts valid package/target-aligned deployment configuration contracts", () => {
    const systemPackage = createSamplePackage();
    const target = createSampleTarget();
    const contract = createDeploymentConfigurationContract({
      configurationId: "deploy-config:1",
      packageId: systemPackage.packageId.value,
      rootSystemAssetId: systemPackage.manifest.rootSystemAssetId,
      rootSystemVersionId: systemPackage.manifest.rootSystemVersionId,
      targetId: target.targetId.value,
      targetType: target.type,
      schema: {
        schemaId: "schema:deployment:v1",
        schemaVersion: "v1",
        requiredDeploymentSettings: ["region"],
        optionalDeploymentSettings: ["namespace"],
        requiredRuntimeSettings: ["runtimeEnvironment"],
        optionalRuntimeSettings: ["runtimeRequirements"],
      },
      valueSet: {
        deploymentSettings: { region: "us-east-1", namespace: "prod" },
        runtimeSettings: { runtimeEnvironment: "container", runtimeRequirements: "network" },
      },
      nestedSystemBindings: [
        {
          systemAssetId: "system:child",
          systemVersionId: "system:child:v3",
          valueSet: {
            deploymentSettings: { namespace: "child" },
            runtimeSettings: { runtimeEnvironment: "container" },
          },
        },
      ],
      createdAt: "2026-03-28T08:30:00.000Z",
    });

    const validator = new DeploymentConfigurationValidator();
    const result = validator.validate({ systemPackage, target, deploymentConfiguration: contract });

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("rejects incomplete and incompatible deployment configuration contracts", () => {
    const systemPackage = createSamplePackage();
    const target = createSampleTarget();
    const contract = createDeploymentConfigurationContract({
      configurationId: "deploy-config:bad",
      packageId: "system-package:other",
      rootSystemAssetId: "system:root",
      rootSystemVersionId: "system:root:v7",
      targetId: target.targetId.value,
      targetType: target.type,
      schema: {
        schemaId: "schema:deployment:v1",
        schemaVersion: "v1",
        requiredDeploymentSettings: ["region"],
        optionalDeploymentSettings: [],
        requiredRuntimeSettings: ["runtimeEnvironment"],
        optionalRuntimeSettings: [],
      },
      valueSet: {
        deploymentSettings: { unsupported: "x" },
        runtimeSettings: { runtimeEnvironment: "edge" },
      },
      nestedSystemBindings: [{ systemAssetId: "system:unknown" }],
      createdAt: "2026-03-28T08:30:00.000Z",
    });

    const validator = new DeploymentConfigurationValidator();
    const result = validator.validate({ systemPackage, target, deploymentConfiguration: contract });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("package-mismatch");
    expect(result.issues.map((issue) => issue.code)).toContain("missing-required-deployment-setting");
    expect(result.issues.map((issue) => issue.code)).toContain("unsupported-deployment-setting");
    expect(result.issues.map((issue) => issue.code)).toContain("runtime-environment-unsupported");
    expect(result.issues.map((issue) => issue.code)).toContain("nested-binding-system-not-in-package");
  });
});

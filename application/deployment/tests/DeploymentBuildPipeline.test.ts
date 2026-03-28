import { describe, expect, it } from "bun:test";
import {
  createDeploymentConfigurationContract,
} from "../../../domain/deployment/DeploymentConfigurationDomain";
import {
  createDeploymentTarget,
  DeploymentTargetTypes,
} from "../../../domain/deployment/DeploymentTargetDomain";
import { createSystemPackage } from "../../../domain/system-packaging/SystemPackagingDomain";
import { DeploymentBuildPipeline } from "../DeploymentBuildPipeline";

function createSamplePackage() {
  return createSystemPackage({
    packageId: "system-package:system:root:v7:v1:abc123",
    manifest: {
      rootSystemAssetId: "system:root",
      rootSystemVersionId: "system:root:v7",
      dependencyGraph: {
        nodes: [
          { nodeId: "root", assetId: "system:root", versionId: "system:root:v7", structuralKind: "system", relation: "root", discoveredAtDepth: 0 },
          { nodeId: "child", assetId: "system:child", versionId: "system:child:v1", structuralKind: "system", relation: "component", discoveredAtDepth: 1, parentNodeId: "root" },
        ],
        edges: [{ fromNodeId: "root", toNodeId: "child", relation: "contains" }],
      },
      dependencyVersionSnapshot: [
        { assetId: "asset:model", versionId: "asset:model:v2", relation: "direct", discoveredInSystemAssetId: "system:root", discoveredAtDepth: 1 },
        { assetId: "system:child", versionId: "system:child:v1", relation: "direct", discoveredInSystemAssetId: "system:root", discoveredAtDepth: 1 },
      ],
      requirements: {
        runtimeEnvironment: "container",
        runtimeRequirements: ["network"],
        exportTargets: ["registry"],
        requiresNestedSystemSupport: true,
        maxDependencyDepth: 2,
      },
      lineage: {
        upstreamVersionIds: ["asset:model:v2"],
      },
      recursion: {
        status: "complete",
        unresolvedNestedSystemCount: 0,
        maxDepth: 3,
      },
      packagingMetadata: {
        packagingVersion: "v1",
        packagedAt: "2026-03-28T11:00:00.000Z",
        determinismKey: "package-det-key-123",
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

function createValidConfiguration() {
  const systemPackage = createSamplePackage();
  const target = createSampleTarget();
  return {
    systemPackage,
    target,
    deploymentConfiguration: createDeploymentConfigurationContract({
      configurationId: "deploy-config:bundle",
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
        runtimeSettings: { runtimeEnvironment: "container", runtimeRequirements: "network,gpu" },
      },
      nestedSystemBindings: [{ systemAssetId: "system:child", systemVersionId: "system:child:v1" }],
      createdAt: "2026-03-28T11:05:00.000Z",
    }),
  };
}

describe("DeploymentBuildPipeline", () => {
  it("produces deterministic bundle ids and reproducibility metadata for same inputs", () => {
    const request = createValidConfiguration();
    const pipelineA = new DeploymentBuildPipeline(undefined, () => new Date("2026-03-28T11:10:00.000Z"));
    const pipelineB = new DeploymentBuildPipeline(undefined, () => new Date("2026-03-28T12:10:00.000Z"));

    const first = pipelineA.build(request);
    const second = pipelineB.build(request);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.bundle?.bundleId.value).toBe(second.bundle?.bundleId.value);
    expect(first.bundle?.manifest.build.reproducibilityKey).toBe(second.bundle?.manifest.build.reproducibilityKey);
    expect(first.bundle?.manifest.build.builtAt).not.toBe(second.bundle?.manifest.build.builtAt);
    expect(first.bundle?.manifest.package.rootSystemVersionId).toBe("system:root:v7");
  });

  it("fails before bundle generation when configuration is invalid", () => {
    const request = createValidConfiguration();
    const pipeline = new DeploymentBuildPipeline();
    const invalid = createDeploymentConfigurationContract({
      configurationId: "deploy-config:invalid",
      packageId: request.systemPackage.packageId.value,
      rootSystemAssetId: request.systemPackage.manifest.rootSystemAssetId,
      rootSystemVersionId: request.systemPackage.manifest.rootSystemVersionId,
      targetId: request.target.targetId.value,
      targetType: request.target.type,
      schema: {
        schemaId: "schema:deployment:v1",
        schemaVersion: "v1",
        requiredDeploymentSettings: ["region"],
        optionalDeploymentSettings: [],
        requiredRuntimeSettings: ["runtimeEnvironment"],
        optionalRuntimeSettings: [],
      },
      valueSet: {
        deploymentSettings: {},
        runtimeSettings: { runtimeEnvironment: "container" },
      },
      createdAt: "2026-03-28T11:15:00.000Z",
    });

    const result = pipeline.build({ ...request, deploymentConfiguration: invalid });

    expect(result.ok).toBe(false);
    expect(result.bundle).toBeUndefined();
    expect(result.issues.map((issue) => issue.code)).toContain("missing-required-deployment-setting");
  });
});

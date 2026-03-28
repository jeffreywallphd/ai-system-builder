import { describe, expect, it } from "bun:test";
import {
  createDeploymentTarget,
  DeploymentTargetTypes,
} from "../../../domain/deployment/DeploymentTargetDomain";
import { createSystemPackage } from "../../../domain/system-packaging/SystemPackagingDomain";
import { DeploymentTargetCompatibilityValidator } from "../DeploymentTargetCompatibilityValidator";
import { DeploymentTargetSelector } from "../DeploymentTargetSelector";

function createSamplePackage() {
  return createSystemPackage({
    packageId: "system-package:system:root:v1:v1:abcd1234",
    manifest: {
      rootSystemAssetId: "system:root",
      rootSystemVersionId: "system:root:v1",
      dependencyGraph: {
        nodes: [
          { nodeId: "root", assetId: "system:root", versionId: "system:root:v1", structuralKind: "system", relation: "root", discoveredAtDepth: 0 },
        ],
        edges: [],
      },
      dependencyVersionSnapshot: [],
      requirements: {
        runtimeEnvironment: "container",
        runtimeRequirements: ["gpu", "network"],
        exportTargets: ["registry"],
        requiresNestedSystemSupport: true,
        maxDependencyDepth: 3,
      },
      lineage: {
        upstreamVersionIds: ["asset:model:v1"],
      },
      recursion: {
        status: "complete",
        unresolvedNestedSystemCount: 0,
        maxDepth: 4,
      },
      packagingMetadata: {
        packagingVersion: "v1",
        packagedAt: "2026-03-28T10:00:00.000Z",
        determinismKey: "deterministic-key",
      },
    },
  });
}

describe("Deployment target abstraction", () => {
  it("selects compatible targets while honoring preferred target ids", () => {
    const systemPackage = createSamplePackage();
    const local = createDeploymentTarget({
      targetId: "target:local",
      name: "Local Desktop",
      type: DeploymentTargetTypes.local,
      capabilities: {
        supportsNestedSystems: true,
        maxDependencyDepth: 8,
        supportedRuntimeEnvironments: ["container", "local"],
        providedRuntimeRequirements: ["gpu", "network", "filesystem"],
        supportedExportTargets: ["registry", "archive"],
        supportedDeploymentSettings: ["region"],
        supportedRuntimeSettings: ["runtimeEnvironment", "runtimeRequirements"],
      },
    });
    const edge = createDeploymentTarget({
      targetId: "target:edge",
      name: "Edge Fleet",
      type: DeploymentTargetTypes.edge,
      capabilities: {
        supportsNestedSystems: false,
        maxDependencyDepth: 2,
        supportedRuntimeEnvironments: ["edge"],
        providedRuntimeRequirements: ["network"],
        supportedExportTargets: ["archive"],
        supportedDeploymentSettings: ["region"],
        supportedRuntimeSettings: ["runtimeEnvironment", "runtimeRequirements"],
      },
    });

    const selector = new DeploymentTargetSelector();
    const selected = selector.selectTarget({
      systemPackage,
      targets: [edge, local],
      preferredTargetId: "target:local",
    });

    expect(selected.selectedTarget?.targetId.value).toBe("target:local");
    expect(selected.evaluations).toHaveLength(2);
    expect(selected.evaluations.find((entry) => entry.target.targetId.value === "target:edge")?.compatibility.compatible).toBe(false);
  });

  it("validates package-target compatibility deterministically", () => {
    const systemPackage = createSamplePackage();
    const cloud = createDeploymentTarget({
      targetId: "target:cloud",
      name: "Cloud Generic",
      type: DeploymentTargetTypes.cloud,
      capabilities: {
        supportsNestedSystems: false,
        maxDependencyDepth: 1,
        supportedRuntimeEnvironments: ["container"],
        providedRuntimeRequirements: ["network"],
        supportedExportTargets: ["registry"],
        supportedDeploymentSettings: ["region"],
        supportedRuntimeSettings: ["runtimeEnvironment", "runtimeRequirements"],
      },
    });

    const validator = new DeploymentTargetCompatibilityValidator();
    const result = validator.validate({ systemPackage, target: cloud });

    expect(result.compatible).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "nested-systems-not-supported",
      "dependency-depth-exceeded",
      "runtime-requirements-missing",
    ]);
  });
});

import { DeploymentBuildPipeline } from "../DeploymentBuildPipeline";
import {
  createDeploymentConfigurationContract,
  type DeploymentConfigurationContract,
} from "../../../domain/deployment/DeploymentConfigurationDomain";
import {
  createDeploymentTarget,
  DeploymentTargetTypes,
  type DeploymentTarget,
} from "../../../domain/deployment/DeploymentTargetDomain";
import { createSystemPackage, type SystemPackage } from "../../../domain/system-packaging/SystemPackagingDomain";

export function createSamplePackage(input?: { readonly includeNestedSystemDependency?: boolean }): SystemPackage {
  const includeNested = input?.includeNestedSystemDependency ?? true;
  return createSystemPackage({
    packageId: "system-package:system:root:v7:v1:abc123",
    manifest: {
      rootSystemAssetId: "system:root",
      rootSystemVersionId: "system:root:v7",
      dependencyGraph: {
        nodes: [
          { nodeId: "root", assetId: "system:root", versionId: "system:root:v7", structuralKind: "system", relation: "root", discoveredAtDepth: 0 },
          ...(includeNested
            ? [{ nodeId: "child", assetId: "system:child", versionId: "system:child:v1", structuralKind: "system", relation: "component", discoveredAtDepth: 1, parentNodeId: "root" } as const]
            : []),
        ],
        edges: includeNested ? [{ fromNodeId: "root", toNodeId: "child", relation: "contains" as const }] : [],
      },
      dependencyVersionSnapshot: [
        { assetId: "asset:model", versionId: "asset:model:v2", relation: "direct", discoveredInSystemAssetId: "system:root", discoveredAtDepth: 1 },
        ...(includeNested
          ? [{ assetId: "system:child", versionId: "system:child:v1", relation: "direct" as const, discoveredInSystemAssetId: "system:root", discoveredAtDepth: 1 }]
          : []),
      ],
      requirements: {
        runtimeEnvironment: "container",
        runtimeRequirements: ["network"],
        exportTargets: ["registry"],
        requiresNestedSystemSupport: includeNested,
        maxDependencyDepth: includeNested ? 2 : 1,
      },
      lineage: {
        upstreamVersionIds: ["asset:model:v2"],
      },
      recursion: {
        status: "complete",
        unresolvedNestedSystemCount: 0,
        maxDepth: includeNested ? 3 : 1,
      },
      packagingMetadata: {
        packagingVersion: "v1",
        packagedAt: "2026-03-28T11:00:00.000Z",
        determinismKey: "package-det-key-123",
      },
    },
  });
}

export function createSampleTarget(type = DeploymentTargetTypes.cloud): DeploymentTarget {
  return createDeploymentTarget({
    targetId: `target:${type}-generic`,
    name: `${type.toUpperCase()} Generic`,
    type,
    capabilities: {
      supportsNestedSystems: true,
      maxDependencyDepth: 5,
      supportedRuntimeEnvironments: ["container", "local"],
      providedRuntimeRequirements: ["network", "gpu"],
      supportedExportTargets: ["registry", "archive"],
      supportedDeploymentSettings: ["region", "namespace"],
      supportedRuntimeSettings: ["runtimeEnvironment", "runtimeRequirements"],
    },
  });
}

export function createSampleConfiguration(input?: {
  readonly systemPackage?: SystemPackage;
  readonly target?: DeploymentTarget;
  readonly configurationId?: string;
}): DeploymentConfigurationContract {
  const systemPackage = input?.systemPackage ?? createSamplePackage();
  const target = input?.target ?? createSampleTarget();
  return createDeploymentConfigurationContract({
    configurationId: input?.configurationId ?? "deploy-config:bundle",
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
  });
}

export function buildSampleBundle(input?: {
  readonly systemPackage?: SystemPackage;
  readonly target?: DeploymentTarget;
  readonly deploymentConfiguration?: DeploymentConfigurationContract;
}) {
  const systemPackage = input?.systemPackage ?? createSamplePackage();
  const target = input?.target ?? createSampleTarget();
  const deploymentConfiguration = input?.deploymentConfiguration ?? createSampleConfiguration({ systemPackage, target });
  const pipeline = new DeploymentBuildPipeline(undefined, () => new Date("2026-03-28T11:10:00.000Z"));
  const result = pipeline.build({ systemPackage, target, deploymentConfiguration });
  if (!result.ok || !result.bundle) {
    throw new Error(`Expected sample bundle to build successfully. Issues: ${result.issues.map((issue) => issue.code).join(",")}`);
  }

  return {
    systemPackage,
    target,
    deploymentConfiguration,
    bundle: result.bundle,
  };
}

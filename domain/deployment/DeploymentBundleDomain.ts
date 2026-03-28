import { createHash } from "node:crypto";
import type { DeploymentTargetType } from "./DeploymentTargetDomain";

export class DeploymentBundleId {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static from(value: string): DeploymentBundleId {
    const normalized = value.trim();
    if (!normalized) {
      throw new Error("DeploymentBundleId cannot be empty.");
    }
    return new DeploymentBundleId(normalized);
  }
}

export interface DeploymentBundleManifest {
  readonly schemaVersion: string;
  readonly package: {
    readonly packageId: string;
    readonly rootSystemAssetId: string;
    readonly rootSystemVersionId: string;
    readonly dependencyVersionSnapshot: ReadonlyArray<{
      readonly assetId: string;
      readonly versionId?: string;
      readonly relation: "direct" | "transitive";
      readonly discoveredInSystemAssetId: string;
      readonly discoveredAtDepth: number;
    }>;
    readonly packageDeterminismKey: string;
  };
  readonly deploymentConfiguration: {
    readonly configurationId: string;
    readonly schemaId: string;
    readonly schemaVersion: string;
    readonly deterministicKey: string;
  };
  readonly target: {
    readonly targetId: string;
    readonly targetType: DeploymentTargetType;
  };
  readonly build: {
    readonly buildId: string;
    readonly builtAt: string;
    readonly deterministicKey: string;
    readonly reproducibilityKey: string;
  };
}

export interface DeploymentBundle {
  readonly bundleId: DeploymentBundleId;
  readonly artifact: {
    readonly format: "deployment-bundle.v1";
    readonly uri: string;
  };
  readonly manifest: DeploymentBundleManifest;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

export function buildDeploymentBundleDeterminismKey(input: {
  readonly packageId: string;
  readonly packageDeterminismKey: string;
  readonly deploymentConfigurationDeterminismKey: string;
  readonly targetId: string;
  readonly targetType: DeploymentTargetType;
  readonly dependencyPins: ReadonlyArray<{ readonly assetId: string; readonly versionId?: string }>;
}): string {
  const payload = JSON.stringify({
    packageId: input.packageId,
    packageDeterminismKey: input.packageDeterminismKey,
    deploymentConfigurationDeterminismKey: input.deploymentConfigurationDeterminismKey,
    targetId: input.targetId,
    targetType: input.targetType,
    dependencyPins: [...input.dependencyPins]
      .map((entry) => `${entry.assetId}:${entry.versionId ?? ""}`)
      .sort((left, right) => left.localeCompare(right)),
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function createDeploymentBundle(input: {
  readonly bundleId: string;
  readonly artifactUri: string;
  readonly manifest: DeploymentBundleManifest;
}): DeploymentBundle {
  return Object.freeze({
    bundleId: DeploymentBundleId.from(input.bundleId),
    artifact: Object.freeze({
      format: "deployment-bundle.v1",
      uri: normalizeRequired(input.artifactUri, "Deployment bundle artifact uri"),
    }),
    manifest: Object.freeze({
      schemaVersion: normalizeRequired(input.manifest.schemaVersion, "Deployment bundle manifest schemaVersion"),
      package: Object.freeze({
        packageId: normalizeRequired(input.manifest.package.packageId, "Deployment bundle package id"),
        rootSystemAssetId: normalizeRequired(input.manifest.package.rootSystemAssetId, "Deployment bundle root system asset id"),
        rootSystemVersionId: normalizeRequired(input.manifest.package.rootSystemVersionId, "Deployment bundle root system version id"),
        dependencyVersionSnapshot: Object.freeze([...input.manifest.package.dependencyVersionSnapshot]),
        packageDeterminismKey: normalizeRequired(input.manifest.package.packageDeterminismKey, "Deployment bundle package determinism key"),
      }),
      deploymentConfiguration: Object.freeze({
        configurationId: normalizeRequired(input.manifest.deploymentConfiguration.configurationId, "Deployment bundle deployment configuration id"),
        schemaId: normalizeRequired(input.manifest.deploymentConfiguration.schemaId, "Deployment bundle deployment configuration schema id"),
        schemaVersion: normalizeRequired(input.manifest.deploymentConfiguration.schemaVersion, "Deployment bundle deployment configuration schema version"),
        deterministicKey: normalizeRequired(input.manifest.deploymentConfiguration.deterministicKey, "Deployment bundle deployment configuration deterministic key"),
      }),
      target: Object.freeze({
        targetId: normalizeRequired(input.manifest.target.targetId, "Deployment bundle target id"),
        targetType: input.manifest.target.targetType,
      }),
      build: Object.freeze({
        buildId: normalizeRequired(input.manifest.build.buildId, "Deployment bundle build id"),
        builtAt: normalizeRequired(input.manifest.build.builtAt, "Deployment bundle builtAt"),
        deterministicKey: normalizeRequired(input.manifest.build.deterministicKey, "Deployment bundle deterministic key"),
        reproducibilityKey: normalizeRequired(input.manifest.build.reproducibilityKey, "Deployment bundle reproducibility key"),
      }),
    }),
  });
}

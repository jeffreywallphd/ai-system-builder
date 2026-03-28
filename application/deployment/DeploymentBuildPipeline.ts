import { createDeploymentBundle, buildDeploymentBundleDeterminismKey, type DeploymentBundle } from "../../domain/deployment/DeploymentBundleDomain";
import type { DeploymentConfigurationContract } from "../../domain/deployment/DeploymentConfigurationDomain";
import type { DeploymentTarget } from "../../domain/deployment/DeploymentTargetDomain";
import type { SystemPackage } from "../../domain/system-packaging/SystemPackagingDomain";
import { DeploymentConfigurationValidator } from "./DeploymentConfigurationValidator";

export interface DeploymentBuildRequest {
  readonly systemPackage: SystemPackage;
  readonly deploymentConfiguration: DeploymentConfigurationContract;
  readonly target: DeploymentTarget;
}

export interface DeploymentBuildResult {
  readonly ok: boolean;
  readonly bundle?: DeploymentBundle;
  readonly issues: ReadonlyArray<{ readonly code: string; readonly message: string }>;
}

export interface DeploymentBuildPipelinePolicy {
  readonly maxCachedBundles: number;
}

const DEFAULT_POLICY: DeploymentBuildPipelinePolicy = Object.freeze({
  maxCachedBundles: 200,
});

export class DeploymentBuildPipeline {
  private readonly bundleByDeterminismKey = new Map<string, DeploymentBundle>();

  public constructor(
    private readonly configurationValidator: DeploymentConfigurationValidator = new DeploymentConfigurationValidator(),
    private readonly clock: () => Date = () => new Date(),
    private readonly policy: DeploymentBuildPipelinePolicy = DEFAULT_POLICY,
  ) {}

  public build(request: DeploymentBuildRequest): DeploymentBuildResult {
    const validation = this.configurationValidator.validate({
      systemPackage: request.systemPackage,
      target: request.target,
      deploymentConfiguration: request.deploymentConfiguration,
    });
    if (!validation.valid) {
      return Object.freeze({
        ok: false,
        issues: validation.issues,
      });
    }

    const dependencyPins = request.systemPackage.manifest.dependencyVersionSnapshot
      .map((entry) => Object.freeze({ assetId: entry.assetId, versionId: entry.versionId }));

    const reproducibilityKey = buildDeploymentBundleDeterminismKey({
      packageId: request.systemPackage.packageId.value,
      packageDeterminismKey: request.systemPackage.manifest.packagingMetadata.determinismKey,
      deploymentConfigurationDeterminismKey: request.deploymentConfiguration.metadata.deterministicKey,
      targetId: request.target.targetId.value,
      targetType: request.target.type,
      dependencyPins,
    });


    const cached = this.bundleByDeterminismKey.get(reproducibilityKey);
    if (cached) {
      return Object.freeze({
        ok: true,
        bundle: cached,
        issues: Object.freeze([]),
      });
    }

    const bundleId = `deployment-bundle:${request.systemPackage.packageId.value}:${request.target.targetId.value}:${reproducibilityKey.slice(0, 16)}`;
    const builtAt = this.clock().toISOString();

    const bundle = createDeploymentBundle({
      bundleId,
      artifactUri: `bundle://${bundleId}`,
      manifest: {
        schemaVersion: "deployment-bundle-manifest.v1",
        package: {
          packageId: request.systemPackage.packageId.value,
          rootSystemAssetId: request.systemPackage.manifest.rootSystemAssetId,
          rootSystemVersionId: request.systemPackage.manifest.rootSystemVersionId,
          dependencyVersionSnapshot: request.systemPackage.manifest.dependencyVersionSnapshot,
          packageDeterminismKey: request.systemPackage.manifest.packagingMetadata.determinismKey,
        },
        deploymentConfiguration: {
          configurationId: request.deploymentConfiguration.configurationId.value,
          schemaId: request.deploymentConfiguration.schema.schemaId,
          schemaVersion: request.deploymentConfiguration.schema.schemaVersion,
          deterministicKey: request.deploymentConfiguration.metadata.deterministicKey,
        },
        target: {
          targetId: request.target.targetId.value,
          targetType: request.target.type,
        },
        build: {
          buildId: `build:${reproducibilityKey.slice(0, 20)}`,
          builtAt,
          deterministicKey: reproducibilityKey,
          reproducibilityKey,
        },
      },
    });

    this.bundleByDeterminismKey.set(reproducibilityKey, bundle);
    this.enforceCacheBound();

    return Object.freeze({
      ok: true,
      bundle,
      issues: Object.freeze([]),
    });
  }

  private enforceCacheBound(): void {
    while (this.bundleByDeterminismKey.size > this.policy.maxCachedBundles) {
      const oldest = this.bundleByDeterminismKey.keys().next().value;
      if (!oldest) {
        break;
      }
      this.bundleByDeterminismKey.delete(oldest);
    }
  }
}

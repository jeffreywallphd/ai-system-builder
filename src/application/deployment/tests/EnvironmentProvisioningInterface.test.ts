import { describe, expect, it } from "bun:test";
import { createEnvironmentProvisioningRequest, EnvironmentProvisioningStatuses } from "@domain/deployment/EnvironmentProvisioningDomain";
import { createDeploymentTarget, DeploymentTargetTypes } from "@domain/deployment/DeploymentTargetDomain";
import { EnvironmentProvisioningCompatibilityValidator } from "../EnvironmentProvisioningCompatibilityValidator";
import { EnvironmentProvisioningService } from "../EnvironmentProvisioningService";
import { buildSampleBundle, createSampleConfiguration, createSamplePackage } from "./testUtils";

describe("EnvironmentProvisioningInterface", () => {
  it("creates provisioning requests from valid bundle + config + target combinations", () => {
    const { bundle, deploymentConfiguration, target } = buildSampleBundle();

    const request = createEnvironmentProvisioningRequest({
      requestId: "provision:req:1",
      bundle,
      deploymentConfiguration,
      target,
      requestedAt: "2026-03-28T12:00:00.000Z",
    });

    expect(request.requestId).toBe("provision:req:1");
    expect(request.bundle.bundleId.value).toBe(bundle.bundleId.value);
    expect(request.deploymentConfiguration.configurationId.value).toBe(deploymentConfiguration.configurationId.value);
    expect(request.target.targetId.value).toBe(target.targetId.value);
  });

  it("accepts compatible target categories and rejects incompatible bounded cases", () => {
    const baseline = buildSampleBundle();
    const validator = new EnvironmentProvisioningCompatibilityValidator();

    const valid = validator.validate(baseline);
    expect(valid.compatible).toBe(true);

    const incompatibleTarget = createDeploymentTarget({
      targetId: "target:edge-generic",
      name: "Edge Generic",
      type: DeploymentTargetTypes.edge,
      capabilities: {
        supportsNestedSystems: false,
        maxDependencyDepth: 0,
        supportedRuntimeEnvironments: ["local"],
        providedRuntimeRequirements: ["filesystem"],
        supportedExportTargets: ["archive"],
        supportedDeploymentSettings: ["zone"],
        supportedRuntimeSettings: ["runtimeEnvironment"],
      },
    });

    const invalid = validator.validate({
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: incompatibleTarget,
    });

    expect(invalid.compatible).toBe(false);
    expect(invalid.issues.map((issue) => issue.code)).toContain("bundle-target-mismatch");
    expect(invalid.issues.map((issue) => issue.code)).toContain("configuration-target-mismatch");
    expect(invalid.issues.map((issue) => issue.code)).toContain("target-capability-mismatch");
  });

  it("returns structured provisioned environments separate from runtime execution state", () => {
    const baseline = buildSampleBundle();
    const service = new EnvironmentProvisioningService(undefined, () => new Date("2026-03-28T12:05:00.000Z"));

    const result = service.provision({
      requestId: "provision:req:2",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T12:04:00.000Z",
    });

    expect(result.status).toBe(EnvironmentProvisioningStatuses.ready);
    expect(result.provisionedEnvironment?.environmentId).toContain("provisioned-env");
    expect(result.provisionedEnvironment?.bundleId).toBe(baseline.bundle.bundleId.value);
    expect(result.provisionedEnvironment?.deploymentConfigurationId).toBe(baseline.deploymentConfiguration.configurationId.value);
    expect(Object.prototype.hasOwnProperty.call(result.provisionedEnvironment ?? {}, "executionId")).toBe(false);
  });

  it("associates nested system bundles with provisioned environments deterministically", () => {
    const systemPackage = createSamplePackage({ includeNestedSystemDependency: true });
    const target = createDeploymentTarget({
      targetId: "target:local-generic",
      name: "Local Generic",
      type: DeploymentTargetTypes.local,
      capabilities: {
        supportsNestedSystems: true,
        maxDependencyDepth: 6,
        supportedRuntimeEnvironments: ["container", "local"],
        providedRuntimeRequirements: ["network", "gpu"],
        supportedExportTargets: ["registry", "archive"],
        supportedDeploymentSettings: ["region", "namespace"],
        supportedRuntimeSettings: ["runtimeEnvironment", "runtimeRequirements"],
      },
    });
    const deploymentConfiguration = createSampleConfiguration({ systemPackage, target, configurationId: "deploy-config:nested" });
    const { bundle } = buildSampleBundle({ systemPackage, target, deploymentConfiguration });

    const service = new EnvironmentProvisioningService(undefined, () => new Date("2026-03-28T12:20:00.000Z"));
    const result = service.provision({
      requestId: "provision:req:nested",
      bundle,
      deploymentConfiguration,
      target,
      requestedAt: "2026-03-28T12:19:00.000Z",
    });

    expect(result.status).toBe(EnvironmentProvisioningStatuses.ready);
    expect(result.plan.requiredEnvironmentCapabilities).toContain("supports-nested-system-bundle");
    expect(result.provisionedEnvironment?.bundleReproducibilityKey).toBe(bundle.manifest.build.reproducibilityKey);
  });
});


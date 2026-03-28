import { describe, expect, it } from "bun:test";
import { DeploymentStatuses } from "../../../domain/deployment/DeploymentExecutionDomain";
import { EnvironmentProvisioningStatuses } from "../../../domain/deployment/EnvironmentProvisioningDomain";
import { createDeploymentTarget, DeploymentTargetTypes } from "../../../domain/deployment/DeploymentTargetDomain";
import { DeploymentExecutionService } from "../DeploymentExecutionService";
import { EnvironmentProvisioningService } from "../EnvironmentProvisioningService";
import { buildSampleBundle, createSampleConfiguration, createSamplePackage } from "./testUtils";

describe("DeploymentExecutionService", () => {
  it("deploys a valid bundle + config + provisioned environment successfully", () => {
    const baseline = buildSampleBundle();
    const provisioning = new EnvironmentProvisioningService(undefined, () => new Date("2026-03-28T12:30:00.000Z"));
    const provisionResult = provisioning.provision({
      requestId: "provision:exec:1",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T12:29:00.000Z",
    });

    expect(provisionResult.status).toBe(EnvironmentProvisioningStatuses.ready);

    const service = new DeploymentExecutionService(undefined, undefined, () => new Date("2026-03-28T12:31:00.000Z"));
    const execution = service.execute({
      requestId: "deploy:req:1",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      provisionedEnvironment: provisionResult.provisionedEnvironment!,
      requestedAt: "2026-03-28T12:30:30.000Z",
    });

    expect(execution.status).toBe(DeploymentStatuses.succeeded);
    expect(execution.deployment?.bundleVersionKey).toBe(baseline.bundle.manifest.build.reproducibilityKey);
    expect(execution.deployment?.deploymentConfigurationId).toBe(baseline.deploymentConfiguration.configurationId.value);
    expect(execution.deployment?.provisionedEnvironmentId).toBe(provisionResult.provisionedEnvironment?.environmentId);
    expect(execution.deployment?.status).toBe(DeploymentStatuses.succeeded);
  });

  it("fails before deployment when provisioned environment linkage is incompatible", () => {
    const baseline = buildSampleBundle();
    const provisioning = new EnvironmentProvisioningService(undefined, () => new Date("2026-03-28T12:40:00.000Z"));
    const provisionResult = provisioning.provision({
      requestId: "provision:exec:2",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T12:39:00.000Z",
    });

    const mismatchedTarget = createDeploymentTarget({
      targetId: "target:edge-generic",
      name: "Edge Generic",
      type: DeploymentTargetTypes.edge,
      capabilities: {
        supportsNestedSystems: true,
        maxDependencyDepth: 5,
        supportedRuntimeEnvironments: ["container"],
        providedRuntimeRequirements: ["network", "gpu"],
        supportedExportTargets: ["registry"],
        supportedDeploymentSettings: ["region", "namespace"],
        supportedRuntimeSettings: ["runtimeEnvironment", "runtimeRequirements"],
      },
    });

    const service = new DeploymentExecutionService(undefined, undefined, () => new Date("2026-03-28T12:41:00.000Z"));
    const execution = service.execute({
      requestId: "deploy:req:2",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: mismatchedTarget,
      provisionedEnvironment: provisionResult.provisionedEnvironment!,
      requestedAt: "2026-03-28T12:40:30.000Z",
    });

    expect(execution.status).toBe(DeploymentStatuses.rejected);
    expect(execution.deployment).toBeUndefined();
    expect(execution.issues.map((issue) => issue.code)).toContain("provisioned-environment-target-mismatch");
  });

  it("keeps deployment results version-pinned and traceable through record lookup", () => {
    const baseline = buildSampleBundle();
    const provisioning = new EnvironmentProvisioningService(undefined, () => new Date("2026-03-28T12:50:00.000Z"));
    const provisionResult = provisioning.provision({
      requestId: "provision:exec:3",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T12:49:00.000Z",
    });

    const service = new DeploymentExecutionService(undefined, undefined, () => new Date("2026-03-28T12:51:00.000Z"));
    const execution = service.execute({
      requestId: "deploy:req:3",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      provisionedEnvironment: provisionResult.provisionedEnvironment!,
      requestedAt: "2026-03-28T12:50:30.000Z",
    });

    const persisted = service.getDeployment(execution.deployment!.deploymentId);
    const environmentDeployments = service.listDeploymentsForEnvironment(provisionResult.provisionedEnvironment!.environmentId);

    expect(persisted?.bundleId).toBe(baseline.bundle.bundleId.value);
    expect(persisted?.rootSystemVersionId).toBe(baseline.bundle.manifest.package.rootSystemVersionId);
    expect(persisted?.metadata.deploymentDeterminismKey).toBeDefined();
    expect(environmentDeployments.map((entry) => entry.deploymentId)).toContain(execution.deployment!.deploymentId);
  });

  it("deploys nested system bundles through the same bounded service", () => {
    const systemPackage = createSamplePackage({ includeNestedSystemDependency: true });
    const target = createDeploymentTarget({
      targetId: "target:cloud-generic",
      name: "Cloud Generic",
      type: DeploymentTargetTypes.cloud,
      capabilities: {
        supportsNestedSystems: true,
        maxDependencyDepth: 8,
        supportedRuntimeEnvironments: ["container"],
        providedRuntimeRequirements: ["network", "gpu"],
        supportedExportTargets: ["registry", "archive"],
        supportedDeploymentSettings: ["region", "namespace"],
        supportedRuntimeSettings: ["runtimeEnvironment", "runtimeRequirements"],
      },
    });
    const deploymentConfiguration = createSampleConfiguration({ systemPackage, target, configurationId: "deploy-config:nested-exec" });
    const { bundle } = buildSampleBundle({ systemPackage, target, deploymentConfiguration });

    const provisioning = new EnvironmentProvisioningService(undefined, () => new Date("2026-03-28T13:00:00.000Z"));
    const provisionResult = provisioning.provision({
      requestId: "provision:exec:nested",
      bundle,
      deploymentConfiguration,
      target,
      requestedAt: "2026-03-28T12:59:00.000Z",
    });

    const service = new DeploymentExecutionService(undefined, undefined, () => new Date("2026-03-28T13:01:00.000Z"));
    const execution = service.execute({
      requestId: "deploy:req:nested",
      bundle,
      deploymentConfiguration,
      target,
      provisionedEnvironment: provisionResult.provisionedEnvironment!,
      requestedAt: "2026-03-28T13:00:30.000Z",
    });

    expect(execution.status).toBe(DeploymentStatuses.succeeded);
    expect(execution.deployment?.nestedSystemCount).toBeGreaterThan(0);
    expect(execution.deployment?.packageId).toBe(bundle.manifest.package.packageId);
  });
});

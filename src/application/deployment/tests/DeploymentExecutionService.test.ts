import { describe, expect, it } from "bun:test";
import { DeploymentStates } from "@domain/deployment/DeploymentStateDomain";
import { DeploymentStatuses } from "@domain/deployment/DeploymentExecutionDomain";
import { createDeploymentTarget, DeploymentTargetTypes } from "@domain/deployment/DeploymentTargetDomain";
import { DeploymentExecutionService } from "../DeploymentExecutionService";
import { EnvironmentProvisioningService } from "../EnvironmentProvisioningService";
import { buildSampleBundle, createSampleConfiguration, createSamplePackage } from "./testUtils";

describe("DeploymentExecutionService", () => {
  it("tracks lifecycle states across provisioning + deployment", () => {
    const baseline = buildSampleBundle();
    const service = new DeploymentExecutionService(
      undefined,
      undefined,
      () => new Date("2026-03-28T12:31:00.000Z"),
      new EnvironmentProvisioningService(undefined, () => new Date("2026-03-28T12:30:00.000Z")),
    );

    const execution = service.executeLifecycle({
      requestId: "deploy:req:lifecycle",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T12:29:00.000Z",
    });

    expect(execution.status).toBe(DeploymentStatuses.succeeded);
    expect(execution.deployment?.state).toBe(DeploymentStates.active);

    const states = execution.deployment?.stateTransitions.map((entry) => entry.toState) ?? [];
    expect(states).toEqual([
      DeploymentStates.requested,
      DeploymentStates.provisioningInProgress,
      DeploymentStates.provisioningComplete,
      DeploymentStates.deploymentInProgress,
      DeploymentStates.active,
    ]);
  });

  it("fails to terminal deployment failed state when provisioning fails", () => {
    const baseline = buildSampleBundle();
    const mismatchedTarget = createDeploymentTarget({
      targetId: "target:local-failing",
      name: "Local Failing",
      type: DeploymentTargetTypes.local,
      capabilities: {
        supportsNestedSystems: false,
        maxDependencyDepth: 1,
        supportedRuntimeEnvironments: ["local"],
        providedRuntimeRequirements: [],
        supportedExportTargets: ["archive"],
        supportedDeploymentSettings: ["namespace"],
        supportedRuntimeSettings: ["runtimeEnvironment"],
      },
    });

    const service = new DeploymentExecutionService(undefined, undefined, () => new Date("2026-03-28T12:41:00.000Z"));
    const execution = service.executeLifecycle({
      requestId: "deploy:req:provision-fail",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: mismatchedTarget,
      requestedAt: "2026-03-28T12:40:30.000Z",
    });

    expect(execution.status).toBe(DeploymentStatuses.rejected);
    expect(execution.deployment?.state).toBe(DeploymentStates.failed);
    expect(execution.deployment?.stateSnapshot.transitionCount).toBeGreaterThanOrEqual(3);
    expect(service.listDeploymentDiagnostics(execution.deployment!.deploymentId).length).toBeGreaterThan(0);
  });

  it("keeps deployment records version-pinned + traceable via state snapshots and queries", () => {
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
    const activeDeployments = service.listDeploymentsByState(DeploymentStates.active);
    const snapshot = service.getDeploymentStateSnapshot(execution.deployment!.deploymentId);

    expect(persisted?.bundleId).toBe(baseline.bundle.bundleId.value);
    expect(persisted?.rootSystemVersionId).toBe(baseline.bundle.manifest.package.rootSystemVersionId);
    expect(persisted?.metadata.deploymentDeterminismKey).toBeDefined();
    expect(environmentDeployments.map((entry) => entry.deploymentId)).toContain(execution.deployment!.deploymentId);
    expect(activeDeployments.map((entry) => entry.deploymentId)).toContain(execution.deployment!.deploymentId);
    expect(snapshot?.state).toBe(DeploymentStates.active);
  });

  it("keeps nested system bundle linkage and deployment diagnostics tied to deployment identity", () => {
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

    const service = new DeploymentExecutionService(undefined, undefined, () => new Date("2026-03-28T13:01:00.000Z"));
    const execution = service.executeLifecycle({
      requestId: "deploy:req:nested",
      bundle,
      deploymentConfiguration,
      target,
      requestedAt: "2026-03-28T13:00:30.000Z",
    });

    expect(execution.status).toBe(DeploymentStatuses.succeeded);
    expect(execution.deployment?.nestedSystemCount).toBeGreaterThan(0);
    expect(execution.deployment?.packageId).toBe(bundle.manifest.package.packageId);

    const logs = service.listDeploymentLogs(execution.deployment!.deploymentId);
    expect(logs.some((entry) => entry.eventKind === "state-transition")).toBeTrue();
    expect(logs.every((entry) => !entry.message.includes("runtimeState"))).toBeTrue();
  });
});


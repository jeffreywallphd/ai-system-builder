import { describe, expect, it } from "bun:test";
import { createDeploymentConfigurationContract } from "../../../domain/deployment/DeploymentConfigurationDomain";
import { createSystemPackage, type SystemPackage } from "../../../domain/system-packaging/SystemPackagingDomain";
import { DeploymentExecutionService, InMemoryDeploymentRecordRepository } from "../DeploymentExecutionService";
import { DeploymentVersionManager } from "../DeploymentVersionManager";
import { DeploymentRollbackService, InMemoryDeploymentRollbackActionRepository } from "../DeploymentRollbackService";
import { DeploymentDiagnosticsService, InMemoryDeploymentDiagnosticsRepository } from "../DeploymentDiagnosticsService";
import { buildSampleBundle, createSampleConfiguration, createSamplePackage, createSampleTarget } from "./testUtils";
import { DeploymentActivationStates } from "../../../domain/deployment/DeploymentExecutionDomain";

function createVersionedPackage(base: SystemPackage, input: { readonly rootVersionId: string; readonly packageId: string }): SystemPackage {
  return createSystemPackage({
    packageId: input.packageId,
    manifest: {
      ...base.manifest,
      rootSystemVersionId: input.rootVersionId,
      dependencyGraph: {
        nodes: base.manifest.dependencyGraph.nodes.map((node) => (
          node.relation === "root"
            ? { ...node, versionId: input.rootVersionId }
            : node
        )),
        edges: base.manifest.dependencyGraph.edges,
      },
      packagingMetadata: {
        ...base.manifest.packagingMetadata,
        determinismKey: `${base.manifest.packagingMetadata.determinismKey}:${input.rootVersionId}`,
      },
    },
  });
}

function createConfig(input: {
  readonly configurationId: string;
  readonly systemPackage: SystemPackage;
  readonly targetId: string;
  readonly targetType: "local" | "cloud" | "edge";
  readonly namespace: string;
}) {
  return createDeploymentConfigurationContract({
    configurationId: input.configurationId,
    packageId: input.systemPackage.packageId.value,
    rootSystemAssetId: input.systemPackage.manifest.rootSystemAssetId,
    rootSystemVersionId: input.systemPackage.manifest.rootSystemVersionId,
    targetId: input.targetId,
    targetType: input.targetType,
    schema: {
      schemaId: "schema:deployment:v1",
      schemaVersion: "v1",
      requiredDeploymentSettings: ["region"],
      optionalDeploymentSettings: ["namespace"],
      requiredRuntimeSettings: ["runtimeEnvironment"],
      optionalRuntimeSettings: ["runtimeRequirements"],
    },
    valueSet: {
      deploymentSettings: { region: "us-east-1", namespace: input.namespace },
      runtimeSettings: { runtimeEnvironment: "container", runtimeRequirements: "network,gpu" },
    },
    nestedSystemBindings: [{ systemAssetId: "system:child", systemVersionId: "system:child:v1" }],
    createdAt: "2026-03-28T14:00:00.000Z",
  });
}

describe("DeploymentVersionManager", () => {
  it("tracks multiple deployments across system versions and explicit activation transitions", () => {
    const diagnostics = new DeploymentDiagnosticsService(new InMemoryDeploymentDiagnosticsRepository(), () => new Date("2026-03-28T14:10:00.000Z"));
    const repository = new InMemoryDeploymentRecordRepository();
    const executionService = new DeploymentExecutionService(undefined, repository, () => new Date("2026-03-28T14:11:00.000Z"), undefined, undefined, diagnostics);
    const manager = new DeploymentVersionManager(repository, executionService);

    const target = createSampleTarget();
    const packageV7 = createSamplePackage({ includeNestedSystemDependency: true });
    const packageV8 = createVersionedPackage(packageV7, {
      rootVersionId: "system:root:v8",
      packageId: "system-package:system:root:v8:v1:def456",
    });

    const configV7A = createConfig({
      configurationId: "deploy-config:v7:a",
      systemPackage: packageV7,
      targetId: target.targetId.value,
      targetType: target.type,
      namespace: "prod-a",
    });
    const configV7B = createConfig({
      configurationId: "deploy-config:v7:b",
      systemPackage: packageV7,
      targetId: target.targetId.value,
      targetType: target.type,
      namespace: "prod-b",
    });
    const configV8 = createConfig({
      configurationId: "deploy-config:v8",
      systemPackage: packageV8,
      targetId: target.targetId.value,
      targetType: target.type,
      namespace: "prod-c",
    });

    const deploymentV7A = executionService.executeLifecycle({
      requestId: "deploy:req:v7:a",
      bundle: buildSampleBundle({ systemPackage: packageV7, target, deploymentConfiguration: configV7A }).bundle,
      deploymentConfiguration: configV7A,
      target,
      requestedAt: "2026-03-28T14:09:00.000Z",
    }).deployment!;
    const deploymentV7B = executionService.executeLifecycle({
      requestId: "deploy:req:v7:b",
      bundle: buildSampleBundle({ systemPackage: packageV7, target, deploymentConfiguration: configV7B }).bundle,
      deploymentConfiguration: configV7B,
      target,
      requestedAt: "2026-03-28T14:09:30.000Z",
    }).deployment!;
    const deploymentV8 = executionService.executeLifecycle({
      requestId: "deploy:req:v8",
      bundle: buildSampleBundle({ systemPackage: packageV8, target, deploymentConfiguration: configV8 }).bundle,
      deploymentConfiguration: configV8,
      target,
      requestedAt: "2026-03-28T14:10:00.000Z",
    }).deployment!;

    expect(deploymentV7A.activationState).toBe(DeploymentActivationStates.inactive);
    expect(deploymentV8.activationState).toBe(DeploymentActivationStates.inactive);

    manager.setActiveDeployment({ deploymentId: deploymentV7B.deploymentId, reason: "promote-v7" });
    const activation = manager.setActiveDeployment({ deploymentId: deploymentV8.deploymentId, reason: "promote-v8" });

    const v7Deployments = manager.listDeploymentsForSystemVersion({ rootSystemAssetId: "system:root", rootSystemVersionId: "system:root:v7" });
    const v8Deployments = manager.listDeploymentsForSystemVersion({ rootSystemAssetId: "system:root", rootSystemVersionId: "system:root:v8" });

    expect(v7Deployments.length).toBe(2);
    expect(v8Deployments.length).toBe(1);
    expect(activation.active.deploymentId).toBe(deploymentV8.deploymentId);
    expect(activation.superseded.map((entry) => entry.deploymentId)).toContain(deploymentV7B.deploymentId);

    const active = manager.getActiveDeployment({ rootSystemAssetId: "system:root", targetId: target.targetId.value, targetType: target.type });
    expect(active?.rootSystemVersionId).toBe("system:root:v8");

    const traceable = manager.listDeploymentHistory({ rootSystemAssetId: "system:root", targetId: target.targetId.value });
    expect(traceable.every((entry) => entry.bundleId.startsWith("deployment-bundle:"))).toBeTrue();
    expect(traceable.map((entry) => entry.deploymentConfigurationId)).toContain("deploy-config:v7:b");
    expect(traceable.some((entry) => entry.nestedSystemCount > 0)).toBeTrue();
  });

  it("reuses short-lived cached history/active lookups while preserving activation correctness", () => {
    const repository = new InMemoryDeploymentRecordRepository();
    const diagnostics = new DeploymentDiagnosticsService(new InMemoryDeploymentDiagnosticsRepository(), () => new Date("2026-03-28T14:20:00.000Z"));
    const executionService = new DeploymentExecutionService(undefined, repository, () => new Date("2026-03-28T14:21:00.000Z"), undefined, undefined, diagnostics);

    let listCalls = 0;
    const listAll = repository.listAll.bind(repository);
    repository.listAll = (() => {
      listCalls += 1;
      return listAll();
    }) as typeof repository.listAll;

    const manager = new DeploymentVersionManager(repository, executionService);
    const baseline = buildSampleBundle();

    const deployment = executionService.executeLifecycle({
      requestId: "deploy:req:cache:v1",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T14:22:00.000Z",
    }).deployment!;
    manager.setActiveDeployment({ deploymentId: deployment.deploymentId, reason: "promote-cache-v1" });
    const callsBeforeReads = listCalls;

    const firstHistory = manager.listDeploymentHistory({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
    });
    const secondHistory = manager.listDeploymentHistory({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
    });
    const firstActive = manager.getActiveDeployment({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
    });
    const secondActive = manager.getActiveDeployment({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
    });

    expect(firstHistory).toEqual(secondHistory);
    expect(firstActive?.deploymentId).toBe(secondActive?.deploymentId);
    expect(listCalls - callsBeforeReads).toBe(2);
  });
});

describe("DeploymentRollbackService", () => {
  it("rolls back to an eligible prior deployment and records rollback actions distinctly", () => {
    const diagnostics = new DeploymentDiagnosticsService(new InMemoryDeploymentDiagnosticsRepository(), () => new Date("2026-03-28T15:10:00.000Z"));
    const repository = new InMemoryDeploymentRecordRepository();
    const executionService = new DeploymentExecutionService(undefined, repository, () => new Date("2026-03-28T15:11:00.000Z"), undefined, undefined, diagnostics);
    const versionManager = new DeploymentVersionManager(repository, executionService);
    const rollbackService = new DeploymentRollbackService(repository, versionManager, diagnostics, new InMemoryDeploymentRollbackActionRepository(), () => new Date("2026-03-28T15:12:00.000Z"));

    const baseline = buildSampleBundle();
    const v7 = executionService.executeLifecycle({
      requestId: "deploy:req:rb:v7",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T15:00:00.000Z",
    }).deployment!;

    const packageV8 = createVersionedPackage(baseline.systemPackage, {
      rootVersionId: "system:root:v8",
      packageId: "system-package:system:root:v8:v1:rollback",
    });
    const configV8 = createSampleConfiguration({
      systemPackage: packageV8,
      target: baseline.target,
      configurationId: "deploy-config:rb:v8",
    });
    const v8 = executionService.executeLifecycle({
      requestId: "deploy:req:rb:v8",
      bundle: buildSampleBundle({ systemPackage: packageV8, target: baseline.target, deploymentConfiguration: configV8 }).bundle,
      deploymentConfiguration: configV8,
      target: baseline.target,
      requestedAt: "2026-03-28T15:01:00.000Z",
    }).deployment!;

    versionManager.setActiveDeployment({ deploymentId: v7.deploymentId, reason: "promote-v7" });
    versionManager.setActiveDeployment({ deploymentId: v8.deploymentId, reason: "promote-v8" });

    const rollback = rollbackService.rollback({
      requestId: "rollback:req:1",
      rootSystemAssetId: "system:root",
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      requestedBy: "operator:deploy",
      requestedAt: "2026-03-28T15:02:00.000Z",
      toDeploymentId: v7.deploymentId,
      reason: "rollback-after-regression",
    });

    expect(rollback.performed).toBeTrue();
    expect(rollback.fromDeploymentId).toBe(v8.deploymentId);
    expect(rollback.toDeploymentId).toBe(v7.deploymentId);

    const active = versionManager.getActiveDeployment({
      rootSystemAssetId: "system:root",
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
    });
    expect(active?.deploymentId).toBe(v7.deploymentId);

    const rollbackActions = rollbackService.listRollbackActions({
      rootSystemAssetId: "system:root",
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
    });
    expect(rollbackActions.length).toBe(1);
    expect(rollbackActions[0]?.performed).toBeTrue();

    const reactivated = repository.getById(v7.deploymentId)!;
    expect(reactivated.activationHistory.some((entry) => entry.actionKind === "rollback")).toBeTrue();
    expect(active?.nestedSystemCount).toBeGreaterThan(0);
  });

  it("returns structured outcomes for ineligible rollback attempts", () => {
    const diagnostics = new DeploymentDiagnosticsService(new InMemoryDeploymentDiagnosticsRepository(), () => new Date("2026-03-28T16:10:00.000Z"));
    const repository = new InMemoryDeploymentRecordRepository();
    const executionService = new DeploymentExecutionService(undefined, repository, () => new Date("2026-03-28T16:11:00.000Z"), undefined, undefined, diagnostics);
    const versionManager = new DeploymentVersionManager(repository, executionService);
    const rollbackService = new DeploymentRollbackService(repository, versionManager, diagnostics, new InMemoryDeploymentRollbackActionRepository(), () => new Date("2026-03-28T16:12:00.000Z"));

    const baseline = buildSampleBundle();
    const deployment = executionService.executeLifecycle({
      requestId: "deploy:req:ineligible",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T16:00:00.000Z",
    }).deployment!;
    versionManager.setActiveDeployment({ deploymentId: deployment.deploymentId, reason: "promote-initial" });

    const outcome = rollbackService.rollback({
      requestId: "rollback:req:ineligible",
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      requestedBy: "operator:deploy",
      requestedAt: "2026-03-28T16:03:00.000Z",
      toDeploymentId: "deployment:missing",
    });

    expect(outcome.performed).toBeFalse();
    expect(outcome.decision.code).toBe("candidate-not-found");

    const rollbackActions = rollbackService.listRollbackActions({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
    });
    expect(rollbackActions[0]?.decision.code).toBe("candidate-not-found");
  });
});

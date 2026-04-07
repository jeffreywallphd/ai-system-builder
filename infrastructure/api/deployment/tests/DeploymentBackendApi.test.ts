import { describe, expect, it } from "bun:test";
import { DeploymentBuildPipeline } from "../../../../application/deployment/DeploymentBuildPipeline";
import { DeploymentDiagnosticsService, InMemoryDeploymentDiagnosticsRepository } from "../../../../application/deployment/DeploymentDiagnosticsService";
import { DeploymentExecutionService, InMemoryDeploymentRecordRepository } from "../../../../application/deployment/DeploymentExecutionService";
import { DeploymentHealthMonitor } from "../../../../application/deployment/DeploymentHealthMonitor";
import { DeploymentRollbackService, InMemoryDeploymentRollbackActionRepository } from "../../../../application/deployment/DeploymentRollbackService";
import { DeploymentVersionManager } from "../../../../application/deployment/DeploymentVersionManager";
import { DeploymentAccessEvaluator, RoleBasedDeploymentAccessPolicy } from "../../../../application/deployment/DeploymentAccessControl";
import { DeploymentQuotaEvaluator } from "../../../../application/deployment/DeploymentQuotaEvaluator";
import { EndpointRoutingService } from "../../../../application/deployment/EndpointRoutingService";
import { InMemoryEndpointExposureRepository, SystemEndpointExposureService } from "../../../../application/deployment/SystemEndpointExposureService";
import { DeploymentEndpointRuntimeInvoker } from "../../system-runtime/DeploymentEndpointRuntimeInvoker";
import { DeploymentBackendApi } from "../DeploymentBackendApi";
import { buildSampleBundle, createSampleConfiguration } from "../../../../application/deployment/tests/testUtils";
import { createSystemPackage } from "../../../../src/domain/system-packaging/SystemPackagingDomain";

function createHarness() {
  const repository = new InMemoryDeploymentRecordRepository();
  const accessEvaluator = new DeploymentAccessEvaluator(new RoleBasedDeploymentAccessPolicy());
  const quotaEvaluator = new DeploymentQuotaEvaluator({
    maxDeploymentsPerCallerPerWindow: 100,
    maxDeploymentsPerTargetPerWindow: 100,
    maxActivationChangesPerTargetPerWindow: 100,
    maxRollbacksPerTargetPerWindow: 100,
    windowMs: 60_000,
  });
  const diagnosticsService = new DeploymentDiagnosticsService(new InMemoryDeploymentDiagnosticsRepository(), () => new Date("2026-03-28T18:00:00.000Z"));
  const buildPipeline = new DeploymentBuildPipeline(undefined, () => new Date("2026-03-28T18:01:00.000Z"));
  const execution = new DeploymentExecutionService(undefined, repository, () => new Date("2026-03-28T18:02:00.000Z"), undefined, undefined, diagnosticsService, accessEvaluator, quotaEvaluator);
  const versionManager = new DeploymentVersionManager(repository, execution, accessEvaluator, quotaEvaluator);
  const rollback = new DeploymentRollbackService(repository, versionManager, diagnosticsService, new InMemoryDeploymentRollbackActionRepository(), () => new Date("2026-03-28T18:03:00.000Z"), accessEvaluator, quotaEvaluator);
  const exposureRepository = new InMemoryEndpointExposureRepository();
  const endpointService = new SystemEndpointExposureService(versionManager, repository, exposureRepository, () => new Date("2026-03-28T18:04:00.000Z"));
  const endpointRouting = new EndpointRoutingService(endpointService, versionManager, repository, new DeploymentEndpointRuntimeInvoker());
  const health = new DeploymentHealthMonitor(repository, diagnosticsService, exposureRepository, endpointRouting, versionManager, undefined, undefined, () => new Date("2026-03-28T18:05:00.000Z"));

  const backend = new DeploymentBackendApi(buildPipeline, execution, versionManager, rollback, health, repository);
  const accessContext = {
    callerKind: "user" as const,
    callerId: "deploy-user-1",
    roles: ["deployer", "deployment-viewer", "deployment-manager", "deployment-rollback"],
    tenantId: "tenant-alpha",
    source: "external-api" as const,
  };

  return { backend, accessContext, versionManager, endpointService };
}

describe("DeploymentBackendApi", () => {
  it("maps deployment lifecycle, status/history/active, rollback, and health to bounded public DTOs", () => {
    const { backend, accessContext, versionManager, endpointService } = createHarness();
    const baseline = buildSampleBundle();

    const startedV1 = backend.startDeployment({
      requestId: "deploy:sdk:v1",
      requestedAt: "2026-03-28T18:10:00.000Z",
      systemPackage: baseline.systemPackage,
      target: baseline.target,
      deploymentConfiguration: baseline.deploymentConfiguration,
      selection: { targetId: baseline.target.targetId.value, targetType: baseline.target.type, tenantId: "tenant-alpha" },
    }, { accessContext });
    expect(startedV1.ok, startedV1.error?.message).toBeTrue();

    const packageV2 = createSystemPackage({
      packageId: "system-package:system:root:v8:v1:sdk",
      manifest: {
        ...baseline.systemPackage.manifest,
        rootSystemVersionId: "system:root:v8",
        dependencyGraph: {
          nodes: baseline.systemPackage.manifest.dependencyGraph.nodes.map((node) => node.relation === "root" ? { ...node, versionId: "system:root:v8" } : node),
          edges: baseline.systemPackage.manifest.dependencyGraph.edges,
        },
      },
    });
    const configV2 = createSampleConfiguration({
      systemPackage: packageV2,
      target: baseline.target,
      configurationId: "deploy-config:sdk:v2",
    });

    const startedV2 = backend.startDeployment({
      requestId: "deploy:sdk:v2",
      requestedAt: "2026-03-28T18:11:00.000Z",
      systemPackage: packageV2,
      target: baseline.target,
      deploymentConfiguration: configV2,
      selection: { targetId: baseline.target.targetId.value, targetType: baseline.target.type, tenantId: "tenant-alpha" },
    }, { accessContext });
    expect(startedV2.ok, startedV2.error?.message).toBeTrue();

    versionManager.setActiveDeployment({
      deploymentId: startedV1.data!.deployment.deploymentId,
      accessContext: { caller: accessContext, tenantId: "tenant-alpha", source: "external-api" },
      resourceTenantId: "tenant-alpha",
      requestSource: "external-api",
    });
    versionManager.setActiveDeployment({
      deploymentId: startedV2.data!.deployment.deploymentId,
      accessContext: { caller: accessContext, tenantId: "tenant-alpha", source: "external-api" },
      resourceTenantId: "tenant-alpha",
      requestSource: "external-api",
    });

    endpointService.exposeActiveDeployment({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      endpointName: "sdk-prod",
      accessContext: { caller: accessContext, tenantId: "tenant-alpha", source: "external-api" },
      resourceTenantId: "tenant-alpha",
      requestSource: "external-api",
    });

    const status = backend.getDeploymentStatus({
      deploymentId: startedV2.data!.deployment.deploymentId,
      tenantId: "tenant-alpha",
      stateTransitionLimit: 1,
    }, { accessContext });
    expect(status.ok, status.error?.message).toBeTrue();
    expect(status.data?.deployment.rootSystemVersionId).toBe("system:root:v8");
    expect(status.data?.stateTransitions.length).toBe(1);

    const history = backend.listDeployments({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      tenantId: "tenant-alpha",
      limit: 1,
    }, { accessContext });
    expect(history.ok, history.error?.message).toBeTrue();
    expect(history.data?.deployments.length).toBe(1);
    expect(history.data?.deployments.every((entry) => entry.targetId === baseline.target.targetId.value)).toBeTrue();

    const active = backend.getActiveDeployment({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      tenantId: "tenant-alpha",
    }, { accessContext });
    expect(active.ok, active.error?.message).toBeTrue();
    expect(active.data?.activeDeployment?.deploymentId).toBe(startedV2.data?.deployment.deploymentId);

    const rollback = backend.rollbackDeployment({
      requestId: "rollback:sdk:1",
      requestedAt: "2026-03-28T18:12:00.000Z",
      requestedBy: "deploy-user-1",
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      toDeploymentId: startedV1.data!.deployment.deploymentId,
      tenantId: "tenant-alpha",
    }, { accessContext });
    expect(rollback.ok, rollback.error?.message).toBeTrue();
    expect(rollback.data?.performed).toBeTrue();
    expect(rollback.data?.decision.eligible).toBeTrue();

    const health = backend.getDeploymentHealth({
      deploymentId: startedV1.data!.deployment.deploymentId,
      tenantId: "tenant-alpha",
    }, { accessContext });
    expect(health.ok, health.error?.message).toBeTrue();
    expect(health.data?.linkage.targetId).toBe(baseline.target.targetId.value);
    expect(health.data?.signals.deploymentStatus).toBe("succeeded");
  });

  it("returns bounded, structured errors for public deployment operations", () => {
    const { backend, accessContext } = createHarness();

    const invalid = backend.listDeployments({
      rootSystemAssetId: "",
      tenantId: "tenant-alpha",
    }, { accessContext });
    expect(invalid.ok).toBeFalse();
    expect(invalid.error?.code).toBe("invalid-request");

    const missing = backend.getDeploymentStatus({
      deploymentId: "deployment:missing",
      tenantId: "tenant-alpha",
    }, { accessContext });
    expect(missing.ok).toBeFalse();
    expect(missing.error?.code).toBe("not-found");
    expect(missing.error?.message).toContain("deployment:missing");
  });
});

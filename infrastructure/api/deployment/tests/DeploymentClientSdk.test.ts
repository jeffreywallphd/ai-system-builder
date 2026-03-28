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
import { buildSampleBundle } from "../../../../application/deployment/tests/testUtils";
import { DeploymentBackendApi } from "../DeploymentBackendApi";
import { DeploymentClient } from "../sdk/DeploymentClient";
import { DeploymentApiSdkTransport, type DeploymentSdkTransport } from "../sdk/DeploymentSdkTransport";

function createClientHarness() {
  const repository = new InMemoryDeploymentRecordRepository();
  const accessEvaluator = new DeploymentAccessEvaluator(new RoleBasedDeploymentAccessPolicy());
  const quotaEvaluator = new DeploymentQuotaEvaluator({
    maxDeploymentsPerCallerPerWindow: 100,
    maxDeploymentsPerTargetPerWindow: 100,
    maxActivationChangesPerTargetPerWindow: 100,
    maxRollbacksPerTargetPerWindow: 100,
    windowMs: 60_000,
  });
  const diagnosticsService = new DeploymentDiagnosticsService(new InMemoryDeploymentDiagnosticsRepository(), () => new Date("2026-03-28T19:00:00.000Z"));
  const buildPipeline = new DeploymentBuildPipeline(undefined, () => new Date("2026-03-28T19:01:00.000Z"));
  const execution = new DeploymentExecutionService(undefined, repository, () => new Date("2026-03-28T19:02:00.000Z"), undefined, undefined, diagnosticsService, accessEvaluator, quotaEvaluator);
  const versionManager = new DeploymentVersionManager(repository, execution, accessEvaluator, quotaEvaluator);
  const rollback = new DeploymentRollbackService(repository, versionManager, diagnosticsService, new InMemoryDeploymentRollbackActionRepository(), () => new Date("2026-03-28T19:03:00.000Z"), accessEvaluator, quotaEvaluator);
  const exposureRepository = new InMemoryEndpointExposureRepository();
  const endpointService = new SystemEndpointExposureService(versionManager, repository, exposureRepository, () => new Date("2026-03-28T19:04:00.000Z"));
  const endpointRouting = new EndpointRoutingService(endpointService, versionManager, repository, new DeploymentEndpointRuntimeInvoker());
  const health = new DeploymentHealthMonitor(repository, diagnosticsService, exposureRepository, endpointRouting, versionManager, undefined, undefined, () => new Date("2026-03-28T19:05:00.000Z"));

  const backend = new DeploymentBackendApi(buildPipeline, execution, versionManager, rollback, health, repository);
  const client = new DeploymentClient({
    transport: new DeploymentApiSdkTransport(backend),
    accessContext: {
      callerKind: "user",
      callerId: "deploy-user-2",
      roles: ["deployer", "deployment-viewer", "deployment-manager", "deployment-rollback"],
      tenantId: "tenant-alpha",
      source: "external-api",
    },
  });

  return { client };
}

describe("DeploymentClient SDK", () => {
  it("invokes deployment API via public SDK contract and returns typed responses", async () => {
    const { client } = createClientHarness();
    const baseline = buildSampleBundle();

    const started = await client.startDeployment({
      requestId: "deploy:client:v1",
      requestedAt: "2026-03-28T19:10:00.000Z",
      systemPackage: baseline.systemPackage,
      target: baseline.target,
      deploymentConfiguration: baseline.deploymentConfiguration,
      selection: {
        targetId: baseline.target.targetId.value,
        targetType: baseline.target.type,
        tenantId: "tenant-alpha",
      },
    });

    expect(started.ok, started.error?.message).toBeTrue();
    expect(started.data?.deployment.deploymentId).toBeDefined();

    const status = await client.getDeploymentStatus({
      deploymentId: started.data!.deployment.deploymentId,
      tenantId: "tenant-alpha",
    });
    expect(status.ok, status.error?.message).toBeTrue();
    expect(status.data?.deployment.deploymentId).toBe(started.data?.deployment.deploymentId);

    const deployments = await client.listDeployments({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      tenantId: "tenant-alpha",
    });
    expect(deployments.ok, deployments.error?.message).toBeTrue();
    expect((deployments.data?.deployments.length ?? 0) >= 1).toBeTrue();

    const health = await client.getDeploymentHealth({
      deploymentId: started.data!.deployment.deploymentId,
      tenantId: "tenant-alpha",
    });
    expect(health.ok, health.error?.message).toBeTrue();
    expect(health.data?.deploymentId).toBe(started.data?.deployment.deploymentId);
  });

  it("surfaces structured errors without leaking internal exceptions", async () => {
    const { client } = createClientHarness();

    const missing = await client.getDeploymentStatus({
      deploymentId: "deployment:missing",
      tenantId: "tenant-alpha",
    });

    expect(missing.ok).toBeFalse();
    expect(missing.error?.code).toBe("not-found");
    expect(Object.keys(missing.error ?? {})).toEqual(expect.arrayContaining(["code", "message"]));
  });

  it("allows per-call context overrides while keeping the SDK client thin", async () => {
    const calls: Array<{ request: unknown; context: unknown }> = [];
    const transport: DeploymentSdkTransport = {
      async startDeployment(request, context) {
        calls.push({ request, context });
        return Object.freeze({
          ok: true,
          data: {
            deployment: {
              deploymentId: "deployment:sdk:1",
              requestId: "deploy:req",
              status: "succeeded",
              state: "active",
              activationState: "inactive",
              activationUpdatedAt: "2026-03-28T19:20:00.000Z",
              rootSystemAssetId: "system:root",
              rootSystemVersionId: "system:root:v1",
              packageId: "system-package:root:v1",
              bundleId: "deployment-bundle:1",
              bundleVersionKey: "key",
              deploymentConfigurationId: "deploy-config:1",
              targetId: "target:cloud-generic",
              targetType: "cloud",
              nestedSystemCount: 1,
              deployedAt: "2026-03-28T19:20:00.000Z",
            },
            issues: [],
          },
        });
      },
      async getDeploymentStatus() { throw new Error("not-used"); },
      async listDeployments() { throw new Error("not-used"); },
      async getActiveDeployment() { throw new Error("not-used"); },
      async rollbackDeployment() { throw new Error("not-used"); },
      async getDeploymentHealth() { throw new Error("not-used"); },
    };

    const client = new DeploymentClient({
      transport,
      authentication: { bearerToken: "default-token" },
      accessContext: { callerKind: "user", callerId: "default-caller" },
    });

    const baseline = buildSampleBundle({ systemPackage: buildSampleBundle().systemPackage });

    const response = await client.startDeployment({
      requestId: "deploy:req",
      requestedAt: "2026-03-28T19:20:00.000Z",
      systemPackage: baseline.systemPackage,
      target: baseline.target,
      deploymentConfiguration: baseline.deploymentConfiguration,
    }, {
      authentication: { bearerToken: "override-token" },
      accessContext: { callerKind: "service", callerId: "svc-1" },
    });

    expect(response.ok).toBeTrue();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.context).toEqual({
      authentication: { bearerToken: "override-token" },
      accessContext: { callerKind: "service", callerId: "svc-1" },
    });
  });
});

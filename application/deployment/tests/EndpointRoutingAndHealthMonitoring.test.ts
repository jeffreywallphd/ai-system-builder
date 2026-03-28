import { describe, expect, it } from "bun:test";
import { createSystemPackage } from "../../../domain/system-packaging/SystemPackagingDomain";
import { DeploymentExecutionService, InMemoryDeploymentRecordRepository } from "../DeploymentExecutionService";
import { DeploymentVersionManager } from "../DeploymentVersionManager";
import {
  DeploymentAccessEvaluator,
  RoleBasedDeploymentAccessPolicy,
  type DeploymentAccessContext,
} from "../DeploymentAccessControl";
import { DeploymentQuotaEvaluator } from "../DeploymentQuotaEvaluator";
import {
  InMemoryEndpointExposureRepository,
  SystemEndpointExposureService,
} from "../SystemEndpointExposureService";
import { EndpointRoutingService, type EndpointRuntimeInvocationRequest } from "../EndpointRoutingService";
import { buildSampleBundle, createSampleConfiguration } from "./testUtils";
import { DeploymentHealthMonitor } from "../DeploymentHealthMonitor";
import { DeploymentDiagnosticsService } from "../DeploymentDiagnosticsService";

const operatorContext: DeploymentAccessContext = Object.freeze({
  caller: Object.freeze({
    callerKind: "user",
    callerId: "caller:deploy-operator",
    roles: Object.freeze(["deployer", "deployment-manager", "deployment-rollback", "deployment-viewer"]),
  }),
  tenantId: "tenant:alpha",
  source: "deployment-api",
});

class RecordingRuntimeInvoker {
  public readonly calls: EndpointRuntimeInvocationRequest[] = [];

  public async invoke(request: EndpointRuntimeInvocationRequest): Promise<unknown> {
    this.calls.push(request);
    return Object.freeze({
      ok: true,
      data: Object.freeze({
        executionId: request.executionId ?? "ext-exec:routed",
        systemId: request.systemId,
        versionId: request.versionId,
      }),
    });
  }
}

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
  const diagnosticsService = new DeploymentDiagnosticsService(undefined, () => new Date("2026-03-28T21:11:00.000Z"));
  const executionService = new DeploymentExecutionService(undefined, repository, () => new Date("2026-03-28T21:11:00.000Z"), undefined, undefined, diagnosticsService, accessEvaluator, quotaEvaluator);
  const versionManager = new DeploymentVersionManager(repository, executionService, accessEvaluator, quotaEvaluator);
  const endpointRepository = new InMemoryEndpointExposureRepository();
  const endpointService = new SystemEndpointExposureService(versionManager, repository, endpointRepository, () => new Date("2026-03-28T21:12:00.000Z"));
  const runtimeInvoker = new RecordingRuntimeInvoker();
  const endpointRouting = new EndpointRoutingService(endpointService, versionManager, repository, runtimeInvoker);
  const healthMonitor = new DeploymentHealthMonitor(
    repository,
    diagnosticsService,
    endpointRepository,
    endpointRouting,
    versionManager,
    undefined,
    undefined,
    () => new Date("2026-03-28T21:13:00.000Z"),
  );

  return {
    executionService,
    versionManager,
    endpointService,
    endpointRouting,
    healthMonitor,
    runtimeInvoker,
    diagnosticsService,
  };
}

describe("EndpointRoutingService", () => {
  it("routes endpoint invocations to the correct active deployment and runtime path", async () => {
    const { executionService, versionManager, endpointService, endpointRouting, runtimeInvoker } = createHarness();
    const baseline = buildSampleBundle();

    const v7 = executionService.executeLifecycle({
      requestId: "deploy:req:route:v7",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T21:00:00.000Z",
    }, {
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    }).deployment!;

    const packageV8 = createSystemPackage({
      packageId: "system-package:system:root:v8:v1:routing",
      manifest: {
        ...baseline.systemPackage.manifest,
        rootSystemVersionId: "system:root:v8",
        dependencyGraph: {
          nodes: baseline.systemPackage.manifest.dependencyGraph.nodes.map((node) => node.relation === "root" ? { ...node, versionId: "system:root:v8" } : node),
          edges: baseline.systemPackage.manifest.dependencyGraph.edges,
        },
      },
    });
    const configV8 = createSampleConfiguration({ systemPackage: packageV8, target: baseline.target, configurationId: "deploy-config:routing:v8" });
    const v8 = executionService.executeLifecycle({
      requestId: "deploy:req:route:v8",
      bundle: buildSampleBundle({ systemPackage: packageV8, target: baseline.target, deploymentConfiguration: configV8 }).bundle,
      deploymentConfiguration: configV8,
      target: baseline.target,
      requestedAt: "2026-03-28T21:00:30.000Z",
    }, {
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    }).deployment!;

    versionManager.setActiveDeployment({
      deploymentId: v7.deploymentId,
      reason: "promote-v7",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });

    const exposureV7 = endpointService.exposeActiveDeployment({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      endpointName: "route-prod",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });

    const firstRoute = endpointRouting.resolveRoute({
      endpointId: exposureV7.endpoint.endpointId.value,
      invocation: Object.freeze({}),
      callerContext: operatorContext.caller,
      tenantId: "tenant:alpha",
      requestSource: "external-api",
    });
    expect(firstRoute.resolvedEndpoint.deploymentId).toBe(v7.deploymentId);

    versionManager.setActiveDeployment({
      deploymentId: v8.deploymentId,
      reason: "promote-v8",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });

    const exposureV8 = endpointService.exposeActiveDeployment({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      endpointName: "route-prod",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });

    expect(exposureV8.endpoint.endpointId.value).toBe(exposureV7.endpoint.endpointId.value);

    const invocation = await endpointRouting.invokeEndpoint({
      endpointId: exposureV8.endpoint.endpointId.value,
      invocation: Object.freeze({
        executionId: "ext-exec:endpoint-route",
        inputPayload: Object.freeze({ message: "hello" }),
        inputContentType: "application/json",
      }),
      callerContext: operatorContext.caller,
      authentication: Object.freeze({ bearerToken: "token" }),
      tenantId: "tenant:alpha",
      requestSource: "external-api",
    });

    expect(invocation.route.resolvedEndpoint.deploymentId).toBe(v8.deploymentId);
    expect(invocation.route.resolvedEndpoint.rootSystemVersionId).toBe("system:root:v8");
    expect(invocation.route.resolvedEndpoint.nestedSystemCount).toBeGreaterThan(0);
    expect(runtimeInvoker.calls.length).toBe(1);
    expect(runtimeInvoker.calls[0]?.systemId).toBe("system:root");
    expect(runtimeInvoker.calls[0]?.versionId).toBe("system:root:v8");
    expect(runtimeInvoker.calls[0]?.tenantId).toBe("tenant:alpha");
  });

  it("enforces tenant/environment isolation during endpoint route resolution", () => {
    const { executionService, versionManager, endpointService, endpointRouting } = createHarness();
    const baseline = buildSampleBundle();
    const deployment = executionService.executeLifecycle({
      requestId: "deploy:req:route:isolation",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T21:03:00.000Z",
    }, {
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    }).deployment!;

    versionManager.setActiveDeployment({
      deploymentId: deployment.deploymentId,
      reason: "promote-isolated",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });

    const exposure = endpointService.exposeActiveDeployment({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      endpointName: "isolation-prod",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });

    expect(() => endpointRouting.resolveRoute({
      endpointId: exposure.endpoint.endpointId.value,
      invocation: Object.freeze({}),
      callerContext: operatorContext.caller,
      tenantId: "tenant:beta",
      requestSource: "external-api",
    })).toThrow();
  });
});

describe("DeploymentHealthMonitor", () => {
  it("evaluates bounded health states from deployment + endpoint routing signals", () => {
    const { executionService, versionManager, endpointService, healthMonitor, diagnosticsService } = createHarness();
    const baseline = buildSampleBundle();

    const healthyCandidate = executionService.executeLifecycle({
      requestId: "deploy:req:health:healthy",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T21:06:00.000Z",
    }, {
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    }).deployment!;

    versionManager.setActiveDeployment({
      deploymentId: healthyCandidate.deploymentId,
      reason: "promote-health",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });

    const exposure = endpointService.exposeActiveDeployment({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      endpointName: "health-prod",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });

    const healthy = healthMonitor.getDeploymentHealth({
      deploymentId: healthyCandidate.deploymentId,
      callerContext: operatorContext.caller,
      tenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });

    expect(healthy.status).toBe("healthy");
    expect(healthy.linkage.endpointIds).toContain(exposure.endpoint.endpointId.value);
    expect(healthy.linkage.activeDeploymentId).toBe(healthyCandidate.deploymentId);

    const packageV9 = createSystemPackage({
      packageId: "system-package:system:root:v9:v1:health",
      manifest: {
        ...baseline.systemPackage.manifest,
        rootSystemVersionId: "system:root:v9",
        dependencyGraph: {
          nodes: baseline.systemPackage.manifest.dependencyGraph.nodes.map((node) => node.relation === "root" ? { ...node, versionId: "system:root:v9" } : node),
          edges: baseline.systemPackage.manifest.dependencyGraph.edges,
        },
      },
    });
    const configV9 = createSampleConfiguration({ systemPackage: packageV9, target: baseline.target, configurationId: "deploy-config:health:v9" });
    const next = executionService.executeLifecycle({
      requestId: "deploy:req:health:v9",
      bundle: buildSampleBundle({ systemPackage: packageV9, target: baseline.target, deploymentConfiguration: configV9 }).bundle,
      deploymentConfiguration: configV9,
      target: baseline.target,
      requestedAt: "2026-03-28T21:08:00.000Z",
    }, {
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    }).deployment!;

    versionManager.setActiveDeployment({
      deploymentId: next.deploymentId,
      reason: "promote-v9",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });

    const supersededHealth = healthMonitor.getDeploymentHealth({
      deploymentId: healthyCandidate.deploymentId,
      callerContext: operatorContext.caller,
      tenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });
    expect(supersededHealth.status).toBe("unknown");

    const diagnostics = executionService.listDeploymentDiagnostics(next.deploymentId, {
      tenantId: "tenant:alpha",
      deploymentEnvironmentId: next.provisionedEnvironmentId,
      targetId: next.targetId,
      targetType: next.targetType,
    });
    expect(diagnostics.length).toBe(0);

    diagnosticsService.recordFailure({
      deploymentId: next.deploymentId,
      eventKind: "post-deploy-check",
      code: "endpoint-latency",
      summary: "Latency above threshold",
      details: Object.freeze({ p95: "1500ms" }),
    });

    endpointService.exposeActiveDeployment({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      endpointName: "health-prod",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });

    const degraded = healthMonitor.getDeploymentHealth({
      deploymentId: next.deploymentId,
      callerContext: operatorContext.caller,
      tenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });

    expect(degraded.status).toBe("degraded");
    expect(degraded.signals.diagnosticErrorCount).toBeGreaterThan(0);
    expect(degraded.linkage.rootSystemVersionId).toBe("system:root:v9");
    expect(degraded.linkage.nestedSystemCount).toBeGreaterThan(0);
  });
});

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
import { buildSampleBundle, createSampleConfiguration } from "./testUtils";

const operatorContext: DeploymentAccessContext = Object.freeze({
  caller: Object.freeze({
    callerKind: "user",
    callerId: "caller:deploy-operator",
    roles: Object.freeze(["deployer", "deployment-manager", "deployment-rollback", "deployment-viewer"]),
  }),
  tenantId: "tenant:alpha",
  source: "deployment-api",
});

function createServices() {
  const repository = new InMemoryDeploymentRecordRepository();
  const accessEvaluator = new DeploymentAccessEvaluator(new RoleBasedDeploymentAccessPolicy());
  const quotaEvaluator = new DeploymentQuotaEvaluator({
    maxDeploymentsPerCallerPerWindow: 100,
    maxDeploymentsPerTargetPerWindow: 100,
    maxActivationChangesPerTargetPerWindow: 100,
    maxRollbacksPerTargetPerWindow: 100,
    windowMs: 60_000,
  });
  const executionService = new DeploymentExecutionService(undefined, repository, () => new Date("2026-03-28T19:11:00.000Z"), undefined, undefined, undefined, accessEvaluator, quotaEvaluator);
  const versionManager = new DeploymentVersionManager(repository, executionService, accessEvaluator, quotaEvaluator);
  const endpointService = new SystemEndpointExposureService(versionManager, repository, new InMemoryEndpointExposureRepository(), () => new Date("2026-03-28T19:12:00.000Z"));
  return { executionService, versionManager, endpointService };
}

describe("Deployment isolation", () => {
  it("isolates deployment records/state/logs by tenant and environment context", () => {
    const { executionService } = createServices();
    const baseline = buildSampleBundle();

    const alpha = executionService.executeLifecycle({
      requestId: "deploy:req:isolated:alpha",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T19:00:00.000Z",
    }, {
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    }).deployment!;

    const betaContext: DeploymentAccessContext = Object.freeze({ ...operatorContext, tenantId: "tenant:beta" });
    const beta = executionService.executeLifecycle({
      requestId: "deploy:req:isolated:beta",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T19:00:30.000Z",
    }, {
      accessContext: betaContext,
      resourceTenantId: "tenant:beta",
      requestSource: "deployment-api",
    }).deployment!;

    expect(alpha.isolation.boundary.tenantId).toBe("tenant:alpha");
    expect(beta.isolation.boundary.tenantId).toBe("tenant:beta");

    const alphaScope = {
      tenantId: "tenant:alpha",
      deploymentEnvironmentId: alpha.provisionedEnvironmentId,
      targetId: alpha.targetId,
      targetType: alpha.targetType,
    } as const;

    const alphaActive = executionService.listDeploymentsByState("active", alphaScope);
    expect(alphaActive.map((entry) => entry.deploymentId)).toContain(alpha.deploymentId);
    expect(alphaActive.map((entry) => entry.deploymentId)).not.toContain(beta.deploymentId);

    const logs = executionService.listDeploymentLogs(alpha.deploymentId, alphaScope);
    const diagnostics = executionService.listDeploymentDiagnostics(alpha.deploymentId, alphaScope);
    expect(logs.length).toBeGreaterThan(0);
    expect(diagnostics.length).toBeGreaterThanOrEqual(0);

    expect(() => executionService.getDeploymentIsolated({
      deploymentId: alpha.deploymentId,
      isolationContext: {
        tenantId: "tenant:beta",
        deploymentEnvironmentId: alpha.provisionedEnvironmentId,
        targetId: alpha.targetId,
        targetType: alpha.targetType,
      },
    })).toThrow();
  });

  it("keeps active deployment management scoped by isolation boundaries", () => {
    const { executionService, versionManager } = createServices();
    const baseline = buildSampleBundle();

    const v1 = executionService.executeLifecycle({
      requestId: "deploy:req:isolation:active:v1",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T19:10:00.000Z",
    }, {
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    }).deployment!;

    const packageV2 = createSystemPackage({
      packageId: "system-package:system:root:v8:v1:isolation",
      manifest: {
        ...baseline.systemPackage.manifest,
        rootSystemVersionId: "system:root:v8",
        dependencyGraph: {
          nodes: baseline.systemPackage.manifest.dependencyGraph.nodes.map((node) => node.relation === "root" ? { ...node, versionId: "system:root:v8" } : node),
          edges: baseline.systemPackage.manifest.dependencyGraph.edges,
        },
      },
    });
    const configV2 = createSampleConfiguration({ systemPackage: packageV2, target: baseline.target, configurationId: "deploy-config:isolation:v2" });
    const v2 = executionService.executeLifecycle({
      requestId: "deploy:req:isolation:active:v2",
      bundle: buildSampleBundle({ systemPackage: packageV2, target: baseline.target, deploymentConfiguration: configV2 }).bundle,
      deploymentConfiguration: configV2,
      target: baseline.target,
      requestedAt: "2026-03-28T19:10:30.000Z",
    }, {
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    }).deployment!;

    versionManager.setActiveDeployment({
      deploymentId: v1.deploymentId,
      reason: "seed-v1",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });
    const promotion = versionManager.setActiveDeployment({
      deploymentId: v2.deploymentId,
      reason: "promote-v2",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });
    expect(promotion.active.deploymentId).toBe(v2.deploymentId);

    const tenantBetaContext: DeploymentAccessContext = Object.freeze({ ...operatorContext, tenantId: "tenant:beta" });
    const deniedLookup = versionManager.getActiveDeployment({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      accessContext: tenantBetaContext,
      resourceTenantId: "tenant:beta",
      requestSource: "deployment-api",
    });
    expect(deniedLookup).toBeUndefined();
  });
});

describe("System endpoint exposure", () => {
  it("exposes and resolves stable endpoint identities linked to active deployments and updates on activation changes", () => {
    const { executionService, versionManager, endpointService } = createServices();
    const baseline = buildSampleBundle();
    const v7 = executionService.executeLifecycle({
      requestId: "deploy:req:endpoint:v7",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T19:20:00.000Z",
    }, {
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    }).deployment!;

    const packageV8 = createSystemPackage({
      packageId: "system-package:system:root:v8:v1:endpoint",
      manifest: {
        ...baseline.systemPackage.manifest,
        rootSystemVersionId: "system:root:v8",
        dependencyGraph: {
          nodes: baseline.systemPackage.manifest.dependencyGraph.nodes.map((node) => node.relation === "root" ? { ...node, versionId: "system:root:v8" } : node),
          edges: baseline.systemPackage.manifest.dependencyGraph.edges,
        },
      },
    });
    const configV8 = createSampleConfiguration({ systemPackage: packageV8, target: baseline.target, configurationId: "deploy-config:endpoint:v8" });
    const v8 = executionService.executeLifecycle({
      requestId: "deploy:req:endpoint:v8",
      bundle: buildSampleBundle({ systemPackage: packageV8, target: baseline.target, deploymentConfiguration: configV8 }).bundle,
      deploymentConfiguration: configV8,
      target: baseline.target,
      requestedAt: "2026-03-28T19:20:30.000Z",
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
    const firstExposure = endpointService.exposeActiveDeployment({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      endpointName: "root-prod",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });
    expect(firstExposure.deploymentId).toBe(v7.deploymentId);
    expect(firstExposure.endpoint.endpointId.value).toBeDefined();

    versionManager.setActiveDeployment({
      deploymentId: v8.deploymentId,
      reason: "promote-v8",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });
    const secondExposure = endpointService.exposeActiveDeployment({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      endpointName: "root-prod",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });

    expect(secondExposure.endpoint.endpointId.value).toBe(firstExposure.endpoint.endpointId.value);
    expect(secondExposure.deploymentId).toBe(v8.deploymentId);

    const resolved = endpointService.resolveEndpoint({
      endpointId: secondExposure.endpoint.endpointId.value,
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });
    expect(resolved?.deploymentId).toBe(v8.deploymentId);
    expect(resolved?.rootSystemVersionId).toBe("system:root:v8");
    expect(resolved?.endpoint.deploymentEnvironmentId).toBe(v8.provisionedEnvironmentId);
  });

  it("enforces endpoint exposure isolation across tenant contexts including nested bundles", () => {
    const { executionService, versionManager, endpointService } = createServices();
    const baseline = buildSampleBundle();
    const deployment = executionService.executeLifecycle({
      requestId: "deploy:req:endpoint:nested",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T19:30:00.000Z",
    }, {
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    }).deployment!;
    expect(deployment.nestedSystemCount).toBeGreaterThan(0);
    versionManager.setActiveDeployment({
      deploymentId: deployment.deploymentId,
      reason: "promote-nested",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });
    const exposed = endpointService.exposeActiveDeployment({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      endpointName: "nested-prod",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });

    const tenantBetaContext: DeploymentAccessContext = Object.freeze({ ...operatorContext, tenantId: "tenant:beta" });
    expect(() => endpointService.resolveEndpoint({
      endpointId: exposed.endpoint.endpointId.value,
      accessContext: tenantBetaContext,
      resourceTenantId: "tenant:beta",
      requestSource: "deployment-api",
    })).toThrow();
  });
});

import { describe, expect, it } from "bun:test";
import { DeploymentExecutionService, InMemoryDeploymentRecordRepository } from "../DeploymentExecutionService";
import { DeploymentVersionManager } from "../DeploymentVersionManager";
import { DeploymentRollbackService, InMemoryDeploymentRollbackActionRepository } from "../DeploymentRollbackService";
import { DeploymentDiagnosticsService, InMemoryDeploymentDiagnosticsRepository } from "../DeploymentDiagnosticsService";
import {
  DeploymentAccessDeniedError,
  DeploymentAccessEvaluator,
  RoleBasedDeploymentAccessPolicy,
  type DeploymentAccessContext,
} from "../DeploymentAccessControl";
import {
  DeploymentQuotaEvaluator,
  DeploymentQuotaExceededError,
} from "../DeploymentQuotaEvaluator";
import { buildSampleBundle, createSampleConfiguration } from "./testUtils";
import { createSystemPackage } from "../../../domain/system-packaging/SystemPackagingDomain";

const operatorContext: DeploymentAccessContext = Object.freeze({
  caller: Object.freeze({
    callerKind: "user",
    callerId: "caller:deploy-operator",
    roles: Object.freeze(["deployer", "deployment-manager", "deployment-rollback", "deployment-viewer"]),
  }),
  tenantId: "tenant:alpha",
  source: "deployment-api",
});

function createGovernedServices(input?: {
  readonly quotaPolicy?: ConstructorParameters<typeof DeploymentQuotaEvaluator>[0];
}) {
  const diagnostics = new DeploymentDiagnosticsService(new InMemoryDeploymentDiagnosticsRepository(), () => new Date("2026-03-28T18:10:00.000Z"));
  const repository = new InMemoryDeploymentRecordRepository();
  const accessEvaluator = new DeploymentAccessEvaluator(new RoleBasedDeploymentAccessPolicy());
  const quotaEvaluator = new DeploymentQuotaEvaluator(input?.quotaPolicy);
  const executionService = new DeploymentExecutionService(undefined, repository, () => new Date("2026-03-28T18:11:00.000Z"), undefined, undefined, diagnostics, accessEvaluator, quotaEvaluator);
  const versionManager = new DeploymentVersionManager(repository, executionService, accessEvaluator, quotaEvaluator);
  const rollbackService = new DeploymentRollbackService(
    repository,
    versionManager,
    diagnostics,
    new InMemoryDeploymentRollbackActionRepository(),
    () => new Date("2026-03-28T18:12:00.000Z"),
    accessEvaluator,
    quotaEvaluator,
  );

  return { executionService, versionManager, rollbackService };
}

describe("Deployment governance: access control", () => {
  it("allows authorized deployment/activation/rollback operations", () => {
    const { executionService, versionManager, rollbackService } = createGovernedServices();

    const baseline = buildSampleBundle();
    const v7 = executionService.executeLifecycle({
      requestId: "deploy:req:gov:v7",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T18:00:00.000Z",
    }, {
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    }).deployment!;

    const packageV8 = createSystemPackage({
      packageId: "system-package:system:root:v8:v1:governance",
      manifest: {
        ...baseline.systemPackage.manifest,
        rootSystemVersionId: "system:root:v8",
        dependencyGraph: {
          nodes: baseline.systemPackage.manifest.dependencyGraph.nodes.map((node) => (
            node.relation === "root" ? { ...node, versionId: "system:root:v8" } : node
          )),
          edges: baseline.systemPackage.manifest.dependencyGraph.edges,
        },
      },
    });
    const configV8 = createSampleConfiguration({
      systemPackage: packageV8,
      target: baseline.target,
      configurationId: "deploy-config:gov:v8",
    });

    const v8 = executionService.executeLifecycle({
      requestId: "deploy:req:gov:v8",
      bundle: buildSampleBundle({ systemPackage: packageV8, target: baseline.target, deploymentConfiguration: configV8 }).bundle,
      deploymentConfiguration: configV8,
      target: baseline.target,
      requestedAt: "2026-03-28T18:01:00.000Z",
    }, {
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    }).deployment!;

    versionManager.setActiveDeployment({
      deploymentId: v7.deploymentId,
      reason: "seed-active",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });
    versionManager.setActiveDeployment({
      deploymentId: v8.deploymentId,
      reason: "promote-v8",
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });

    const rollback = rollbackService.rollback({
      requestId: "rollback:req:gov:1",
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      requestedBy: "caller:deploy-operator",
      requestedAt: "2026-03-28T18:02:00.000Z",
      toDeploymentId: v7.deploymentId,
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });

    expect(rollback.performed).toBeTrue();

    const history = versionManager.listDeploymentHistory({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });
    expect(history.length).toBeGreaterThanOrEqual(2);

    const actions = rollbackService.listRollbackActions({
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });
    expect(actions.length).toBe(1);
  });

  it("denies unauthorized and tenant-mismatched deployment operations with structured access errors", () => {
    const { executionService } = createGovernedServices();
    const baseline = buildSampleBundle();

    const unauthorizedContext: DeploymentAccessContext = Object.freeze({
      caller: Object.freeze({
        callerKind: "user",
        callerId: "caller:readonly",
        roles: Object.freeze(["deployment-viewer"]),
      }),
      tenantId: "tenant:alpha",
      source: "deployment-api",
    });

    expect(() => executionService.executeLifecycle({
      requestId: "deploy:req:unauthorized",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T18:20:00.000Z",
    }, {
      accessContext: unauthorizedContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    })).toThrow(DeploymentAccessDeniedError);

    const tenantMismatchContext: DeploymentAccessContext = Object.freeze({
      ...operatorContext,
      tenantId: "tenant:beta",
    });

    expect(() => executionService.executeLifecycle({
      requestId: "deploy:req:tenant-mismatch",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T18:21:00.000Z",
    }, {
      accessContext: tenantMismatchContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    })).toThrow(DeploymentAccessDeniedError);
  });
});

describe("Deployment governance: quotas and limits", () => {
  it("enforces deployment quotas distinctly from access decisions", () => {
    const { executionService } = createGovernedServices({
      quotaPolicy: {
        maxDeploymentsPerCallerPerWindow: 1,
        maxDeploymentsPerTargetPerWindow: 5,
        maxActivationChangesPerTargetPerWindow: 5,
        maxRollbacksPerTargetPerWindow: 5,
        windowMs: 600_000,
      },
    });

    const baseline = buildSampleBundle();
    executionService.executeLifecycle({
      requestId: "deploy:req:quota:1",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T18:30:00.000Z",
    }, {
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });

    expect(() => executionService.executeLifecycle({
      requestId: "deploy:req:quota:2",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T18:31:00.000Z",
    }, {
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    })).toThrow(DeploymentQuotaExceededError);
  });

  it("applies quota limits with tenant-aware caller scope and bounded activation frequency", () => {
    const { executionService, versionManager } = createGovernedServices({
      quotaPolicy: {
        maxDeploymentsPerCallerPerWindow: 1,
        maxDeploymentsPerTargetPerWindow: 10,
        maxActivationChangesPerTargetPerWindow: 1,
        maxRollbacksPerTargetPerWindow: 5,
        windowMs: 600_000,
      },
    });

    const baseline = buildSampleBundle();
    const first = executionService.executeLifecycle({
      requestId: "deploy:req:tenant:alpha",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T18:40:00.000Z",
    }, {
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    }).deployment!;

    const tenantBetaContext: DeploymentAccessContext = Object.freeze({
      ...operatorContext,
      tenantId: "tenant:beta",
    });
    const second = executionService.executeLifecycle({
      requestId: "deploy:req:tenant:beta",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T18:41:00.000Z",
    }, {
      accessContext: tenantBetaContext,
      resourceTenantId: "tenant:beta",
      requestSource: "deployment-api",
    }).deployment!;

    expect(first.deploymentId).not.toBe(second.deploymentId);

    versionManager.setActiveDeployment({
      deploymentId: first.deploymentId,
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
      reason: "promote-initial",
    });

    expect(() => versionManager.setActiveDeployment({
      deploymentId: second.deploymentId,
      accessContext: operatorContext,
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
      reason: "promote-again",
    })).toThrow(DeploymentQuotaExceededError);
  });
});

import { describe, expect, it } from "bun:test";
import { AssetVersion } from "../../../../src/domain/assets/AssetVersion";
import { SystemPackagingService } from "../../../../application/system-packaging/SystemPackagingService";
import { DeploymentBuildPipeline } from "../../../../application/deployment/DeploymentBuildPipeline";
import {
  DeploymentExecutionService,
  InMemoryDeploymentRecordRepository,
} from "../../../../application/deployment/DeploymentExecutionService";
import {
  DeploymentDiagnosticsService,
  InMemoryDeploymentDiagnosticsRepository,
} from "../../../../application/deployment/DeploymentDiagnosticsService";
import {
  createDeploymentConfigurationContract,
  type DeploymentConfigurationContract,
} from "../../../../src/domain/deployment/DeploymentConfigurationDomain";
import {
  createDeploymentTarget,
  DeploymentTargetTypes,
  type DeploymentTarget,
} from "../../../../src/domain/deployment/DeploymentTargetDomain";
import {
  DeploymentAccessEvaluator,
  RoleBasedDeploymentAccessPolicy,
  type DeploymentAccessContext,
} from "../../../../application/deployment/DeploymentAccessControl";
import { DeploymentQuotaEvaluator } from "../../../../application/deployment/DeploymentQuotaEvaluator";
import { DeploymentVersionManager } from "../../../../application/deployment/DeploymentVersionManager";
import {
  InMemoryEndpointExposureRepository,
  SystemEndpointExposureService,
} from "../../../../application/deployment/SystemEndpointExposureService";
import { EndpointRoutingService } from "../../../../application/deployment/EndpointRoutingService";
import { DeploymentHealthMonitor } from "../../../../application/deployment/DeploymentHealthMonitor";
import { DeploymentRollbackService, InMemoryDeploymentRollbackActionRepository } from "../../../../application/deployment/DeploymentRollbackService";
import {
  DeploymentAuditTrailService,
  InMemoryDeploymentAuditRepository,
} from "../../../../application/deployment/DeploymentAuditTrailService";
import type { IStudioShellRepository } from "../../../../application/ports/interfaces/IStudioShellRepository";
import type { Studio, AssetSession, AssetDraft } from "../../../../src/domain/studio-shell/StudioShellDomain";
import { SystemRuntimeBackendApi } from "../../system-runtime/SystemRuntimeBackendApi";
import { ExternalSystemRuntimeInterface } from "../../system-runtime/ExternalSystemRuntimeInterface";
import { DeploymentEndpointRuntimeInvoker } from "../../system-runtime/DeploymentEndpointRuntimeInvoker";

class InMemoryStudioShellRepository implements IStudioShellRepository {
  private readonly studios = new Map<string, Studio>();
  private readonly sessions = new Map<string, AssetSession>();
  private readonly drafts = new Map<string, AssetDraft>();
  private readonly versions = new Map<string, AssetVersion>();

  async saveStudio(studio: Studio): Promise<Studio> { this.studios.set(studio.id, studio); return studio; }
  async getStudio(studioId: string): Promise<Studio | undefined> { return this.studios.get(studioId); }
  async saveSession(session: AssetSession): Promise<AssetSession> { this.sessions.set(session.id, session); return session; }
  async getSession(sessionId: string): Promise<AssetSession | undefined> { return this.sessions.get(sessionId); }
  async listStudioSessions(studioId: string): Promise<ReadonlyArray<AssetSession>> { return [...this.sessions.values()].filter((entry) => entry.studioId === studioId); }
  async saveDraft(draft: AssetDraft): Promise<AssetDraft> { this.drafts.set(draft.id, draft); return draft; }
  async getDraft(draftId: string): Promise<AssetDraft | undefined> { return this.drafts.get(draftId); }
  async listSessionDrafts(sessionId: string): Promise<ReadonlyArray<AssetDraft>> { return [...this.drafts.values()].filter((entry) => entry.sessionId === sessionId); }
  async saveAssetVersion(version: AssetVersion): Promise<AssetVersion> { this.versions.set(version.versionId, version); return version; }
  async getAssetVersion(versionId: string): Promise<AssetVersion | undefined> { return this.versions.get(versionId); }
  async listAssetVersionsByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>> { return [...this.versions.values()].filter((entry) => entry.assetId.value === assetId); }
}

const accessContext: DeploymentAccessContext = Object.freeze({
  caller: Object.freeze({
    callerKind: "user",
    callerId: "deploy-interop-user",
    roles: ["deployer", "deployment-viewer", "deployment-manager", "deployment-rollback"],
  }),
  tenantId: "tenant-interop",
  source: "external-api",
});

function createTarget(targetId: string, type: DeploymentTarget["type"]): DeploymentTarget {
  return createDeploymentTarget({
    targetId,
    name: targetId,
    type,
    capabilities: {
      supportsNestedSystems: true,
      maxDependencyDepth: 6,
      supportedRuntimeEnvironments: ["container", "local"],
      providedRuntimeRequirements: ["network"],
      supportedExportTargets: ["registry", "archive"],
      supportedDeploymentSettings: ["region", "namespace"],
      supportedRuntimeSettings: ["runtimeEnvironment", "runtimeRequirements"],
    },
  });
}

function createConfiguration(input: {
  packageId: string;
  rootSystemAssetId: string;
  rootSystemVersionId: string;
  target: DeploymentTarget;
  configurationId: string;
}): DeploymentConfigurationContract {
  return createDeploymentConfigurationContract({
    configurationId: input.configurationId,
    packageId: input.packageId,
    rootSystemAssetId: input.rootSystemAssetId,
    rootSystemVersionId: input.rootSystemVersionId,
    targetId: input.target.targetId.value,
    targetType: input.target.type,
    schema: {
      schemaId: "schema:deployment:interop:v1",
      schemaVersion: "v1",
      requiredDeploymentSettings: ["region"],
      optionalDeploymentSettings: ["namespace"],
      requiredRuntimeSettings: ["runtimeEnvironment"],
      optionalRuntimeSettings: ["runtimeRequirements"],
    },
    valueSet: {
      deploymentSettings: { region: "us-west-2", namespace: "interop" },
      runtimeSettings: { runtimeEnvironment: "container", runtimeRequirements: "network" },
    },
    nestedSystemBindings: [],
    createdAt: "2026-03-28T23:00:00.000Z",
  });
}

async function seedSystems(repository: InMemoryStudioShellRepository): Promise<void> {
  for (const version of [
    new AssetVersion({
      assetId: "system:interop-a",
      versionId: "system:interop-a:v1",
      metadata: {
        metadata: { taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" } },
        dependencies: [],
        content: JSON.stringify({ systemSpec: { components: [], inputs: [{ inputId: "request", valueType: "string", required: true }], outputs: [{ outputId: "response", valueType: "string" }] } }),
      },
    }),
    new AssetVersion({
      assetId: "system:interop-a",
      versionId: "system:interop-a:v2",
      parentVersionId: "system:interop-a:v1",
      metadata: {
        metadata: { taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" } },
        dependencies: [],
        content: JSON.stringify({ systemSpec: { components: [], inputs: [{ inputId: "request", valueType: "string", required: true }], outputs: [{ outputId: "response", valueType: "string" }] } }),
      },
    }),
    new AssetVersion({
      assetId: "system:interop-b",
      versionId: "system:interop-b:v1",
      metadata: {
        metadata: { taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" } },
        dependencies: [],
        content: JSON.stringify({ systemSpec: { components: [], inputs: [{ inputId: "request", valueType: "string", required: true }], outputs: [{ outputId: "response", valueType: "string" }] } }),
      },
    }),
    new AssetVersion({
      assetId: "system:interop-parent",
      versionId: "system:interop-parent:v1",
      metadata: {
        metadata: { taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" } },
        dependencies: [],
        content: JSON.stringify({
          systemSpec: {
            nestedSystems: [{ assetId: "system:interop-b", versionId: "system:interop-b:v1", alias: "child" }],
            components: [{ componentKind: "system", alias: "child", assetId: "system:interop-b", versionId: "system:interop-b:v1", taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" } }],
            inputs: [{ inputId: "request", valueType: "string", required: true }],
            outputs: [{ outputId: "response", valueType: "string" }],
          },
        }),
      },
    }),
  ]) {
    await repository.saveAssetVersion(version);
  }
}

function createHarness() {
  const runtimeRepository = new InMemoryStudioShellRepository();
  const packaging = new SystemPackagingService(runtimeRepository, () => new Date("2026-03-28T23:00:01.000Z"));
  const deploymentRepository = new InMemoryDeploymentRecordRepository();
  const diagnostics = new DeploymentDiagnosticsService(new InMemoryDeploymentDiagnosticsRepository(), () => new Date("2026-03-28T23:00:02.000Z"));
  const accessEvaluator = new DeploymentAccessEvaluator(new RoleBasedDeploymentAccessPolicy());
  const quotaEvaluator = new DeploymentQuotaEvaluator({
    maxDeploymentsPerCallerPerWindow: 200,
    maxDeploymentsPerTargetPerWindow: 200,
    maxActivationChangesPerTargetPerWindow: 200,
    maxRollbacksPerTargetPerWindow: 200,
    windowMs: 60_000,
  });
  const auditTrail = new DeploymentAuditTrailService(new InMemoryDeploymentAuditRepository());

  const execution = new DeploymentExecutionService(undefined, deploymentRepository, () => new Date("2026-03-28T23:00:03.000Z"), undefined, undefined, diagnostics, accessEvaluator, quotaEvaluator, undefined, auditTrail);
  const versions = new DeploymentVersionManager(deploymentRepository, execution, accessEvaluator, quotaEvaluator, undefined, auditTrail);
  const rollback = new DeploymentRollbackService(deploymentRepository, versions, diagnostics, new InMemoryDeploymentRollbackActionRepository(), () => new Date("2026-03-28T23:00:04.000Z"), accessEvaluator, quotaEvaluator, undefined, auditTrail);

  const endpointRepository = new InMemoryEndpointExposureRepository();
  const endpointService = new SystemEndpointExposureService(versions, deploymentRepository, endpointRepository, () => new Date("2026-03-28T23:00:05.000Z"));
  const runtime = new ExternalSystemRuntimeInterface(new SystemRuntimeBackendApi(runtimeRepository));
  const endpointRouting = new EndpointRoutingService(endpointService, versions, deploymentRepository, new DeploymentEndpointRuntimeInvoker(runtime));
  const health = new DeploymentHealthMonitor(deploymentRepository, diagnostics, endpointRepository, endpointRouting, versions, undefined, undefined, () => new Date("2026-03-28T23:00:06.000Z"));

  return { runtimeRepository, packaging, execution, versions, rollback, endpointService, endpointRouting, health, auditTrail };
}

async function deployVersion(input: {
  harness: ReturnType<typeof createHarness>;
  versionId: string;
  target: DeploymentTarget;
  requestId: string;
  configurationId: string;
}) {
  const pkg = await input.harness.packaging.packageSystemVersion({ versionId: input.versionId });
  const config = createConfiguration({
    packageId: pkg.packageId.value,
    rootSystemAssetId: pkg.manifest.rootSystemAssetId,
    rootSystemVersionId: pkg.manifest.rootSystemVersionId,
    target: input.target,
    configurationId: input.configurationId,
  });
  const bundle = new DeploymentBuildPipeline().build({ systemPackage: pkg, target: input.target, deploymentConfiguration: config });
  expect(bundle.ok).toBeTrue();

  const result = input.harness.execution.executeLifecycle({
    requestId: input.requestId,
    requestedAt: "2026-03-28T23:01:00.000Z",
    bundle: bundle.bundle!,
    target: input.target,
    deploymentConfiguration: config,
  }, {
    accessContext,
    resourceTenantId: accessContext.tenantId,
    requestSource: "external-api",
  });

  expect(result.status).toBe("succeeded");
  return { package: pkg, deployment: result.deployment! };
}

describe("Deployment interop E2E", () => {
  it("keeps deployments isolated across systems, versions, parent/child composition, and target contexts", async () => {
    const harness = createHarness();
    await seedSystems(harness.runtimeRepository);

    const cloudTarget = createTarget("target:cloud:interop", DeploymentTargetTypes.cloud);
    const edgeTarget = createTarget("target:edge:interop", DeploymentTargetTypes.edge);

    const aV1 = await deployVersion({ harness, versionId: "system:interop-a:v1", target: cloudTarget, requestId: "deploy:interop:a:v1", configurationId: "deploy-config:interop:a:v1" });
    const aV2 = await deployVersion({ harness, versionId: "system:interop-a:v2", target: cloudTarget, requestId: "deploy:interop:a:v2", configurationId: "deploy-config:interop:a:v2" });
    const bV1 = await deployVersion({ harness, versionId: "system:interop-b:v1", target: edgeTarget, requestId: "deploy:interop:b:v1", configurationId: "deploy-config:interop:b:v1" });
    const parentV1 = await deployVersion({ harness, versionId: "system:interop-parent:v1", target: cloudTarget, requestId: "deploy:interop:parent:v1", configurationId: "deploy-config:interop:parent:v1" });

    harness.versions.setActiveDeployment({ deploymentId: aV1.deployment.deploymentId, accessContext, resourceTenantId: accessContext.tenantId, requestSource: "external-api", reason: "seed-a-v1" });
    harness.versions.setActiveDeployment({ deploymentId: aV2.deployment.deploymentId, accessContext, resourceTenantId: accessContext.tenantId, requestSource: "external-api", reason: "promote-a-v2" });
    harness.versions.setActiveDeployment({ deploymentId: bV1.deployment.deploymentId, accessContext, resourceTenantId: accessContext.tenantId, requestSource: "external-api", reason: "promote-b-v1" });
    harness.versions.setActiveDeployment({ deploymentId: parentV1.deployment.deploymentId, accessContext, resourceTenantId: accessContext.tenantId, requestSource: "external-api", reason: "promote-parent" });

    const endpointA = harness.endpointService.exposeActiveDeployment({
      rootSystemAssetId: "system:interop-a",
      targetId: cloudTarget.targetId.value,
      targetType: cloudTarget.type,
      endpointName: "interop-a",
      accessContext,
      resourceTenantId: accessContext.tenantId,
      requestSource: "external-api",
    });
    const endpointB = harness.endpointService.exposeActiveDeployment({
      rootSystemAssetId: "system:interop-b",
      targetId: edgeTarget.targetId.value,
      targetType: edgeTarget.type,
      endpointName: "interop-b",
      accessContext,
      resourceTenantId: accessContext.tenantId,
      requestSource: "external-api",
    });
    const endpointParent = harness.endpointService.exposeActiveDeployment({
      rootSystemAssetId: "system:interop-parent",
      targetId: cloudTarget.targetId.value,
      targetType: cloudTarget.type,
      endpointName: "interop-parent",
      accessContext,
      resourceTenantId: accessContext.tenantId,
      requestSource: "external-api",
    });

    expect(endpointA.deploymentId).toBe(aV2.deployment.deploymentId);
    expect(endpointB.deploymentId).toBe(bV1.deployment.deploymentId);
    expect(endpointParent.rootSystemVersionId).toBe("system:interop-parent:v1");
    expect(parentV1.deployment.nestedSystemCount).toBeGreaterThan(0);

    const routeA = harness.endpointRouting.resolveRoute({ endpointId: endpointA.endpoint.endpointId.value, invocation: Object.freeze({}), callerContext: accessContext.caller, tenantId: accessContext.tenantId, requestSource: "external-api" });
    const routeB = harness.endpointRouting.resolveRoute({ endpointId: endpointB.endpoint.endpointId.value, invocation: Object.freeze({}), callerContext: accessContext.caller, tenantId: accessContext.tenantId, requestSource: "external-api" });
    const routeParent = harness.endpointRouting.resolveRoute({ endpointId: endpointParent.endpoint.endpointId.value, invocation: Object.freeze({}), callerContext: accessContext.caller, tenantId: accessContext.tenantId, requestSource: "external-api" });

    expect(routeA.resolvedEndpoint.rootSystemVersionId).toBe("system:interop-a:v2");
    expect(routeB.resolvedEndpoint.targetType).toBe("edge");
    expect(routeParent.resolvedEndpoint.nestedSystemCount).toBeGreaterThan(0);

    const invokeParent = await harness.endpointRouting.invokeEndpoint({
      endpointId: endpointParent.endpoint.endpointId.value,
      invocation: Object.freeze({ inputPayload: { request: "interop" } }),
      callerContext: accessContext.caller,
      tenantId: accessContext.tenantId,
      requestSource: "external-api",
    });
    expect(invokeParent.route.resolvedEndpoint.deploymentId).toBe(parentV1.deployment.deploymentId);

    const rollback = harness.rollback.rollback({
      requestId: "rollback:interop:a:v1",
      requestedAt: "2026-03-28T23:02:00.000Z",
      requestedBy: accessContext.caller.callerId,
      rootSystemAssetId: "system:interop-a",
      targetId: cloudTarget.targetId.value,
      targetType: cloudTarget.type,
      toDeploymentId: aV1.deployment.deploymentId,
      accessContext,
      resourceTenantId: accessContext.tenantId,
      requestSource: "external-api",
    });
    expect(rollback.performed).toBeTrue();

    harness.endpointService.exposeActiveDeployment({
      rootSystemAssetId: "system:interop-a",
      targetId: cloudTarget.targetId.value,
      targetType: cloudTarget.type,
      endpointName: "interop-a",
      accessContext,
      resourceTenantId: accessContext.tenantId,
      requestSource: "external-api",
    });

    const routeAfterRollback = harness.endpointRouting.resolveRoute({ endpointId: endpointA.endpoint.endpointId.value, invocation: Object.freeze({}), callerContext: accessContext.caller, tenantId: accessContext.tenantId, requestSource: "external-api" });
    expect(routeAfterRollback.resolvedEndpoint.rootSystemVersionId).toBe("system:interop-a:v1");

    const healthA = harness.health.getDeploymentHealth({ deploymentId: aV1.deployment.deploymentId, callerContext: accessContext.caller, tenantId: accessContext.tenantId, requestSource: "external-api" });
    const healthParent = harness.health.getDeploymentHealth({ deploymentId: parentV1.deployment.deploymentId, callerContext: accessContext.caller, tenantId: accessContext.tenantId, requestSource: "external-api" });
    expect(healthA.linkage.rootSystemAssetId).toBe("system:interop-a");
    expect(healthParent.linkage.rootSystemAssetId).toBe("system:interop-parent");

    expect(() => harness.endpointRouting.resolveRoute({
      endpointId: endpointA.endpoint.endpointId.value,
      invocation: Object.freeze({}),
      callerContext: accessContext.caller,
      tenantId: "tenant-other",
      requestSource: "external-api",
    })).toThrow();

    const auditRecent = harness.auditTrail.listRecent(200);
    expect(auditRecent.some((entry) => entry.deployment.rootSystemAssetId === "system:interop-a" && entry.eventKind === "rollback-completed")).toBeTrue();
    expect(auditRecent.some((entry) => entry.deployment.rootSystemAssetId === "system:interop-parent" && entry.eventKind === "deployment-succeeded")).toBeTrue();
  });
});

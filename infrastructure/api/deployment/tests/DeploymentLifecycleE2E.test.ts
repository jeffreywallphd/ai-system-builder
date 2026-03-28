import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../../../application/ports/interfaces/IStudioShellRepository";
import type { Studio, AssetDraft, AssetSession } from "../../../../domain/studio-shell/StudioShellDomain";
import { AssetVersion } from "../../../../domain/assets/AssetVersion";
import { SystemPackagingService } from "../../../../application/system-packaging/SystemPackagingService";
import { DeploymentTargetSelector } from "../../../../application/deployment/DeploymentTargetSelector";
import { DeploymentConfigurationValidator } from "../../../../application/deployment/DeploymentConfigurationValidator";
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
} from "../../../../domain/deployment/DeploymentConfigurationDomain";
import {
  createDeploymentTarget,
  DeploymentTargetTypes,
  type DeploymentTarget,
} from "../../../../domain/deployment/DeploymentTargetDomain";
import { DeploymentVersionManager } from "../../../../application/deployment/DeploymentVersionManager";
import {
  DeploymentRollbackService,
  InMemoryDeploymentRollbackActionRepository,
} from "../../../../application/deployment/DeploymentRollbackService";
import {
  DeploymentAccessEvaluator,
  RoleBasedDeploymentAccessPolicy,
  type DeploymentAccessContext,
} from "../../../../application/deployment/DeploymentAccessControl";
import { DeploymentQuotaEvaluator } from "../../../../application/deployment/DeploymentQuotaEvaluator";
import {
  InMemoryEndpointExposureRepository,
  SystemEndpointExposureService,
} from "../../../../application/deployment/SystemEndpointExposureService";
import { EndpointRoutingService } from "../../../../application/deployment/EndpointRoutingService";
import { DeploymentHealthMonitor } from "../../../../application/deployment/DeploymentHealthMonitor";
import { DeploymentBackendApi } from "../DeploymentBackendApi";
import { DeploymentClient } from "../sdk/DeploymentClient";
import { DeploymentApiSdkTransport } from "../sdk/DeploymentSdkTransport";
import { ExternalSystemRuntimeInterface } from "../../system-runtime/ExternalSystemRuntimeInterface";
import { SystemRuntimeBackendApi } from "../../system-runtime/SystemRuntimeBackendApi";
import { DeploymentEndpointRuntimeInvoker } from "../../system-runtime/DeploymentEndpointRuntimeInvoker";
import {
  DeploymentAuditTrailService,
  InMemoryDeploymentAuditRepository,
} from "../../../../application/deployment/DeploymentAuditTrailService";
import {
  DeploymentAuditEventKinds,
  type DeploymentAuditRecord,
} from "../../../../domain/deployment/DeploymentAuditTrailDomain";
import {
  type EnvironmentProvisioningInterface,
  EnvironmentProvisioningStatuses,
} from "../../../../domain/deployment/EnvironmentProvisioningDomain";
import { EnvironmentProvisioningService } from "../../../../application/deployment/EnvironmentProvisioningService";
import { createSystemPackage } from "../../../../domain/system-packaging/SystemPackagingDomain";

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

const accessContext = {
  callerKind: "user" as const,
  callerId: "deploy-e2e-user",
  roles: ["deployer", "deployment-viewer", "deployment-manager", "deployment-rollback"],
  tenantId: "tenant-e2e",
  source: "external-api" as const,
};

function toDeploymentAccessContext(): DeploymentAccessContext {
  return Object.freeze({
    caller: Object.freeze({
      callerKind: accessContext.callerKind,
      callerId: accessContext.callerId,
      roles: accessContext.roles,
    }),
    tenantId: accessContext.tenantId,
    source: accessContext.source,
  });
}

function createTarget(type: DeploymentTarget["type"] = DeploymentTargetTypes.cloud): DeploymentTarget {
  return createDeploymentTarget({
    targetId: `target:${type}:e2e`,
    name: `${type}-e2e`,
    type,
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
}

function createConfiguration(input: {
  packageId: string;
  rootSystemAssetId: string;
  rootSystemVersionId: string;
  target: DeploymentTarget;
  configurationId: string;
  includeNestedBinding?: boolean;
}): DeploymentConfigurationContract {
  return createDeploymentConfigurationContract({
    configurationId: input.configurationId,
    packageId: input.packageId,
    rootSystemAssetId: input.rootSystemAssetId,
    rootSystemVersionId: input.rootSystemVersionId,
    targetId: input.target.targetId.value,
    targetType: input.target.type,
    schema: {
      schemaId: "schema:deployment:e2e:v1",
      schemaVersion: "v1",
      requiredDeploymentSettings: ["region"],
      optionalDeploymentSettings: ["namespace"],
      requiredRuntimeSettings: ["runtimeEnvironment"],
      optionalRuntimeSettings: ["runtimeRequirements"],
    },
    valueSet: {
      deploymentSettings: { region: "us-east-1", namespace: "prod" },
      runtimeSettings: { runtimeEnvironment: "container", runtimeRequirements: "network" },
    },
    nestedSystemBindings: input.includeNestedBinding === false
      ? []
      : [{ systemAssetId: "system:child", systemVersionId: "system:child:v1" }],
    createdAt: "2026-03-28T22:01:00.000Z",
  });
}

async function seedSystemVersions(repository: InMemoryStudioShellRepository): Promise<void> {
  await repository.saveAssetVersion(new AssetVersion({
    assetId: "system:child",
    versionId: "system:child:v1",
    metadata: {
      metadata: { taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" } },
      dependencies: [{ assetId: "asset:model", versionId: "asset:model:v2" }],
      content: JSON.stringify({ systemSpec: { components: [] } }),
    },
  }));

  await repository.saveAssetVersion(new AssetVersion({
    assetId: "system:e2e-root",
    versionId: "system:e2e-root:v1",
    metadata: {
      metadata: { taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" } },
      dependencies: [{ assetId: "asset:dataset", versionId: "asset:dataset:v3" }],
      content: JSON.stringify({
        systemSpec: {
          nestedSystems: [{ assetId: "system:child", versionId: "system:child:v1", alias: "child" }],
          components: [
            {
              componentKind: "system",
              alias: "child",
              assetId: "system:child",
              versionId: "system:child:v1",
              taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
            },
          ],
          inputs: [{ inputId: "request", valueType: "string", required: true }],
          outputs: [{ outputId: "response", valueType: "string" }],
        },
      }),
    },
  }));
}

function createHarness(input?: { provisioningInterface?: EnvironmentProvisioningInterface }) {
  const deploymentRepository = new InMemoryDeploymentRecordRepository();
  const diagnosticsRepository = new InMemoryDeploymentDiagnosticsRepository();
  const diagnostics = new DeploymentDiagnosticsService(diagnosticsRepository, () => new Date("2026-03-28T22:00:00.000Z"));
  const accessEvaluator = new DeploymentAccessEvaluator(new RoleBasedDeploymentAccessPolicy());
  const quotaEvaluator = new DeploymentQuotaEvaluator({
    maxDeploymentsPerCallerPerWindow: 100,
    maxDeploymentsPerTargetPerWindow: 100,
    maxActivationChangesPerTargetPerWindow: 100,
    maxRollbacksPerTargetPerWindow: 100,
    windowMs: 60_000,
  });
  const auditRepository = new InMemoryDeploymentAuditRepository();
  const auditTrail = new DeploymentAuditTrailService(auditRepository);

  const execution = new DeploymentExecutionService(
    undefined,
    deploymentRepository,
    () => new Date("2026-03-28T22:00:01.000Z"),
    input?.provisioningInterface,
    undefined,
    diagnostics,
    accessEvaluator,
    quotaEvaluator,
    undefined,
    auditTrail,
  );
  const versionManager = new DeploymentVersionManager(
    deploymentRepository,
    execution,
    accessEvaluator,
    quotaEvaluator,
    undefined,
    auditTrail,
  );
  const rollback = new DeploymentRollbackService(
    deploymentRepository,
    versionManager,
    diagnostics,
    new InMemoryDeploymentRollbackActionRepository(),
    () => new Date("2026-03-28T22:00:02.000Z"),
    accessEvaluator,
    quotaEvaluator,
    undefined,
    auditTrail,
  );

  const runtimeRepository = new InMemoryStudioShellRepository();
  const runtimeBackend = new SystemRuntimeBackendApi(runtimeRepository);
  const externalRuntime = new ExternalSystemRuntimeInterface(runtimeBackend);

  const endpointRepo = new InMemoryEndpointExposureRepository();
  const endpointService = new SystemEndpointExposureService(versionManager, deploymentRepository, endpointRepo, () => new Date("2026-03-28T22:00:03.000Z"));
  const endpointRouting = new EndpointRoutingService(endpointService, versionManager, deploymentRepository, new DeploymentEndpointRuntimeInvoker(externalRuntime));
  const health = new DeploymentHealthMonitor(deploymentRepository, diagnostics, endpointRepo, endpointRouting, versionManager, undefined, undefined, () => new Date("2026-03-28T22:00:04.000Z"));

  const backend = new DeploymentBackendApi(new DeploymentBuildPipeline(undefined, () => new Date("2026-03-28T22:00:05.000Z")), execution, versionManager, rollback, health, deploymentRepository);
  const sdk = new DeploymentClient({
    transport: new DeploymentApiSdkTransport(backend),
    accessContext,
  });

  return { runtimeRepository, execution, versionManager, rollback, endpointService, endpointRouting, health, backend, sdk, auditTrail };
}

describe("Deployment lifecycle E2E", () => {
  it("executes package→target→config→build→provision→deploy→activate→route→health→rollback with coherent SDK/API truth", async () => {
    const harness = createHarness();
    await seedSystemVersions(harness.runtimeRepository);

    const packaging = new SystemPackagingService(harness.runtimeRepository, () => new Date("2026-03-28T22:10:00.000Z"));
    const systemPackage = await packaging.packageSystemVersion({ versionId: "system:e2e-root:v1", packagingVersion: "v1" });

    const selector = new DeploymentTargetSelector();
    const selected = selector.selectTarget({
      systemPackage,
      targets: [
        createTarget(DeploymentTargetTypes.edge),
        createTarget(DeploymentTargetTypes.cloud),
      ],
      preferredTargetId: "target:cloud:e2e",
    });
    expect(selected.selectedTarget?.targetId.value).toBe("target:cloud:e2e");

    const deploymentConfiguration = createConfiguration({
      packageId: systemPackage.packageId.value,
      rootSystemAssetId: systemPackage.manifest.rootSystemAssetId,
      rootSystemVersionId: systemPackage.manifest.rootSystemVersionId,
      target: selected.selectedTarget!,
      configurationId: "deploy-config:e2e:v1",
      includeNestedBinding: true,
    });
    const configurationValidation = new DeploymentConfigurationValidator().validate({
      systemPackage,
      target: selected.selectedTarget!,
      deploymentConfiguration,
    });
    expect(configurationValidation.valid).toBeTrue();

    const built = new DeploymentBuildPipeline().build({
      systemPackage,
      target: selected.selectedTarget!,
      deploymentConfiguration,
    });
    expect(built.ok, built.issues.map((issue) => issue.code).join(",")).toBeTrue();

    const started = await harness.sdk.startDeployment({
      requestId: "deploy:e2e:v1",
      requestedAt: "2026-03-28T22:10:01.000Z",
      systemPackage,
      target: selected.selectedTarget!,
      deploymentConfiguration,
      selection: {
        targetId: selected.selectedTarget!.targetId.value,
        targetType: selected.selectedTarget!.type,
        tenantId: "tenant-e2e",
      },
    });
    expect(started.ok, started.error?.message).toBeTrue();

    const deploymentId = started.data!.deployment.deploymentId;
    const deploymentRecord = harness.execution.getDeployment(deploymentId);
    expect(deploymentRecord?.state).toBe("active");

    harness.versionManager.setActiveDeployment({
      deploymentId,
      accessContext: toDeploymentAccessContext(),
      resourceTenantId: "tenant-e2e",
      requestSource: "external-api",
      reason: "activate-e2e",
    });

    const exposure = harness.endpointService.exposeActiveDeployment({
      rootSystemAssetId: systemPackage.manifest.rootSystemAssetId,
      targetId: selected.selectedTarget!.targetId.value,
      targetType: selected.selectedTarget!.type,
      endpointName: "e2e-root",
      accessContext: toDeploymentAccessContext(),
      resourceTenantId: "tenant-e2e",
      requestSource: "external-api",
    });

    const routed = await harness.endpointRouting.invokeEndpoint({
      endpointId: exposure.endpoint.endpointId.value,
      invocation: Object.freeze({ inputPayload: { request: "hello deployment e2e" } }),
      callerContext: toDeploymentAccessContext().caller,
      tenantId: "tenant-e2e",
      requestSource: "external-api",
    });
    expect(routed.route.resolvedEndpoint.deploymentId).toBe(deploymentId);
    expect(routed.route.resolvedEndpoint.rootSystemVersionId).toBe(systemPackage.manifest.rootSystemVersionId);

    const health = await harness.sdk.getDeploymentHealth({ deploymentId, tenantId: "tenant-e2e" });
    expect(health.ok, health.error?.message).toBeTrue();
    expect(health.data?.status).toBe("healthy");
    expect(health.data?.linkage.endpointIds).toContain(exposure.endpoint.endpointId.value);

    const packageV2 = new AssetVersion({
      assetId: "system:e2e-root",
      versionId: "system:e2e-root:v2",
      parentVersionId: "system:e2e-root:v1",
      metadata: {
        metadata: { taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" } },
        dependencies: [{ assetId: "asset:dataset", versionId: "asset:dataset:v3" }],
        content: JSON.stringify({ systemSpec: { components: [] } }),
      },
    });
    await harness.runtimeRepository.saveAssetVersion(packageV2);
    const packagedV2 = await packaging.packageSystemVersion({ versionId: "system:e2e-root:v2", packagingVersion: "v1" });
    const configV2 = createConfiguration({
      packageId: packagedV2.packageId.value,
      rootSystemAssetId: packagedV2.manifest.rootSystemAssetId,
      rootSystemVersionId: packagedV2.manifest.rootSystemVersionId,
      target: selected.selectedTarget!,
      configurationId: "deploy-config:e2e:v2",
      includeNestedBinding: false,
    });

    const startedV2 = await harness.sdk.startDeployment({
      requestId: "deploy:e2e:v2",
      requestedAt: "2026-03-28T22:12:00.000Z",
      systemPackage: packagedV2,
      target: selected.selectedTarget!,
      deploymentConfiguration: configV2,
      selection: {
        targetId: selected.selectedTarget!.targetId.value,
        targetType: selected.selectedTarget!.type,
        tenantId: "tenant-e2e",
      },
    });
    expect(startedV2.ok).toBeTrue();

    harness.versionManager.setActiveDeployment({
      deploymentId: startedV2.data!.deployment.deploymentId,
      accessContext: toDeploymentAccessContext(),
      resourceTenantId: "tenant-e2e",
      requestSource: "external-api",
      reason: "activate-v2",
    });

    const rollback = await harness.sdk.rollbackDeployment({
      requestId: "rollback:e2e:v1",
      requestedAt: "2026-03-28T22:13:00.000Z",
      requestedBy: accessContext.callerId,
      rootSystemAssetId: systemPackage.manifest.rootSystemAssetId,
      targetId: selected.selectedTarget!.targetId.value,
      targetType: selected.selectedTarget!.type,
      toDeploymentId: deploymentId,
      tenantId: "tenant-e2e",
    });
    expect(rollback.ok).toBeTrue();
    expect(rollback.data?.performed).toBeTrue();

    harness.endpointService.exposeActiveDeployment({
      rootSystemAssetId: systemPackage.manifest.rootSystemAssetId,
      targetId: selected.selectedTarget!.targetId.value,
      targetType: selected.selectedTarget!.type,
      endpointName: "e2e-root",
      accessContext: toDeploymentAccessContext(),
      resourceTenantId: "tenant-e2e",
      requestSource: "external-api",
    });

    const routeAfterRollback = harness.endpointRouting.resolveRoute({
      endpointId: exposure.endpoint.endpointId.value,
      invocation: Object.freeze({}),
      callerContext: toDeploymentAccessContext().caller,
      tenantId: "tenant-e2e",
      requestSource: "external-api",
    });
    expect(routeAfterRollback.resolvedEndpoint.deploymentId).toBe(deploymentId);

    const deploymentAudit = harness.auditTrail
      .listRecent(100)
      .filter((entry) => entry.deployment.requestId === "deploy:e2e:v1" || entry.deployment.deploymentId === deploymentId);
    expect(deploymentAudit.some((entry) => entry.eventKind === DeploymentAuditEventKinds.deploymentRequested)).toBeTrue();
    expect(deploymentAudit.some((entry) => entry.eventKind === DeploymentAuditEventKinds.deploymentSucceeded)).toBeTrue();
    expect(deploymentAudit.some((entry) => entry.eventKind === DeploymentAuditEventKinds.activationChanged)).toBeTrue();

    const allAudit = harness.auditTrail.listRecent(50);
    expect(allAudit.some((entry) => entry.eventKind === DeploymentAuditEventKinds.rollbackCompleted)).toBeTrue();
  });

  it("records coherent failure diagnostics/state/audit when provisioning fails", () => {
    class AlwaysFailProvisioning implements EnvironmentProvisioningInterface {
      private readonly fallback = new EnvironmentProvisioningService();

      public provision(request: Parameters<EnvironmentProvisioningInterface["provision"]>[0]) {
        const baseline = this.fallback.provision(request);
        return Object.freeze({
          ...baseline,
          status: EnvironmentProvisioningStatuses.failed,
          provisionedEnvironment: undefined,
          issues: Object.freeze([
            { code: "provisioning-capacity-exhausted", message: "Capacity unavailable for requested target." },
          ]),
        });
      }
    }

    const harness = createHarness({ provisioningInterface: new AlwaysFailProvisioning() });
    const target = createTarget();
    const packageRoot = createSystemPackage({
      packageId: "system-package:failure:v1",
      manifest: {
        rootSystemAssetId: "system:e2e-root",
        rootSystemVersionId: "system:e2e-root:v1",
        dependencyGraph: { nodes: [{ nodeId: "root", assetId: "system:e2e-root", versionId: "system:e2e-root:v1", structuralKind: "system", relation: "root", discoveredAtDepth: 0 }], edges: [] },
        dependencyVersionSnapshot: [],
        requirements: { requiresNestedSystemSupport: false, maxDependencyDepth: 0 },
        lineage: {},
        recursion: { status: "complete", unresolvedNestedSystemCount: 0, maxDepth: 0 },
        packagingMetadata: { packagingVersion: "v1", packagedAt: "2026-03-28T22:20:00.000Z", determinismKey: "failure-key" },
      },
    });
    const deploymentConfiguration = createConfiguration({
      packageId: packageRoot.packageId.value,
      rootSystemAssetId: packageRoot.manifest.rootSystemAssetId,
      rootSystemVersionId: packageRoot.manifest.rootSystemVersionId,
      target,
      configurationId: "deploy-config:fail:v1",
      includeNestedBinding: false,
    });

    const built = new DeploymentBuildPipeline().build({
      systemPackage: packageRoot,
      target,
      deploymentConfiguration,
    });
    expect(built.ok).toBeTrue();
    const started = harness.execution.executeLifecycle({
      requestId: "deploy:e2e:fail",
      requestedAt: "2026-03-28T22:20:01.000Z",
      bundle: built.bundle!,
      target,
      deploymentConfiguration,
    }, {
      accessContext: toDeploymentAccessContext(),
      resourceTenantId: "tenant-e2e",
      requestSource: "external-api",
    });

    expect(started.issues.some((issue) => issue.code === "provisioning-capacity-exhausted")).toBeTrue();
    expect(started.deployment.status).toBe("rejected");
    expect(started.deployment.state).toBe("failed");

    const diagnostics = harness.execution.listDeploymentDiagnostics(started.deployment.deploymentId, {
      tenantId: "tenant-e2e",
      targetId: target.targetId.value,
      targetType: target.type,
      deploymentEnvironmentId: "pending-provisioning",
    });
    expect(diagnostics.length).toBeGreaterThan(0);

    const audit = harness.auditTrail
      .listRecent(50)
      .filter((entry) => entry.deployment.requestId === "deploy:e2e:fail" || entry.deployment.deploymentId === started.deployment.deploymentId);
    const outcomes = new Set(audit.map((entry: DeploymentAuditRecord) => `${entry.eventKind}:${entry.outcome}`));
    expect(outcomes.has(`${DeploymentAuditEventKinds.deploymentRequested}:accepted`)).toBeTrue();
    expect(outcomes.has(`${DeploymentAuditEventKinds.deploymentRejected}:rejected`)).toBeTrue();
  });
});

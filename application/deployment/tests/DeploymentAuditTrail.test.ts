import { describe, expect, it } from "bun:test";
import {
  DeploymentExecutionService,
  InMemoryDeploymentRecordRepository,
} from "../DeploymentExecutionService";
import { DeploymentVersionManager } from "../DeploymentVersionManager";
import { DeploymentRollbackService, InMemoryDeploymentRollbackActionRepository } from "../DeploymentRollbackService";
import {
  DeploymentAuditTrailService,
  InMemoryDeploymentAuditRepository,
} from "../DeploymentAuditTrailService";
import { DeploymentAutoscalingService, InMemoryDeploymentScalingRepository } from "../DeploymentAutoscalingService";
import { buildSampleBundle, createSampleConfiguration } from "./testUtils";
import { createSystemPackage } from "../../../domain/system-packaging/SystemPackagingDomain";

const caller = Object.freeze({
  callerKind: "user",
  callerId: "caller:deploy-manager",
  sessionId: "session:deploy:1",
  roles: Object.freeze(["deployer", "deployment-manager", "deployment-rollback"]),
  authenticatedPrincipalId: "principal:deploy-manager",
});

describe("Deployment audit trail", () => {
  it("records deployment execution, activation, rollback, and autoscaling management actions", () => {
    const auditRepository = new InMemoryDeploymentAuditRepository();
    const auditTrail = new DeploymentAuditTrailService(auditRepository);
    const deploymentRepository = new InMemoryDeploymentRecordRepository();

    const executionService = new DeploymentExecutionService(
      undefined,
      deploymentRepository,
      () => new Date("2026-03-28T23:00:00.000Z"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      auditTrail,
    );
    const versionManager = new DeploymentVersionManager(
      deploymentRepository,
      executionService,
      undefined,
      undefined,
      undefined,
      auditTrail,
    );
    const rollbackService = new DeploymentRollbackService(
      deploymentRepository,
      versionManager,
      { logEvent: () => undefined },
      new InMemoryDeploymentRollbackActionRepository(),
      () => new Date("2026-03-28T23:01:00.000Z"),
      undefined,
      undefined,
      undefined,
      auditTrail,
    );
    const autoscaling = new DeploymentAutoscalingService(
      deploymentRepository,
      new InMemoryDeploymentScalingRepository(),
      () => new Date("2026-03-28T23:02:00.000Z"),
      auditTrail,
    );

    const baseline = buildSampleBundle();
    const v7 = executionService.executeLifecycle({
      requestId: "deploy:req:audit:v7",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T23:00:00.000Z",
    }, {
      accessContext: { caller, tenantId: "tenant:alpha", source: "deployment-api" },
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    }).deployment!;

    const packageV8 = createSystemPackage({
      packageId: "system-package:system:root:v8:v1:audit",
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
      configurationId: "deploy-config:audit:v8",
    });
    const v8 = executionService.executeLifecycle({
      requestId: "deploy:req:audit:v8",
      bundle: buildSampleBundle({ systemPackage: packageV8, target: baseline.target, deploymentConfiguration: configV8 }).bundle,
      deploymentConfiguration: configV8,
      target: baseline.target,
      requestedAt: "2026-03-28T23:00:30.000Z",
    }, {
      accessContext: { caller, tenantId: "tenant:alpha", source: "deployment-api" },
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    }).deployment!;

    versionManager.setActiveDeployment({
      deploymentId: v7.deploymentId,
      reason: "promote-v7",
      accessContext: { caller, tenantId: "tenant:alpha", source: "deployment-api" },
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });
    versionManager.setActiveDeployment({
      deploymentId: v8.deploymentId,
      reason: "promote-v8",
      accessContext: { caller, tenantId: "tenant:alpha", source: "deployment-api" },
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });

    const rollback = rollbackService.rollback({
      requestId: "rollback:req:audit",
      rootSystemAssetId: baseline.systemPackage.manifest.rootSystemAssetId,
      targetId: baseline.target.targetId.value,
      targetType: baseline.target.type,
      requestedBy: caller.callerId,
      requestedAt: "2026-03-28T23:01:00.000Z",
      toDeploymentId: v7.deploymentId,
      accessContext: { caller, tenantId: "tenant:alpha", source: "deployment-api" },
      resourceTenantId: "tenant:alpha",
      requestSource: "deployment-api",
    });
    expect(rollback.performed).toBeTrue();

    autoscaling.upsertScalingConfiguration({
      deploymentId: v7.deploymentId,
      minCapacity: 1,
      maxCapacity: 6,
      desiredCapacity: 2,
      requestedBy: caller.callerId,
      caller,
      tenantId: "tenant:alpha",
      requestSource: "deployment-api",
      policy: {
        policyId: "policy:audit",
        policyName: "Audit Policy",
        triggerKinds: ["cpu-utilization", "health-status"],
        cooldownSeconds: 60,
      },
    });

    autoscaling.requestScaleAction({
      deploymentId: v7.deploymentId,
      requestedCapacity: 3,
      requestedBy: caller.callerId,
      caller,
      tenantId: "tenant:alpha",
      requestSource: "deployment-api",
      reason: "capacity-bump",
    });

    const auditForV7 = auditTrail.listByDeploymentId(v7.deploymentId);
    expect(auditForV7.some((entry) => entry.eventKind === "deployment-succeeded")).toBeTrue();
    expect(auditForV7.some((entry) => entry.eventKind === "activation-changed")).toBeTrue();
    expect(auditForV7.some((entry) => entry.eventKind === "rollback-completed")).toBeTrue();
    expect(auditForV7.some((entry) => entry.eventKind === "scaling-configuration-changed")).toBeTrue();
    expect(auditForV7.some((entry) => entry.eventKind === "scale-action-requested")).toBeTrue();

    const rollbackAudit = auditForV7.find((entry) => entry.eventKind === "rollback-completed");
    expect(rollbackAudit?.caller.authenticatedPrincipalId).toBe("principal:deploy-manager");
    expect(rollbackAudit?.tenant.tenantId).toBe("tenant:alpha");
    expect(rollbackAudit?.deployment.targetId).toBe(v7.targetId);
    expect(rollbackAudit?.deployment.rootSystemVersionId).toBe(v7.rootSystemVersionId);

    const recent = auditTrail.listRecent();
    expect(recent.every((entry) => entry.eventKind !== "completed")).toBeTrue();
  });

  it("keeps audit records queryable and separate from diagnostics/log stream semantics", () => {
    const auditTrail = new DeploymentAuditTrailService(new InMemoryDeploymentAuditRepository());
    const record = auditTrail.record({
      eventKind: "deployment-requested",
      outcome: "accepted",
      requestSource: "deployment-api",
      caller: { callerId: "caller:deploy-manager", authenticatedPrincipalId: "principal:deploy-manager" },
      tenant: { tenantId: "tenant:alpha", source: "deployment-api" },
      deployment: {
        deploymentId: "deployment:test",
        requestId: "deploy:req:test",
        rootSystemAssetId: "system:root",
        rootSystemVersionId: "system:root:v7",
        targetId: "target:cloud-generic",
        targetType: "cloud",
      },
      detail: { message: "Requested." },
      metadata: { stage: "request" },
      occurredAt: "2026-03-28T23:10:00.000Z",
    });

    const query = auditTrail.listByDeploymentId("deployment:test");
    expect(query.length).toBe(1);
    expect(query[0]?.auditId).toBe(record.auditId);
    expect(query[0]?.metadata?.stage).toBe("request");
  });
});

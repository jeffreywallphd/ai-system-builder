import { describe, expect, it } from "bun:test";
import {
  DeploymentExecutionService,
  InMemoryDeploymentRecordRepository,
} from "../DeploymentExecutionService";
import { DeploymentVersionManager } from "../DeploymentVersionManager";
import {
  DeploymentAutoscalingService,
  InMemoryDeploymentScalingRepository,
} from "../DeploymentAutoscalingService";
import { ScaleActionStatuses, ScaleDirections } from "@domain/deployment/DeploymentAutoscalingDomain";
import { buildSampleBundle } from "./testUtils";

function createHarness() {
  const deploymentRepository = new InMemoryDeploymentRecordRepository();
  const executionService = new DeploymentExecutionService(undefined, deploymentRepository, () => new Date("2026-03-28T22:00:00.000Z"));
  const versionManager = new DeploymentVersionManager(deploymentRepository, executionService);
  const autoscaling = new DeploymentAutoscalingService(
    deploymentRepository,
    new InMemoryDeploymentScalingRepository(),
    () => new Date("2026-03-28T22:01:00.000Z"),
  );

  return { executionService, versionManager, autoscaling };
}

describe("Deployment autoscaling interface (bounded)", () => {
  it("creates bounded scaling policies/configurations linked to deployment/version/environment", () => {
    const { executionService, versionManager, autoscaling } = createHarness();
    const baseline = buildSampleBundle();

    const deployment = executionService.executeLifecycle({
      requestId: "deploy:req:scale:config",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T22:00:00.000Z",
    }).deployment!;

    versionManager.setActiveDeployment({ deploymentId: deployment.deploymentId, reason: "activate-for-scaling" });

    const configuration = autoscaling.upsertScalingConfiguration({
      deploymentId: deployment.deploymentId,
      minCapacity: 2,
      maxCapacity: 8,
      desiredCapacity: 3,
      requestedBy: "caller:scale-manager",
      requestSource: "deployment-api",
      policy: {
        policyId: "policy:prod-default",
        policyName: "Prod Default",
        triggerKinds: ["cpu-utilization", "request-rate", "health-status"],
        cooldownSeconds: 90,
        targetUtilizationPercent: 70,
        scaleOutStep: 2,
        scaleInStep: 1,
      },
    });

    expect(configuration.deploymentId).toBe(deployment.deploymentId);
    expect(configuration.rootSystemVersionId).toBe(deployment.rootSystemVersionId);
    expect(configuration.deploymentEnvironmentId).toBe(deployment.provisionedEnvironmentId);
    expect(configuration.targetId).toBe(deployment.targetId);
    expect(configuration.nestedSystemCount).toBeGreaterThan(0);
  });

  it("rejects invalid and unsupported scaling configuration/action requests cleanly", () => {
    const { executionService, versionManager, autoscaling } = createHarness();
    const baseline = buildSampleBundle();

    const deployment = executionService.executeLifecycle({
      requestId: "deploy:req:scale:invalid",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T22:02:00.000Z",
    }).deployment!;

    expect(() => autoscaling.upsertScalingConfiguration({
      deploymentId: deployment.deploymentId,
      minCapacity: 1,
      maxCapacity: 5,
      desiredCapacity: 3,
      requestedBy: "caller:scale-manager",
      policy: {
        policyId: "policy:requires-active",
        policyName: "Requires Active",
        triggerKinds: ["cpu-utilization"],
        cooldownSeconds: 30,
      },
    })).toThrow("is not an active deployment");

    versionManager.setActiveDeployment({ deploymentId: deployment.deploymentId, reason: "activate-for-invalid-scale" });

    expect(() => autoscaling.upsertScalingConfiguration({
      deploymentId: deployment.deploymentId,
      minCapacity: 5,
      maxCapacity: 4,
      desiredCapacity: 4,
      requestedBy: "caller:scale-manager",
      policy: {
        policyId: "policy:bad-range",
        policyName: "Bad Range",
        triggerKinds: ["cpu-utilization"],
        cooldownSeconds: 30,
      },
    })).toThrow("maxCapacity must be greater than or equal to minCapacity");

    autoscaling.upsertScalingConfiguration({
      deploymentId: deployment.deploymentId,
      minCapacity: 1,
      maxCapacity: 4,
      desiredCapacity: 2,
      requestedBy: "caller:scale-manager",
      policy: {
        policyId: "policy:bounded",
        policyName: "Bounded",
        triggerKinds: ["cpu-utilization"],
        cooldownSeconds: 30,
      },
    });

    const rejected = autoscaling.requestScaleAction({
      deploymentId: deployment.deploymentId,
      requestedCapacity: 9,
      requestedBy: "caller:scale-manager",
      actionKind: "manual-adjustment",
      reason: "outside-bounds",
    });
    expect(rejected.status).toBe(ScaleActionStatuses.rejected);
  });

  it("remains distinct from runtime state and bounded deployment health inputs", () => {
    const { executionService, versionManager, autoscaling } = createHarness();
    const baseline = buildSampleBundle();
    const deployment = executionService.executeLifecycle({
      requestId: "deploy:req:scale:decision",
      bundle: baseline.bundle,
      deploymentConfiguration: baseline.deploymentConfiguration,
      target: baseline.target,
      requestedAt: "2026-03-28T22:03:00.000Z",
    }).deployment!;

    versionManager.setActiveDeployment({ deploymentId: deployment.deploymentId, reason: "activate-for-decision" });

    autoscaling.upsertScalingConfiguration({
      deploymentId: deployment.deploymentId,
      minCapacity: 1,
      maxCapacity: 6,
      desiredCapacity: 3,
      requestedBy: "caller:scale-manager",
      policy: {
        policyId: "policy:runtime-distinct",
        policyName: "Runtime Distinct",
        triggerKinds: ["cpu-utilization", "health-status"],
        cooldownSeconds: 45,
        targetUtilizationPercent: 65,
      },
    });

    const decision = autoscaling.evaluateScaleDecision({
      deploymentId: deployment.deploymentId,
      observedCapacity: 3,
      observedUtilizationPercent: 92,
      observedHealthStatus: "degraded",
    });

    expect(decision.direction).toBe(ScaleDirections.scaleOut);
    const status = autoscaling.getScaleStatus(deployment.deploymentId)!;
    expect(status.lastEvaluatedAt).toBeString();
    expect(status.summary).toContain("Observed utilization");

    const transitionCountBefore = executionService.listStateTransitions(deployment.deploymentId).length;
    const action = autoscaling.requestScaleAction({
      deploymentId: deployment.deploymentId,
      requestedCapacity: decision.targetCapacity,
      requestedBy: "caller:scale-manager",
      actionKind: "apply-decision",
      decision,
    });
    expect(action.status).toBe(ScaleActionStatuses.requested);

    const transitionCountAfter = executionService.listStateTransitions(deployment.deploymentId).length;
    expect(transitionCountAfter).toBe(transitionCountBefore);
  });
});


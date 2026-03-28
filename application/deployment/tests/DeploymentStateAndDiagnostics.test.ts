import { describe, expect, it } from "bun:test";
import { DeploymentLogLevels } from "../../../domain/deployment/DeploymentDiagnosticsDomain";
import { DeploymentStates } from "../../../domain/deployment/DeploymentStateDomain";
import { DeploymentDiagnosticsService } from "../DeploymentDiagnosticsService";
import { DeploymentStateTracker } from "../DeploymentStateTracker";

describe("DeploymentStateTracker", () => {
  it("enforces bounded transition rules", () => {
    const tracker = new DeploymentStateTracker();
    const initialized = tracker.initialize({ deploymentId: "deployment:test:1", at: "2026-03-28T09:00:00.000Z" });

    const progressed = tracker.transition({
      deploymentId: "deployment:test:1",
      currentState: initialized.state,
      transitions: initialized.transitions,
      toState: DeploymentStates.provisioningInProgress,
      at: "2026-03-28T09:01:00.000Z",
      reason: "provisioning-started",
    });

    expect(progressed.snapshot.transitionCount).toBe(2);
    expect(progressed.snapshot.state).toBe(DeploymentStates.provisioningInProgress);
    expect(() => tracker.transition({
      deploymentId: "deployment:test:1",
      currentState: progressed.state,
      transitions: progressed.transitions,
      toState: DeploymentStates.active,
      at: "2026-03-28T09:02:00.000Z",
    })).toThrow();
  });
});

describe("DeploymentDiagnosticsService", () => {
  it("stores structured logs and diagnostics separately from runtime traces", () => {
    const diagnostics = new DeploymentDiagnosticsService(undefined, () => new Date("2026-03-28T10:00:00.000Z"));
    diagnostics.logEvent({
      deploymentId: "deployment:test:2",
      eventKind: "provisioning-result",
      message: "Provisioning ready.",
      level: DeploymentLogLevels.info,
      details: Object.freeze({ environmentId: "env:1", targetId: "target:cloud" }),
    });

    diagnostics.recordFailure({
      deploymentId: "deployment:test:2",
      eventKind: "deployment-failure",
      code: "deploy-step-timeout",
      summary: "Deployment step timed out.",
      details: Object.freeze({ step: "activate", timeoutSeconds: "45" }),
    });

    const logs = diagnostics.listLogs("deployment:test:2");
    const records = diagnostics.listDiagnostics("deployment:test:2");

    expect(logs.length).toBe(2);
    expect(logs.map((entry) => entry.eventKind)).toContain("provisioning-result");
    expect(logs.map((entry) => entry.level)).toContain(DeploymentLogLevels.error);
    expect(records.length).toBe(1);
    expect(records[0]?.code).toBe("deploy-step-timeout");
    expect(records[0]?.details?.step).toBe("activate");
  });
});

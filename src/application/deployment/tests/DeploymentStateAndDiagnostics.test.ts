import { describe, expect, it } from "bun:test";
import { DeploymentLogLevels } from "@domain/deployment/DeploymentDiagnosticsDomain";
import { DeploymentStates } from "@domain/deployment/DeploymentStateDomain";
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

  it("applies bounded log/diagnostic query limits for polling workloads", () => {
    const diagnostics = new DeploymentDiagnosticsService(undefined, () => new Date("2026-03-28T10:05:00.000Z"));
    for (const index of [1, 2, 3, 4]) {
      diagnostics.logEvent({
        deploymentId: "deployment:test:3",
        eventKind: `event-${index}`,
        message: `event ${index}`,
      });
      diagnostics.recordFailure({
        deploymentId: "deployment:test:3",
        eventKind: `failure-${index}`,
        code: `code-${index}`,
        summary: `failure ${index}`,
      });
    }

    const boundedLogs = diagnostics.listLogs("deployment:test:3", { limit: 2 });
    const boundedDiagnostics = diagnostics.listDiagnostics("deployment:test:3", { limit: 2 });

    expect(boundedLogs).toHaveLength(2);
    expect(boundedLogs[0]?.eventKind).toBe("event-4");
    expect(boundedLogs[1]?.eventKind).toBe("failure-4");
    expect(boundedDiagnostics).toHaveLength(2);
    expect(boundedDiagnostics[0]?.code).toBe("code-3");
    expect(boundedDiagnostics[1]?.code).toBe("code-4");
  });
});


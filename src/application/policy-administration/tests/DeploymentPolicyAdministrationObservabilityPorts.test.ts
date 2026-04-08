import { describe, expect, it } from "bun:test";
import {
  publishDeploymentPolicyAdministrationObservabilityBestEffort,
  sanitizeDeploymentPolicyAdministrationObservabilityEvent,
  type DeploymentPolicyAdministrationObservabilityEvent,
  type IDeploymentPolicyAdministrationObservabilityPort,
} from "@application/policy-administration/ports/DeploymentPolicyAdministrationObservabilityPorts";

class CapturingDeploymentPolicyAdministrationObservabilityPort implements IDeploymentPolicyAdministrationObservabilityPort {
  public event: DeploymentPolicyAdministrationObservabilityEvent | undefined;

  public async recordDeploymentPolicyAdministrationEvent(
    event: DeploymentPolicyAdministrationObservabilityEvent,
  ): Promise<void> {
    this.event = event;
  }
}

describe("DeploymentPolicyAdministrationObservabilityPorts", () => {
  it("sanitizes details with redaction and bounded metadata", () => {
    const event = sanitizeDeploymentPolicyAdministrationObservabilityEvent(Object.freeze({
      event: " deployment-policy-admin.write.failed ",
      operation: "write",
      outcome: "failure",
      severity: "error",
      occurredAt: " 2026-04-08T10:00:00.000Z ",
      scope: Object.freeze({
        kind: "deployment-policy-scope",
        scopeId: " workspace-alpha ",
      }),
      correlationId: " corr:write:1 ",
      details: Object.freeze({
        failureMessage: "path C:\\secrets\\policy.sqlite",
        requestPayload: Object.freeze({
          rawBody: "secret-value",
        }),
        nested: Object.freeze({
          token: "token-value",
          safeMarker: "admin-surface",
        }),
      }),
      counters: Object.freeze({
        operationCount: 2,
      }),
    }));

    expect(event.event).toBe("deployment-policy-admin.write.failed");
    expect(event.scope?.scopeId).toBe("workspace-alpha");
    expect(event.correlationId).toBe("corr:write:1");
    expect((event.details as Record<string, unknown>)?.failureMessage).toBe("[REDACTED]");
    expect((event.details as Record<string, unknown>)?.requestPayload).toBe("[REDACTED]");
    expect(((event.details as Record<string, unknown>)?.nested as Record<string, unknown>)?.token).toBe("[REDACTED]");
    expect(((event.details as Record<string, unknown>)?.nested as Record<string, unknown>)?.safeMarker).toBe("admin-surface");
  });

  it("publishes best-effort observability without throwing on sink errors", async () => {
    const sink: IDeploymentPolicyAdministrationObservabilityPort = {
      async recordDeploymentPolicyAdministrationEvent(): Promise<void> {
        throw new Error("downstream unavailable");
      },
    };

    await publishDeploymentPolicyAdministrationObservabilityBestEffort(sink, Object.freeze({
      event: "deployment-policy-admin.read.completed",
      operation: "read",
      outcome: "success",
      severity: "info",
      occurredAt: "2026-04-08T10:01:00.000Z",
      scope: Object.freeze({
        kind: "deployment-policy-scope",
        scopeId: "workspace-alpha",
      }),
    }));
  });

  it("publishes sanitized events to observability sinks", async () => {
    const sink = new CapturingDeploymentPolicyAdministrationObservabilityPort();
    await publishDeploymentPolicyAdministrationObservabilityBestEffort(sink, Object.freeze({
      event: "deployment-policy-admin.surface.read.failed",
      operation: "admin-surface",
      outcome: "failure",
      severity: "error",
      occurredAt: "2026-04-08T10:02:00.000Z",
      details: Object.freeze({
        message: "token ABC",
      }),
    }));

    expect(sink.event).toBeDefined();
    expect((sink.event?.details as Record<string, unknown>)?.message).toBe("[REDACTED]");
  });
});

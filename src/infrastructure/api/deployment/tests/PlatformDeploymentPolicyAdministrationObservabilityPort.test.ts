import { describe, expect, it } from "bun:test";
import { PlatformDeploymentPolicyAdministrationObservabilityPort } from "../PlatformDeploymentPolicyAdministrationObservabilityPort";

describe("PlatformDeploymentPolicyAdministrationObservabilityPort", () => {
  it("logs observability events with deployment-policy admin payload shape", async () => {
    const infoEvents: Array<Record<string, unknown>> = [];
    const sink = new PlatformDeploymentPolicyAdministrationObservabilityPort({
      logger: {
        info: (event) => infoEvents.push(event as Record<string, unknown>),
        warn: () => {},
        error: () => {},
      },
    });

    await sink.recordDeploymentPolicyAdministrationEvent(Object.freeze({
      event: "deployment-policy-admin.write.completed",
      operation: "write",
      outcome: "success",
      severity: "info",
      occurredAt: "2026-04-08T11:00:00.000Z",
      scope: Object.freeze({
        kind: "deployment-policy-scope",
        scopeId: "workspace-alpha",
      }),
      correlationId: "corr-policy-admin-1",
      counters: Object.freeze({
        operationCount: 2,
      }),
    }));

    expect(infoEvents).toHaveLength(1);
    expect(infoEvents[0]?.event).toBe("deployment-policy-admin.write.completed");
    expect(infoEvents[0]?.requestId).toBe("corr-policy-admin-1");
  });

  it("emits aggregate and counter metrics best-effort", async () => {
    const metricNames: string[] = [];
    const sink = new PlatformDeploymentPolicyAdministrationObservabilityPort({
      metricsSink: {
        emit: (event) => {
          metricNames.push(event.name);
        },
      },
    });

    await sink.recordDeploymentPolicyAdministrationEvent(Object.freeze({
      event: "deployment-policy-admin.surface.write.overrides.completed",
      operation: "admin-surface",
      outcome: "success",
      severity: "info",
      occurredAt: "2026-04-08T11:01:00.000Z",
      counters: Object.freeze({
        operationCount: 3,
        validationIssueCount: 0,
      }),
    }));

    expect(metricNames).toContain("deployment_policy_admin_event_total");
    expect(metricNames).toContain("deployment_policy_admin_operationCount");
    expect(metricNames).toContain("deployment_policy_admin_validationIssueCount");
  });
});

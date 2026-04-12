import { describe, expect, it } from "bun:test";
import {
  publishDeploymentPolicyGovernanceEventBestEffort,
  type DeploymentPolicyGovernanceEvent,
  type IDeploymentPolicyGovernanceEventSink,
} from "@application/policy-administration/ports/DeploymentPolicyGovernanceEventPorts";

class CapturingDeploymentPolicyGovernanceEventSink implements IDeploymentPolicyGovernanceEventSink {
  public event: DeploymentPolicyGovernanceEvent | undefined;

  public async recordDeploymentPolicyGovernanceEvent(event: DeploymentPolicyGovernanceEvent): Promise<void> {
    this.event = event;
  }
}

describe("DeploymentPolicyGovernanceEventPorts", () => {
  it("publishes sanitized deployment policy governance events", async () => {
    const sink = new CapturingDeploymentPolicyGovernanceEventSink();

    await publishDeploymentPolicyGovernanceEventBestEffort(sink, Object.freeze({
      channel: "audit",
      type: "deployment-policy-overrides-mutated",
      occurredAt: " 2026-04-08T10:00:00.000Z ",
      outcome: "succeeded",
      actorUserIdentityId: " user:admin ",
      scopeKind: "workspace",
      scopeId: " workspace-alpha ",
      profileId: " classroom ",
      policyFamilyIds: Object.freeze([
        " sharing-posture ",
        "sharing-posture",
        " security-governance ",
      ]),
      details: Object.freeze({
        changedCount: 1,
        beforeValue: "private",
        nested: Object.freeze({
          token: "secret-token",
          safeReason: "ticket approved",
        }),
        prompt: "sensitive prompt content",
        localPath: "C:\\unsafe\\path",
      }),
    }));

    expect(sink.event).toBeDefined();
    expect(sink.event?.occurredAt).toBe("2026-04-08T10:00:00.000Z");
    expect(sink.event?.actorUserIdentityId).toBe("user:admin");
    expect(sink.event?.scopeId).toBe("workspace-alpha");
    expect(sink.event?.profileId).toBe("classroom");
    expect(sink.event?.policyFamilyIds).toEqual(["sharing-posture", "security-governance"]);
    const details = sink.event?.details as Record<string, unknown> | undefined;
    expect(details?.changedCount).toBe(1);
    expect(details?.beforeValue).toBe("[REDACTED]");
    expect(details?.prompt).toBe("[REDACTED]");
    expect(details?.localPath).toBe("[REDACTED]");
    expect((details?.nested as Record<string, unknown> | undefined)?.token).toBe("[REDACTED]");
    expect((details?.nested as Record<string, unknown> | undefined)?.safeReason).toBe("ticket approved");
  });

  it("swallows sink errors for best-effort publication", async () => {
    const sink: IDeploymentPolicyGovernanceEventSink = {
      async recordDeploymentPolicyGovernanceEvent(): Promise<void> {
        throw new Error("downstream unavailable");
      },
    };

    await publishDeploymentPolicyGovernanceEventBestEffort(sink, Object.freeze({
      channel: "operational",
      type: "deployment-policy-active-profile-changed",
      occurredAt: "2026-04-08T10:05:00.000Z",
      outcome: "succeeded",
      scopeKind: "workspace",
      scopeId: "workspace-alpha",
    }));
  });
});

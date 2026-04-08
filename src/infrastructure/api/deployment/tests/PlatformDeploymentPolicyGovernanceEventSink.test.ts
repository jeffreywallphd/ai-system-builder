import { describe, expect, it } from "bun:test";
import type {
  IPlatformAuditEventRepository,
  PlatformAuditEventListQuery,
  PlatformAuditEventRecord,
  PlatformPersistenceMutationContext,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import { PlatformDeploymentPolicyGovernanceEventSink } from "../PlatformDeploymentPolicyGovernanceEventSink";

class InMemoryPlatformAuditRepository implements IPlatformAuditEventRepository {
  public readonly events: PlatformAuditEventRecord[] = [];

  public async appendAuditEvent(
    event: PlatformAuditEventRecord,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<{ readonly changed: boolean; readonly wasReplay: boolean; readonly record: PlatformAuditEventRecord }> {
    this.events.push(event);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: event,
    });
  }

  public async listAuditEvents(_query: PlatformAuditEventListQuery): Promise<ReadonlyArray<PlatformAuditEventRecord>> {
    return Object.freeze([...this.events]);
  }
}

describe("PlatformDeploymentPolicyGovernanceEventSink", () => {
  it("records audit-channel governance events to platform audit records", async () => {
    const repository = new InMemoryPlatformAuditRepository();
    const sink = new PlatformDeploymentPolicyGovernanceEventSink(repository);

    await sink.recordDeploymentPolicyGovernanceEvent(Object.freeze({
      channel: "audit",
      type: "deployment-policy-active-profile-changed",
      occurredAt: "2026-04-08T11:00:00.000Z",
      outcome: "succeeded",
      actorUserIdentityId: "user:admin",
      scopeKind: "workspace",
      scopeId: "workspace-alpha",
      profileId: "organization",
      details: Object.freeze({
        previousProfileId: "classroom",
        nextProfileId: "organization",
      }),
    }));

    expect(repository.events).toHaveLength(1);
    expect(repository.events[0]?.eventKind).toBe("system");
    expect(repository.events[0]?.action).toBe("policy.deployment.active-profile.changed");
    expect(repository.events[0]?.workspaceId).toBe("workspace-alpha");
    expect(repository.events[0]?.targetRef).toBe("deployment-policy:workspace-alpha:organization");
    expect(repository.events[0]?.outcome).toBe("succeeded");
  });

  it("emits operational-channel governance events through logger and skips platform audit", async () => {
    const repository = new InMemoryPlatformAuditRepository();
    const infoEvents: Array<Record<string, unknown>> = [];
    const sink = new PlatformDeploymentPolicyGovernanceEventSink(repository, {
      info: (event) => {
        infoEvents.push(event as Record<string, unknown>);
      },
    });

    await sink.recordDeploymentPolicyGovernanceEvent(Object.freeze({
      channel: "operational",
      type: "deployment-policy-overrides-mutated",
      occurredAt: "2026-04-08T11:01:00.000Z",
      outcome: "succeeded",
      actorUserIdentityId: "user:admin",
      scopeKind: "workspace",
      scopeId: "workspace-alpha",
      profileId: "organization",
      policyFamilyIds: Object.freeze(["sharing-posture"]),
      details: Object.freeze({
        mutationCount: 1,
      }),
    }));

    expect(repository.events).toHaveLength(0);
    expect(infoEvents).toHaveLength(1);
    expect(infoEvents[0]?.operation).toBe("deployment-policy.governance-event");
    expect(infoEvents[0]?.scopeId).toBe("workspace-alpha");
    expect(infoEvents[0]?.profileId).toBe("organization");
  });
});

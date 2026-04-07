import { describe, expect, it } from "bun:test";
import {
  IdentityLifecycleEventContractVersions,
  IdentityLifecycleEventTypes,
  createIdentityLifecycleEvent,
} from "@application/contracts/IdentityLifecycleEventContracts";
import type {
  AuditLedgerAppendContext,
  AuditLedgerAppendResult,
  AuditLedgerQuery,
  IAuditLedgerRepository,
} from "@application/audit/AuditApplicationContracts";
import { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import type { CanonicalAuditEvent } from "@domain/audit/AuditDomain";
import { AuthoritativeIdentityLifecycleEventPublisher } from "../AuthoritativeIdentityLifecycleEventPublisher";
import { AuthoritativeNodeTrustAuditSink } from "../AuthoritativeNodeTrustAuditSink";
import { AuthoritativeAuthorizationPolicyEventRecorder } from "../AuthoritativeAuthorizationPolicyEventRecorder";

class InMemoryAuditLedgerRepository implements IAuditLedgerRepository {
  public readonly events: CanonicalAuditEvent[] = [];

  public readonly contexts: AuditLedgerAppendContext[] = [];

  public async appendAuditEvent(
    event: CanonicalAuditEvent,
    context: AuditLedgerAppendContext,
  ): Promise<AuditLedgerAppendResult> {
    this.events.push(event);
    this.contexts.push(context);
    return {
      changed: true,
      wasReplay: false,
      sequence: this.events.length,
      event,
    };
  }

  public async listAuditEvents(_query: AuditLedgerQuery): Promise<ReadonlyArray<CanonicalAuditEvent>> {
    return this.events;
  }
}

describe("Authoritative security audit adapters", () => {
  it("records login/session lifecycle events through authoritative identity audit with credential redaction", async () => {
    const repository = new InMemoryAuditLedgerRepository();
    const recorder = new AuthoritativeAuditRecordingService({
      repository,
      now: () => new Date("2026-04-07T18:00:00.000Z"),
      idGenerator: () => "identity-1",
    });
    const publisher = new AuthoritativeIdentityLifecycleEventPublisher(recorder);

    await publisher.publish(createIdentityLifecycleEvent({
      eventType: IdentityLifecycleEventTypes.localAccountLoginSucceeded,
      contractVersion: IdentityLifecycleEventContractVersions.v1,
      occurredAt: "2026-04-07T18:00:00.000Z",
      payload: {
        userIdentityId: "user:login-1",
        providerId: "provider:local-password",
        providerSubject: "person@example.com",
        credentialMaterialId: "credential:raw-material",
        authenticatedAt: "2026-04-07T18:00:00.000Z",
        authPath: "local-password",
      },
    }));

    const event = repository.events[0];
    expect(event).toBeDefined();
    expect(event?.action).toBe("auth.local-account.login.succeeded");
    expect(event?.actor.actorId).toBe("user:login-1");
    expect(event?.payload.adminOnlyDetails?.credentialMaterialId).toBe("[REDACTED]");
    expect(event?.payload.adminOnlyDetails?.providerSubject).toBe("person@example.com");
    expect(event?.scope.kind).toBe("global");
  });

  it("records node approval/revocation events through authoritative node trust audit with sensitive detail redaction", async () => {
    const repository = new InMemoryAuditLedgerRepository();
    const recorder = new AuthoritativeAuditRecordingService({
      repository,
      now: () => new Date("2026-04-07T18:10:00.000Z"),
      idGenerator: () => "node-1",
    });
    const sink = new AuthoritativeNodeTrustAuditSink(recorder);

    await sink.recordNodeTrustAuditEvent({
      type: "node-revoked",
      actorUserIdentityId: "user:admin-1",
      occurredAt: "2026-04-07T18:10:00.000Z",
      workspaceId: "workspace:primary",
      nodeId: "node:gpu-west-1",
      outcome: "success",
      details: Object.freeze({
        reasonCode: "policy-violation",
        trustMaterialRef: "raw-material:abc123",
      }),
    });

    const event = repository.events[0];
    expect(event).toBeDefined();
    expect(event?.action).toBe("node.revoked");
    expect(event?.scope.workspaceId).toBe("workspace:primary");
    expect(event?.protectedResource?.resourceRef).toBe("node:gpu-west-1");
    expect(event?.payload.adminOnlyDetails?.trustMaterialRef).toBe("[REDACTED]");
  });

  it("records authorization sharing/permission mutations through authoritative audit with metadata redaction", async () => {
    const repository = new InMemoryAuditLedgerRepository();
    const recorder = new AuthoritativeAuditRecordingService({
      repository,
      now: () => new Date("2026-04-07T18:20:00.000Z"),
      idGenerator: () => "authz-1",
    });
    const eventRecorder = new AuthoritativeAuthorizationPolicyEventRecorder(recorder);

    await eventRecorder.recordPolicyEvaluationEvent({
      type: "authorization-sharing-grant-upserted",
      occurredAt: "2026-04-07T18:20:00.000Z",
      correlationId: "corr:sharing:1",
      actor: {
        actorUserIdentityId: "user:owner-1",
      },
      workspaceId: "workspace:primary",
      resource: {
        resourceFamily: "asset",
        resourceType: "asset-record",
        resourceId: "asset:123",
      },
      mutation: {
        entityKind: "sharing-grant",
        mutationKind: "upsert",
        operationKey: "authorization:sharing:grant:upsert:1",
        expectedRevision: 1,
        changed: true,
        wasReplay: false,
      },
      details: Object.freeze({
        subjectKind: "user",
        apiToken: "sensitive-token-value",
      }),
    });

    const event = repository.events[0];
    expect(event).toBeDefined();
    expect(event?.action).toBe("share.grant.upserted");
    expect(event?.scope.workspaceId).toBe("workspace:primary");
    expect(event?.protectedResource?.resourceRef).toBe("asset-record:asset:123");
    expect((event?.payload.adminOnlyDetails?.details as Record<string, unknown>)?.apiToken).toBe("[REDACTED]");
  });
});

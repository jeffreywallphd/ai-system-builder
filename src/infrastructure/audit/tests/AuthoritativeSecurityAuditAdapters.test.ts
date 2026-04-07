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
import { AuthoritativeStorageManagementAuditSink } from "../AuthoritativeStorageManagementAuditSink";
import { AuthoritativeProtectedAssetAuditSink } from "../AuthoritativeProtectedAssetAuditSink";
import { AuthoritativeRunSubmissionAuditSink } from "../AuthoritativeRunSubmissionAuditSink";
import { AuthoritativeSchedulingGovernanceEventSink } from "../AuthoritativeSchedulingGovernanceEventSink";
import {
  composeBestEffortSecretAuditHooks,
  createAuthoritativeSecretAccessAuditHook,
} from "../AuthoritativeSecretAccessAuditHook";

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

  it("records storage policy and metadata changes through authoritative storage/policy categories", async () => {
    const repository = new InMemoryAuditLedgerRepository();
    const recorder = new AuthoritativeAuditRecordingService({
      repository,
      now: () => new Date("2026-04-07T18:30:00.000Z"),
      idGenerator: () => "storage-1",
    });
    const sink = new AuthoritativeStorageManagementAuditSink(recorder);

    await sink.recordStorageManagementEvent({
      type: "storage-policy-updated",
      actorUserIdentityId: "user:storage-admin",
      workspaceId: "workspace:primary",
      storageInstanceId: "storage:alpha",
      occurredAt: "2026-04-07T18:30:00.000Z",
      correlationId: "corr:storage:policy:1",
      outcome: "success",
      details: Object.freeze({
        policyId: "policy-storage-alpha",
        keyReferenceId: "kms://workspace-alpha/keys/one",
      }),
    });
    await sink.recordStorageManagementEvent({
      type: "storage-metadata-updated",
      actorUserIdentityId: "user:storage-admin",
      workspaceId: "workspace:primary",
      storageInstanceId: "storage:alpha",
      occurredAt: "2026-04-07T18:30:01.000Z",
      outcome: "already-applied",
      details: Object.freeze({
        changedMetadataFields: Object.freeze(["displayName"]),
      }),
    });

    expect(repository.events).toHaveLength(2);
    expect(repository.events[0]?.category).toBe("policy");
    expect(repository.events[0]?.action).toBe("policy.storage.updated");
    expect(repository.events[0]?.protectedResource?.resourceRef).toBe("storage-instance:storage:alpha");
    expect((repository.events[0]?.payload.userSafeDetails as Record<string, unknown>)?.keyReferenceId).toBe("[REDACTED]");
    expect(repository.events[1]?.category).toBe("administrative");
    expect(repository.events[1]?.action).toBe("storage.metadata.updated");
  });

  it("records protected download access outcomes through authoritative protected-data taxonomy", async () => {
    const repository = new InMemoryAuditLedgerRepository();
    const recorder = new AuthoritativeAuditRecordingService({
      repository,
      now: () => new Date("2026-04-07T18:40:00.000Z"),
      idGenerator: () => "asset-1",
    });
    const sink = new AuthoritativeProtectedAssetAuditSink(recorder);

    await sink.recordAssetEvent({
      type: "asset-download-authorized",
      occurredAt: "2026-04-07T18:40:00.000Z",
      workspaceId: "workspace:primary",
      actorUserId: "user:analyst",
      correlationId: "corr:asset:download:1",
      outcome: "success",
      asset: Object.freeze({
        assetId: "asset:protected-1",
        versionId: "asset:protected-1:v2",
      }),
      details: Object.freeze({
        purpose: "download",
      }),
    });
    await sink.recordAssetEvent({
      type: "asset-download-opened",
      occurredAt: "2026-04-07T18:40:02.000Z",
      workspaceId: "workspace:primary",
      actorUserId: "user:analyst",
      outcome: "rejected",
      asset: Object.freeze({
        assetId: "asset:protected-1",
      }),
      details: Object.freeze({
        reasonCode: "invalid-download-grant",
      }),
    });

    expect(repository.events).toHaveLength(2);
    expect(repository.events[0]?.category).toBe("protected-data");
    expect(repository.events[0]?.action).toBe("asset.protected.download.authorized");
    expect(repository.events[1]?.outcome).toBe("rejected");
    expect(repository.events[1]?.action).toBe("asset.protected.download.opened");
  });

  it("records secret operation and access-decision events through authoritative secret hooks", async () => {
    const repository = new InMemoryAuditLedgerRepository();
    const recorder = new AuthoritativeAuditRecordingService({
      repository,
      now: () => new Date("2026-04-07T18:50:00.000Z"),
      idGenerator: () => "secret-1",
    });
    const hook = composeBestEffortSecretAuditHooks(
      createAuthoritativeSecretAccessAuditHook(recorder),
    );

    await hook(Object.freeze({
      eventKind: "secret.access-decision",
      action: "create",
      decision: "allowed",
      reason: "allowed",
      actor: Object.freeze({
        actorId: "user:security-admin",
        actorType: "server-admin",
      }),
      target: Object.freeze({
        secretId: "secret:server:provider:openai",
        scope: "server",
      }),
      occurredAt: "2026-04-07T18:50:00.000Z",
    }));
    await hook(Object.freeze({
      eventKind: "secret.operation",
      operation: "rotate",
      status: "succeeded",
      reasonCode: "operation-succeeded",
      actor: Object.freeze({
        actorId: "user:security-admin",
        actorType: "server-admin",
      }),
      target: Object.freeze({
        secretId: "secret:server:provider:openai",
        scope: "server",
      }),
      occurredAt: "2026-04-07T18:50:01.000Z",
    }));

    expect(repository.events).toHaveLength(2);
    expect(repository.events[0]?.action).toBe("secret.create.access-evaluated");
    expect(repository.events[0]?.category).toBe("protected-data");
    expect(repository.events[1]?.action).toBe("secret.rotate.operation-recorded");
    expect(repository.events[1]?.outcome).toBe("succeeded");
    expect(repository.events[1]?.scope.kind).toBe("global");
  });

  it("records run submission lifecycle events through authoritative orchestration audit records", async () => {
    const repository = new InMemoryAuditLedgerRepository();
    const recorder = new AuthoritativeAuditRecordingService({
      repository,
      now: () => new Date("2026-04-07T19:00:00.000Z"),
      idGenerator: () => "run-submission-1",
    });
    const sink = new AuthoritativeRunSubmissionAuditSink(recorder);

    await sink.recordRunSubmissionEvent(Object.freeze({
      type: "run-submission-accepted",
      occurredAt: "2026-04-07T19:00:00.000Z",
      workspaceId: "workspace:primary",
      runId: "run:submitted-1",
      actorUserIdentityId: "user:runner",
      details: Object.freeze({
        source: "api",
      }),
    }));
    await sink.recordRunSubmissionEvent(Object.freeze({
      type: "run-submission-denied",
      occurredAt: "2026-04-07T19:00:01.000Z",
      workspaceId: "workspace:primary",
      actorUserIdentityId: "user:runner",
      details: Object.freeze({
        reasonCode: "policy-ineligible",
      }),
    }));

    expect(repository.events).toHaveLength(2);
    expect(repository.events[0]?.action).toBe("run.submission.accepted");
    expect(repository.events[0]?.category).toBe("orchestration");
    expect(repository.events[0]?.protectedResource?.resourceRef).toBe("run:submitted-1");
    expect(repository.events[1]?.action).toBe("run.submission.denied");
    expect(repository.events[1]?.outcome).toBe("denied");
  });

  it("records scheduling governance audit-channel events through authoritative orchestration records", async () => {
    const repository = new InMemoryAuditLedgerRepository();
    const recorder = new AuthoritativeAuditRecordingService({
      repository,
      now: () => new Date("2026-04-07T19:10:00.000Z"),
      idGenerator: () => "scheduling-1",
    });
    const sink = new AuthoritativeSchedulingGovernanceEventSink(recorder);

    await sink.recordSchedulingGovernanceEvent(Object.freeze({
      channel: "audit",
      type: "scheduling-reservation-conflict",
      occurredAt: "2026-04-07T19:10:00.000Z",
      outcome: "conflict",
      workspaceId: "workspace:primary",
      actorServiceId: "scheduler:default",
      runId: "run:123",
      queueId: "queue:default",
      decisionId: "decision:abc",
      details: Object.freeze({
        reasonCode: "reservation-owner-mismatch",
      }),
    }));
    await sink.recordSchedulingGovernanceEvent(Object.freeze({
      channel: "operational",
      type: "scheduling-assignment-materialized",
      occurredAt: "2026-04-07T19:10:01.000Z",
      outcome: "succeeded",
      runId: "run:123",
    }));

    expect(repository.events).toHaveLength(1);
    expect(repository.events[0]?.action).toBe("run.scheduling.reservation.conflict");
    expect(repository.events[0]?.outcome).toBe("failed");
    expect(repository.events[0]?.protectedResource?.resourceRef).toBe("run:123");
  });

  it("maps published visibility resource policy mutations to publication-oriented sharing actions", async () => {
    const repository = new InMemoryAuditLedgerRepository();
    const recorder = new AuthoritativeAuditRecordingService({
      repository,
      now: () => new Date("2026-04-07T19:20:00.000Z"),
      idGenerator: () => "share-publication-1",
    });
    const eventRecorder = new AuthoritativeAuthorizationPolicyEventRecorder(recorder);

    await eventRecorder.recordPolicyEvaluationEvent({
      type: "authorization-resource-policy-upserted",
      occurredAt: "2026-04-07T19:20:00.000Z",
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
        entityKind: "resource-policy",
        mutationKind: "upsert",
        operationKey: "authorization:resource-policy:upsert:published",
        changed: true,
        wasReplay: false,
      },
      details: Object.freeze({
        visibility: "published",
        sharingPolicyMode: "published",
      }),
    });

    expect(repository.events).toHaveLength(1);
    expect(repository.events[0]?.action).toBe("share.resource.publication.updated");
    expect(repository.events[0]?.category).toBe("sharing");
  });
});

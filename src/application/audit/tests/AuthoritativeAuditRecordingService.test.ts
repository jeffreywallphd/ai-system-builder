import { describe, expect, it } from "bun:test";
import {
  AuditActorKinds,
  AuditEventCategories,
  AuditScopeKinds,
  type CanonicalAuditEvent,
} from "@domain/audit/AuditDomain";
import type {
  AuditLedgerAppendContext,
  AuditLedgerAppendResult,
  AuditLedgerQuery,
  IAuditLedgerRepository,
} from "../AuditApplicationContracts";
import {
  AuthoritativeAuditEventSources,
  createAuthoritativeAuditFeatureRecorder,
  type AuthoritativeAuditRecordEventInput,
} from "../ports/AuthoritativeAuditRecordingPorts";
import {
  AuthoritativeAuditRecordingService,
  toCanonicalAuthoritativeAuditEvent,
} from "../use-cases/AuthoritativeAuditRecordingService";

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

  public async countAuditEvents(_query: AuditLedgerQuery): Promise<number> {
    return this.events.length;
  }

  public async getAuditEventById(eventId: string): Promise<CanonicalAuditEvent | undefined> {
    return this.events.find((event) => event.eventId === eventId);
  }
}

function buildInput(overrides?: Partial<AuthoritativeAuditRecordEventInput>): AuthoritativeAuditRecordEventInput {
  return {
    operationKey: "Audit:Identity:Login:1",
    eventType: "identity-login-succeeded",
    action: "identity.login.succeeded",
    outcome: "succeeded",
    occurredAt: "2026-04-07T16:00:00.000Z",
    actor: {
      actorId: "user:1",
      actorKind: AuditActorKinds.user,
      actorUserIdentityId: "user:1",
    },
    scope: {
      kind: AuditScopeKinds.workspace,
      workspaceId: "workspace:1",
    },
    payload: {
      userSafeDetails: {
        provider: "local",
      },
    },
    ...overrides,
  };
}

describe("AuthoritativeAuditRecordingService", () => {
  it("records authoritative events and normalizes operation/action values", async () => {
    const repository = new InMemoryAuditLedgerRepository();
    const service = new AuthoritativeAuditRecordingService({
      repository,
      now: () => new Date("2026-04-07T16:00:01.000Z"),
      idGenerator: () => "event-1",
    });

    const result = await service.recordIdentityEvent(buildInput({
      action: " Identity.Login.Succeeded ",
      operationKey: " Identity:Login:Attempt:1 ",
    }));

    expect(result.sequence).toBe(1);
    expect(repository.events).toHaveLength(1);
    expect(repository.contexts[0]?.operationKey).toBe("identity:login:attempt:1");
    expect(repository.events[0]?.category).toBe(AuditEventCategories.securitySensitive);
    expect(repository.events[0]?.action).toBe("identity.login.succeeded");
    expect(repository.events[0]?.eventId).toBe("audit:identity:event-1");
  });

  it("centralizes redaction and protected-data metadata for structured payloads", async () => {
    const repository = new InMemoryAuditLedgerRepository();
    const service = new AuthoritativeAuditRecordingService({
      repository,
      now: () => new Date("2026-04-07T16:10:00.000Z"),
      idGenerator: () => "event-2",
    });

    await service.recordSecretsEvent(buildInput({
      operationKey: "secret:create:1",
      eventType: "secret-created",
      action: "secret.created",
      payload: {
        userSafeDetails: {
          secretName: "openai-key",
          tokenValue: "actual-secret-token",
          nested: {
            apiKey: "very-secret",
          },
        },
        adminOnlyDetails: {
          secretValue: "never-store-plaintext",
          internalErrorStack: "sensitive-trace",
        },
      },
    }));

    const event = repository.events[0];
    expect(event).toBeDefined();
    expect(event?.payload.userSafeDetails?.tokenValue).toBe("[REDACTED]");
    expect((event?.payload.userSafeDetails?.nested as Record<string, unknown>)?.apiKey).toBe("[REDACTED]");
    expect(event?.payload.adminOnlyDetails?.secretValue).toBe("[REDACTED]");
    expect(event?.payload.hasProtectedData).toBeTrue();
    expect(event?.payload.redactionReasons).toContain("secret-material");
    expect(event?.payload.redactionReasons).toContain("token");
  });

  it("normalizes actor/workspace/resource/correlation references and action context", async () => {
    const repository = new InMemoryAuditLedgerRepository();
    const service = new AuthoritativeAuditRecordingService({
      repository,
      now: () => new Date("2026-04-07T16:12:00.000Z"),
      idGenerator: () => "event-2b",
    });

    await service.recordSchedulingEvent(buildInput({
      operationKey: "scheduling:dispatch:1",
      eventType: "scheduling-dispatch-attempted",
      action: "scheduling.dispatch.attempted",
      actor: {
        actorId: " service:runtime-dispatch ",
        actorKind: AuditActorKinds.service,
      },
      scope: {
        kind: AuditScopeKinds.workspace,
        workspaceId: " workspace/prod-west ",
      },
      protectedResource: {
        resourceType: " Runtime Queue ",
        resourceId: " C:\\runtime\\queues\\primary ",
        resourceRef: "sqlite://internal/queue_row_1",
        sensitivityClass: "sensitive",
      },
      correlationId: " corr/runtime/dispatch-1 ",
      requestId: " req/runtime/dispatch-1 ",
      actionContext: {
        nodeId: " node/gpu-west-1 ",
        deviceId: " workstation/ci-runner-1 ",
      },
      linkage: {
        eventGroupId: " group/runtime/dispatch-1 ",
        workflowId: " workflow/dispatch ",
        runId: " run/42 ",
        governanceActionId: " governance/action/dispatch ",
        relatedResources: [
          {
            resourceType: " runtime queue ",
            resourceId: " queue/main ",
            relationship: "subject",
          },
        ],
      },
    }));

    const event = repository.events[0];
    expect(event).toBeDefined();
    expect(event?.actor.actorId).toBe("service:runtime-dispatch");
    expect(event?.actor.actorServiceId).toBe("service:runtime-dispatch");
    expect(event?.scope.workspaceId).toBe("workspace:prod-west");
    expect(event?.protectedResource?.resourceType).toBe("runtime-queue");
    expect(event?.protectedResource?.resourceRef).toBe("runtime-queue:C:runtime:queues:primary");
    expect(event?.protectedResource?.resourceRef).not.toContain("sqlite://internal/queue_row_1");
    expect(event?.correlationId).toBe("corr:runtime:dispatch-1");
    expect(event?.requestId).toBe("req:runtime:dispatch-1");
    expect(event?.linkage?.eventGroupId).toBe("group:runtime:dispatch-1");
    expect(event?.linkage?.workflowId).toBe("workflow:dispatch");
    expect(event?.linkage?.runId).toBe("run:42");
    expect(event?.linkage?.governanceActionId).toBe("governance:action:dispatch");
    expect(event?.linkage?.relatedResources?.[0]?.resourceRef).toBe("runtime-queue:queue:main");
    expect(
      (event?.payload.userSafeDetails?.referenceContext as Record<string, unknown>)?.nodeRef,
    ).toBe("node:gpu-west-1");
    expect(
      (event?.payload.userSafeDetails?.referenceContext as Record<string, unknown>)?.deviceRef,
    ).toBe("device:workstation:ci-runner-1");
  });

  it("exposes feature-scoped recorder helpers for cross-feature emission", async () => {
    const repository = new InMemoryAuditLedgerRepository();
    const service = new AuthoritativeAuditRecordingService({
      repository,
      now: () => new Date("2026-04-07T16:15:00.000Z"),
      idGenerator: () => "event-3",
    });

    const recordRunEvent = createAuthoritativeAuditFeatureRecorder(service, AuthoritativeAuditEventSources.runs);
    const recordPolicyEvent = createAuthoritativeAuditFeatureRecorder(service, AuthoritativeAuditEventSources.policy);

    await recordRunEvent(buildInput({
      operationKey: "run:accepted:1",
      eventType: "run-submission-accepted",
      action: "run.submission.accepted",
    }));

    await recordPolicyEvent(buildInput({
      operationKey: "policy:updated:1",
      eventType: "policy-updated",
      action: "policy.updated",
    }));

    expect(repository.events).toHaveLength(2);
    expect(repository.events[0]?.category).toBe(AuditEventCategories.orchestration);
    expect(repository.events[1]?.category).toBe(AuditEventCategories.policy);
  });

  it("rejects action namespaces that do not match the selected source port", async () => {
    const repository = new InMemoryAuditLedgerRepository();
    const service = new AuthoritativeAuditRecordingService({ repository });

    await expect(service.recordStorageEvent(buildInput({
      action: "identity.login.succeeded",
    }))).rejects.toThrow("not valid for 'storage' source");
  });

  it("applies retention lifecycle default seams when configured", async () => {
    const repository = new InMemoryAuditLedgerRepository();
    const service = new AuthoritativeAuditRecordingService({
      repository,
      now: () => new Date("2026-04-07T16:18:00.000Z"),
      idGenerator: () => "event-retention-defaults",
      retentionLifecycleDefaults: {
        policyKey: "retention-policy:workspace-default",
        policyVersion: "2026-04-07",
        retentionAnchor: "recorded-at",
      },
    });

    await service.recordPolicyEvent(buildInput({
      operationKey: "retention:policy:updated:1",
      eventType: "retention-policy-updated",
      action: "retention.policy.updated",
    }));

    expect(repository.events).toHaveLength(1);
    expect(repository.events[0]?.retentionMetadata?.policyKey).toBe("retention-policy:workspace-default");
    expect(repository.events[0]?.retentionMetadata?.policyVersion).toBe("2026-04-07");
    expect(repository.events[0]?.retentionMetadata?.retentionAnchor).toBe("recorded-at");
  });

  it("returns canonical immutable-safe event snapshots", () => {
    const event = toCanonicalAuthoritativeAuditEvent({
      recordKind: "audit-record",
      eventId: "audit:test:1",
      eventType: "policy-updated",
      category: "policy",
      action: "policy.updated",
      outcome: "succeeded",
      occurredAt: "2026-04-07T16:20:00.000Z",
      recordedAt: "2026-04-07T16:20:00.010Z",
      actor: {
        actorId: "service:policy",
        actorKind: "service",
        actorServiceId: "service:policy",
      },
      scope: {
        kind: "workspace",
        workspaceId: "workspace:1",
      },
      payload: {
        userSafeDetails: {
          key: "value",
        },
        hasProtectedData: false,
        redactionReasons: [],
      },
      integrity: {
        schemaVersion: "1.0",
        hashAlgorithm: "sha-256",
      },
      retention: "governance",
      immutability: "append-only",
    });

    expect(event.payload.userSafeDetails?.key).toBe("value");
    expect(Object.isFrozen(event.payload)).toBeTrue();
  });
});

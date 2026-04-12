import { describe, expect, it } from "bun:test";
import {
  AuditActorKinds,
  AuditDomainError,
  AuditEventCategories,
  AuditLifecycleStates,
  AuditImmutabilityPostures,
  AuditRetentionAnchorKinds,
  AuditRedactionReasons,
  AuditRetentionPostures,
  AuditScopeKinds,
  AuditResourceSensitivityClasses,
  createAuditActorIdentity,
  createAuditEventPayloadBoundary,
  createCanonicalAuditEvent,
  createAuditScope,
  toUserSafeAuditEventView,
} from "../AuditDomain";

describe("AuditDomain", () => {
  it("enforces actor and scope invariants", () => {
    expect(() => createAuditActorIdentity({ actorId: "", actorKind: AuditActorKinds.user })).toThrow(
      AuditDomainError,
    );

    expect(() => createAuditActorIdentity({
      actorId: "actor:user:1",
      actorKind: AuditActorKinds.user,
    })).toThrow(AuditDomainError);

    expect(createAuditActorIdentity({
      actorId: "actor:user:1",
      actorKind: AuditActorKinds.user,
      actorUserIdentityId: "user:1",
      actorSessionId: "session:1",
    })).toEqual({
      actorId: "actor:user:1",
      actorKind: AuditActorKinds.user,
      actorUserIdentityId: "user:1",
      actorServiceId: undefined,
      actorSessionId: "session:1",
    });

    expect(() => createAuditScope({ kind: AuditScopeKinds.workspace })).toThrow(AuditDomainError);

    expect(createAuditScope({ kind: AuditScopeKinds.workspace, workspaceId: "workspace:1" })).toEqual({
      kind: AuditScopeKinds.workspace,
      workspaceId: "workspace:1",
    });
  });

  it("enforces payload boundary redaction invariants", () => {
    expect(() => createAuditEventPayloadBoundary({
      userSafeDetails: {
        key: "safe",
      },
      adminOnlyDetails: {
        key: "secret",
      },
      hasProtectedData: true,
      redactionReasons: [AuditRedactionReasons.secretMaterial],
    })).toThrow(AuditDomainError);

    expect(() => createAuditEventPayloadBoundary({
      hasProtectedData: true,
      adminOnlyDetails: {
        credentialHash: "abc",
      },
    })).toThrow(AuditDomainError);

    const payload = createAuditEventPayloadBoundary({
      userSafeDetails: {
        mutationKind: "role-reassigned",
      },
      adminOnlyDetails: {
        internalPolicyResult: "policy:123",
      },
      hasProtectedData: true,
      redactionReasons: [AuditRedactionReasons.internalOnlyDiagnostic],
    });

    expect(payload.hasProtectedData).toBeTrue();
    expect(payload.redactionReasons).toEqual([AuditRedactionReasons.internalOnlyDiagnostic]);
  });

  it("creates canonical audit events with append-oriented invariants", () => {
    const event = createCanonicalAuditEvent({
      eventId: "audit:event:1",
      eventType: "workspace-role-reassigned",
      category: AuditEventCategories.administrative,
      action: "workspace.role.reassigned",
      outcome: "succeeded",
      occurredAt: "2026-04-07T12:00:00.000Z",
      recordedAt: "2026-04-07T12:00:01.000Z",
      actor: {
        actorId: "user:admin:1",
        actorKind: AuditActorKinds.user,
        actorUserIdentityId: "user:admin:1",
        actorSessionId: "session:admin:1",
      },
      scope: {
        kind: AuditScopeKinds.workspace,
        workspaceId: "workspace:1",
      },
      protectedResource: {
        resourceType: "workspace-role-assignment",
        resourceId: "assignment:1",
        resourceRef: "workspace-role-assignment:assignment:1",
        sensitivityClass: AuditResourceSensitivityClasses.sensitive,
        workspaceId: "workspace:1",
      },
      payload: {
        userSafeDetails: {
          roleKey: "admin",
          targetUserIdentityId: "user:member:9",
        },
        adminOnlyDetails: {
          priorRoleKey: "member",
          internalReasonCodes: ["owner-requested"],
        },
        hasProtectedData: true,
        redactionReasons: [AuditRedactionReasons.personalData],
      },
      integrity: {
        schemaVersion: "1.0",
        hashAlgorithm: "sha-256",
        eventDigest: "digest:1",
        previousEventDigest: "digest:0",
      },
      retention: AuditRetentionPostures.governance,
      immutability: AuditImmutabilityPostures.appendOnly,
      correlationId: "corr:1",
      requestId: "request:1",
      linkage: {
        eventGroupId: "group:trust-change:1",
      },
    });

    expect(event.recordKind).toBe("audit-record");
    expect(event.immutability).toBe("append-only");
    expect(event.payload.userSafeDetails?.priorRoleKey).toBeUndefined();

    const userSafe = toUserSafeAuditEventView(event);
    expect(userSafe.details).toEqual({
      roleKey: "admin",
      targetUserIdentityId: "user:member:9",
    });
    expect(userSafe.linkage?.eventGroupId).toBe("group:trust-change:1");

    expect(() => createCanonicalAuditEvent({
      ...event,
      eventId: "audit:event:2",
      occurredAt: "2026-04-07T12:00:02.000Z",
      recordedAt: "2026-04-07T12:00:01.000Z",
      integrity: {
        schemaVersion: "1.0",
        hashAlgorithm: "sha-256",
      },
    })).toThrow(AuditDomainError);
  });

  it("normalizes and validates linkage metadata", () => {
    const event = createCanonicalAuditEvent({
      eventId: "audit:event:linkage:1",
      eventType: "run-governance-updated",
      category: AuditEventCategories.orchestration,
      action: "run.governance.updated",
      outcome: "succeeded",
      occurredAt: "2026-04-07T12:10:00.000Z",
      actor: {
        actorId: "service:orchestrator",
        actorKind: AuditActorKinds.service,
        actorServiceId: "service:orchestrator",
      },
      scope: {
        kind: AuditScopeKinds.workspace,
        workspaceId: "workspace:1",
      },
      payload: {
        hasProtectedData: false,
        redactionReasons: [],
      },
      integrity: {
        schemaVersion: "1.0",
        hashAlgorithm: "sha-256",
      },
      linkage: {
        eventGroupId: " group:run-governance:1 ",
        parentEventId: " audit:event:linkage:0 ",
        rootEventId: " audit:event:linkage:root ",
        workflowId: " workflow:queue-arbitration ",
        sessionRef: " session:runtime:1 ",
        runId: " run:123 ",
        governanceActionId: " governance:change:7 ",
        relatedResources: [
          {
            resourceType: "run",
            resourceId: "run:123",
            resourceRef: "run:123",
            relationship: "subject",
          },
        ],
      },
    });

    expect(event.linkage?.eventGroupId).toBe("group:run-governance:1");
    expect(event.linkage?.runId).toBe("run:123");
    expect(event.linkage?.relatedResources?.[0]?.relationship).toBe("subject");

    expect(() => createCanonicalAuditEvent({
      ...event,
      eventId: "audit:event:linkage:2",
      linkage: {
        rootEventId: "audit:event:same",
        parentEventId: "audit:event:same",
      },
    })).toThrow(AuditDomainError);
  });

  it("supports retention lifecycle metadata seams without destructive controls", () => {
    const event = createCanonicalAuditEvent({
      eventId: "audit:event:retention:1",
      eventType: "policy-retention-updated",
      category: AuditEventCategories.policy,
      action: "retention.policy.updated",
      outcome: "succeeded",
      occurredAt: "2026-04-07T12:15:00.000Z",
      actor: {
        actorId: "user:governance-admin",
        actorKind: AuditActorKinds.user,
        actorUserIdentityId: "user:governance-admin",
      },
      scope: {
        kind: AuditScopeKinds.workspace,
        workspaceId: "workspace:1",
      },
      payload: {
        hasProtectedData: false,
        redactionReasons: [],
      },
      integrity: {
        schemaVersion: "1.0",
        hashAlgorithm: "sha-256",
      },
      retention: AuditRetentionPostures.governance,
      retentionMetadata: {
        policyKey: "retention-policy:workspace-default",
        policyVersion: "2026-04-07",
        retentionAnchor: AuditRetentionAnchorKinds.recordedAt,
        retainUntil: "2027-04-07T00:00:00.000Z",
        archiveAfter: "2027-07-07T00:00:00.000Z",
        lifecycleState: AuditLifecycleStates.archiveCandidate,
        lifecycleUpdatedAt: "2026-04-07T12:16:00.000Z",
      },
    });

    expect(event.retentionMetadata?.policyKey).toBe("retention-policy:workspace-default");
    expect(event.retentionMetadata?.retentionAnchor).toBe(AuditRetentionAnchorKinds.recordedAt);
    expect(event.retentionMetadata?.lifecycleState).toBe(AuditLifecycleStates.archiveCandidate);

    const legalHoldDefault = createCanonicalAuditEvent({
      ...event,
      eventId: "audit:event:retention:2",
      retention: AuditRetentionPostures.legalHold,
      retentionMetadata: undefined,
    });
    expect(legalHoldDefault.retentionMetadata?.lifecycleState).toBe(AuditLifecycleStates.retentionHold);

    expect(() => createCanonicalAuditEvent({
      ...event,
      eventId: "audit:event:retention:3",
      retentionMetadata: {
        retentionAnchor: AuditRetentionAnchorKinds.occurredAt,
        retainUntil: "2027-04-07T00:00:00.000Z",
        archiveAfter: "2027-01-01T00:00:00.000Z",
      },
    })).toThrow(AuditDomainError);
  });
});

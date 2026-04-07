import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  AuditActorKinds,
  AuditEventCategories,
  AuditLifecycleStates,
  AuditImmutabilityPostures,
  AuditRetentionAnchorKinds,
  AuditScopeKinds,
  createCanonicalAuditEvent,
  type CanonicalAuditEvent,
} from "@domain/audit/AuditDomain";
import { SharedApiSortDirections } from "@shared/contracts/api/SharedApiContractPrimitives";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteAuditLedgerRepository } from "../SqliteAuditLedgerRepository";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function createEvent(overrides?: Partial<CanonicalAuditEvent>): CanonicalAuditEvent {
  const scope = overrides?.scope ?? {
    kind: AuditScopeKinds.workspace,
    workspaceId: "workspace:alpha",
  };
  return createCanonicalAuditEvent({
    eventId: overrides?.eventId ?? "audit:event:1",
    eventType: overrides?.eventType ?? "run-submission-accepted",
    category: overrides?.category ?? AuditEventCategories.orchestration,
    action: overrides?.action ?? "run.submission.accepted",
    outcome: overrides?.outcome ?? "succeeded",
    occurredAt: overrides?.occurredAt ?? "2026-04-07T20:00:00.000Z",
    recordedAt: overrides?.recordedAt,
    actor: overrides?.actor ?? {
      actorId: "user:alpha",
      actorKind: AuditActorKinds.user,
      actorUserIdentityId: "user:alpha",
    },
    scope,
    protectedResource: overrides?.protectedResource,
    payload: overrides?.payload ?? {
      userSafeDetails: {
        runId: "run:alpha",
      },
      hasProtectedData: false,
      redactionReasons: [],
    },
    integrity: overrides?.integrity ?? {
      schemaVersion: "1.0",
      hashAlgorithm: "sha-256",
    },
    retention: overrides?.retention,
    immutability: overrides?.immutability,
    correlationId: overrides?.correlationId,
    requestId: overrides?.requestId,
    linkage: overrides?.linkage,
  });
}

describe("SqliteAuditLedgerRepository", () => {
  it("durably appends canonical events and supports replay-safe operation keys", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-audit-ledger-"));
    createdRoots.push(root);
    const repository = new SqliteAuditLedgerRepository(path.join(root, "audit.sqlite"));

    const event = createEvent();
    const first = await repository.appendAuditEvent(event, {
      operationKey: "Audit:Runs:1",
      actorId: "user:alpha",
      occurredAt: "2026-04-07T20:00:01.000Z",
      correlationId: "corr:alpha",
    });
    const replay = await repository.appendAuditEvent(event, {
      operationKey: " audit:runs:1 ",
      actorId: "user:alpha",
      occurredAt: "2026-04-07T20:00:02.000Z",
      correlationId: "corr:alpha",
    });

    expect(first.changed).toBeTrue();
    expect(first.sequence).toBe(1);
    expect(replay.changed).toBeFalse();
    expect(replay.wasReplay).toBeTrue();
    expect(replay.sequence).toBe(1);

    const reloaded = new SqliteAuditLedgerRepository(path.join(root, "audit.sqlite"));
    const events = await reloaded.listAuditEvents({
      limit: 10,
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.eventId).toBe(event.eventId);

    repository.dispose();
    reloaded.dispose();
  });

  it("returns append conflict when same event id is reused with different content", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-audit-ledger-conflict-"));
    createdRoots.push(root);
    const repository = new SqliteAuditLedgerRepository(path.join(root, "audit.sqlite"));

    await repository.appendAuditEvent(createEvent({
      eventId: "audit:event:conflict",
      action: "policy.updated",
      category: AuditEventCategories.policy,
      eventType: "policy-updated",
    }), {
      operationKey: "audit:conflict:1",
      actorId: "user:alpha",
    });

    await expect(repository.appendAuditEvent(createEvent({
      eventId: "audit:event:conflict",
      action: "policy.deleted",
      category: AuditEventCategories.policy,
      eventType: "policy-deleted",
    }), {
      operationKey: "audit:conflict:2",
      actorId: "user:alpha",
    })).rejects.toThrow("already exists with different contents");

    repository.dispose();
  });

  it("supports query filters over category, actor/resource references, action namespace, thin-safe, and sorting", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-audit-ledger-query-"));
    createdRoots.push(root);
    const repository = new SqliteAuditLedgerRepository(path.join(root, "audit.sqlite"));

    await repository.appendAuditEvent(createEvent({
      eventId: "audit:event:admin",
      eventType: "workspace-member-added",
      category: AuditEventCategories.administrative,
      action: "workspace.member.added",
      occurredAt: "2026-04-07T19:55:00.000Z",
      actor: {
        actorId: "user:admin",
        actorKind: AuditActorKinds.user,
        actorUserIdentityId: "user:admin",
      },
      protectedResource: {
        resourceType: "workspace",
        resourceId: "workspace:alpha",
        resourceRef: "workspace:alpha",
        sensitivityClass: "standard",
        workspaceId: "workspace:alpha",
      },
    }), {
      operationKey: "audit:query:1",
      actorId: "user:admin",
    });

    await repository.appendAuditEvent(createEvent({
      eventId: "audit:event:secret",
      eventType: "secret-access-decision",
      category: AuditEventCategories.protectedData,
      action: "secret.read.access-evaluated",
      occurredAt: "2026-04-07T20:05:00.000Z",
      actor: {
        actorId: "service:secrets",
        actorKind: AuditActorKinds.service,
        actorServiceId: "service:secrets",
      },
      payload: {
        userSafeDetails: {
          decision: "allowed",
        },
        adminOnlyDetails: {
          tokenValue: "[REDACTED]",
        },
        hasProtectedData: true,
        redactionReasons: ["token"],
      },
      retention: "legal-hold",
      retentionMetadata: {
        policyKey: "retention-policy:legal-hold",
        policyVersion: "2026-04-07",
        retentionAnchor: AuditRetentionAnchorKinds.recordedAt,
        retainUntil: "2027-04-07T00:00:00.000Z",
        lifecycleState: AuditLifecycleStates.retentionHold,
      },
      protectedResource: {
        resourceType: "secret",
        resourceId: "secret:one",
        resourceRef: "secret:one",
        sensitivityClass: "protected",
      },
    }), {
      operationKey: "audit:query:2",
      actorId: "service:secrets",
    });

    await repository.appendAuditEvent(createEvent({
      eventId: "audit:event:run",
      eventType: "run-submission-accepted",
      category: AuditEventCategories.orchestration,
      action: "run.submission.accepted",
      occurredAt: "2026-04-07T20:10:00.000Z",
      actor: {
        actorId: "user:runner",
        actorKind: AuditActorKinds.user,
        actorUserIdentityId: "user:runner",
      },
      protectedResource: {
        resourceType: "run",
        resourceId: "run:beta",
        resourceRef: "run:beta",
        sensitivityClass: "sensitive",
        workspaceId: "workspace:alpha",
      },
      correlationId: "corr:run:beta",
      requestId: "req:run:beta",
      linkage: {
        eventGroupId: "group:run-governance:beta",
        workflowId: "workflow:run-governance",
        runId: "run:beta",
        governanceActionId: "governance:run:retry",
        rootEventId: "audit:event:admin",
        parentEventId: "audit:event:secret",
        sessionRef: "session:runner:beta",
        relatedResources: [
          {
            resourceType: "workspace",
            resourceId: "workspace:alpha",
            resourceRef: "workspace:alpha",
            relationship: "scope",
            workspaceId: "workspace:alpha",
          },
        ],
      },
    }), {
      operationKey: "audit:query:3",
      actorId: "user:runner",
      correlationId: "corr:run:beta",
    });

    const byActionPrefix = await repository.listAuditEvents({
      actionPrefix: "run.",
    });
    expect(byActionPrefix).toHaveLength(1);
    expect(byActionPrefix[0]?.eventId).toBe("audit:event:run");

    const thinSafeOnly = await repository.listAuditEvents({
      filters: {
        includeThinSafeOnly: true,
      },
    });
    expect(thinSafeOnly.map((event) => event.eventId)).toEqual([
      "audit:event:run",
      "audit:event:admin",
    ]);

    const byActorAndResource = await repository.listAuditEvents({
      filters: {
        actorIds: ["service:secrets"],
        resourceTypes: ["secret"],
      },
    });
    expect(byActorAndResource).toHaveLength(1);
    expect(byActorAndResource[0]?.eventId).toBe("audit:event:secret");
    expect(byActorAndResource[0]?.retentionMetadata?.policyKey).toBe("retention-policy:legal-hold");

    const byRetentionLifecycle = await repository.listAuditEvents({
      filters: {
        retentionPostures: ["legal-hold"],
        lifecycleStates: [AuditLifecycleStates.retentionHold],
        retentionPolicyKeys: ["retention-policy:legal-hold"],
        retainUntilAfter: "2027-01-01T00:00:00.000Z",
        retainUntilBefore: "2028-01-01T00:00:00.000Z",
      },
    });
    expect(byRetentionLifecycle).toHaveLength(1);
    expect(byRetentionLifecycle[0]?.eventId).toBe("audit:event:secret");

    const byLinkage = await repository.listAuditEvents({
      filters: {
        correlationIds: ["corr:run:beta"],
        requestIds: ["req:run:beta"],
        eventGroupIds: ["group:run-governance:beta"],
        workflowIds: ["workflow:run-governance"],
        runIds: ["run:beta"],
        governanceActionIds: ["governance:run:retry"],
        rootEventIds: ["audit:event:admin"],
        parentEventIds: ["audit:event:secret"],
        sessionRefs: ["session:runner:beta"],
      },
    });
    expect(byLinkage).toHaveLength(1);
    expect(byLinkage[0]?.eventId).toBe("audit:event:run");
    expect(byLinkage[0]?.linkage?.relatedResources?.[0]?.relationship).toBe("scope");

    const scopedCount = await repository.countAuditEvents({
      filters: {
        actorIds: ["service:secrets"],
        resourceTypes: ["secret"],
      },
    });
    expect(scopedCount).toBe(1);

    const ascendingByOccurred = await repository.listAuditEvents({
      sorting: {
        sortBy: "occurredAt",
        sortDirection: SharedApiSortDirections.ascending,
      },
    });
    expect(ascendingByOccurred.map((event) => event.eventId)).toEqual([
      "audit:event:admin",
      "audit:event:secret",
      "audit:event:run",
    ]);

    const offsetWindow = await repository.listAuditEvents({
      sorting: {
        sortBy: "occurredAt",
        sortDirection: SharedApiSortDirections.ascending,
      },
      pagination: {
        limit: 1,
        offset: 1,
      },
    });
    expect(offsetWindow.map((event) => event.eventId)).toEqual(["audit:event:secret"]);

    const detail = await repository.getAuditEventById("audit:event:secret");
    expect(detail?.eventId).toBe("audit:event:secret");
    expect(detail?.category).toBe("protected-data");
    const missing = await repository.getAuditEventById("audit:event:missing");
    expect(missing).toBeUndefined();

    repository.dispose();
  });

  it("prohibits update and delete mutations against persisted audit ledger rows", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-audit-ledger-immutable-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "audit.sqlite");
    const repository = new SqliteAuditLedgerRepository(databasePath);

    await repository.appendAuditEvent(createEvent({
      eventId: "audit:event:immutable",
      eventType: "policy-updated",
      category: AuditEventCategories.policy,
      action: "policy.updated",
      integrity: {
        schemaVersion: "1.0",
        hashAlgorithm: "sha-256",
        eventDigest: "digest:immutable:1",
      },
    }), {
      operationKey: "audit:immutable:1",
      actorId: "user:auditor",
      occurredAt: "2026-04-07T20:11:00.000Z",
    });

    repository.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    expect(() => database.prepare(`
      UPDATE authoritative_audit_ledger_events
      SET outcome = 'failed'
      WHERE event_id = 'audit:event:immutable'
    `).run()).toThrow("append-only");

    expect(() => database.prepare(`
      DELETE FROM authoritative_audit_ledger_events
      WHERE event_id = 'audit:event:immutable'
    `).run()).toThrow("append-only");

    expect(() => database.prepare(`
      UPDATE authoritative_audit_ledger_mutation_replays
      SET actor_id = 'user:tampered'
      WHERE operation_key = 'audit:immutable:1'
    `).run()).toThrow("append-only");
    database.close();
  });

  it("enforces hash-chain integrity continuity when appending", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-audit-ledger-hash-chain-"));
    createdRoots.push(root);
    const repository = new SqliteAuditLedgerRepository(path.join(root, "audit.sqlite"));

    await repository.appendAuditEvent(createEvent({
      eventId: "audit:event:chain:1",
      eventType: "policy-updated",
      category: AuditEventCategories.policy,
      action: "policy.updated",
      integrity: {
        schemaVersion: "1.0",
        hashAlgorithm: "sha-256",
        eventDigest: "digest:chain:1",
      },
      immutability: AuditImmutabilityPostures.appendOnlyHashChained,
    }), {
      operationKey: "audit:chain:1",
      actorId: "user:auditor",
      occurredAt: "2026-04-07T20:12:00.000Z",
    });

    await expect(repository.appendAuditEvent(createEvent({
      eventId: "audit:event:chain:2",
      eventType: "policy-updated",
      category: AuditEventCategories.policy,
      action: "policy.updated",
      integrity: {
        schemaVersion: "1.0",
        hashAlgorithm: "sha-256",
      },
      immutability: AuditImmutabilityPostures.appendOnlyHashChained,
    }), {
      operationKey: "audit:chain:2-missing-digest",
      actorId: "user:auditor",
      occurredAt: "2026-04-07T20:12:10.000Z",
    })).rejects.toThrow("requires integrity.eventDigest");

    await expect(repository.appendAuditEvent(createEvent({
      eventId: "audit:event:chain:2b",
      eventType: "policy-updated",
      category: AuditEventCategories.policy,
      action: "policy.updated",
      integrity: {
        schemaVersion: "1.0",
        hashAlgorithm: "sha-256",
        eventDigest: "digest:chain:2b",
        previousEventDigest: "digest:wrong",
      },
      immutability: AuditImmutabilityPostures.appendOnlyHashChained,
    }), {
      operationKey: "audit:chain:2-mismatch",
      actorId: "user:auditor",
      occurredAt: "2026-04-07T20:12:20.000Z",
    })).rejects.toThrow("does not match latest ledger digest");

    const appended = await repository.appendAuditEvent(createEvent({
      eventId: "audit:event:chain:2c",
      eventType: "policy-updated",
      category: AuditEventCategories.policy,
      action: "policy.updated",
      integrity: {
        schemaVersion: "1.0",
        hashAlgorithm: "sha-256",
        eventDigest: "digest:chain:2c",
        previousEventDigest: "digest:chain:1",
      },
      immutability: AuditImmutabilityPostures.appendOnlyHashChained,
    }), {
      operationKey: "audit:chain:2-valid",
      actorId: "user:auditor",
      occurredAt: "2026-04-07T20:12:30.000Z",
    });

    expect(appended.changed).toBeTrue();
    expect(appended.sequence).toBe(2);
    repository.dispose();
  });
});

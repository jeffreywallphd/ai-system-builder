import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  AuditActorKinds,
  AuditEventCategories,
  AuditScopeKinds,
  createCanonicalAuditEvent,
  type CanonicalAuditEvent,
} from "@domain/audit/AuditDomain";
import { SharedApiSortDirections } from "@shared/contracts/api/SharedApiContractPrimitives";
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

    repository.dispose();
  });
});

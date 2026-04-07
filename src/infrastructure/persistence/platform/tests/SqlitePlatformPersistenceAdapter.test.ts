import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PlatformAuditEventKinds } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqlitePlatformPersistenceAdapter } from "../SqlitePlatformPersistenceAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("SqlitePlatformPersistenceAdapter", () => {
  it("applies migrations and creates run/audit persistence tables", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-platform-schema-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "platform.sqlite");

    const adapter = new SqlitePlatformPersistenceAdapter(databasePath);
    await adapter.createRun({
      runId: "run-bootstrap",
      runKind: "workflow",
      status: "pending",
      workspaceId: "workspace-alpha",
      userIdentityId: "user-owner",
      sourceAggregateRef: "workflow:bootstrap",
      initiatedAt: "2026-04-06T12:00:00.000Z",
      metadata: {
        schedule: {
          triggerType: "manual",
        },
      },
      revision: 0,
    }, {
      operationKey: "op-platform-run-bootstrap",
      actorId: "user-owner",
      occurredAt: "2026-04-06T12:00:00.000Z",
      correlationId: "corr-platform-bootstrap",
    });
    adapter.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const versionRow = database.prepare("SELECT MAX(version) AS version FROM platform_repository_migrations")
      .get() as { version?: number };
    expect(versionRow.version).toBe(1);

    const tables = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('platform_run_records', 'platform_audit_events', 'platform_persistence_mutation_replays')
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual([
      "platform_audit_events",
      "platform_persistence_mutation_replays",
      "platform_run_records",
    ]);

    database.close();
  });

  it("supports replay-safe run create/save with query filters and revision checks", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-platform-runs-"));
    createdRoots.push(root);
    const adapter = new SqlitePlatformPersistenceAdapter(path.join(root, "platform.sqlite"));

    const created = await adapter.createRun({
      runId: "run-001",
      runKind: "workflow",
      status: "pending",
      workspaceId: "workspace-alpha",
      userIdentityId: "user-owner",
      sourceAggregateRef: "workflow:render",
      initiatedAt: "2026-04-06T12:00:00.000Z",
      metadata: {
        schedule: {
          triggerType: "cron",
          cron: "0 */30 * * * *",
          queuePriority: 5,
        },
      },
      revision: 0,
    }, {
      operationKey: "op-run-001-create",
      actorId: "user-owner",
      occurredAt: "2026-04-06T12:00:00.000Z",
      correlationId: "corr-run-001",
    });

    expect(created.changed).toBeTrue();
    expect(created.wasReplay).toBeFalse();
    expect(created.record.revision).toBe(1);

    const replay = await adapter.createRun(created.record, {
      operationKey: "op-run-001-create",
      actorId: "user-owner",
      occurredAt: "2026-04-06T12:00:01.000Z",
      correlationId: "corr-run-001",
    });
    expect(replay.changed).toBeFalse();
    expect(replay.wasReplay).toBeTrue();
    expect(replay.record.revision).toBe(1);

    const started = await adapter.saveRun({
      ...created.record,
      status: "running",
      startedAt: "2026-04-06T12:00:03.000Z",
      revision: created.record.revision,
    }, {
      operationKey: "op-run-001-start",
      actorId: "system:orchestrator",
      occurredAt: "2026-04-06T12:00:03.000Z",
      correlationId: "corr-run-001",
      expectedRevision: created.record.revision,
    });
    expect(started.record.revision).toBe(2);
    expect(started.record.status).toBe("running");

    const completed = await adapter.saveRun({
      ...started.record,
      status: "completed",
      completedAt: "2026-04-06T12:00:20.000Z",
      terminalReason: "succeeded",
      metadata: {
        schedule: {
          triggerType: "cron",
          cron: "0 */30 * * * *",
        },
        queue: {
          lane: "standard",
          priority: 5,
        },
      },
      revision: started.record.revision,
    }, {
      operationKey: "op-run-001-complete",
      actorId: "system:orchestrator",
      occurredAt: "2026-04-06T12:00:20.000Z",
      correlationId: "corr-run-001",
      expectedRevision: started.record.revision,
    });
    expect(completed.record.revision).toBe(3);
    expect(completed.record.status).toBe("completed");
    expect(completed.record.completedAt).toBe("2026-04-06T12:00:20.000Z");

    await adapter.createRun({
      runId: "run-002",
      runKind: "agent",
      status: "running",
      workspaceId: "workspace-beta",
      userIdentityId: "user-operator",
      sourceAggregateRef: "agent:planner",
      initiatedAt: "2026-04-06T13:00:00.000Z",
      startedAt: "2026-04-06T13:00:05.000Z",
      revision: 0,
    }, {
      operationKey: "op-run-002-create",
      actorId: "user-operator",
      occurredAt: "2026-04-06T13:00:00.000Z",
    });

    const queryResult = await adapter.listRuns({
      runKinds: ["workflow"],
      statuses: ["completed"],
      workspaceId: "workspace-alpha",
      userIdentityId: "user-owner",
      sourceAggregateRef: "workflow:render",
      initiatedAfter: "2026-04-06T11:59:59.000Z",
      initiatedBefore: "2026-04-06T12:30:00.000Z",
      limit: 10,
      offset: 0,
    });

    expect(queryResult).toHaveLength(1);
    expect(queryResult[0]?.runId).toBe("run-001");
    expect((queryResult[0]?.metadata as { schedule?: { triggerType?: string } } | undefined)?.schedule?.triggerType)
      .toBe("cron");

    await expect(adapter.saveRun({
      ...created.record,
      status: "failed",
      completedAt: "2026-04-06T12:01:00.000Z",
      terminalReason: "stale-update",
    }, {
      operationKey: "op-run-001-stale",
      actorId: "system:orchestrator",
      occurredAt: "2026-04-06T12:01:00.000Z",
      expectedRevision: created.record.revision,
    })).rejects.toThrow("expectedRevision");

    adapter.dispose();
  });

  it("supports append-only audit event persistence with replay and query filters", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-platform-audit-"));
    createdRoots.push(root);
    const adapter = new SqlitePlatformPersistenceAdapter(path.join(root, "platform.sqlite"));

    const appended = await adapter.appendAuditEvent({
      eventId: "audit-001",
      eventKind: PlatformAuditEventKinds.runs,
      action: "run.completed",
      actorId: "system:orchestrator",
      workspaceId: "workspace-alpha",
      userIdentityId: "user-owner",
      targetRef: "run:run-001",
      outcome: "succeeded",
      occurredAt: "2026-04-06T12:00:21.000Z",
      correlationId: "corr-run-001",
      details: {
        runId: "run-001",
        status: "completed",
      },
    }, {
      operationKey: "op-audit-001-append",
      actorId: "system:orchestrator",
      occurredAt: "2026-04-06T12:00:21.000Z",
      correlationId: "corr-run-001",
    });
    expect(appended.changed).toBeTrue();
    expect(appended.wasReplay).toBeFalse();

    const replay = await adapter.appendAuditEvent(appended.record, {
      operationKey: "op-audit-001-append",
      actorId: "system:orchestrator",
      occurredAt: "2026-04-06T12:00:21.100Z",
      correlationId: "corr-run-001",
    });
    expect(replay.changed).toBeFalse();
    expect(replay.wasReplay).toBeTrue();

    const duplicateByEventId = await adapter.appendAuditEvent(appended.record, {
      operationKey: "op-audit-001-duplicate-event-id",
      actorId: "system:orchestrator",
      occurredAt: "2026-04-06T12:00:21.200Z",
      correlationId: "corr-run-001",
    });
    expect(duplicateByEventId.changed).toBeFalse();
    expect(duplicateByEventId.wasReplay).toBeFalse();

    await adapter.appendAuditEvent({
      eventId: "audit-002",
      eventKind: PlatformAuditEventKinds.storage,
      action: "storage.policy.updated",
      actorId: "user-admin",
      workspaceId: "workspace-alpha",
      userIdentityId: "user-admin",
      targetRef: "storage:alpha",
      outcome: "succeeded",
      occurredAt: "2026-04-06T12:10:00.000Z",
      details: {
        policyId: "policy-alpha",
      },
    }, {
      operationKey: "op-audit-002-append",
      actorId: "user-admin",
      occurredAt: "2026-04-06T12:10:00.000Z",
      correlationId: "corr-storage-002",
    });

    const listed = await adapter.listAuditEvents({
      eventKinds: [PlatformAuditEventKinds.runs],
      workspaceId: "workspace-alpha",
      userIdentityId: "user-owner",
      actorId: "system:orchestrator",
      targetRef: "run:run-001",
      occurredAfter: "2026-04-06T12:00:00.000Z",
      occurredBefore: "2026-04-06T12:01:00.000Z",
      limit: 10,
      offset: 0,
    });

    expect(listed).toHaveLength(1);
    expect(listed[0]?.eventId).toBe("audit-001");
    expect((listed[0]?.details as { runId?: string } | undefined)?.runId).toBe("run-001");

    const ordered = await adapter.listAuditEvents({});
    expect(ordered).toHaveLength(2);
    expect(ordered[0]?.eventId).toBe("audit-002");
    expect(ordered[1]?.eventId).toBe("audit-001");

    adapter.dispose();
  });
});


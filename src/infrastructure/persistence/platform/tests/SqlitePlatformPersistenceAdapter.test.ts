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
    expect(versionRow.version).toBe(6);

    const tables = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN (
          'platform_run_records',
          'platform_audit_events',
          'platform_persistence_mutation_replays',
          'platform_run_orchestration_queue',
          'platform_run_node_placement_holds',
          'platform_run_dispatch_attempts'
        )
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual([
      "platform_audit_events",
      "platform_persistence_mutation_replays",
      "platform_run_dispatch_attempts",
      "platform_run_node_placement_holds",
      "platform_run_orchestration_queue",
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

  it("rolls back run and audit writes when a transaction fails", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-platform-tx-"));
    createdRoots.push(root);
    const adapter = new SqlitePlatformPersistenceAdapter(path.join(root, "platform.sqlite"));

    await expect(adapter.runInTransaction(async () => {
      await adapter.createRun({
        runId: "run-tx-001",
        runKind: "workflow",
        status: "pending",
        workspaceId: "workspace-alpha",
        userIdentityId: "user-owner",
        sourceAggregateRef: "workflow:tx",
        initiatedAt: "2026-04-06T12:30:00.000Z",
        revision: 0,
      }, {
        operationKey: "op-run-tx-001-create",
        actorId: "user-owner",
        occurredAt: "2026-04-06T12:30:00.000Z",
      });

      await adapter.appendAuditEvent({
        eventId: "audit-tx-001",
        eventKind: PlatformAuditEventKinds.runs,
        action: "run.accepted",
        actorId: "user-owner",
        workspaceId: "workspace-alpha",
        userIdentityId: "user-owner",
        targetRef: "run:run-tx-001",
        outcome: "succeeded",
        occurredAt: "2026-04-06T12:30:01.000Z",
      }, {
        operationKey: "op-audit-tx-001",
        actorId: "user-owner",
        occurredAt: "2026-04-06T12:30:01.000Z",
      });

      throw new Error("force rollback");
    })).rejects.toThrow("force rollback");

    const run = await adapter.findRunById("run-tx-001");
    expect(run).toBeUndefined();

    const events = await adapter.listAuditEvents({
      targetRef: "run:run-tx-001",
    });
    expect(events).toHaveLength(0);

    adapter.dispose();
  });

  it("persists queue entries and claims assignment-ready runs in queue order", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-platform-queue-"));
    createdRoots.push(root);
    const adapter = new SqlitePlatformPersistenceAdapter(path.join(root, "platform.sqlite"));

    const queueRunIds = ["run-queue-1", "run-queue-2", "run-queue-3"] as const;
    for (const [index, runId] of queueRunIds.entries()) {
      const submittedAt = `2026-04-06T12:0${index + 1}:00.000Z`;
      await adapter.createRun({
        runId,
        runKind: "workflow",
        status: "pending",
        workspaceId: "workspace-alpha",
        userIdentityId: "user-owner",
        sourceAggregateRef: "workflow:queue",
        initiatedAt: submittedAt,
        metadata: {
          canonicalRun: {
            identity: {
              runId,
              workflowId: "workflow:queue",
              workspaceId: "workspace-alpha",
            },
            submission: {
              source: "api",
              submittedAt,
            },
            state: "queued",
            queue: {
              queueId: "queue:default",
              enteredAt: submittedAt,
              position: null,
              positionAsOf: submittedAt,
            },
            assignment: {
              status: "unassigned",
            },
            execution: {
              outcome: "none",
            },
            retry: {
              attempt: 1,
              maxAttempts: 1,
            },
            updatedAt: submittedAt,
          },
        },
        revision: 0,
      }, {
        operationKey: `op-${runId}-create`,
        actorId: "system:orchestrator",
        occurredAt: submittedAt,
      });
    }

    await adapter.enqueueRunForAssignment({
      runId: "run-queue-1",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      lifecycleState: "queued",
      enteredAt: "2026-04-06T12:01:00.000Z",
      orderKey: "2026-04-06T12:01:00.000Z:run-queue-1",
      eligibilityMarker: "ready",
      eligibleAt: "2026-04-06T12:03:00.000Z",
      updatedAt: "2026-04-06T12:01:00.000Z",
    }, {
      operationKey: "op-run-queue-1-enqueue",
      actorId: "system:orchestrator",
      occurredAt: "2026-04-06T12:01:00.000Z",
    });
    await adapter.enqueueRunForAssignment({
      runId: "run-queue-2",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      lifecycleState: "queued",
      enteredAt: "2026-04-06T12:02:00.000Z",
      orderKey: "2026-04-06T12:02:00.000Z:run-queue-2",
      eligibilityMarker: "ready",
      eligibleAt: "2026-04-06T12:02:00.000Z",
      updatedAt: "2026-04-06T12:02:00.000Z",
    }, {
      operationKey: "op-run-queue-2-enqueue",
      actorId: "system:orchestrator",
      occurredAt: "2026-04-06T12:02:00.000Z",
    });
    await adapter.enqueueRunForAssignment({
      runId: "run-queue-3",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      lifecycleState: "queued",
      enteredAt: "2026-04-06T12:03:00.000Z",
      orderKey: "2026-04-06T12:03:00.000Z:run-queue-3",
      eligibilityMarker: "deferred",
      eligibleAt: "2026-04-06T12:10:00.000Z",
      updatedAt: "2026-04-06T12:03:00.000Z",
    }, {
      operationKey: "op-run-queue-3-enqueue",
      actorId: "system:orchestrator",
      occurredAt: "2026-04-06T12:03:00.000Z",
    });

    const ready = await adapter.listAssignmentReadyRuns({
      asOf: "2026-04-06T12:05:00.000Z",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      limit: 10,
    });
    expect(ready.map((entry) => entry.runId)).toEqual([
      "run-queue-2",
      "run-queue-1",
    ]);

    const claimed = await adapter.claimAssignmentReadyRuns({
      asOf: "2026-04-06T12:05:00.000Z",
      reservationOwner: "orchestrator:alpha",
      reservationTtlSeconds: 60,
      limit: 2,
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
    });
    expect(claimed).toHaveLength(2);
    expect(claimed[0]?.runId).toBe("run-queue-2");
    expect(claimed[0]?.claimToken).toBeDefined();
    expect(claimed[1]?.runId).toBe("run-queue-1");
    expect(claimed[1]?.claimToken).toBeDefined();

    const stillReady = await adapter.listAssignmentReadyRuns({
      asOf: "2026-04-06T12:05:00.000Z",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      limit: 10,
    });
    expect(stillReady).toHaveLength(0);

    const releaseResult = await adapter.releaseRunClaim({
      runId: "run-queue-2",
      claimToken: claimed[0]?.claimToken ?? "missing",
      releasedAt: "2026-04-06T12:05:10.000Z",
    });
    expect(releaseResult).toBeTrue();

    const readyAfterRelease = await adapter.listAssignmentReadyRuns({
      asOf: "2026-04-06T12:05:11.000Z",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      limit: 10,
    });
    expect(readyAfterRelease.map((entry) => entry.runId)).toEqual(["run-queue-2"]);

    adapter.dispose();
  });

  it("defers claimed runs with backoff metadata and reconsiders deferred entries when eligible", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-platform-queue-defer-"));
    createdRoots.push(root);
    const adapter = new SqlitePlatformPersistenceAdapter(path.join(root, "platform.sqlite"));

    await adapter.createRun({
      runId: "run-queue-defer-1",
      runKind: "workflow",
      status: "pending",
      workspaceId: "workspace-alpha",
      userIdentityId: "user-owner",
      sourceAggregateRef: "workflow:queue",
      initiatedAt: "2026-04-06T12:00:00.000Z",
      metadata: {},
      revision: 0,
    }, {
      operationKey: "op-run-queue-defer-1-create",
      actorId: "system:orchestrator",
      occurredAt: "2026-04-06T12:00:00.000Z",
    });

    await adapter.enqueueRunForAssignment({
      runId: "run-queue-defer-1",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      lifecycleState: "queued",
      enteredAt: "2026-04-06T12:00:00.000Z",
      orderKey: "2026-04-06T12:00:00.000Z:run-queue-defer-1",
      eligibilityMarker: "ready",
      eligibleAt: "2026-04-06T12:00:00.000Z",
      updatedAt: "2026-04-06T12:00:00.000Z",
    }, {
      operationKey: "op-run-queue-defer-1-enqueue",
      actorId: "system:orchestrator",
      occurredAt: "2026-04-06T12:00:00.000Z",
    });

    const claimed = await adapter.claimAssignmentReadyRuns({
      asOf: "2026-04-06T12:01:00.000Z",
      reservationOwner: "orchestrator:alpha",
      reservationTtlSeconds: 30,
      limit: 1,
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
    });
    expect(claimed).toHaveLength(1);

    const deferred = await adapter.deferRunClaimForNoPlacement?.({
      runId: "run-queue-defer-1",
      claimToken: claimed[0]?.claimToken ?? "missing",
      deferredAt: "2026-04-06T12:01:00.000Z",
      reasonCategory: "capability-coverage-missing",
      reasonCodes: ["node-missing-capability"],
      reasonMessage: "No node supports required capabilities.",
      decisionId: "decision:no-placement",
      requiresAdministrativeAttention: true,
      initialDelaySeconds: 30,
      maxDelaySeconds: 600,
      multiplier: 2,
    });
    expect(deferred?.record.eligibilityMarker).toBe("deferred");
    expect(deferred?.record.deferCount).toBe(1);
    expect(deferred?.record.lastNoPlacementReasonCodes).toEqual(["node-missing-capability"]);
    expect(deferred?.record.lastNoPlacementRequiresAdministrativeAttention).toBeTrue();

    const beforeEligible = await adapter.listAssignmentReadyRuns({
      asOf: "2026-04-06T12:01:20.000Z",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      limit: 10,
    });
    expect(beforeEligible).toEqual([]);

    const afterEligible = await adapter.listAssignmentReadyRuns({
      asOf: "2026-04-06T12:01:30.000Z",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      limit: 10,
    });
    expect(afterEligible.map((entry) => entry.runId)).toEqual(["run-queue-defer-1"]);

    adapter.dispose();
  });

  it("claims queued runs for node dispatch once and surfaces controlled duplicate conflicts", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-platform-node-claim-"));
    createdRoots.push(root);
    const adapter = new SqlitePlatformPersistenceAdapter(path.join(root, "platform.sqlite"));

    await adapter.createRun({
      runId: "run-dispatch-1",
      runKind: "workflow",
      status: "pending",
      workspaceId: "workspace-alpha",
      userIdentityId: "user-owner",
      sourceAggregateRef: "workflow:dispatch",
      initiatedAt: "2026-04-06T12:00:00.000Z",
      metadata: {
        canonicalRun: {
          identity: {
            runId: "run-dispatch-1",
            workflowId: "workflow:dispatch",
            workspaceId: "workspace-alpha",
          },
          submission: {
            source: "api",
            submittedAt: "2026-04-06T12:00:00.000Z",
          },
          state: "queued",
          queue: {
            queueId: "queue:default",
            enteredAt: "2026-04-06T12:00:00.000Z",
            position: null,
            positionAsOf: "2026-04-06T12:00:00.000Z",
          },
          assignment: {
            status: "unassigned",
          },
          execution: {
            outcome: "none",
          },
          retry: {
            attempt: 1,
            maxAttempts: 1,
          },
          updatedAt: "2026-04-06T12:00:00.000Z",
        },
      },
      revision: 0,
    }, {
      operationKey: "op-run-dispatch-create",
      actorId: "system:orchestrator",
      occurredAt: "2026-04-06T12:00:00.000Z",
    });

    await adapter.enqueueRunForAssignment({
      runId: "run-dispatch-1",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      lifecycleState: "queued",
      enteredAt: "2026-04-06T12:00:00.000Z",
      orderKey: "2026-04-06T12:00:00.000Z:run-dispatch-1",
      eligibilityMarker: "ready",
      eligibleAt: "2026-04-06T12:00:00.000Z",
      updatedAt: "2026-04-06T12:00:00.000Z",
    }, {
      operationKey: "op-run-dispatch-enqueue",
      actorId: "system:orchestrator",
      occurredAt: "2026-04-06T12:00:00.000Z",
    });

    const reservation = await adapter.claimAssignmentReadyRuns({
      asOf: "2026-04-06T12:01:00.000Z",
      reservationOwner: "orchestrator:alpha",
      reservationTtlSeconds: 300,
      limit: 1,
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
    });
    const claimToken = reservation[0]?.claimToken;
    expect(claimToken).toBeDefined();

    const [claimA, claimB] = await Promise.all([
      adapter.claimQueuedRunForNodeDispatch({
        runId: "run-dispatch-1",
        nodeId: "node:trusted-alpha",
        reservationOwner: "orchestrator:alpha",
        claimToken: claimToken!,
        dispatchAttemptId: "dispatch-attempt:1",
        preparedAt: "2026-04-06T12:02:00.000Z",
        dispatchMetadata: Object.freeze({
          runId: "run-dispatch-1",
        }),
      }),
      adapter.claimQueuedRunForNodeDispatch({
        runId: "run-dispatch-1",
        nodeId: "node:trusted-beta",
        reservationOwner: "orchestrator:alpha",
        claimToken: claimToken!,
        dispatchAttemptId: "dispatch-attempt:2",
        preparedAt: "2026-04-06T12:02:00.000Z",
        dispatchMetadata: Object.freeze({
          runId: "run-dispatch-1",
        }),
      }),
    ]);

    const outcomes = [claimA, claimB].map((entry) => entry.outcome).sort();
    expect(outcomes).toEqual(["claimed", "conflict"]);
    const claimed = [claimA, claimB].find((entry) => entry.outcome === "claimed");
    const conflicted = [claimA, claimB].find((entry) => entry.outcome === "conflict");
    expect(claimed).toBeDefined();
    expect(conflicted).toBeDefined();
    if (claimed && claimed.outcome === "claimed") {
      expect(claimed.queueEntry.assignmentNodeId).toBeDefined();
      expect(claimed.queueEntry.dispatchPreparedAt).toBe("2026-04-06T12:02:00.000Z");
    }
    if (conflicted && conflicted.outcome === "conflict") {
      expect(conflicted.conflict.reason).toBe("already-assigned");
    }

    const attempts = await adapter.listDispatchAttemptsByRunId("run-dispatch-1");
    expect(attempts).toHaveLength(1);
    expect(["dispatch-attempt:1", "dispatch-attempt:2"]).toContain(attempts[0]?.attemptId);
    expect(attempts[0]?.dispatchResult).toBeUndefined();

    const updated = await adapter.recordDispatchAttemptResult({
      runId: "run-dispatch-1",
      attemptId: attempts[0]!.attemptId,
      result: Object.freeze({
        status: "accepted",
        recordedAt: "2026-04-06T12:02:01.000Z",
        acceptedAt: "2026-04-06T12:02:01.000Z",
        dispatchId: "dispatch:run-dispatch-1",
        backendKind: "remote-dispatch",
        backendRunId: "backend-run-1",
        metadata: Object.freeze({
          lane: "standard",
        }),
      }),
    });
    expect(updated).toBeTrue();

    const updatedAttempts = await adapter.listDispatchAttemptsByRunId("run-dispatch-1");
    expect(updatedAttempts[0]?.dispatchResult?.status).toBe("accepted");
    expect(updatedAttempts[0]?.dispatchResult?.dispatchId).toBe("dispatch:run-dispatch-1");
    expect((updatedAttempts[0]?.dispatchResult?.metadata as { lane?: string } | undefined)?.lane).toBe("standard");

    const finalized = await adapter.finalizeRunQueueEntry({
      runId: "run-dispatch-1",
      finalizedAt: "2026-04-06T12:05:00.000Z",
      lifecycleState: "completed",
    });
    expect(finalized).toBeTrue();

    const queueAfterFinalization = await adapter.getQueueEntryByRunId("run-dispatch-1");
    expect(queueAfterFinalization?.lifecycleState).toBe("completed");
    expect(queueAfterFinalization?.claimToken).toBeUndefined();

    adapter.dispose();
  });

  it("supports guarded recovery requeue for stale assigned queue entries", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-platform-recovery-requeue-"));
    createdRoots.push(root);
    const adapter = new SqlitePlatformPersistenceAdapter(path.join(root, "platform.sqlite"));

    await adapter.createRun({
      runId: "run-recovery-1",
      runKind: "workflow",
      status: "pending",
      workspaceId: "workspace-alpha",
      userIdentityId: "user-owner",
      sourceAggregateRef: "workflow:recovery",
      initiatedAt: "2026-04-06T12:00:00.000Z",
      metadata: {
        canonicalRun: {
          identity: {
            runId: "run-recovery-1",
            workflowId: "workflow:recovery",
            workspaceId: "workspace-alpha",
          },
          submission: {
            source: "api",
            submittedAt: "2026-04-06T12:00:00.000Z",
          },
          state: "assigned",
          queue: {
            queueId: "queue:default",
            enteredAt: "2026-04-06T12:00:00.000Z",
            position: null,
            positionAsOf: "2026-04-06T12:05:00.000Z",
            dequeuedAt: "2026-04-06T12:05:00.000Z",
          },
          assignment: {
            status: "assigned",
            assignedNodeId: "node:trusted-a",
            assignedAt: "2026-04-06T12:05:00.000Z",
          },
          execution: {
            outcome: "none",
          },
          retry: {
            attempt: 1,
            maxAttempts: 1,
          },
          updatedAt: "2026-04-06T12:05:00.000Z",
        },
      },
      revision: 0,
    }, {
      operationKey: "op-run-recovery-create",
      actorId: "system:orchestrator",
      occurredAt: "2026-04-06T12:00:00.000Z",
    });

    await adapter.enqueueRunForAssignment({
      runId: "run-recovery-1",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      lifecycleState: "queued",
      enteredAt: "2026-04-06T12:00:00.000Z",
      orderKey: "2026-04-06T12:00:00.000Z:run-recovery-1",
      eligibilityMarker: "ready",
      eligibleAt: "2026-04-06T12:00:00.000Z",
      updatedAt: "2026-04-06T12:00:00.000Z",
    }, {
      operationKey: "op-run-recovery-enqueue",
      actorId: "system:orchestrator",
      occurredAt: "2026-04-06T12:00:00.000Z",
    });

    const reservation = await adapter.claimAssignmentReadyRuns({
      asOf: "2026-04-06T12:01:00.000Z",
      reservationOwner: "orchestrator:alpha",
      reservationTtlSeconds: 600,
      limit: 1,
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
    });
    const claimToken = reservation[0]?.claimToken;
    expect(claimToken).toBeDefined();

    const claimed = await adapter.claimQueuedRunForNodeDispatch({
      runId: "run-recovery-1",
      nodeId: "node:trusted-a",
      reservationOwner: "orchestrator:alpha",
      claimToken: claimToken!,
      dispatchAttemptId: "dispatch-attempt:recovery-1",
      preparedAt: "2026-04-06T12:05:00.000Z",
      dispatchMetadata: Object.freeze({
        runId: "run-recovery-1",
      }),
    });
    expect(claimed.outcome).toBe("claimed");

    const requeued = await adapter.requeueAssignedRunForRecovery?.({
      runId: "run-recovery-1",
      requeuedAt: "2026-04-06T12:10:00.000Z",
      eligibilityMarker: "ready",
    });
    expect(requeued).toBeTrue();

    const queueEntry = await adapter.getQueueEntryByRunId("run-recovery-1");
    expect(queueEntry?.lifecycleState).toBe("queued");
    expect(queueEntry?.assignmentNodeId).toBeUndefined();
    expect(queueEntry?.dequeuedAt).toBeUndefined();
    expect(queueEntry?.claimToken).toBeUndefined();
    expect(queueEntry?.lastDispatchAttemptId).toBeUndefined();

    adapter.dispose();
  });

  it("supports node placement hold conflict and expiry lifecycle semantics", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-platform-node-holds-"));
    createdRoots.push(root);
    const adapter = new SqlitePlatformPersistenceAdapter(path.join(root, "platform.sqlite"));

    await adapter.createRun({
      runId: "run-hold-1",
      runKind: "workflow",
      status: "pending",
      workspaceId: "workspace-alpha",
      userIdentityId: "user-owner",
      sourceAggregateRef: "workflow:hold",
      initiatedAt: "2026-04-06T12:00:00.000Z",
      revision: 0,
    }, {
      operationKey: "op-run-hold-1-create",
      actorId: "system:orchestrator",
      occurredAt: "2026-04-06T12:00:00.000Z",
    });
    await adapter.createRun({
      runId: "run-hold-2",
      runKind: "workflow",
      status: "pending",
      workspaceId: "workspace-alpha",
      userIdentityId: "user-owner",
      sourceAggregateRef: "workflow:hold",
      initiatedAt: "2026-04-06T12:01:00.000Z",
      revision: 0,
    }, {
      operationKey: "op-run-hold-2-create",
      actorId: "system:orchestrator",
      occurredAt: "2026-04-06T12:01:00.000Z",
    });

    const holdA = await adapter.acquireNodePlacementHold({
      holdToken: "node-hold:1",
      runId: "run-hold-1",
      queueId: "queue:default",
      nodeId: "node:trusted-1",
      reservationOwner: "scheduler:alpha",
      claimToken: "claim:1",
      decisionId: "decision:1",
      heldAt: "2026-04-06T12:05:00.000Z",
      expiresAt: "2026-04-06T12:05:20.000Z",
    });
    expect(holdA.outcome).toBe("acquired");

    const conflict = await adapter.acquireNodePlacementHold({
      holdToken: "node-hold:2",
      runId: "run-hold-2",
      queueId: "queue:default",
      nodeId: "node:trusted-1",
      reservationOwner: "scheduler:beta",
      claimToken: "claim:2",
      decisionId: "decision:2",
      heldAt: "2026-04-06T12:05:10.000Z",
      expiresAt: "2026-04-06T12:05:40.000Z",
    });
    expect(conflict.outcome).toBe("conflict");
    if (conflict.outcome === "conflict") {
      expect(conflict.conflict.reason).toBe("held-by-another-owner");
      expect(conflict.conflict.currentHold.holdToken).toBe("node-hold:1");
    }

    const releaseWrongToken = await adapter.releaseNodePlacementHold({
      nodeId: "node:trusted-1",
      holdToken: "node-hold:missing",
      releasedAt: "2026-04-06T12:05:11.000Z",
    });
    expect(releaseWrongToken).toBeFalse();

    const holdAfterExpiry = await adapter.acquireNodePlacementHold({
      holdToken: "node-hold:3",
      runId: "run-hold-2",
      queueId: "queue:default",
      nodeId: "node:trusted-1",
      reservationOwner: "scheduler:beta",
      claimToken: "claim:2",
      decisionId: "decision:2",
      heldAt: "2026-04-06T12:05:21.000Z",
      expiresAt: "2026-04-06T12:05:41.000Z",
    });
    expect(holdAfterExpiry.outcome).toBe("acquired");
    if (holdAfterExpiry.outcome === "acquired") {
      expect(holdAfterExpiry.hold.holdToken).toBe("node-hold:3");
      expect(holdAfterExpiry.hold.runId).toBe("run-hold-2");
    }

    const released = await adapter.releaseNodePlacementHold({
      nodeId: "node:trusted-1",
      holdToken: "node-hold:3",
      releasedAt: "2026-04-06T12:05:22.000Z",
    });
    expect(released).toBeTrue();

    const reacquired = await adapter.acquireNodePlacementHold({
      holdToken: "node-hold:4",
      runId: "run-hold-1",
      queueId: "queue:default",
      nodeId: "node:trusted-1",
      reservationOwner: "scheduler:alpha",
      claimToken: "claim:4",
      heldAt: "2026-04-06T12:05:23.000Z",
      expiresAt: "2026-04-06T12:05:43.000Z",
    });
    expect(reacquired.outcome).toBe("acquired");

    adapter.dispose();
  });
});


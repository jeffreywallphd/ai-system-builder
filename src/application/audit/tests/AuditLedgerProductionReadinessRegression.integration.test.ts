import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { AuthoritativeAuditRecordingService } from "../use-cases/AuthoritativeAuditRecordingService";
import { RuntimeBackendAuditGovernanceRealtimePublisher } from "@infrastructure/audit/RuntimeBackendAuditGovernanceRealtimePublisher";
import { SqliteAuditLedgerRepository } from "../../../infrastructure/persistence/audit/SqliteAuditLedgerRepository";
import { AuthoritativeStorageManagementAuditSink } from "@infrastructure/audit/AuthoritativeStorageManagementAuditSink";
import { AuthoritativeRunSubmissionAuditSink } from "@infrastructure/audit/AuthoritativeRunSubmissionAuditSink";
import { WorkspaceAuditLedgerReadAuthorizer } from "../use-cases/WorkspaceAuditLedgerReadAuthorizer";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type { WorkspaceAuthorizationSnapshot, WorkspaceAuthorizationSnapshotQuery } from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";
import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
import { AuditLedgerQueryService } from "../use-cases/AuditLedgerQueryService";
import { AuditLedgerBackendApi } from "@infrastructure/api/audit/AuditLedgerBackendApi";
import {
  RuntimeRealtimeTopics,
  RuntimeRealtimeEventCategories,
  RuntimeRealtimeAuditGovernanceEventKinds,
  RuntimeRealtimeSubscriptionModes,
  type RuntimeRealtimeEventEnvelope,
} from "@shared/contracts/runtime/SystemRuntimeRealtimeEventContracts";
import { AuthoritativeRuntimeEventStream } from "@infrastructure/api/system-runtime/AuthoritativeRuntimeEventStream";
import { parseRuntimeRealtimeEventEnvelope } from "@shared/schemas/runtime/SystemRuntimeRealtimeEventSchemaContracts";
import { openSqliteCompatDatabase } from "../../../infrastructure/persistence/sqlite/SqliteCompat";
import { ReconcileAuditLedgerStartupStateUseCase } from "../use-cases/ReconcileAuditLedgerStartupStateUseCase";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

class InMemoryWorkspaceAuthorizationReadRepository implements IWorkspaceAuthorizationReadRepository {
  public constructor(private readonly snapshots: Readonly<Record<string, WorkspaceAuthorizationSnapshot>>) {}

  public async getWorkspaceAuthorizationSnapshot(
    query: WorkspaceAuthorizationSnapshotQuery,
  ): Promise<WorkspaceAuthorizationSnapshot | undefined> {
    const key = `${query.workspaceId}:${query.userIdentityId}`;
    return this.snapshots[key];
  }
}

function createAuthorizationSnapshot(input: {
  readonly workspaceId: string;
  readonly requesterId: string;
  readonly isAdmin: boolean;
}): WorkspaceAuthorizationSnapshot {
  const now = "2026-04-07T20:00:00.000Z";
  return Object.freeze({
    workspace: Object.freeze({
      id: input.workspaceId,
      slug: input.workspaceId.replace(/:/g, "-"),
      displayName: input.workspaceId,
      status: "active",
      encryptionPolicy: Object.freeze({
        encryptionMode: "platform-managed",
        contentEncryptionRequired: true,
        keyScope: "workspace",
        allowPreviewDecryption: false,
        allowWorkerDecryption: false,
      }),
      ownership: Object.freeze({
        workspaceId: input.workspaceId,
        ownerUserId: "user:owner",
        visibility: "private",
        createdBy: "user:owner",
        createdAt: now,
        lastModifiedBy: "user:owner",
        lastModifiedAt: now,
      }),
    }),
    membership: Object.freeze({
      id: `membership:${input.workspaceId}:${input.requesterId}`,
      workspaceId: input.workspaceId,
      userIdentityId: input.requesterId,
      status: WorkspaceMembershipStatuses.active,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: "user:owner",
      lastModifiedBy: "user:owner",
    }),
    activeRoleAssignments: input.isAdmin
      ? Object.freeze([Object.freeze({
        id: `role:${input.workspaceId}:${input.requesterId}:admin`,
        workspaceId: input.workspaceId,
        userIdentityId: input.requesterId,
        role: WorkspaceRoles.admin,
        status: "active",
        assignedAt: now,
        assignedBy: "user:owner",
      })])
      : Object.freeze([Object.freeze({
        id: `role:${input.workspaceId}:${input.requesterId}:member`,
        workspaceId: input.workspaceId,
        userIdentityId: input.requesterId,
        role: WorkspaceRoles.member,
        status: "active",
        assignedAt: now,
        assignedBy: "user:owner",
      })]),
    effectiveRoles: input.isAdmin
      ? Object.freeze([WorkspaceRoles.admin])
      : Object.freeze([WorkspaceRoles.member]),
    isWorkspaceOwner: false,
  });
}

function createWorkspaceAuditBackendApi(repository: SqliteAuditLedgerRepository): AuditLedgerBackendApi {
  const authorizationRepository = new InMemoryWorkspaceAuthorizationReadRepository({
    "workspace:alpha:user:admin": createAuthorizationSnapshot({
      workspaceId: "workspace:alpha",
      requesterId: "user:admin",
      isAdmin: true,
    }),
    "workspace:alpha:user:member": createAuthorizationSnapshot({
      workspaceId: "workspace:alpha",
      requesterId: "user:member",
      isAdmin: false,
    }),
  });

  const queryService = new AuditLedgerQueryService({
    repository,
    authorizer: new WorkspaceAuditLedgerReadAuthorizer({
      workspaceAuthorizationReadRepository: authorizationRepository,
      clock: {
        now: () => new Date("2026-04-07T20:01:00.000Z"),
      },
    }),
  });

  return new AuditLedgerBackendApi({
    auditLedgerQueryService: queryService,
  });
}

describe("Audit ledger production-readiness regression", () => {
  it("covers authoritative capture, append replay invariants, permission-safe retrieval, redaction, and realtime contract stability", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-audit-ledger-regression-"));
    createdRoots.push(root);

    const repository = new SqliteAuditLedgerRepository(path.join(root, "audit.sqlite"));
    const runtimeStream = new AuthoritativeRuntimeEventStream();
    const deliveredRealtimeEvents: RuntimeRealtimeEventEnvelope[] = [];
    const subscription = runtimeStream.subscribe({
      request: Object.freeze({
        actor: Object.freeze({
          actorUserIdentityId: "user:admin",
          accessChannel: "desktop",
          workspaceId: "workspace:alpha",
        }),
        topics: Object.freeze([Object.freeze({
          topic: RuntimeRealtimeTopics.auditGovernance,
          workspaceId: "workspace:alpha",
        })]),
        mode: RuntimeRealtimeSubscriptionModes.liveOnly,
      }),
      listener: (event) => {
        deliveredRealtimeEvents.push(event);
      },
    });

    const publicationBackend = {
      publishRuntimeAuditGovernance: (input: {
        readonly actorUserIdentityId?: string;
        readonly workspaceId?: string;
        readonly payload: unknown;
      }) => runtimeStream.publishAuditGovernanceEvent(input),
    };

    const recorder = new AuthoritativeAuditRecordingService({
      repository,
      publicationPort: new RuntimeBackendAuditGovernanceRealtimePublisher(publicationBackend as never),
      now: () => new Date("2026-04-07T20:00:00.000Z"),
      idGenerator: (() => {
        let sequence = 0;
        return () => {
          sequence += 1;
          return `regression-${sequence}`;
        };
      })(),
    });

    const storageAuditSink = new AuthoritativeStorageManagementAuditSink(recorder);
    await storageAuditSink.recordStorageManagementEvent({
      type: "storage-policy-updated",
      actorUserIdentityId: "user:admin",
      workspaceId: "workspace:alpha",
      storageInstanceId: "storage:alpha",
      occurredAt: "2026-04-07T20:00:01.000Z",
      correlationId: "corr:audit-ledger:storage-policy",
      outcome: "success",
      details: Object.freeze({
        policyId: "retention-policy:workspace-default",
        keyReferenceId: "kms://workspace-alpha/keys/one",
      }),
    });

    await storageAuditSink.recordStorageManagementEvent({
      type: "storage-policy-updated",
      actorUserIdentityId: "user:admin",
      workspaceId: "workspace:alpha",
      storageInstanceId: "storage:alpha",
      occurredAt: "2026-04-07T20:00:01.000Z",
      correlationId: "corr:audit-ledger:storage-policy",
      outcome: "success",
      details: Object.freeze({
        policyId: "retention-policy:workspace-default",
        keyReferenceId: "kms://workspace-alpha/keys/one",
      }),
    });

    const runAuditSink = new AuthoritativeRunSubmissionAuditSink(recorder);
    await runAuditSink.recordRunSubmissionEvent(Object.freeze({
      type: "run-submission-accepted",
      occurredAt: "2026-04-07T20:00:02.000Z",
      workspaceId: "workspace:alpha",
      runId: "run:alpha",
      actorUserIdentityId: "user:member",
      correlationId: "corr:audit-ledger:run",
      details: Object.freeze({
        requestKind: "api",
      }),
    }));

    const allEvents = await repository.listAuditEvents({
      workspaceId: "workspace:alpha",
      sorting: {
        sortBy: "occurredAt",
        sortDirection: "asc",
      },
    });
    expect(allEvents).toHaveLength(2);
    expect(allEvents[0]?.action).toBe("policy.storage.updated");
    expect(allEvents[1]?.action).toBe("run.submission.accepted");

    const byCorrelation = await repository.listAuditEvents({
      workspaceId: "workspace:alpha",
      filters: {
        correlationIds: ["corr:audit-ledger:storage-policy"],
      },
    });
    expect(byCorrelation).toHaveLength(1);
    expect(byCorrelation[0]?.eventType).toBe("storage-policy-updated");

    const api = createWorkspaceAuditBackendApi(repository);

    const adminDetail = await api.getAuditEventDetail({
      actorUserIdentityId: "user:admin",
      workspaceId: "workspace:alpha",
      eventId: allEvents[0]!.eventId,
    });
    expect(adminDetail.ok).toBeTrue();
    expect(adminDetail.data?.event.visibility).toBe("admin");
    expect(adminDetail.data?.event.adminOnlyDetails).toBeDefined();

    const memberProtectedDetail = await api.getAuditEventDetail({
      actorUserIdentityId: "user:member",
      workspaceId: "workspace:alpha",
      eventId: allEvents[0]!.eventId,
    });
    expect(memberProtectedDetail.ok).toBeFalse();
    expect(memberProtectedDetail.error?.code).toBe("not-found");

    const memberList = await api.listAuditEvents({
      actorUserIdentityId: "user:member",
      workspaceId: "workspace:alpha",
      query: {
        pagination: {
          limit: 20,
          offset: 0,
        },
      },
    });
    expect(memberList.ok).toBeTrue();
    expect(memberList.data?.events).toHaveLength(1);
    expect(memberList.data?.events[0]?.action).toBe("run.submission.accepted");

    expect(deliveredRealtimeEvents).toHaveLength(2);
    const parsedRealtimeEnvelope = parseRuntimeRealtimeEventEnvelope(JSON.parse(JSON.stringify(deliveredRealtimeEvents[0])));
    const parsedPayload = parsedRealtimeEnvelope.payload as Record<string, unknown>;
    expect(parsedRealtimeEnvelope.topic).toBe(RuntimeRealtimeTopics.auditGovernance);
    expect(parsedRealtimeEnvelope.category).toBe(RuntimeRealtimeEventCategories.auditGovernance);
    expect(parsedPayload.eventKind).toBe(RuntimeRealtimeAuditGovernanceEventKinds.policyActionRecorded);
    expect(parsedPayload.action).toBe("policy.storage.updated");
    expect((parsedPayload.details as Record<string, unknown> | undefined)?.keyReferenceId).toBe("[REDACTED]");

    const replayPublishedPolicyEvents = deliveredRealtimeEvents.filter((event) => (
      (event.payload as Record<string, unknown>).action === "policy.storage.updated"
    ));
    expect(replayPublishedPolicyEvents).toHaveLength(1);

    subscription.unsubscribe();
    repository.dispose();
  });

  it("maintains append-only immutability guards and reports startup reconciliation follow-up for orphaned replay anomalies", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-audit-ledger-reconcile-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "audit.sqlite");
    const repository = new SqliteAuditLedgerRepository(databasePath);

    const recorder = new AuthoritativeAuditRecordingService({
      repository,
      now: () => new Date("2026-04-07T21:00:00.000Z"),
      idGenerator: () => "immutability-1",
    });
    const runAuditSink = new AuthoritativeRunSubmissionAuditSink(recorder);

    await runAuditSink.recordRunSubmissionEvent(Object.freeze({
      type: "run-submission-accepted",
      occurredAt: "2026-04-07T21:00:00.000Z",
      workspaceId: "workspace:alpha",
      runId: "run:immutable",
      actorUserIdentityId: "user:admin",
      details: Object.freeze({
        requestKind: "api",
      }),
    }));

    const inserted = await repository.listAuditEvents({
      workspaceId: "workspace:alpha",
      limit: 5,
    });
    expect(inserted).toHaveLength(1);

    const database = openSqliteCompatDatabase(databasePath);
    expect(() => database.prepare(`
      UPDATE authoritative_audit_ledger_events
      SET outcome = 'failed'
      WHERE event_id = ?
    `).run(inserted[0]!.eventId)).toThrow("append-only");
    database.close();

    repository.dispose();

    const tampered = openSqliteCompatDatabase(databasePath);
    tampered.pragma("foreign_keys = OFF");
    tampered.prepare(`
      INSERT INTO authoritative_audit_ledger_mutation_replays (
        operation_key,
        event_id,
        sequence,
        actor_id,
        correlation_id,
        occurred_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "audit:orphaned:replay:1",
      "audit:event:missing",
      999,
      "user:tampered",
      null,
      "2026-04-07T21:05:00.000Z",
      "2026-04-07T21:05:00.000Z",
    );
    tampered.close();

    const reopened = new SqliteAuditLedgerRepository(databasePath);
    const reconcile = new ReconcileAuditLedgerStartupStateUseCase({
      repository: reopened,
      now: () => new Date("2026-04-07T21:06:00.000Z"),
    });

    const reconciliation = await reconcile.execute({
      asOf: "2026-04-07T21:06:00.000Z",
      limit: 20,
    });

    expect(reconciliation.supported).toBeTrue();
    expect(reconciliation.repairedCount).toBe(0);
    expect(reconciliation.manualFollowUpCount).toBe(1);
    expect(reconciliation.issueCount).toBe(1);

    reopened.dispose();
  });
});

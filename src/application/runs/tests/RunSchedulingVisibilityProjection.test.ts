import { describe, expect, it } from "bun:test";
import {
  type PlatformRunRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import { buildRunQueueSchedulingAdminSummary, buildRunSchedulingVisibilityProjection, stripRunSchedulingAdminDiagnostics } from "@application/runs/use-cases/RunSchedulingVisibilityProjection";
import { RunLifecycleStates, RunSubmissionSources, createCanonicalRunRecord } from "@domain/runs/RunDomain";
import { mapLifecycleStateToPlatformRunStatus, type RunAuthoritativeMetadata } from "@application/runs/use-cases/RunCreationPersistenceMapper";
import type { AuthoritativeRunQueueEntryRecord } from "@application/runs/ports/RunOrchestrationPersistencePorts";

function createRunRecord(): PlatformRunRecord {
  const canonicalRun = createCanonicalRunRecord({
    identity: {
      runId: "run:1",
      workflowId: "workflow:1",
      workspaceId: "workspace-alpha",
    },
    submission: {
      source: RunSubmissionSources.api,
      submittedAt: "2026-04-07T09:00:00.000Z",
      submittedByActorId: "user-owner",
    },
    state: RunLifecycleStates.queued,
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
    updatedAt: "2026-04-07T09:05:00.000Z",
  });

  const metadata: RunAuthoritativeMetadata = Object.freeze({
    schemaVersion: 1,
    canonicalRun,
    submissionSnapshot: Object.freeze({
      actor: Object.freeze({
        actorUserIdentityId: "user-owner",
        activeWorkspaceId: "workspace-alpha",
      }),
      runtimeTarget: Object.freeze({
        systemId: "system:demo",
        versionId: "system:demo:v1",
        async: true,
      }),
      tags: Object.freeze([]),
      parameters: Object.freeze({}),
      storageReferences: Object.freeze([]),
      resourceReferences: Object.freeze([]),
      policyPrerequisites: Object.freeze([]),
    }),
    visibility: Object.freeze({
      workspaceScope: "workspace",
      sharingPosture: "workspace-members",
    }),
    orchestration: Object.freeze({
      initialLifecycleState: RunLifecycleStates.queued,
      initialQueueState: "queued",
      intent: Object.freeze({
        kind: "queue-admission-requested",
        queueId: "queue:default",
        recordedAt: "2026-04-07T09:00:00.000Z",
      }),
    }),
  });

  return Object.freeze({
    runId: "run:1",
    runKind: "workflow",
    status: mapLifecycleStateToPlatformRunStatus(RunLifecycleStates.queued),
    workspaceId: "workspace-alpha",
    userIdentityId: "user-owner",
    sourceAggregateRef: "workflow:1",
    initiatedAt: "2026-04-07T09:00:00.000Z",
    metadata,
    revision: 1,
  });
}

describe("RunSchedulingVisibilityProjection", () => {
  it("builds scheduling projection from queue and scheduling audit signals", () => {
    const queueEntry: AuthoritativeRunQueueEntryRecord = Object.freeze({
      runId: "run:1",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      lifecycleState: RunLifecycleStates.queued,
      enteredAt: "2026-04-07T09:00:00.000Z",
      orderKey: "001",
      eligibilityMarker: "deferred",
      eligibleAt: "2026-04-07T09:10:00.000Z",
      updatedAt: "2026-04-07T09:05:00.000Z",
      revision: 2,
      deferCount: 2,
      lastNoPlacementCategory: "capability-coverage-missing",
      lastNoPlacementReasonCodes: Object.freeze(["node-missing-capability"]),
      lastNoPlacementReasonMessage: "No eligible node satisfies required capabilities.",
      lastNoPlacementDecisionId: "decision:1",
      lastNoPlacementRecordedAt: "2026-04-07T09:05:00.000Z",
      lastNoPlacementRequiresAdministrativeAttention: true,
    });

    const projection = buildRunSchedulingVisibilityProjection({
      runRecord: createRunRecord(),
      queueEntry,
      auditEvents: Object.freeze([Object.freeze({
        eventId: "audit:1",
        eventKind: "runs",
        action: "run.scheduling.priority-placement.selected",
        actorId: "scheduler:1",
        targetRef: "run:run:1",
        outcome: "succeeded",
        occurredAt: "2026-04-07T09:02:00.000Z",
        details: Object.freeze({
          rolePriorityScore: 4,
          queueAgeSeconds: 120,
          reasonCodes: Object.freeze(["role-priority-preempted"]),
        }),
      })]),
    });

    expect(projection.effectivePriority?.priorityBand).toBe("critical");
    expect(projection.candidateConstraints?.requiredCapabilities).toContain("executor");
    expect(projection.defer?.deferCount).toBe(2);
    expect(projection.placement.outcome).toBe("deferred");
    expect(projection.admin?.requiresAdministrativeAttention).toBeTrue();

    const redacted = stripRunSchedulingAdminDiagnostics(projection);
    expect(redacted?.admin).toBeUndefined();
  });

  it("builds queue-level admin summary from projected scheduling diagnostics", () => {
    const summary = buildRunQueueSchedulingAdminSummary({
      asOf: "2026-04-07T10:00:00.000Z",
      items: Object.freeze([Object.freeze({
        scheduling: Object.freeze({
          placement: Object.freeze({
            outcome: "deferred",
            reasonCodes: Object.freeze([]),
          }),
          admin: Object.freeze({
            requiresAdministrativeAttention: true,
            reasonCodes: Object.freeze(["node-missing-capability", "node-missing-capability"]),
            decisionReasonCodes: Object.freeze(["no-eligible-candidates"]),
            exclusionReasonCodes: Object.freeze(["node-missing-capability"]),
          }),
        }),
      })]),
    });

    expect(summary.totalRuns).toBe(1);
    expect(summary.deferredRuns).toBe(1);
    expect(summary.requiresAdministrativeAttentionRuns).toBe(1);
    expect(summary.reasonCodes[0]?.code).toBe("node-missing-capability");
  });
});

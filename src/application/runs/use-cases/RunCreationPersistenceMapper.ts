import {
  createCanonicalRunRecord,
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  type CanonicalRunRecord,
  type RunLifecycleState,
} from "@domain/runs/RunDomain";
import {
  PlatformRunKinds,
  PlatformRunStatuses,
  type PlatformRunKind,
  type PlatformRunRecord,
  type PlatformRunStatus,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type { CanonicalRunSubmissionCommand } from "./RunSubmissionValidationContracts";

export const RunAuthoritativeMetadataSchemaVersion = 1;

export interface RunAuthoritativeMetadata {
  readonly schemaVersion: number;
  readonly canonicalRun: CanonicalRunRecord;
  readonly submissionSnapshot: {
    readonly actor: CanonicalRunSubmissionCommand["actor"];
    readonly runtimeTarget: CanonicalRunSubmissionCommand["runtimeTarget"];
    readonly tags: CanonicalRunSubmissionCommand["tags"];
    readonly parameters: CanonicalRunSubmissionCommand["parameters"];
    readonly metadata?: CanonicalRunSubmissionCommand["metadata"];
    readonly storageReferences: CanonicalRunSubmissionCommand["storageReferences"];
    readonly resourceReferences: CanonicalRunSubmissionCommand["resourceReferences"];
    readonly policyPrerequisites: CanonicalRunSubmissionCommand["policyPrerequisites"];
  };
  readonly visibility: {
    readonly workspaceScope: "workspace";
    readonly sharingPosture: "workspace-members";
  };
  readonly orchestration: {
    readonly initialLifecycleState: RunLifecycleState;
    readonly initialQueueState: "queued";
    readonly intent: {
      readonly kind: "queue-admission-requested";
      readonly queueId: string;
      readonly recordedAt: string;
    };
  };
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function resolveWorkflowIdentity(command: CanonicalRunSubmissionCommand): string {
  if (command.workflowId) {
    return command.workflowId;
  }
  if (command.templateId) {
    return `template:${command.templateId}`;
  }
  return `system:${command.runtimeTarget.systemId}:${command.runtimeTarget.versionId}`;
}

export function resolveRunKind(command: CanonicalRunSubmissionCommand): PlatformRunKind {
  if (command.workflowId || command.templateId) {
    return PlatformRunKinds.workflow;
  }
  return PlatformRunKinds.system;
}

export function resolveRunSourceAggregateRef(command: CanonicalRunSubmissionCommand): string {
  if (command.workflowId) {
    return `workflow:${command.workflowId}`;
  }
  if (command.templateId) {
    return `template:${command.templateId}`;
  }
  return `runtime:${command.runtimeTarget.systemId}:${command.runtimeTarget.versionId}`;
}

export function mapLifecycleStateToPlatformRunStatus(state: RunLifecycleState): PlatformRunStatus {
  switch (state) {
    case RunLifecycleStates.running:
    case RunLifecycleStates.cancelling:
      return PlatformRunStatuses.running;
    case RunLifecycleStates.completed:
      return PlatformRunStatuses.completed;
    case RunLifecycleStates.failed:
      return PlatformRunStatuses.failed;
    case RunLifecycleStates.cancelled:
      return PlatformRunStatuses.cancelled;
    default:
      return PlatformRunStatuses.pending;
  }
}

export function mapPlatformRunStatusToLifecycleState(status: PlatformRunStatus): RunLifecycleState {
  switch (status) {
    case PlatformRunStatuses.running:
      return RunLifecycleStates.running;
    case PlatformRunStatuses.completed:
      return RunLifecycleStates.completed;
    case PlatformRunStatuses.failed:
      return RunLifecycleStates.failed;
    case PlatformRunStatuses.cancelled:
      return RunLifecycleStates.cancelled;
    case PlatformRunStatuses.blocked:
    case PlatformRunStatuses.pending:
    default:
      return RunLifecycleStates.submitted;
  }
}

export function createInitialCanonicalRunRecord(
  command: CanonicalRunSubmissionCommand,
  runId: string,
): CanonicalRunRecord {
  return createCanonicalRunRecord({
    identity: {
      runId,
      workflowId: resolveWorkflowIdentity(command),
      workspaceId: command.workspaceId,
    },
    submission: {
      source: command.source,
      submittedAt: command.occurredAt,
      submittedByActorId: normalizeOptional(command.submissionContext.submittedByActorId)
        ?? normalizeOptional(command.actor.actorUserIdentityId)
        ?? normalizeOptional(command.actor.actorServiceId),
      clientRequestId: normalizeOptional(command.submissionContext.clientRequestId),
      correlationId: normalizeOptional(command.submissionContext.correlationId),
    },
    state: RunLifecycleStates.submitted,
    assignment: {
      status: "unassigned",
    },
    execution: {
      outcome: RunExecutionOutcomeKinds.none,
    },
    retry: {
      attempt: 1,
      maxAttempts: 1,
    },
    updatedAt: command.occurredAt,
  });
}

export function createRunAuthoritativeMetadata(
  command: CanonicalRunSubmissionCommand,
  run: CanonicalRunRecord,
  queueId: string,
): RunAuthoritativeMetadata {
  return Object.freeze({
    schemaVersion: RunAuthoritativeMetadataSchemaVersion,
    canonicalRun: run,
    submissionSnapshot: Object.freeze({
      actor: command.actor,
      runtimeTarget: command.runtimeTarget,
      tags: command.tags,
      parameters: command.parameters,
      metadata: command.metadata,
      storageReferences: command.storageReferences,
      resourceReferences: command.resourceReferences,
      policyPrerequisites: command.policyPrerequisites,
    }),
    visibility: Object.freeze({
      workspaceScope: "workspace",
      sharingPosture: "workspace-members",
    }),
    orchestration: Object.freeze({
      initialLifecycleState: run.state,
      initialQueueState: "queued",
      intent: Object.freeze({
        kind: "queue-admission-requested",
        queueId,
        recordedAt: run.updatedAt,
      }),
    }),
  });
}

export function mapCanonicalRunToPlatformRecord(input: {
  readonly command: CanonicalRunSubmissionCommand;
  readonly run: CanonicalRunRecord;
  readonly queueId: string;
}): PlatformRunRecord {
  const metadata = createRunAuthoritativeMetadata(input.command, input.run, input.queueId);
  return Object.freeze({
    runId: input.run.identity.runId,
    runKind: resolveRunKind(input.command),
    status: mapLifecycleStateToPlatformRunStatus(input.run.state),
    workspaceId: input.run.identity.workspaceId,
    userIdentityId: input.command.actor.actorUserIdentityId,
    sourceAggregateRef: resolveRunSourceAggregateRef(input.command),
    initiatedAt: input.run.submission.submittedAt,
    metadata,
    revision: 0,
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function mapPlatformRunRecordToCanonicalRun(record: PlatformRunRecord): CanonicalRunRecord {
  const metadata = record.metadata;
  if (isObject(metadata) && "canonicalRun" in metadata) {
    return createCanonicalRunRecord((metadata as RunAuthoritativeMetadata).canonicalRun);
  }

  const state = mapPlatformRunStatusToLifecycleState(record.status);
  const execution = state === RunLifecycleStates.running
    ? Object.freeze({
      startedAt: record.startedAt ?? record.initiatedAt,
      outcome: RunExecutionOutcomeKinds.none,
    })
    : state === RunLifecycleStates.completed
      ? Object.freeze({
        startedAt: record.startedAt ?? record.initiatedAt,
        finishedAt: record.completedAt ?? record.initiatedAt,
        outcome: RunExecutionOutcomeKinds.succeeded,
      })
      : state === RunLifecycleStates.failed
        ? Object.freeze({
          startedAt: record.startedAt ?? record.initiatedAt,
          finishedAt: record.completedAt ?? record.initiatedAt,
          outcome: RunExecutionOutcomeKinds.failed,
          errorMessage: record.terminalReason ?? "Run failed.",
        })
        : state === RunLifecycleStates.cancelled
          ? Object.freeze({
            startedAt: record.startedAt ?? record.initiatedAt,
            finishedAt: record.completedAt ?? record.initiatedAt,
            outcome: RunExecutionOutcomeKinds.cancelled,
          })
          : Object.freeze({
            outcome: RunExecutionOutcomeKinds.none,
          });
  const assignment = state === RunLifecycleStates.running
    ? Object.freeze({
      status: "assigned" as const,
      assignedNodeId: "node:unknown",
      assignedAt: record.startedAt ?? record.initiatedAt,
    })
    : Object.freeze({
      status: "unassigned" as const,
    });

  return createCanonicalRunRecord({
    identity: {
      runId: record.runId,
      workflowId: record.sourceAggregateRef,
      workspaceId: record.workspaceId,
    },
    submission: {
      source: "internal-orchestrator",
      submittedAt: record.initiatedAt,
    },
    state,
    assignment,
    execution,
    updatedAt: record.completedAt ?? record.startedAt ?? record.initiatedAt,
  });
}

export function updatePlatformRunRecordCanonicalState(
  record: PlatformRunRecord,
  canonicalRun: CanonicalRunRecord,
): PlatformRunRecord {
  const metadata = isObject(record.metadata)
    ? { ...(record.metadata as Record<string, unknown>) }
    : {};
  metadata.canonicalRun = canonicalRun;

  return Object.freeze({
    ...record,
    status: mapLifecycleStateToPlatformRunStatus(canonicalRun.state),
    metadata: Object.freeze(metadata),
  });
}

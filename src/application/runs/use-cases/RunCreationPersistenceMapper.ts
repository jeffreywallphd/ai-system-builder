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
import {
  RunResultOutputAvailabilityHints,
  RunResultTerminalQualityHints,
  toRunDetail,
  toRunStatusEnvelope,
  type RunDetail,
  type RunStatusEnvelope,
  type RunResultSummary,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";

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
    readonly lineage?: {
      readonly kind: "retry";
      readonly previousRunId: string;
      readonly attempt: number;
      readonly maxAttempts: number;
      readonly retryReason?: string;
    };
    readonly finalization?: RunAuthoritativeFinalizationSnapshot;
  };
}

export interface RunAuthoritativeFinalizationSnapshot extends RunResultSummary {
  readonly finalizedAt: string;
  readonly outcome: "completed" | "failed" | "cancelled";
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
  retry?: {
    readonly attempt: number;
    readonly maxAttempts: number;
    readonly previousRunId?: string;
    readonly retryReason?: string;
  },
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
      attempt: retry?.attempt ?? 1,
      maxAttempts: retry?.maxAttempts ?? 1,
      previousRunId: normalizeOptional(retry?.previousRunId),
      retryReason: normalizeOptional(retry?.retryReason),
    },
    updatedAt: command.occurredAt,
  });
}

export function createRunAuthoritativeMetadata(
  command: CanonicalRunSubmissionCommand,
  run: CanonicalRunRecord,
  queueId: string,
): RunAuthoritativeMetadata {
  const hasRetryLineage = Boolean(run.retry.previousRunId);
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
      ...(hasRetryLineage
        ? {
          lineage: Object.freeze({
            kind: "retry" as const,
            previousRunId: run.retry.previousRunId!,
            attempt: run.retry.attempt,
            maxAttempts: run.retry.maxAttempts,
            retryReason: run.retry.retryReason,
          }),
        }
        : {}),
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

function toFinalizationSnapshot(value: unknown): RunAuthoritativeFinalizationSnapshot | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  const finalizedAt = typeof value.finalizedAt === "string" ? value.finalizedAt.trim() : "";
  const outcome = value.outcome === "completed" || value.outcome === "failed" || value.outcome === "cancelled"
    ? value.outcome
    : undefined;
  const outputs = Array.isArray(value.outputs) ? value.outputs : [];
  if (!finalizedAt || !outcome) {
    return undefined;
  }

  return Object.freeze({
    finalizedAt,
    outcome,
    summary: typeof value.summary === "string" ? value.summary : undefined,
    externalResultId: typeof value.externalResultId === "string" ? value.externalResultId : undefined,
    outputs: Object.freeze(outputs.map((entry) => Object.freeze({ ...(entry as Record<string, unknown>) }))),
    metrics: isObject(value.metrics) ? Object.freeze({ ...value.metrics }) : undefined,
    outputAvailability: Object.values(RunResultOutputAvailabilityHints)
      .includes(value.outputAvailability as typeof RunResultOutputAvailabilityHints[keyof typeof RunResultOutputAvailabilityHints])
      ? value.outputAvailability as typeof RunResultOutputAvailabilityHints[keyof typeof RunResultOutputAvailabilityHints]
      : undefined,
    terminalQuality: Object.values(RunResultTerminalQualityHints)
      .includes(value.terminalQuality as typeof RunResultTerminalQualityHints[keyof typeof RunResultTerminalQualityHints])
      ? value.terminalQuality as typeof RunResultTerminalQualityHints[keyof typeof RunResultTerminalQualityHints]
      : undefined,
  }) as RunAuthoritativeFinalizationSnapshot;
}

export function extractRunFinalizationSnapshot(metadata: unknown): RunAuthoritativeFinalizationSnapshot | undefined {
  if (!isObject(metadata)) {
    return undefined;
  }
  const orchestration = metadata.orchestration;
  if (!isObject(orchestration)) {
    return undefined;
  }
  return toFinalizationSnapshot(orchestration.finalization);
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
    startedAt: canonicalRun.execution.startedAt,
    completedAt: canonicalRun.execution.finishedAt,
    terminalReason: canonicalRun.execution.outcome === RunExecutionOutcomeKinds.failed
      ? canonicalRun.execution.errorMessage
      : canonicalRun.execution.outcome === RunExecutionOutcomeKinds.cancelled
        ? "cancelled"
        : canonicalRun.execution.outcome === RunExecutionOutcomeKinds.succeeded
          ? "succeeded"
          : undefined,
    metadata: Object.freeze(metadata),
  });
}

export function toRunDetailFromPlatformRecord(record: PlatformRunRecord): RunDetail {
  const detail = toRunDetail(mapPlatformRunRecordToCanonicalRun(record));
  const finalization = extractRunFinalizationSnapshot(record.metadata);
  if (!finalization) {
    return detail;
  }

  return Object.freeze({
    ...detail,
    finalization,
  });
}

export function toRunStatusEnvelopeFromPlatformRecord(record: PlatformRunRecord): RunStatusEnvelope {
  const status = toRunStatusEnvelope(mapPlatformRunRecordToCanonicalRun(record));
  const finalization = extractRunFinalizationSnapshot(record.metadata);
  if (!finalization) {
    return status;
  }

  return Object.freeze({
    ...status,
    finalization,
  });
}

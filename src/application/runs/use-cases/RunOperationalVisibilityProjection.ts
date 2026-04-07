import type { PlatformAuditEventRecord } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type { AuthoritativeRunDispatchAttemptRecord } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import {
  RunLifecycleStates,
  type CanonicalRunRecord,
} from "@domain/runs/RunDomain";
import {
  deriveRunFailureSummary,
  type RunFailureSummary,
  type RunDetail,
  type RunStatusEnvelope,
  type RunStatusTimelineEntry,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";

export const OperationalVisibilityAudiences = Object.freeze({
  user: "user",
  admin: "admin",
});

export type OperationalVisibilityAudience =
  typeof OperationalVisibilityAudiences[keyof typeof OperationalVisibilityAudiences];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function normalizeOptional(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized || undefined;
}

function parseLifecycleState(value: unknown): string | undefined {
  const state = normalizeOptional(value);
  if (!state) {
    return undefined;
  }

  return Object.values(RunLifecycleStates).includes(state as typeof RunLifecycleStates[keyof typeof RunLifecycleStates])
    ? state
    : undefined;
}

function detailKeys(value: unknown): ReadonlyArray<string> | undefined {
  const details = asRecord(value);
  if (!details) {
    return undefined;
  }
  const keys = Object.keys(details);
  return keys.length === 0
    ? undefined
    : Object.freeze(keys.sort());
}

function parseTimelineEvent(input: {
  readonly event: PlatformAuditEventRecord;
  readonly audience: OperationalVisibilityAudience;
}): RunStatusTimelineEntry | undefined {
  const details = asRecord(input.event.details);
  const action = input.event.action;

  if (action === "run.orchestration-intent.recorded") {
    const state = parseLifecycleState(details?.lifecycleState) ?? RunLifecycleStates.queued;
    return Object.freeze({
      occurredAt: input.event.occurredAt,
      state,
      source: "audit",
      kind: "submission",
      message: "Run orchestration intent recorded for queue admission.",
    });
  }

  if (action === "run.lifecycle.transitioned") {
    const state = parseLifecycleState(details?.toState) ?? parseLifecycleState(details?.lifecycleState);
    if (!state) {
      return undefined;
    }
    const dispatchAttemptId = normalizeOptional(details?.dispatchAttemptId);
    const dispatchOutcome = normalizeOptional(details?.dispatchOutcome);
    return Object.freeze({
      occurredAt: input.event.occurredAt,
      state,
      source: "audit",
      kind: "lifecycle-transition",
      message: dispatchAttemptId
        ? dispatchOutcome
          ? `Lifecycle transitioned (${dispatchOutcome}) for dispatch attempt '${dispatchAttemptId}'.`
          : `Lifecycle transitioned for dispatch attempt '${dispatchAttemptId}'.`
        : "Lifecycle transitioned.",
    });
  }

  if (action === "run.execution-update.ingested") {
    const state = parseLifecycleState(details?.toState);
    if (!state) {
      return undefined;
    }
    const hadProgress = details?.hadProgress === true;
    const hadHeartbeat = details?.hadHeartbeat === true;
    const hadInternalDiagnostics = details?.hadInternalDiagnostics === true;
    const statusParts: string[] = [];
    if (hadProgress) {
      statusParts.push("progress");
    }
    if (hadHeartbeat) {
      statusParts.push("heartbeat");
    }
    if (hadInternalDiagnostics && input.audience === OperationalVisibilityAudiences.admin) {
      statusParts.push("diagnostics");
    }
    return Object.freeze({
      occurredAt: input.event.occurredAt,
      state,
      source: "audit",
      kind: hadProgress ? "progress" : "lifecycle-transition",
      message: statusParts.length > 0
        ? `Execution update ingested (${statusParts.join(", ")}).`
        : "Execution update ingested.",
    });
  }

  if (action === "run.cancellation.requested") {
    const state = parseLifecycleState(details?.toState) ?? RunLifecycleStates.cancelling;
    const outcome = normalizeOptional(details?.outcome);
    const reason = normalizeOptional(details?.reason);
    return Object.freeze({
      occurredAt: input.event.occurredAt,
      state,
      source: "audit",
      kind: "cancellation",
      message: outcome
        ? reason
          ? `Cancellation ${outcome}: ${reason}`
          : `Cancellation ${outcome}.`
        : "Cancellation requested.",
    });
  }

  if (action === "run.retry.requested") {
    const state = RunLifecycleStates.retryPending;
    const retriedRunId = normalizeOptional(details?.retriedRunId);
    const reason = normalizeOptional(details?.reason);
    return Object.freeze({
      occurredAt: input.event.occurredAt,
      state,
      source: "audit",
      kind: "retry",
      message: retriedRunId
        ? reason
          ? `Retry queued as '${retriedRunId}' (${reason}).`
          : `Retry queued as '${retriedRunId}'.`
        : "Retry requested.",
    });
  }

  const state = parseLifecycleState(details?.toState ?? details?.lifecycleState ?? details?.fromState);
  if (!state) {
    return undefined;
  }
  return Object.freeze({
    occurredAt: input.event.occurredAt,
    state,
    source: "audit",
    kind: "lifecycle-transition",
    message: normalizeOptional(details?.message)
      ?? normalizeOptional(details?.reason)
      ?? normalizeOptional(input.event.action),
  });
}

function toDispatchTimelineEntries(input: {
  readonly dispatchAttempts: ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>;
  readonly audience: OperationalVisibilityAudience;
}): ReadonlyArray<RunStatusTimelineEntry> {
  const sorted = [...input.dispatchAttempts]
    .sort((left, right) => left.preparedAt.localeCompare(right.preparedAt) || left.attemptId.localeCompare(right.attemptId));

  const entries: RunStatusTimelineEntry[] = [];
  for (const attempt of sorted) {
    entries.push(Object.freeze({
      occurredAt: attempt.preparedAt,
      state: RunLifecycleStates.dispatching,
      source: "audit",
      kind: "dispatch-attempt",
      message: `Dispatch attempt '${attempt.attemptId}' prepared for node '${attempt.nodeId}'.`,
    }));

    if (!attempt.dispatchResult) {
      continue;
    }
    if (attempt.dispatchResult.status === "accepted") {
      entries.push(Object.freeze({
        occurredAt: attempt.dispatchResult.recordedAt,
        state: RunLifecycleStates.running,
        source: "audit",
        kind: "dispatch-attempt",
        message: `Dispatch attempt '${attempt.attemptId}' accepted by execution backend.`,
      }));
      continue;
    }

    const safeMessage = normalizeOptional(attempt.dispatchResult.failure?.safeMessage) ?? "Dispatch failed to start.";
    const internalCode = normalizeOptional(attempt.dispatchResult.failure?.internalCode);
    entries.push(Object.freeze({
      occurredAt: attempt.dispatchResult.recordedAt,
      state: RunLifecycleStates.failed,
      source: "audit",
      kind: "dispatch-attempt",
      message: input.audience === OperationalVisibilityAudiences.admin && internalCode
        ? `${safeMessage} (internalCode=${internalCode})`
        : safeMessage,
    }));
  }

  return Object.freeze(entries);
}

function dedupeTimelineEntries(entries: ReadonlyArray<RunStatusTimelineEntry>): ReadonlyArray<RunStatusTimelineEntry> {
  const seen = new Set<string>();
  const deduped: RunStatusTimelineEntry[] = [];
  for (const entry of entries) {
    const key = `${entry.occurredAt}|${entry.state}|${entry.source}|${entry.kind ?? ""}|${entry.message ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(entry);
  }
  return Object.freeze(deduped);
}

function deriveOperationalFailureSummary(input: {
  readonly run: CanonicalRunRecord;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly dispatchAttempts?: ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>;
  readonly audience: OperationalVisibilityAudience;
}): RunFailureSummary | undefined {
  const summary = deriveRunFailureSummary(input.run);
  if (!summary) {
    return undefined;
  }
  if (input.audience !== OperationalVisibilityAudiences.admin) {
    return summary;
  }

  const latestDispatchFailure = input.dispatchAttempts
    ?.filter((attempt) => attempt.dispatchResult?.status === "failed-to-start")
    .sort((left, right) => (
      (right.dispatchResult?.recordedAt ?? "").localeCompare(left.dispatchResult?.recordedAt ?? "")
      || right.preparedAt.localeCompare(left.preparedAt)
      || right.attemptId.localeCompare(left.attemptId)
    ))[0];

  const executionTelemetry = asRecord(input.metadata?.executionTelemetry);
  const lastInternalUpdate = asRecord(executionTelemetry?.lastInternalUpdate);
  const finalizationInternal = asRecord(executionTelemetry?.finalizationInternal);
  const finalizationDiagnostics = asRecord(finalizationInternal?.diagnostics);
  const registrationDiagnostics = asRecord(finalizationInternal?.registrationDiagnostics);

  return Object.freeze({
    ...summary,
    diagnostics: Object.freeze({
      visibility: "admin",
      latestDispatchFailure: latestDispatchFailure?.dispatchResult
        ? Object.freeze({
          attemptId: latestDispatchFailure.attemptId,
          recordedAt: latestDispatchFailure.dispatchResult.recordedAt,
          nodeId: latestDispatchFailure.nodeId,
          safeCode: latestDispatchFailure.dispatchResult.failure?.safeCode ?? "dispatch-failed-to-start",
          safeMessage: latestDispatchFailure.dispatchResult.failure?.safeMessage ?? "Dispatch failed to start.",
          internalCode: normalizeOptional(latestDispatchFailure.dispatchResult.failure?.internalCode),
          retryable: latestDispatchFailure.dispatchResult.failure?.retryable,
          detailKeys: detailKeys(latestDispatchFailure.dispatchResult.failure?.details),
        })
        : undefined,
      latestExecutionTelemetry: Object.freeze({
        updatedAt: normalizeOptional(lastInternalUpdate?.updatedAt as string | undefined),
        senderNodeId: normalizeOptional(lastInternalUpdate?.senderNodeId as string | undefined),
        senderBackendKind: normalizeOptional(lastInternalUpdate?.senderBackendKind as string | undefined),
        senderBackendRunId: normalizeOptional(lastInternalUpdate?.senderBackendRunId as string | undefined),
        diagnosticKeys: detailKeys(lastInternalUpdate?.diagnostics),
        finalizationDiagnosticKeys: detailKeys(finalizationDiagnostics),
        registrationDiagnosticKeys: detailKeys(registrationDiagnostics),
      }),
    }),
  });
}

export function buildOperationalRunStatusTimeline(input: {
  readonly run: CanonicalRunRecord;
  readonly auditEvents: ReadonlyArray<PlatformAuditEventRecord>;
  readonly dispatchAttempts?: ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>;
  readonly audience?: OperationalVisibilityAudience;
}): ReadonlyArray<RunStatusTimelineEntry> {
  const audience = input.audience ?? OperationalVisibilityAudiences.user;
  const timeline: RunStatusTimelineEntry[] = [{
    occurredAt: input.run.submission.submittedAt,
    state: RunLifecycleStates.submitted,
    source: "run-state",
    kind: "submission",
    message: "Run submission accepted.",
  }];

  timeline.push(...toDispatchTimelineEntries({
    dispatchAttempts: input.dispatchAttempts ?? Object.freeze([]),
    audience,
  }));

  const orderedEvents = [...input.auditEvents]
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  for (const event of orderedEvents) {
    const timelineEvent = parseTimelineEvent({
      event,
      audience,
    });
    if (timelineEvent) {
      timeline.push(timelineEvent);
    }
  }

  if (!timeline.some((entry) => entry.occurredAt === input.run.updatedAt && entry.state === input.run.state)) {
    timeline.push({
      occurredAt: input.run.updatedAt,
      state: input.run.state,
      source: "run-state",
      kind: "lifecycle-transition",
    });
  }

  return dedupeTimelineEntries(Object.freeze(timeline.map((entry) => Object.freeze(entry))));
}

export function mergeOperationalDetailProjection(input: {
  readonly detail: RunDetail;
  readonly run: CanonicalRunRecord;
  readonly timeline: ReadonlyArray<RunStatusTimelineEntry>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly dispatchAttempts?: ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>;
  readonly audience?: OperationalVisibilityAudience;
}): RunDetail {
  return Object.freeze({
    ...input.detail,
    failureSummary: input.detail.failureSummary ?? deriveOperationalFailureSummary({
      run: input.run,
      metadata: input.metadata,
      dispatchAttempts: input.dispatchAttempts,
      audience: input.audience ?? OperationalVisibilityAudiences.user,
    }),
    statusTimeline: input.timeline,
  });
}

export function mergeOperationalStatusProjection(input: {
  readonly status: RunStatusEnvelope;
  readonly run: CanonicalRunRecord;
  readonly timeline: ReadonlyArray<RunStatusTimelineEntry>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly dispatchAttempts?: ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>;
  readonly audience?: OperationalVisibilityAudience;
}): RunStatusEnvelope {
  return Object.freeze({
    ...input.status,
    failureSummary: input.status.failureSummary ?? deriveOperationalFailureSummary({
      run: input.run,
      metadata: input.metadata,
      dispatchAttempts: input.dispatchAttempts,
      audience: input.audience ?? OperationalVisibilityAudiences.user,
    }),
    statusTimeline: input.timeline,
  });
}

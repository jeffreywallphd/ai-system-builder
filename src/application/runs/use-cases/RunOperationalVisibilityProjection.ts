import type { PlatformAuditEventRecord } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import {
  RunLifecycleStates,
  type CanonicalRunRecord,
} from "@domain/runs/RunDomain";
import {
  deriveRunFailureSummary,
  type RunDetail,
  type RunStatusEnvelope,
  type RunStatusTimelineEntry,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";

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

export function buildOperationalRunStatusTimeline(input: {
  readonly run: CanonicalRunRecord;
  readonly auditEvents: ReadonlyArray<PlatformAuditEventRecord>;
}): ReadonlyArray<RunStatusTimelineEntry> {
  const timeline: RunStatusTimelineEntry[] = [{
    occurredAt: input.run.submission.submittedAt,
    state: RunLifecycleStates.submitted,
    source: "run-state",
    message: "Run submission accepted.",
  }];

  const orderedEvents = [...input.auditEvents]
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  for (const event of orderedEvents) {
    const details = asRecord(event.details);
    if (!details) {
      continue;
    }
    const toState = parseLifecycleState(details.toState ?? details.lifecycleState);
    if (!toState) {
      continue;
    }
    timeline.push({
      occurredAt: event.occurredAt,
      state: toState,
      source: "audit",
      message: normalizeOptional(details.message)
        ?? normalizeOptional(details.reason)
        ?? normalizeOptional(event.action),
    });
  }

  if (!timeline.some((entry) => entry.occurredAt === input.run.updatedAt && entry.state === input.run.state)) {
    timeline.push({
      occurredAt: input.run.updatedAt,
      state: input.run.state,
      source: "run-state",
    });
  }

  return Object.freeze(timeline.map((entry) => Object.freeze(entry)));
}

export function mergeOperationalDetailProjection(input: {
  readonly detail: RunDetail;
  readonly run: CanonicalRunRecord;
  readonly timeline: ReadonlyArray<RunStatusTimelineEntry>;
}): RunDetail {
  return Object.freeze({
    ...input.detail,
    failureSummary: input.detail.failureSummary ?? deriveRunFailureSummary(input.run),
    statusTimeline: input.timeline,
  });
}

export function mergeOperationalStatusProjection(input: {
  readonly status: RunStatusEnvelope;
  readonly run: CanonicalRunRecord;
  readonly timeline: ReadonlyArray<RunStatusTimelineEntry>;
}): RunStatusEnvelope {
  return Object.freeze({
    ...input.status,
    failureSummary: input.status.failureSummary ?? deriveRunFailureSummary(input.run),
    statusTimeline: input.timeline,
  });
}

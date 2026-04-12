import { randomUUID } from "node:crypto";
import {
  PlatformAuditEventKinds,
  type IPlatformAuditEventRepository,
  type PlatformAuditEventRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type {
  ISchedulingGovernanceEventSink,
  SchedulingGovernanceEvent,
} from "@application/scheduling/ports/SchedulingGovernanceEventPorts";
import type {
  RuntimeRealtimeQueueMovementPayload,
  RuntimeRealtimeRunStatusPayload,
} from "@shared/contracts/runtime/SystemRuntimeRealtimeEventContracts";
import type { RunOrchestrationRealtimePublisher } from "./RunOrchestrationRealtimePublisher";
import type { RunOrchestrationObservability } from "./RunOrchestrationObservability";

const SchedulingAuditActionsByType = Object.freeze({
  "scheduling-priority-placement-selected": "run.scheduling.priority-placement.selected",
  "scheduling-deferred-no-placement": "run.scheduling.no-placement.deferred",
  "scheduling-reservation-conflict": "run.scheduling.reservation.conflict",
  "scheduling-assignment-materialized": "run.scheduling.assignment.materialized",
  "scheduling-assignment-materialization-conflict": "run.scheduling.assignment.materialization.conflict",
} as const satisfies Record<SchedulingGovernanceEvent["type"], string>);

export class PlatformSchedulingGovernanceEventSink implements ISchedulingGovernanceEventSink {
  public constructor(
    private readonly repository: IPlatformAuditEventRepository,
    private readonly realtimePublisher?: RunOrchestrationRealtimePublisher,
    private readonly observability?: RunOrchestrationObservability,
  ) {}

  public async recordSchedulingGovernanceEvent(event: SchedulingGovernanceEvent): Promise<void> {
    if (event.channel === "audit") {
      await this.recordAuditEvent(event);
      return;
    }

    if (event.channel !== "operational") {
      return;
    }
    this.publishRealtimeEvents(event);
    await this.recordOperationalObservability(event);
  }

  private async recordAuditEvent(event: SchedulingGovernanceEvent): Promise<void> {
    const actorId = resolveActorId(event);
    const auditEvent = Object.freeze({
      eventId: `audit:run-scheduling:${randomUUID()}`,
      eventKind: PlatformAuditEventKinds.runs,
      action: SchedulingAuditActionsByType[event.type],
      actorId,
      workspaceId: event.workspaceId,
      userIdentityId: event.actorUserIdentityId,
      targetRef: resolveTargetRef(event),
      outcome: resolveAuditOutcome(event.outcome),
      occurredAt: event.occurredAt,
      details: event.details,
    } satisfies PlatformAuditEventRecord);
    await this.repository.appendAuditEvent(auditEvent, {
      operationKey: `run-scheduling-audit:${event.type}:${event.decisionId ?? event.runId ?? event.nodeId ?? randomUUID()}`,
      actorId,
      occurredAt: event.occurredAt,
    });
  }

  private publishRealtimeEvents(event: SchedulingGovernanceEvent): void {
    const runId = normalizeOptional(event.runId);
    if (!this.realtimePublisher || !runId) {
      return;
    }

    const queuePayload = toRuntimeQueuePayload(event, runId);
    this.realtimePublisher.publishQueueMovement({
      actorUserIdentityId: normalizeOptional(event.actorUserIdentityId),
      workspaceId: normalizeOptional(event.workspaceId),
      payload: queuePayload,
    });

    const runPayload = toRuntimeRunStatusPayload(event, runId);
    this.realtimePublisher.publishRunStatus({
      actorUserIdentityId: normalizeOptional(event.actorUserIdentityId),
      workspaceId: normalizeOptional(event.workspaceId),
      payload: runPayload,
    });
  }

  private async recordOperationalObservability(event: SchedulingGovernanceEvent): Promise<void> {
    if (!this.observability) {
      return;
    }

    const counters = buildSchedulingObservabilityCounters(event);
    const reasonCodes = toOptionalStringArray(event.details?.reasonCodes);
    const exclusionReasonCodes = toOptionalStringArray(event.details?.exclusionReasonCodes);
    const details = Object.freeze({
      channel: event.channel,
      schedulerEventType: event.type,
      schedulerOutcome: event.outcome,
      queueId: normalizeOptional(event.queueId),
      decisionId: normalizeOptional(event.decisionId),
      reasonCategory: normalizeOptional(asStringValue(event.details?.reasonCategory)),
      reasonCodes,
      exclusionReasonCodes,
      requiresAdministrativeAttention: toOptionalBoolean(event.details?.requiresAdministrativeAttention),
    });

    try {
      await this.observability.record({
        event: "run.orchestration.scheduling.governance-event.recorded",
        operation: "scheduling.governance-event",
        outcome: "success",
        severity: resolveSchedulingOperationalSeverity(event),
        correlationId: normalizeOptional(event.decisionId),
        runId: normalizeOptional(event.runId),
        workspaceId: normalizeOptional(event.workspaceId),
        nodeId: normalizeOptional(event.nodeId),
        markers: buildSchedulingObservabilityMarkers(event),
        counters,
        details,
        occurredAt: event.occurredAt,
      });
    } catch {
      // Scheduler observability publication is intentionally best-effort.
    }
  }
}

function buildSchedulingObservabilityCounters(event: SchedulingGovernanceEvent): Readonly<Record<string, number>> {
  const counters: Record<string, number> = {
    scheduling_governance_events_total: 1,
    [`scheduling_event_${sanitizeCounterToken(event.type)}_total`]: 1,
    [`scheduling_outcome_${sanitizeCounterToken(event.outcome)}_total`]: 1,
  };

  if (event.type === "scheduling-deferred-no-placement") {
    counters.scheduling_defer_no_placement_total = 1;
  }
  if (event.type === "scheduling-reservation-conflict") {
    counters.scheduling_reservation_conflicts_total = 1;
  }
  if (event.type === "scheduling-assignment-materialization-conflict") {
    counters.scheduling_assignment_materialization_conflicts_total = 1;
  }

  const decisionReasonCodes = toOptionalStringArray(event.details?.reasonCodes) ?? [];
  const exclusionReasonCodes = toOptionalStringArray(event.details?.exclusionReasonCodes) ?? [];
  const reasonCodes = [
    ...decisionReasonCodes,
    ...exclusionReasonCodes,
  ];
  for (const reasonCode of [...new Set(reasonCodes)].slice(0, 20)) {
    counters[`scheduling_reason_${sanitizeCounterToken(reasonCode)}_total`] = 1;
  }

  return Object.freeze(counters);
}

function buildSchedulingObservabilityMarkers(
  event: SchedulingGovernanceEvent,
): ReadonlyArray<string> {
  const markers = [
    "scheduler-governance-event",
    `scheduler-event:${event.type}`,
    `scheduler-outcome:${event.outcome}`,
  ];
  if (event.type === "scheduling-deferred-no-placement") {
    markers.push("defer-no-placement");
  }
  if (event.type === "scheduling-reservation-conflict") {
    markers.push("reservation-conflict");
  }
  if (event.type === "scheduling-assignment-materialization-conflict") {
    markers.push("assignment-materialization-conflict");
  }
  return Object.freeze(markers);
}

function resolveSchedulingOperationalSeverity(
  event: SchedulingGovernanceEvent,
): "info" | "warn" | "error" {
  if (event.type === "scheduling-priority-placement-selected" || event.type === "scheduling-assignment-materialized") {
    return "info";
  }
  if (event.type === "scheduling-deferred-no-placement" || event.type === "scheduling-reservation-conflict") {
    return "warn";
  }
  if (event.type === "scheduling-assignment-materialization-conflict") {
    return "warn";
  }
  return "info";
}

function toOptionalStringArray(value: unknown): ReadonlyArray<string> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value
    .map((entry) => normalizeOptional(asStringValue(entry)))
    .filter((entry): entry is string => Boolean(entry));
  return normalized.length > 0 ? Object.freeze([...new Set(normalized)]) : undefined;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asStringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function sanitizeCounterToken(value: string): string {
  return value.trim().replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "unknown";
}

function resolveActorId(event: SchedulingGovernanceEvent): string {
  const actorUser = normalizeOptional(event.actorUserIdentityId);
  if (actorUser) {
    return actorUser;
  }
  const actorService = normalizeOptional(event.actorServiceId);
  if (actorService) {
    return actorService;
  }
  const reservationOwner = normalizeOptional(event.reservationOwner);
  if (reservationOwner) {
    return reservationOwner;
  }
  return "system:run-scheduler";
}

function resolveAuditOutcome(outcome: SchedulingGovernanceEvent["outcome"]): PlatformAuditEventRecord["outcome"] {
  switch (outcome) {
    case "succeeded":
      return "succeeded";
    case "deferred":
      return "rejected";
    case "conflict":
      return "failed";
    case "rejected":
      return "rejected";
    default:
      return "failed";
  }
}

function resolveTargetRef(event: SchedulingGovernanceEvent): string | undefined {
  const runRef = normalizeRef(event.runId, "run");
  if (runRef) {
    return runRef;
  }
  const nodeRef = normalizeRef(event.nodeId, "node");
  if (nodeRef) {
    return nodeRef;
  }
  const decisionId = normalizeOptional(event.decisionId);
  return decisionId ? `scheduling-decision:${decisionId}` : undefined;
}

function normalizeRef(value: string | undefined, prefix: string): string | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }
  if (normalized.startsWith(`${prefix}:`)) {
    return normalized;
  }
  return `${prefix}:${normalized}`;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function toRuntimeQueuePayload(
  event: SchedulingGovernanceEvent,
  runId: string,
): RuntimeRealtimeQueueMovementPayload {
  return Object.freeze({
    queueItemId: `runtime-queue:${runId}`,
    executionId: runId,
    status: resolveRuntimeQueueStatus(event),
    runId,
    queueId: normalizeOptional(event.queueId),
    eventKind: resolveRuntimeEventKind(event),
    changedAt: event.occurredAt,
  });
}

function toRuntimeRunStatusPayload(
  event: SchedulingGovernanceEvent,
  runId: string,
): RuntimeRealtimeRunStatusPayload {
  const lifecycleState = resolveRuntimeLifecycleState(event);
  return Object.freeze({
    executionId: runId,
    status: lifecycleState,
    runId,
    queueId: normalizeOptional(event.queueId),
    lifecycleState,
    eventKind: resolveRuntimeEventKind(event),
    changedAt: event.occurredAt,
  });
}

function resolveRuntimeEventKind(
  event: SchedulingGovernanceEvent,
): RuntimeRealtimeRunStatusPayload["eventKind"] {
  switch (event.type) {
    case "scheduling-priority-placement-selected":
      return "scheduling-priority-placement-selected";
    case "scheduling-deferred-no-placement":
      return "scheduling-deferred-no-placement";
    case "scheduling-reservation-conflict":
      return "scheduling-reservation-conflict";
    case "scheduling-assignment-materialization-conflict":
      return "scheduling-assignment-materialization-conflict";
    case "scheduling-assignment-materialized":
      return "scheduling-assignment-materialized";
    default:
      return "state-changed";
  }
}

function resolveRuntimeLifecycleState(event: SchedulingGovernanceEvent): string {
  switch (event.type) {
    case "scheduling-priority-placement-selected":
    case "scheduling-assignment-materialized":
      return "assignment-pending";
    case "scheduling-deferred-no-placement":
      return "queued";
    case "scheduling-reservation-conflict":
    case "scheduling-assignment-materialization-conflict":
      return "queued";
    default:
      return "queued";
  }
}

function resolveRuntimeQueueStatus(event: SchedulingGovernanceEvent): RuntimeRealtimeQueueMovementPayload["status"] {
  switch (event.type) {
    case "scheduling-priority-placement-selected":
    case "scheduling-assignment-materialized":
      return "running";
    case "scheduling-deferred-no-placement":
    case "scheduling-reservation-conflict":
    case "scheduling-assignment-materialization-conflict":
      return "queued";
    default:
      return "queued";
  }
}

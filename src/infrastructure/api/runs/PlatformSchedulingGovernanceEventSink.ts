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

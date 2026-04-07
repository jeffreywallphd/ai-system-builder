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

const SchedulingAuditActionsByType = Object.freeze({
  "scheduling-priority-placement-selected": "run.scheduling.priority-placement.selected",
  "scheduling-deferred-no-placement": "run.scheduling.no-placement.deferred",
  "scheduling-reservation-conflict": "run.scheduling.reservation.conflict",
  "scheduling-assignment-materialization-conflict": "run.scheduling.assignment.materialization.conflict",
} as const satisfies Record<SchedulingGovernanceEvent["type"], string>);

export class PlatformSchedulingGovernanceEventSink implements ISchedulingGovernanceEventSink {
  public constructor(
    private readonly repository: IPlatformAuditEventRepository,
  ) {}

  public async recordSchedulingGovernanceEvent(event: SchedulingGovernanceEvent): Promise<void> {
    if (event.channel !== "audit") {
      return;
    }

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

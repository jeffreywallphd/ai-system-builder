import type { AuthoritativeAuditRecordingPort } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import type {
  ISchedulingGovernanceEventSink,
  SchedulingGovernanceEvent,
} from "@application/scheduling/ports/SchedulingGovernanceEventPorts";
import { AuditActorKinds, AuditEventOutcomes, AuditScopeKinds } from "@domain/audit/AuditDomain";

const SchedulingAuditActionsByType = Object.freeze({
  "scheduling-priority-placement-selected": "run.scheduling.priority-placement.selected",
  "scheduling-deferred-no-placement": "run.scheduling.no-placement.deferred",
  "scheduling-reservation-conflict": "run.scheduling.reservation.conflict",
  "scheduling-assignment-materialized": "run.scheduling.assignment.materialized",
  "scheduling-assignment-materialization-conflict": "run.scheduling.assignment.materialization.conflict",
} as const satisfies Record<SchedulingGovernanceEvent["type"], string>);

export class AuthoritativeSchedulingGovernanceEventSink implements ISchedulingGovernanceEventSink {
  public constructor(private readonly recorder: AuthoritativeAuditRecordingPort) {}

  public async recordSchedulingGovernanceEvent(event: SchedulingGovernanceEvent): Promise<void> {
    if (event.channel !== "audit") {
      return;
    }

    const actorUserIdentityId = normalizeOptional(event.actorUserIdentityId);
    const actorServiceId = normalizeOptional(event.actorServiceId);
    const reservationOwner = normalizeOptional(event.reservationOwner);
    const actor = actorUserIdentityId
      ? Object.freeze({
        actorId: actorUserIdentityId,
        actorKind: AuditActorKinds.user,
        actorUserIdentityId,
      })
      : Object.freeze({
        actorId: actorServiceId ?? reservationOwner ?? "system:run-scheduler",
        actorKind: AuditActorKinds.service,
        actorServiceId: actorServiceId ?? reservationOwner ?? "system:run-scheduler",
      });

    const workspaceId = normalizeOptional(event.workspaceId);
    const runId = normalizeOptional(event.runId);
    const nodeId = normalizeOptional(event.nodeId);
    const decisionId = normalizeOptional(event.decisionId);
    const queueId = normalizeOptional(event.queueId);

    await this.recorder.recordRunsEvent({
      operationKey: `run-scheduling-audit:${event.type}:${decisionId ?? runId ?? nodeId ?? event.occurredAt}`,
      eventType: event.type,
      action: SchedulingAuditActionsByType[event.type],
      outcome: resolveOutcome(event.outcome),
      occurredAt: event.occurredAt,
      actor,
      scope: workspaceId
        ? Object.freeze({
          kind: AuditScopeKinds.workspace,
          workspaceId,
        })
        : Object.freeze({
          kind: AuditScopeKinds.global,
        }),
      protectedResource: resolveProtectedResource({
        runId,
        nodeId,
        decisionId,
        workspaceId,
      }),
      payload: Object.freeze({
        userSafeDetails: Object.freeze({
          channel: event.channel,
          queueId,
          decisionId,
          outcome: event.outcome,
          reservationOwner,
        }),
        adminOnlyDetails: event.details
          ? Object.freeze({
            details: event.details,
          })
          : undefined,
      }),
    });
  }
}

function resolveOutcome(
  outcome: SchedulingGovernanceEvent["outcome"],
): typeof AuditEventOutcomes[keyof typeof AuditEventOutcomes] {
  switch (outcome) {
    case "succeeded":
      return AuditEventOutcomes.succeeded;
    case "deferred":
      return AuditEventOutcomes.rejected;
    case "conflict":
      return AuditEventOutcomes.failed;
    case "rejected":
      return AuditEventOutcomes.rejected;
    default:
      return AuditEventOutcomes.failed;
  }
}

function resolveProtectedResource(input: {
  readonly runId?: string;
  readonly nodeId?: string;
  readonly decisionId?: string;
  readonly workspaceId?: string;
}) {
  if (input.runId) {
    return Object.freeze({
      resourceType: "run",
      resourceId: input.runId,
      resourceRef: input.runId.startsWith("run:") ? input.runId : `run:${input.runId}`,
      sensitivityClass: "sensitive" as const,
      workspaceId: input.workspaceId,
    });
  }
  if (input.nodeId) {
    return Object.freeze({
      resourceType: "node",
      resourceId: input.nodeId,
      resourceRef: input.nodeId.startsWith("node:") ? input.nodeId : `node:${input.nodeId}`,
      sensitivityClass: "sensitive" as const,
      workspaceId: input.workspaceId,
    });
  }
  if (input.decisionId) {
    return Object.freeze({
      resourceType: "scheduling-decision",
      resourceId: input.decisionId,
      resourceRef: input.decisionId.startsWith("scheduling-decision:")
        ? input.decisionId
        : `scheduling-decision:${input.decisionId}`,
      sensitivityClass: "standard" as const,
      workspaceId: input.workspaceId,
    });
  }
  return undefined;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

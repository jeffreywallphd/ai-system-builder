import type { AuthoritativeAuditRecordingPort } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import { AuditActorKinds, AuditEventOutcomes, AuditScopeKinds } from "@domain/audit/AuditDomain";
import type {
  RunSubmissionAuditEvent,
  RunSubmissionAuditSink,
} from "@application/runs/use-cases/RunSubmissionAudit";

const RunAuditActionsByType = Object.freeze({
  "run-submission-accepted": "run.submission.accepted",
  "run-submission-denied": "run.submission.denied",
  "run-lifecycle-transitioned": "run.lifecycle.transitioned",
} as const satisfies Record<RunSubmissionAuditEvent["type"], string>);

export class AuthoritativeRunSubmissionAuditSink implements RunSubmissionAuditSink {
  public constructor(private readonly recorder: AuthoritativeAuditRecordingPort) {}

  public async recordRunSubmissionEvent(event: RunSubmissionAuditEvent): Promise<void> {
    const actorUserIdentityId = normalizeOptional(event.actorUserIdentityId);
    const actorServiceId = normalizeOptional(event.actorServiceId);
    const actor = actorUserIdentityId
      ? Object.freeze({
        actorId: actorUserIdentityId,
        actorKind: AuditActorKinds.user,
        actorUserIdentityId,
      })
      : Object.freeze({
        actorId: actorServiceId ?? "system:run-orchestrator",
        actorKind: AuditActorKinds.service,
        actorServiceId: actorServiceId ?? "system:run-orchestrator",
      });
    const workspaceId = normalizeOptional(event.workspaceId);
    const runId = normalizeOptional(event.runId);

    await this.recorder.recordRunsEvent({
      operationKey: `run-submission-audit:${event.type}:${runId ?? workspaceId ?? event.occurredAt}`,
      eventType: event.type,
      action: RunAuditActionsByType[event.type],
      outcome: event.type === "run-submission-denied"
        ? AuditEventOutcomes.denied
        : AuditEventOutcomes.succeeded,
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
      protectedResource: runId
        ? Object.freeze({
          resourceType: "run",
          resourceId: runId,
          resourceRef: runId.startsWith("run:") ? runId : `run:${runId}`,
          sensitivityClass: "sensitive",
          workspaceId,
        })
        : undefined,
      payload: Object.freeze({
        userSafeDetails: Object.freeze({
          runId,
          workspaceId,
          ...event.details,
        }),
      }),
    });
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

import { randomUUID } from "node:crypto";
import {
  PlatformAuditEventKinds,
  type IPlatformAuditEventRepository,
  type PlatformAuditEventRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type {
  RunSubmissionAuditEvent,
  RunSubmissionAuditSink,
} from "@application/runs/use-cases/RunSubmissionAudit";

const RunAuditActionsByType = Object.freeze({
  "run-submission-accepted": "run.submission.accepted",
  "run-submission-denied": "run.submission.denied",
  "run-submission-denial-pattern-detected": "run.submission.denial-pattern.detected",
  "run-lifecycle-transitioned": "run.lifecycle.transitioned",
} as const satisfies Record<RunSubmissionAuditEvent["type"], string>);

export class PlatformRunSubmissionAuditSink implements RunSubmissionAuditSink {
  public constructor(
    private readonly repository: IPlatformAuditEventRepository,
  ) {}

  public async recordRunSubmissionEvent(event: RunSubmissionAuditEvent): Promise<void> {
    const actorId = this.resolveActorId(event);
    const auditEvent = this.mapToPlatformAuditEvent(event, actorId);
    await this.repository.appendAuditEvent(auditEvent, {
      operationKey: `run-audit:${event.type}:${event.runId ?? event.workspaceId ?? randomUUID()}`,
      actorId,
      occurredAt: event.occurredAt,
    });
  }

  private mapToPlatformAuditEvent(event: RunSubmissionAuditEvent, actorId: string): PlatformAuditEventRecord {
    return Object.freeze({
      eventId: `audit:run:${randomUUID()}`,
      eventKind: PlatformAuditEventKinds.runs,
      action: RunAuditActionsByType[event.type],
      actorId,
      workspaceId: event.workspaceId,
      userIdentityId: event.actorUserIdentityId,
      targetRef: resolveRunTargetRef(event.runId),
      outcome: this.resolveOutcome(event.type),
      occurredAt: event.occurredAt,
      details: event.details,
    });
  }

  private resolveOutcome(type: RunSubmissionAuditEvent["type"]): PlatformAuditEventRecord["outcome"] {
    if (type === "run-submission-denied" || type === "run-submission-denial-pattern-detected") {
      return "denied";
    }
    return "succeeded";
  }

  private resolveActorId(event: RunSubmissionAuditEvent): string {
    const userId = normalizeOptional(event.actorUserIdentityId);
    if (userId) {
      return userId;
    }
    const serviceId = normalizeOptional(event.actorServiceId);
    if (serviceId) {
      return serviceId;
    }
    return "system:run-orchestrator";
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function resolveRunTargetRef(runId: string | undefined): string | undefined {
  const normalized = normalizeOptional(runId);
  if (!normalized) {
    return undefined;
  }
  if (normalized.startsWith("run:")) {
    return normalized;
  }
  return `run:${normalized}`;
}

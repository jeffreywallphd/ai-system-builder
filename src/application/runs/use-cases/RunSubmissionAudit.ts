export const RunSubmissionAuditEventTypes = Object.freeze({
  submissionAccepted: "run-submission-accepted",
  submissionDenied: "run-submission-denied",
  lifecycleTransitioned: "run-lifecycle-transitioned",
});

export type RunSubmissionAuditEventType =
  typeof RunSubmissionAuditEventTypes[keyof typeof RunSubmissionAuditEventTypes];

export interface RunSubmissionAuditEvent {
  readonly type: RunSubmissionAuditEventType;
  readonly occurredAt: string;
  readonly workspaceId?: string;
  readonly runId?: string;
  readonly actorUserIdentityId?: string;
  readonly actorServiceId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface RunSubmissionAuditSink {
  recordRunSubmissionEvent(event: RunSubmissionAuditEvent): Promise<void>;
}

export async function publishRunSubmissionAuditEventBestEffort(
  auditSink: RunSubmissionAuditSink | undefined,
  event: RunSubmissionAuditEvent,
): Promise<void> {
  if (!auditSink) {
    return;
  }

  try {
    await auditSink.recordRunSubmissionEvent(event);
  } catch {
    // Intentionally best-effort until durable audit fan-out is standardized.
  }
}

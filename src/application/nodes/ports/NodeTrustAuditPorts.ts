export const NodeTrustAuditEventTypes = Object.freeze({
  enrollmentRequested: "node-enrollment-requested",
  pendingEnrollmentReviewed: "node-pending-enrollment-reviewed",
  nodeApproved: "node-approved",
  nodeRejected: "node-rejected",
  nodeRevoked: "node-revoked",
  heartbeatRecorded: "node-heartbeat-recorded",
  trustedInventoryQueried: "node-trusted-inventory-queried",
});

export type NodeTrustAuditEventType =
  typeof NodeTrustAuditEventTypes[keyof typeof NodeTrustAuditEventTypes];

export interface NodeTrustAuditEvent {
  readonly type: NodeTrustAuditEventType;
  readonly actorUserIdentityId: string;
  readonly occurredAt: string;
  readonly nodeId?: string;
  readonly enrollmentRequestId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface NodeTrustAuditSink {
  recordNodeTrustAuditEvent(event: NodeTrustAuditEvent): Promise<void>;
}

export async function publishNodeTrustAuditEventBestEffort(
  auditSink: NodeTrustAuditSink | undefined,
  event: NodeTrustAuditEvent,
): Promise<void> {
  if (!auditSink) {
    return;
  }

  try {
    await auditSink.recordNodeTrustAuditEvent(event);
  } catch {
    // Intentionally best-effort until audit delivery guarantees are implemented.
  }
}

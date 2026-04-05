export const NodeTrustAuditEventTypes = Object.freeze({
  enrollmentRequested: "node-enrollment-requested",
  enrollmentExpired: "node-enrollment-expired",
  pendingEnrollmentReviewed: "node-pending-enrollment-reviewed",
  nodeApproved: "node-approved",
  nodeActivated: "node-activated",
  nodeRejected: "node-rejected",
  nodeRevoked: "node-revoked",
  heartbeatRecorded: "node-heartbeat-recorded",
  heartbeatRejected: "node-heartbeat-rejected",
  trustedInventoryQueried: "node-trusted-inventory-queried",
  inventoryQueried: "node-inventory-queried",
  inventoryDetailQueried: "node-inventory-detail-queried",
});

export type NodeTrustAuditEventType =
  typeof NodeTrustAuditEventTypes[keyof typeof NodeTrustAuditEventTypes];

export interface NodeTrustAuditEvent {
  readonly type: NodeTrustAuditEventType;
  readonly actorUserIdentityId: string;
  readonly occurredAt: string;
  readonly nodeId?: string;
  readonly enrollmentRequestId?: string;
  readonly workspaceId?: string;
  readonly deploymentId?: string;
  readonly outcome?: "success" | "rejected" | "already-applied";
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
    await auditSink.recordNodeTrustAuditEvent(sanitizeNodeTrustAuditEvent(event));
  } catch {
    // Intentionally best-effort until audit delivery guarantees are implemented.
  }
}

const SensitiveNodeTrustAuditDetailKeyPattern = /(secret|token|password|credential|private[-_]?key|trust[-_]?material|attestation|csr|pem|raw)/i;

function sanitizeNodeTrustAuditEvent(event: NodeTrustAuditEvent): NodeTrustAuditEvent {
  return Object.freeze({
    ...event,
    actorUserIdentityId: normalizeAuditValue(event.actorUserIdentityId),
    occurredAt: normalizeAuditValue(event.occurredAt),
    nodeId: normalizeAuditOptional(event.nodeId),
    enrollmentRequestId: normalizeAuditOptional(event.enrollmentRequestId),
    workspaceId: normalizeAuditOptional(event.workspaceId),
    deploymentId: normalizeAuditOptional(event.deploymentId),
    details: sanitizeNodeTrustAuditDetails(event.details),
  });
}

function sanitizeNodeTrustAuditDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SensitiveNodeTrustAuditDetailKeyPattern.test(key)) {
      output[key] = "[REDACTED]";
      continue;
    }
    output[key] = sanitizeAuditUnknown(value);
  }

  return Object.freeze(output);
}

function sanitizeAuditUnknown(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return value.length > 512 ? `${value.slice(0, 512)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.slice(0, 20).map((entry) => sanitizeAuditUnknown(entry)));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (SensitiveNodeTrustAuditDetailKeyPattern.test(key)) {
        output[key] = "[REDACTED]";
        continue;
      }
      output[key] = sanitizeAuditUnknown(nestedValue);
    }
    return Object.freeze(output);
  }

  return String(value);
}

function normalizeAuditValue(value: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "unknown";
}

function normalizeAuditOptional(value?: string): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

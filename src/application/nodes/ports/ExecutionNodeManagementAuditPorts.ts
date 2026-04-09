export const ExecutionNodeManagementAuditEventTypes = Object.freeze({
  executionNodeRegistered: "execution-node-registered",
  executionNodeActivated: "execution-node-activated",
  executionNodeAvailabilityOverrideUpdated: "execution-node-availability-override-updated",
  executionNodeBackendStateRefreshed: "execution-node-backend-state-refreshed",
  executionNodeSelectionEvaluated: "execution-node-selection-evaluated",
});

export type ExecutionNodeManagementAuditEventType =
  typeof ExecutionNodeManagementAuditEventTypes[keyof typeof ExecutionNodeManagementAuditEventTypes];

export interface ExecutionNodeManagementAuditEvent {
  readonly type: ExecutionNodeManagementAuditEventType;
  readonly actorUserIdentityId: string;
  readonly occurredAt: string;
  readonly nodeId?: string;
  readonly runId?: string;
  readonly workspaceId?: string;
  readonly outcome?: "success" | "rejected" | "failed" | "already-applied";
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ExecutionNodeManagementAuditSink {
  recordExecutionNodeManagementAuditEvent(event: ExecutionNodeManagementAuditEvent): Promise<void>;
}

export async function publishExecutionNodeManagementAuditEventBestEffort(
  auditSink: ExecutionNodeManagementAuditSink | undefined,
  event: ExecutionNodeManagementAuditEvent,
): Promise<void> {
  if (!auditSink) {
    return;
  }

  try {
    await auditSink.recordExecutionNodeManagementAuditEvent(sanitizeExecutionNodeManagementAuditEvent(event));
  } catch {
    // Best-effort: audit should not block execution-node management operations.
  }
}

const SensitiveExecutionNodeAuditDetailKeyPattern = /(secret|token|password|credential|private[-_]?key|public[-_]?key|trust[-_]?material|attestation|pem|csr|raw|body|payload|content|bytes|blob|path|uri|url|endpoint|connection|configuration|config|metadata(?:[-_]?json)?)/i;

function sanitizeExecutionNodeManagementAuditEvent(
  event: ExecutionNodeManagementAuditEvent,
): ExecutionNodeManagementAuditEvent {
  return Object.freeze({
    ...event,
    actorUserIdentityId: normalizeAuditValue(event.actorUserIdentityId),
    occurredAt: normalizeAuditValue(event.occurredAt),
    nodeId: normalizeAuditOptional(event.nodeId),
    runId: normalizeAuditOptional(event.runId),
    workspaceId: normalizeAuditOptional(event.workspaceId),
    details: sanitizeAuditDetails(event.details),
  });
}

function sanitizeAuditDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SensitiveExecutionNodeAuditDetailKeyPattern.test(key)) {
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
    return value.length > 512
      ? `${value.slice(0, 512)}...`
      : value;
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
      if (SensitiveExecutionNodeAuditDetailKeyPattern.test(key)) {
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

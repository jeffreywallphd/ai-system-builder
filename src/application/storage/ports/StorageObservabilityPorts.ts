export const StorageManagementAuditEventTypes = Object.freeze({
  storageCreated: "storage-created",
  storageMetadataUpdated: "storage-metadata-updated",
  storagePolicyUpdated: "storage-policy-updated",
  storageActivated: "storage-activated",
  storageDeactivated: "storage-deactivated",
  storageDetailQueried: "storage-detail-queried",
  storageAccessListed: "storage-access-listed",
});

export type StorageManagementAuditEventType =
  typeof StorageManagementAuditEventTypes[keyof typeof StorageManagementAuditEventTypes];

export interface StorageManagementAuditEvent {
  readonly type: StorageManagementAuditEventType;
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly occurredAt: string;
  readonly storageInstanceId?: string;
  readonly correlationId?: string;
  readonly outcome?: "success" | "rejected" | "already-applied";
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface StorageManagementAuditSink {
  recordStorageManagementEvent(event: StorageManagementAuditEvent): Promise<void>;
}

export async function publishStorageManagementAuditEventBestEffort(
  auditSink: StorageManagementAuditSink | undefined,
  event: StorageManagementAuditEvent,
): Promise<void> {
  if (!auditSink) {
    return;
  }

  try {
    await auditSink.recordStorageManagementEvent(sanitizeStorageManagementAuditEvent(event));
  } catch {
    // Intentionally best-effort until guaranteed delivery is implemented.
  }
}

const SensitiveStorageManagementAuditDetailKeyPattern =
  /(secret|token|password|credential|private[-_]?key|public[-_]?key|trust[-_]?material|storage[-_]?locator|key[-_]?reference|key[-_]?id|backend[-_]?binding|provisioning[-_]?reference|connection|endpoint|path|uri|url|raw|pem|csr)/i;
const MaxStorageManagementAuditStringLength = 512;

function sanitizeStorageManagementAuditEvent(event: StorageManagementAuditEvent): StorageManagementAuditEvent {
  return Object.freeze({
    ...event,
    actorUserIdentityId: normalizeAuditValue(event.actorUserIdentityId),
    workspaceId: normalizeAuditValue(event.workspaceId),
    occurredAt: normalizeAuditValue(event.occurredAt),
    storageInstanceId: normalizeAuditOptional(event.storageInstanceId),
    correlationId: normalizeAuditOptional(event.correlationId),
    details: sanitizeStorageManagementAuditDetails(event.details),
  });
}

function sanitizeStorageManagementAuditDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SensitiveStorageManagementAuditDetailKeyPattern.test(key)) {
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
    return value.length > MaxStorageManagementAuditStringLength
      ? `${value.slice(0, MaxStorageManagementAuditStringLength)}...`
      : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return Object.freeze(value.slice(0, 20).map((item) => sanitizeAuditUnknown(item)));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (SensitiveStorageManagementAuditDetailKeyPattern.test(key)) {
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

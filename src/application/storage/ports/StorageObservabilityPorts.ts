export const StorageManagementAuditEventTypes = Object.freeze({
  storageCreated: "storage-created",
  storageMetadataUpdated: "storage-metadata-updated",
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
    await auditSink.recordStorageManagementEvent(event);
  } catch {
    // Intentionally best-effort until guaranteed delivery is implemented.
  }
}

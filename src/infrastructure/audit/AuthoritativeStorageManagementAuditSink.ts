import type { AuthoritativeAuditRecordingPort } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import {
  StorageManagementAuditEventTypes,
  type StorageManagementAuditEvent,
  type StorageManagementAuditSink,
} from "@application/storage/ports/StorageObservabilityPorts";
import { AuditActorKinds, AuditEventOutcomes, AuditScopeKinds } from "@domain/audit/AuditDomain";

const StorageActionByEventType = Object.freeze({
  [StorageManagementAuditEventTypes.storageCreated]: "storage.instance.created",
  [StorageManagementAuditEventTypes.storageMetadataUpdated]: "storage.metadata.updated",
  [StorageManagementAuditEventTypes.storageActivated]: "storage.lifecycle.activated",
  [StorageManagementAuditEventTypes.storageDeactivated]: "storage.lifecycle.deactivated",
  [StorageManagementAuditEventTypes.storageDetailQueried]: "storage.detail.queried",
  [StorageManagementAuditEventTypes.storageAccessListed]: "storage.access.listed",
} as const satisfies Readonly<Record<string, string>>);

export class AuthoritativeStorageManagementAuditSink implements StorageManagementAuditSink {
  public constructor(private readonly recorder: AuthoritativeAuditRecordingPort) {}

  public async recordStorageManagementEvent(event: StorageManagementAuditEvent): Promise<void> {
    const operationKey = `storage-management:${event.type}:${event.storageInstanceId ?? event.workspaceId}:${event.occurredAt}`;
    const actorUserIdentityId = normalizeRequired(event.actorUserIdentityId, "unknown-user");
    const workspaceId = normalizeRequired(event.workspaceId, "unknown-workspace");
    const storageInstanceId = normalizeOptional(event.storageInstanceId);
    const payload = Object.freeze({
      userSafeDetails: Object.freeze({
        eventType: event.type,
        storageInstanceId,
        ...toSafeDetails(event.details),
      }),
      adminOnlyDetails: Object.freeze({
        correlationId: normalizeOptional(event.correlationId),
        details: event.details,
      }),
    });

    if (event.type === StorageManagementAuditEventTypes.storagePolicyUpdated) {
      await this.recorder.recordPolicyEvent({
        operationKey,
        eventType: event.type,
        action: "policy.storage.updated",
        outcome: resolveOutcome(event.outcome),
        occurredAt: event.occurredAt,
        actor: Object.freeze({
          actorId: actorUserIdentityId,
          actorKind: AuditActorKinds.user,
          actorUserIdentityId,
        }),
        scope: Object.freeze({
          kind: AuditScopeKinds.workspace,
          workspaceId,
        }),
        protectedResource: storageInstanceId
          ? Object.freeze({
            resourceType: "storage-instance",
            resourceId: storageInstanceId,
            resourceRef: `storage-instance:${storageInstanceId}`,
            sensitivityClass: "sensitive" as const,
            workspaceId,
          })
          : undefined,
        correlationId: normalizeOptional(event.correlationId),
        payload,
      });
      return;
    }

    await this.recorder.recordStorageEvent({
      operationKey,
      eventType: event.type,
      action: StorageActionByEventType[event.type] ?? "storage.event.recorded",
      outcome: resolveOutcome(event.outcome),
      occurredAt: event.occurredAt,
      actor: Object.freeze({
        actorId: actorUserIdentityId,
        actorKind: AuditActorKinds.user,
        actorUserIdentityId,
      }),
      scope: Object.freeze({
        kind: AuditScopeKinds.workspace,
        workspaceId,
      }),
      protectedResource: storageInstanceId
        ? Object.freeze({
          resourceType: "storage-instance",
          resourceId: storageInstanceId,
          resourceRef: `storage-instance:${storageInstanceId}`,
          sensitivityClass: "sensitive" as const,
          workspaceId,
        })
        : undefined,
      correlationId: normalizeOptional(event.correlationId),
      payload,
    });
  }
}

function resolveOutcome(
  outcome: StorageManagementAuditEvent["outcome"] | undefined,
): typeof AuditEventOutcomes[keyof typeof AuditEventOutcomes] {
  if (outcome === "rejected") {
    return AuditEventOutcomes.rejected;
  }
  return AuditEventOutcomes.succeeded;
}

function normalizeRequired(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function toSafeDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> {
  if (!details) {
    return Object.freeze({});
  }
  return Object.freeze({
    ...details,
  });
}

import type { AuthoritativeAuditRecordingPort } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import {
  ImageAssetAuditEventTypes,
  type ImageAssetAuditEvent,
  type ImageAssetAuditSink,
} from "@application/image-assets/ports/ImageAssetAuditPort";
import { AuditActorKinds, AuditEventOutcomes, AuditRedactionReasons, AuditScopeKinds } from "@domain/audit/AuditDomain";

const ImageAssetAuditActionByType = Object.freeze({
  [ImageAssetAuditEventTypes.creationInitiated]: "asset.image.creation.initiated",
  [ImageAssetAuditEventTypes.uploadFinalized]: "asset.image.upload.finalized",
  [ImageAssetAuditEventTypes.originalContentAccessed]: "asset.protected.image.original.accessed",
  [ImageAssetAuditEventTypes.previewAccessRequested]: "asset.protected.image.preview.requested",
  [ImageAssetAuditEventTypes.previewContentOpened]: "asset.protected.image.preview.opened",
} as const satisfies Readonly<Record<string, string>>);

export class AuthoritativeImageAssetAuditSink implements ImageAssetAuditSink {
  public constructor(private readonly recorder: AuthoritativeAuditRecordingPort) {}

  public async recordImageAssetEvent(event: ImageAssetAuditEvent): Promise<void> {
    const action = ImageAssetAuditActionByType[event.type];
    if (!action) {
      return;
    }

    const isProtectedAction = action.startsWith("asset.protected.");
    const operationKey = normalizeOptional(event.operationKey)
      ?? `image-asset-audit:${event.type}:${event.asset.assetId}:${event.occurredAt}`;
    const actorUserId = normalizeRequired(event.actorUserId, "unknown-user");
    const workspaceId = normalizeRequired(event.workspaceId, "unknown-workspace");
    const assetId = normalizeRequired(event.asset.assetId, "unknown-image-asset");

    const payload = Object.freeze({
      hasProtectedData: isProtectedAction,
      redactionReasons: isProtectedAction
        ? Object.freeze([AuditRedactionReasons.internalOnlyDiagnostic])
        : Object.freeze([]),
      userSafeDetails: Object.freeze({
        assetId,
        storageInstanceId: normalizeOptional(event.asset.storageInstanceId),
        ownerUserId: normalizeOptional(event.asset.ownerUserId),
        visibility: event.asset.visibility,
        originKind: event.asset.originKind,
        lifecycleStatus: event.asset.lifecycleStatus,
        mediaType: event.asset.mediaType,
        details: event.details,
      }),
      adminOnlyDetails: isProtectedAction
        ? Object.freeze({
          operationKey,
          correlationId: normalizeOptional(event.correlationId),
        })
        : undefined,
    });

    const input = {
      operationKey,
      eventType: event.type,
      action,
      outcome: resolveOutcome(event.outcome),
      occurredAt: event.occurredAt,
      actor: Object.freeze({
        actorId: actorUserId,
        actorKind: AuditActorKinds.user,
        actorUserIdentityId: actorUserId,
      }),
      scope: Object.freeze({
        kind: AuditScopeKinds.workspace,
        workspaceId,
      }),
      protectedResource: Object.freeze({
        resourceType: "image-asset-record",
        resourceId: assetId,
        resourceRef: `image-asset-record:${assetId}`,
        sensitivityClass: isProtectedAction ? "protected" : "sensitive",
        workspaceId,
      }),
      correlationId: normalizeOptional(event.correlationId),
      payload,
      actionContext: Object.freeze({
        targetResourceId: assetId,
      }),
    } as const;

    if (isProtectedAction) {
      await this.recorder.recordSecretsEvent(input);
      return;
    }

    await this.recorder.recordStorageEvent(input);
  }
}

function resolveOutcome(
  outcome: ImageAssetAuditEvent["outcome"],
): typeof AuditEventOutcomes[keyof typeof AuditEventOutcomes] {
  if (outcome === "rejected") {
    return AuditEventOutcomes.rejected;
  }
  if (outcome === "failed") {
    return AuditEventOutcomes.failed;
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

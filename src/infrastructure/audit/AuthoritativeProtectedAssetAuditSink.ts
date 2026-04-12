import type { AuthoritativeAuditRecordingPort } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import {
  AssetAuditEventTypes,
  type AssetAuditEvent,
  type AssetAuditSink,
} from "@application/assets/ports/AssetAuditPort";
import { AuditActorKinds, AuditEventOutcomes, AuditRedactionReasons, AuditScopeKinds } from "@domain/audit/AuditDomain";

const ProtectedAssetActionByEventType = Object.freeze({
  [AssetAuditEventTypes.downloadAuthorized]: "asset.protected.download.authorized",
  [AssetAuditEventTypes.downloadOpened]: "asset.protected.download.opened",
} as const satisfies Readonly<Record<string, string>>);

export class AuthoritativeProtectedAssetAuditSink implements AssetAuditSink {
  public constructor(private readonly recorder: AuthoritativeAuditRecordingPort) {}

  public async recordAssetEvent(event: AssetAuditEvent): Promise<void> {
    const action = ProtectedAssetActionByEventType[event.type];
    if (!action) {
      return;
    }

    const actorUserId = normalizeRequired(event.actorUserId, "unknown-user");
    const workspaceId = normalizeRequired(event.workspaceId, "unknown-workspace");
    const assetId = normalizeRequired(event.asset.assetId, "unknown-asset");
    const versionId = normalizeOptional(event.asset.versionId);
    const operationKey = normalizeOptional(event.operationKey)
      ?? `asset-protected:${event.type}:${assetId}:${event.occurredAt}`;

    await this.recorder.recordSecretsEvent({
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
        resourceType: "asset-record",
        resourceId: assetId,
        resourceRef: `asset-record:${assetId}`,
        sensitivityClass: "protected",
        workspaceId,
      }),
      correlationId: normalizeOptional(event.correlationId),
      payload: Object.freeze({
        hasProtectedData: true,
        redactionReasons: Object.freeze([AuditRedactionReasons.internalOnlyDiagnostic]),
        userSafeDetails: Object.freeze({
          assetId,
          versionId,
          assetKind: event.asset.kind,
          visibility: event.asset.visibility,
          lifecycleState: event.asset.lifecycleState,
          outcome: event.outcome,
          details: event.details,
        }),
        adminOnlyDetails: Object.freeze({
          operationKey,
          correlationId: normalizeOptional(event.correlationId),
        }),
      }),
      actionContext: Object.freeze({
        targetResourceId: assetId,
      }),
    });
  }
}

function resolveOutcome(
  outcome: AssetAuditEvent["outcome"] | undefined,
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

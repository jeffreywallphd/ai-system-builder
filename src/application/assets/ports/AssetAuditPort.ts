import type { Asset, AssetLifecycleState, AssetVisibility } from "../../../domain/assets/AssetDomain";

export const AssetAuditEventTypes = Object.freeze({
  registered: "asset-registered",
  uploadInitiated: "asset-upload-initiated",
  lookedUp: "asset-looked-up",
  listed: "asset-listed",
  uploadFinalized: "asset-upload-finalized",
  downloadAuthorized: "asset-download-authorized",
  previewResolved: "asset-preview-resolved",
  generatedOutputRegistered: "asset-generated-output-registered",
  archived: "asset-archived",
  deleted: "asset-deleted",
});

export type AssetAuditEventType = typeof AssetAuditEventTypes[keyof typeof AssetAuditEventTypes];

export interface AssetAuditEvent {
  readonly type: AssetAuditEventType;
  readonly occurredAt: string;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly correlationId?: string;
  readonly operationKey?: string;
  readonly asset: Readonly<{
    readonly assetId: string;
    readonly kind?: Asset["kind"];
    readonly visibility?: AssetVisibility;
    readonly lifecycleState?: AssetLifecycleState;
    readonly versionId?: string;
  }>;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface AssetAuditSink {
  recordAssetEvent(event: AssetAuditEvent): Promise<void>;
}


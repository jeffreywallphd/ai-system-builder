import type { Asset, AssetLifecycleState, AssetVisibility } from "@domain/assets/AssetDomain";

export const AssetAuditEventTypes = Object.freeze({
  registered: "asset-registered",
  uploadInitiated: "asset-upload-initiated",
  lookedUp: "asset-looked-up",
  listed: "asset-listed",
  uploadFinalized: "asset-upload-finalized",
  downloadAuthorized: "asset-download-authorized",
  downloadOpened: "asset-download-opened",
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
  readonly outcome?: "success" | "rejected" | "already-applied";
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

export async function publishAssetAuditEventBestEffort(
  auditSink: AssetAuditSink | undefined,
  event: AssetAuditEvent,
): Promise<void> {
  if (!auditSink) {
    return;
  }

  try {
    await auditSink.recordAssetEvent(sanitizeAssetAuditEvent(event));
  } catch {
    // Intentionally best-effort until guaranteed delivery is implemented.
  }
}

const SensitiveAssetAuditDetailKeyPattern =
  /(secret|token|password|credential|private[-_]?key|public[-_]?key|content|payload|body|raw|bytes|blob|stream|path|filepath|file[-_]?path|directory|uri|url|object[-_]?key|object[-_]?version|storage[-_]?uri|checksum[-_]?digest)/i;
const MaxAssetAuditStringLength = 512;

function sanitizeAssetAuditEvent(event: AssetAuditEvent): AssetAuditEvent {
  return Object.freeze({
    ...event,
    occurredAt: normalizeAuditValue(event.occurredAt),
    workspaceId: normalizeAuditValue(event.workspaceId),
    actorUserId: normalizeAuditValue(event.actorUserId),
    correlationId: normalizeAuditOptional(event.correlationId),
    operationKey: normalizeAuditOptional(event.operationKey),
    asset: Object.freeze({
      assetId: normalizeAuditValue(event.asset.assetId),
      kind: event.asset.kind,
      visibility: event.asset.visibility,
      lifecycleState: event.asset.lifecycleState,
      versionId: normalizeAuditOptional(event.asset.versionId),
    }),
    details: sanitizeAssetAuditDetails(event.details),
  });
}

function sanitizeAssetAuditDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SensitiveAssetAuditDetailKeyPattern.test(key)) {
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
    return value.length > MaxAssetAuditStringLength
      ? `${value.slice(0, MaxAssetAuditStringLength)}...`
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
      if (SensitiveAssetAuditDetailKeyPattern.test(key)) {
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



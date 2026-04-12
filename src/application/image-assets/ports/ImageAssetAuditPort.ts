import type { ResourceVisibility } from "@domain/authorization/AuthorizationDomain";
import type { ImageAssetOriginKind, ImageAssetStatus, SupportedImageMediaType } from "@domain/image-assets/ImageAssetDomain";

export const ImageAssetAuditEventTypes = Object.freeze({
  creationInitiated: "image-asset-creation-initiated",
  uploadFinalized: "image-asset-upload-finalized",
  originalContentAccessed: "image-asset-original-content-accessed",
  previewAccessRequested: "image-asset-preview-access-requested",
  previewContentOpened: "image-asset-preview-content-opened",
});

export type ImageAssetAuditEventType =
  typeof ImageAssetAuditEventTypes[keyof typeof ImageAssetAuditEventTypes];

export const ImageAssetAuditOutcomes = Object.freeze({
  success: "success",
  rejected: "rejected",
  failed: "failed",
});

export type ImageAssetAuditOutcome =
  typeof ImageAssetAuditOutcomes[keyof typeof ImageAssetAuditOutcomes];

export interface ImageAssetAuditEvent {
  readonly type: ImageAssetAuditEventType;
  readonly occurredAt: string;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly correlationId?: string;
  readonly operationKey?: string;
  readonly outcome: ImageAssetAuditOutcome;
  readonly asset: Readonly<{
    readonly assetId: string;
    readonly storageInstanceId?: string;
    readonly ownerUserId?: string;
    readonly visibility?: ResourceVisibility;
    readonly originKind?: ImageAssetOriginKind;
    readonly lifecycleStatus?: ImageAssetStatus;
    readonly mediaType?: SupportedImageMediaType | string;
  }>;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ImageAssetAuditSink {
  recordImageAssetEvent(event: ImageAssetAuditEvent): Promise<void>;
}

export async function publishImageAssetAuditEventBestEffort(
  auditSink: ImageAssetAuditSink | undefined,
  event: ImageAssetAuditEvent,
): Promise<void> {
  if (!auditSink) {
    return;
  }

  try {
    await auditSink.recordImageAssetEvent(sanitizeImageAssetAuditEvent(event));
  } catch {
    // Intentionally best-effort until durable fan-out is centralized.
  }
}

const SensitiveImageAssetAuditDetailKeyPattern =
  /(secret|token|password|credential|private[-_]?key|public[-_]?key|content|payload|body|raw|bytes|blob|stream|path|filepath|file[-_]?path|directory|uri|url|object[-_]?key|object[-_]?version|storage[-_]?uri|checksum[-_]?digest)/i;
const MaxImageAssetAuditStringLength = 512;

function sanitizeImageAssetAuditEvent(event: ImageAssetAuditEvent): ImageAssetAuditEvent {
  return Object.freeze({
    ...event,
    occurredAt: normalizeAuditValue(event.occurredAt),
    workspaceId: normalizeAuditValue(event.workspaceId),
    actorUserId: normalizeAuditValue(event.actorUserId),
    correlationId: normalizeAuditOptional(event.correlationId),
    operationKey: normalizeAuditOptional(event.operationKey),
    asset: Object.freeze({
      assetId: normalizeAuditValue(event.asset.assetId),
      storageInstanceId: normalizeAuditOptional(event.asset.storageInstanceId),
      ownerUserId: normalizeAuditOptional(event.asset.ownerUserId),
      visibility: event.asset.visibility,
      originKind: event.asset.originKind,
      lifecycleStatus: event.asset.lifecycleStatus,
      mediaType: normalizeAuditOptional(event.asset.mediaType),
    }),
    details: sanitizeImageAssetAuditDetails(event.details),
  });
}

function sanitizeImageAssetAuditDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SensitiveImageAssetAuditDetailKeyPattern.test(key)) {
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
    return value.length > MaxImageAssetAuditStringLength
      ? `${value.slice(0, MaxImageAssetAuditStringLength)}...`
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
      if (SensitiveImageAssetAuditDetailKeyPattern.test(key)) {
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

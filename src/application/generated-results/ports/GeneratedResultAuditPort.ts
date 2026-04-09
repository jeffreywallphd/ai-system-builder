import type { ResourceVisibility } from "@domain/authorization/AuthorizationDomain";
import type { GeneratedResultAssetStatus } from "@domain/image-assets/GeneratedResultAssetDomain";
import type { SupportedImageMediaType } from "@domain/image-assets/ImageAssetDomain";

export const GeneratedResultAuditEventTypes = Object.freeze({
  resultPersisted: "generated-result-persisted",
  previewGenerationRecorded: "generated-result-preview-generation-recorded",
  originalContentAccessed: "generated-result-original-content-accessed",
  previewAccessRequested: "generated-result-preview-access-requested",
  previewContentOpened: "generated-result-preview-content-opened",
});

export type GeneratedResultAuditEventType =
  typeof GeneratedResultAuditEventTypes[keyof typeof GeneratedResultAuditEventTypes];

export const GeneratedResultAuditOutcomes = Object.freeze({
  success: "success",
  rejected: "rejected",
  failed: "failed",
});

export type GeneratedResultAuditOutcome =
  typeof GeneratedResultAuditOutcomes[keyof typeof GeneratedResultAuditOutcomes];

export interface GeneratedResultAuditEvent {
  readonly type: GeneratedResultAuditEventType;
  readonly occurredAt: string;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly correlationId?: string;
  readonly operationKey?: string;
  readonly outcome: GeneratedResultAuditOutcome;
  readonly result: Readonly<{
    readonly resultAssetId: string;
    readonly runId?: string;
    readonly workflowId?: string;
    readonly systemId?: string;
    readonly executionNodeId?: string;
    readonly storageInstanceId?: string;
    readonly visibility?: ResourceVisibility;
    readonly lifecycleStatus?: GeneratedResultAssetStatus;
    readonly mediaType?: SupportedImageMediaType | string;
  }>;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface GeneratedResultAuditSink {
  recordGeneratedResultEvent(event: GeneratedResultAuditEvent): Promise<void>;
}

export async function publishGeneratedResultAuditEventBestEffort(
  auditSink: GeneratedResultAuditSink | undefined,
  event: GeneratedResultAuditEvent,
): Promise<void> {
  if (!auditSink) {
    return;
  }

  try {
    await auditSink.recordGeneratedResultEvent(sanitizeGeneratedResultAuditEvent(event));
  } catch {
    // Intentionally best-effort until durable fan-out is centralized.
  }
}

const SensitiveGeneratedResultAuditDetailKeyPattern =
  /(secret|token|password|credential|private[-_]?key|public[-_]?key|content|payload|body|raw|bytes|blob|stream|path|filepath|file[-_]?path|directory|uri|url|object[-_]?key|object[-_]?version|storage[-_]?uri|checksum[-_]?digest|backend[-_]?handle)/i;
const MaxGeneratedResultAuditStringLength = 512;

function sanitizeGeneratedResultAuditEvent(event: GeneratedResultAuditEvent): GeneratedResultAuditEvent {
  return Object.freeze({
    ...event,
    occurredAt: normalizeAuditValue(event.occurredAt),
    workspaceId: normalizeAuditValue(event.workspaceId),
    actorUserId: normalizeAuditValue(event.actorUserId),
    correlationId: normalizeAuditOptional(event.correlationId),
    operationKey: normalizeAuditOptional(event.operationKey),
    result: Object.freeze({
      resultAssetId: normalizeAuditValue(event.result.resultAssetId),
      runId: normalizeAuditOptional(event.result.runId),
      workflowId: normalizeAuditOptional(event.result.workflowId),
      systemId: normalizeAuditOptional(event.result.systemId),
      executionNodeId: normalizeAuditOptional(event.result.executionNodeId),
      storageInstanceId: normalizeAuditOptional(event.result.storageInstanceId),
      visibility: event.result.visibility,
      lifecycleStatus: event.result.lifecycleStatus,
      mediaType: normalizeAuditOptional(event.result.mediaType),
    }),
    details: sanitizeGeneratedResultAuditDetails(event.details),
  });
}

function sanitizeGeneratedResultAuditDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SensitiveGeneratedResultAuditDetailKeyPattern.test(key)) {
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
    return value.length > MaxGeneratedResultAuditStringLength
      ? `${value.slice(0, MaxGeneratedResultAuditStringLength)}...`
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
      if (SensitiveGeneratedResultAuditDetailKeyPattern.test(key)) {
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

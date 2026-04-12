export const OfflineOperationalEventChannels = Object.freeze({
  operational: "operational",
  audit: "audit",
});

export type OfflineOperationalEventChannel =
  typeof OfflineOperationalEventChannels[keyof typeof OfflineOperationalEventChannels];

export const OfflineOperationalEventTypes = Object.freeze({
  offlineEntered: "offline-entered",
  offlineExited: "offline-exited",
  replaySucceeded: "replay-succeeded",
  replayFailed: "replay-failed",
  conflictDetected: "conflict-detected",
  protectedLocalExecutionRegistered: "protected-local-execution-registered",
  resynchronizationAttemptStarted: "resynchronization-attempt-started",
  resynchronizationAttemptCompleted: "resynchronization-attempt-completed",
  snapshotRefreshFailed: "snapshot-refresh-failed",
});

export type OfflineOperationalEventType =
  typeof OfflineOperationalEventTypes[keyof typeof OfflineOperationalEventTypes];

export const OfflineOperationalEventClassifications = Object.freeze({
  userFacingOutcome: "user-facing-outcome",
  operationalDiagnostic: "operational-diagnostic",
  combined: "combined",
});

export type OfflineOperationalEventClassification =
  typeof OfflineOperationalEventClassifications[keyof typeof OfflineOperationalEventClassifications];

export interface OfflineOperationalEvent {
  readonly channel: OfflineOperationalEventChannel;
  readonly type: OfflineOperationalEventType;
  readonly occurredAt: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly syncAttemptId?: string;
  readonly workspaceId?: string;
  readonly actorUserIdentityId?: string;
  readonly actorServiceId?: string;
  readonly operationId?: string;
  readonly resourceClass?: string;
  readonly resourceId?: string;
  readonly classification?: OfflineOperationalEventClassification;
  readonly outcome?: "succeeded" | "failed" | "conflict";
  readonly summary?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}

export interface IOfflineOperationalEventSink {
  recordOfflineOperationalEvent(event: OfflineOperationalEvent): Promise<void>;
}

const SensitiveOfflineDetailKeyPattern = /(payload|token|secret|credential|password|internal|path|file|directory|content|body|bytes|raw)/i;
const SensitiveOfflineStringValuePattern = /(file:\/\/|[a-zA-Z]:\\|\\\\|\/Users\/|\/home\/|\/var\/|\/tmp\/|\/etc\/|api[_-]?key|bearer\s+[a-z0-9\-_.]+|prompt\s*:)/i;
const MaxOfflineEventStringLength = 256;
const MaxOfflineEventArrayLength = 20;
const MaxOfflineEventObjectEntries = 24;
const RedactedMarker = "[REDACTED]";

export async function publishOfflineOperationalEventBestEffort(
  sink: IOfflineOperationalEventSink | undefined,
  event: OfflineOperationalEvent,
): Promise<void> {
  if (!sink) {
    return;
  }

  try {
    await sink.recordOfflineOperationalEvent(sanitizeOfflineOperationalEvent(event));
  } catch {
    // Offline operational/audit publication is best-effort and must not alter reconnect control flow.
  }
}

function sanitizeOfflineOperationalEvent(event: OfflineOperationalEvent): OfflineOperationalEvent {
  return Object.freeze({
    channel: event.channel,
    type: event.type,
    occurredAt: normalizeRequired(event.occurredAt, "occurredAt"),
    requestId: normalizeOptional(event.requestId),
    correlationId: normalizeOptional(event.correlationId),
    syncAttemptId: normalizeOptional(event.syncAttemptId),
    workspaceId: normalizeOptional(event.workspaceId),
    actorUserIdentityId: normalizeOptional(event.actorUserIdentityId),
    actorServiceId: normalizeOptional(event.actorServiceId),
    operationId: normalizeOptional(event.operationId),
    resourceClass: normalizeOptional(event.resourceClass),
    resourceId: normalizeOptional(event.resourceId),
    classification: event.classification,
    outcome: event.outcome,
    summary: sanitizeOptionalSummary(event.summary),
    details: sanitizeDetails(event.details),
    diagnostics: sanitizeDetails(event.diagnostics),
  });
}

function sanitizeDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details).slice(0, MaxOfflineEventObjectEntries)) {
    if (SensitiveOfflineDetailKeyPattern.test(key)) {
      output[key] = RedactedMarker;
      continue;
    }
    output[key] = sanitizeUnknown(value);
  }

  return Object.freeze(output);
}

function sanitizeUnknown(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return sanitizeStringValue(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.slice(0, MaxOfflineEventArrayLength).map((entry) => sanitizeUnknown(entry)));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, MaxOfflineEventObjectEntries)) {
      if (SensitiveOfflineDetailKeyPattern.test(key)) {
        output[key] = RedactedMarker;
        continue;
      }
      output[key] = sanitizeUnknown(nested);
    }
    return Object.freeze(output);
  }
  return String(value);
}

function sanitizeOptionalSummary(value: string | undefined): string | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }
  return sanitizeStringValue(normalized);
}

function sanitizeStringValue(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return normalized;
  }
  if (SensitiveOfflineStringValuePattern.test(normalized) || looksLikeRootedPath(normalized)) {
    return RedactedMarker;
  }
  return normalized.length > MaxOfflineEventStringLength
    ? `${normalized.slice(0, MaxOfflineEventStringLength)}...`
    : normalized;
}

function looksLikeRootedPath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return false;
  }
  if (!value.includes("/")) {
    return false;
  }
  return value.length > 4;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    throw new Error(`Offline operational event requires non-empty ${field}.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

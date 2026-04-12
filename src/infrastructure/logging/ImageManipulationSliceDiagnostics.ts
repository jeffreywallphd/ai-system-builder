export const IMAGE_MANIPULATION_SLICE_NAME = "image-manipulation" as const;

export interface ImageManipulationSliceCorrelation {
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly workspaceId?: string;
  readonly runId?: string;
  readonly workflowId?: string;
  readonly systemId?: string;
  readonly assetId?: string;
  readonly resultAssetId?: string;
  readonly previewDerivativeId?: string;
  readonly nodeId?: string;
  readonly executionJobId?: string;
  readonly backendExecutionId?: string;
  readonly operationKey?: string;
}

export interface ImageManipulationSliceResilienceDiagnostic {
  readonly code: string;
  readonly category: "validation" | "operational" | "degraded" | "recovery" | "unknown";
  readonly summary: string;
  readonly retryable?: boolean;
  readonly degraded?: boolean;
  readonly recoveryKind?: string;
  readonly retryAfterMs?: number;
  readonly scope?: string;
  readonly state?: string;
}

export function createImageManipulationSliceCorrelation(
  input: ImageManipulationSliceCorrelation,
): Readonly<ImageManipulationSliceCorrelation> {
  return Object.freeze({
    requestId: normalizeOptional(input.requestId),
    correlationId: normalizeOptional(input.correlationId),
    workspaceId: normalizeOptional(input.workspaceId),
    runId: normalizeOptional(input.runId),
    workflowId: normalizeOptional(input.workflowId),
    systemId: normalizeOptional(input.systemId),
    assetId: normalizeOptional(input.assetId),
    resultAssetId: normalizeOptional(input.resultAssetId),
    previewDerivativeId: normalizeOptional(input.previewDerivativeId),
    nodeId: normalizeOptional(input.nodeId),
    executionJobId: normalizeOptional(input.executionJobId),
    backendExecutionId: normalizeOptional(input.backendExecutionId),
    operationKey: normalizeOptional(input.operationKey),
  });
}

export function deriveImageManipulationResilienceDiagnostics(input: {
  readonly diagnostics?: ReadonlyArray<ImageManipulationSliceResilienceDiagnostic>;
  readonly details?: unknown;
  readonly defaultCode: string;
  readonly defaultSummary: string;
  readonly defaultCategory?: ImageManipulationSliceResilienceDiagnostic["category"];
  readonly defaultRetryable?: boolean;
  readonly defaultDegraded?: boolean;
}): ReadonlyArray<ImageManipulationSliceResilienceDiagnostic> {
  if (input.diagnostics && input.diagnostics.length > 0) {
    return Object.freeze(input.diagnostics.map((entry) => Object.freeze({
      code: normalizeOptional(entry.code) ?? input.defaultCode,
      category: entry.category,
      summary: normalizeOptional(entry.summary) ?? input.defaultSummary,
      retryable: entry.retryable,
      degraded: entry.degraded,
      recoveryKind: normalizeOptional(entry.recoveryKind),
      retryAfterMs: normalizeNumber(entry.retryAfterMs),
      scope: normalizeOptional(entry.scope),
      state: normalizeOptional(entry.state),
    })));
  }

  const detailsBased = deriveFromKnownFailureEnvelope(input.details);
  if (detailsBased.length > 0) {
    return detailsBased;
  }

  return Object.freeze([Object.freeze({
    code: input.defaultCode,
    category: input.defaultCategory ?? "unknown",
    summary: input.defaultSummary,
    retryable: input.defaultRetryable,
    degraded: input.defaultDegraded,
  })]);
}

function deriveFromKnownFailureEnvelope(
  details: unknown,
): ReadonlyArray<ImageManipulationSliceResilienceDiagnostic> {
  const record = asRecord(details);
  if (!record) {
    return Object.freeze([]);
  }

  const imageFailure = asRecord(record.imageManipulationFailure);
  if (!imageFailure) {
    return Object.freeze([]);
  }

  const classification = asRecord(imageFailure.classification);
  const recovery = asRecord(imageFailure.recovery);
  const resilience = asRecord(imageFailure.resilience);

  const code = normalizeOptional(asString(classification?.issueCode))
    ?? normalizeOptional(asString(record.code))
    ?? "im.slice.operational.unknown";
  const summary = normalizeOptional(asString(classification?.reason))
    ?? normalizeOptional(asString(resilience?.summary))
    ?? normalizeOptional(asString(record.message))
    ?? "Image manipulation operation reported a normalized failure.";
  const retryable = asBoolean(recovery?.retryEligible) ?? asBoolean(record.retryable);
  const degraded = asBoolean(classification?.degraded);
  const scope = normalizeOptional(asString(resilience?.scope));
  const state = normalizeOptional(asString(resilience?.state));
  const recoveryKind = normalizeOptional(asString(resilience?.recoveryKind));
  const retryAfterMs = normalizeNumber(asNumber(recovery?.retryAfterMs) ?? asNumber(resilience?.recoveryRetryAfterMs));
  const category = resolveCategory(
    normalizeOptional(asString(classification?.kind)),
    normalizeOptional(asString(classification?.summaryCategory)),
    degraded,
  );

  return Object.freeze([Object.freeze({
    code,
    category,
    summary,
    retryable,
    degraded,
    recoveryKind,
    retryAfterMs,
    scope,
    state,
  })]);
}

function resolveCategory(
  kind: string | undefined,
  summaryCategory: string | undefined,
  degraded: boolean | undefined,
): ImageManipulationSliceResilienceDiagnostic["category"] {
  if (kind === "validation") {
    return "validation";
  }
  if (degraded || summaryCategory === "connectivity" || summaryCategory === "output") {
    return "degraded";
  }
  if (kind === "operational") {
    return "operational";
  }
  return "unknown";
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeNumber(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

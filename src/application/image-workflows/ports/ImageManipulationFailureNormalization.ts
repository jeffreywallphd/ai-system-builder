import {
  ImageManipulationFailureDispositions,
  ImageManipulationFailureSummaryCategories,
  ImageManipulationIssueKinds,
  ImageManipulationIssueLayers,
  createImageManipulationIssueClassification,
  type ImageManipulationIssueClassification,
} from "@shared/contracts/image-workflows/ImageManipulationValidationFailureTaxonomy";
import {
  ImageManipulationExecutionFailureCategories,
  type ImageManipulationExecutionFailure,
  type ImageManipulationExecutionFailureCategory,
} from "./ImageManipulationExecutionStatusContracts";

export const ImageManipulationFailureNormalizationSources = Object.freeze({
  dispatch: "dispatch",
  progressPolling: "progress-polling",
  outputCollection: "output-collection",
});

export type ImageManipulationFailureNormalizationSource =
  typeof ImageManipulationFailureNormalizationSources[keyof typeof ImageManipulationFailureNormalizationSources];

export interface NormalizeImageManipulationExecutionFailureInput {
  readonly source: ImageManipulationFailureNormalizationSource;
  readonly failedAt: string;
  readonly backendStatusCode?: string;
  readonly backendErrorCode?: string;
  readonly rawMessage?: string;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
  readonly stageCode?: string;
  readonly state?: "failed" | "cancelled";
  readonly partialOutputCount?: number;
  readonly partialProgressObserved?: boolean;
}

const connectivityTokens = Object.freeze([
  "transport-unavailable",
  "econn",
  "network",
  "unreachable",
  "offline",
  "connection",
  "dns",
  "socket",
]);

const timeoutTokens = Object.freeze([
  "timeout",
  "timed out",
  "deadline",
  "request-timeout",
  "gateway timeout",
]);

const missingModelTokens = Object.freeze([
  "missing-model",
  "missing model",
  "checkpoint",
  "model not found",
  "lora not found",
  "vae not found",
]);

const translationTokens = Object.freeze([
  "translation",
  "slot-binding",
  "binding",
  "template",
  "invalid prompt",
  "prompt graph",
  "missing translated request",
  "comfy.request",
  "backend field",
  "output mapping",
  "parameter mapping",
  "unsupported-template-id",
]);

const invalidDataTokens = Object.freeze([
  "invalid-request",
  "invalid response",
  "invalid-response",
  "invalid",
  "malformed",
  "unprocessable",
  "bad request",
  "schema",
  "payload",
]);

const outputTokens = Object.freeze([
  "output",
  "persist",
  "collection",
  "materializ",
  "lineage",
]);

export function normalizeImageManipulationExecutionFailure(
  input: NormalizeImageManipulationExecutionFailureInput,
): ImageManipulationExecutionFailure {
  const partialOutputCount = clampNonNegativeInteger(input.partialOutputCount) ?? 0;
  const normalizedText = toNormalizedText(input);

  const category = classifyCategory({
    normalizedText,
    source: input.source,
    state: input.state,
    partialOutputCount,
  });
  const code = resolveCode(category, input.source, normalizedText, partialOutputCount);
  const retryable = resolveRetryable(category, code);
  const summary = resolveSummary(category, code, partialOutputCount);
  const userMessage = resolveUserMessage(category, code, retryable, partialOutputCount);
  const classification = resolveFailureClassification({
    category,
    code,
    retryable,
    stageCode: normalizeOptional(input.stageCode) ?? resolveStageCode(input.source, category, input.state),
  });
  const diagnostics = buildDiagnostics(input);

  return Object.freeze({
    code,
    category,
    summary,
    userMessage,
    retryable,
    failedAt: input.failedAt,
    stageCode: normalizeOptional(input.stageCode) ?? resolveStageCode(input.source, category, input.state),
    partialProgressObserved: Boolean(input.partialProgressObserved),
    partialOutputCount,
    classification,
    diagnostics,
  });
}

export function sanitizeImageManipulationDiagnostics(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }
  return sanitizeRecord(details);
}

function resolveStageCode(
  source: ImageManipulationFailureNormalizationSource,
  category: ImageManipulationExecutionFailureCategory,
  state: "failed" | "cancelled" | undefined,
): string {
  if (state === "cancelled" || category === ImageManipulationExecutionFailureCategories.cancellation) {
    return "cancelled";
  }
  if (source === ImageManipulationFailureNormalizationSources.dispatch) {
    return "dispatch";
  }
  if (source === ImageManipulationFailureNormalizationSources.outputCollection) {
    return "output-collection";
  }
  return "execution";
}

function classifyCategory(input: {
  readonly normalizedText: string;
  readonly source: ImageManipulationFailureNormalizationSource;
  readonly state?: "failed" | "cancelled";
  readonly partialOutputCount: number;
}): ImageManipulationExecutionFailureCategory {
  if (input.state === "cancelled" || input.normalizedText.includes("cancel")) {
    return ImageManipulationExecutionFailureCategories.cancellation;
  }
  if (containsAny(input.normalizedText, timeoutTokens)) {
    return ImageManipulationExecutionFailureCategories.timeout;
  }
  if (containsAny(input.normalizedText, connectivityTokens)) {
    return ImageManipulationExecutionFailureCategories.connectivity;
  }
  if (containsAny(input.normalizedText, missingModelTokens)) {
    return ImageManipulationExecutionFailureCategories.dependency;
  }
  if (containsAny(input.normalizedText, translationTokens)) {
    return ImageManipulationExecutionFailureCategories.translation;
  }
  if (
    input.source === ImageManipulationFailureNormalizationSources.outputCollection
    || input.partialOutputCount > 0
    || containsAny(input.normalizedText, outputTokens)
  ) {
    if (containsAny(input.normalizedText, outputTokens) || input.partialOutputCount > 0) {
      return ImageManipulationExecutionFailureCategories.output;
    }
  }
  if (containsAny(input.normalizedText, invalidDataTokens)) {
    return ImageManipulationExecutionFailureCategories.validation;
  }
  return ImageManipulationExecutionFailureCategories.execution;
}

function resolveCode(
  category: ImageManipulationExecutionFailureCategory,
  source: ImageManipulationFailureNormalizationSource,
  normalizedText: string,
  partialOutputCount: number,
): string {
  if (category === ImageManipulationExecutionFailureCategories.cancellation) {
    return source === ImageManipulationFailureNormalizationSources.dispatch
      ? "dispatch-cancelled"
      : "execution-cancelled";
  }
  if (category === ImageManipulationExecutionFailureCategories.timeout) {
    return source === ImageManipulationFailureNormalizationSources.dispatch
      ? "dispatch-timeout"
      : "execution-timeout";
  }
  if (category === ImageManipulationExecutionFailureCategories.connectivity) {
    return source === ImageManipulationFailureNormalizationSources.dispatch
      ? "dispatch-connectivity-failed"
      : "execution-connectivity-failed";
  }
  if (category === ImageManipulationExecutionFailureCategories.dependency) {
    return "execution-missing-model-dependency";
  }
  if (category === ImageManipulationExecutionFailureCategories.translation) {
    return source === ImageManipulationFailureNormalizationSources.dispatch
      ? "dispatch-translation-mismatch"
      : "execution-translation-mismatch";
  }
  if (category === ImageManipulationExecutionFailureCategories.validation) {
    return source === ImageManipulationFailureNormalizationSources.dispatch
      ? "dispatch-invalid-request-data"
      : "execution-invalid-request-data";
  }
  if (category === ImageManipulationExecutionFailureCategories.output) {
    if (partialOutputCount > 0 || normalizedText.includes("partial")) {
      return "output-collection-partial-anomaly";
    }
    return "output-collection-failed";
  }
  return source === ImageManipulationFailureNormalizationSources.dispatch
    ? "dispatch-execution-failed"
    : "execution-failed";
}

function resolveRetryable(
  category: ImageManipulationExecutionFailureCategory,
  code: string,
): boolean {
  if (category === ImageManipulationExecutionFailureCategories.timeout) {
    return true;
  }
  if (category === ImageManipulationExecutionFailureCategories.connectivity) {
    return true;
  }
  if (category === ImageManipulationExecutionFailureCategories.capacity) {
    return true;
  }
  if (category === ImageManipulationExecutionFailureCategories.output && code === "output-collection-partial-anomaly") {
    return true;
  }
  return false;
}

function resolveFailureClassification(input: {
  readonly category: ImageManipulationExecutionFailureCategory;
  readonly code: string;
  readonly retryable: boolean;
  readonly stageCode: string;
}): ImageManipulationIssueClassification {
  const layer = resolveFailureLayer(input.category, input.stageCode);
  const reason = input.code;
  const kind = input.category === ImageManipulationFailureSummaryCategories.validation
    || input.category === ImageManipulationFailureSummaryCategories.translation
    ? ImageManipulationIssueKinds.validation
    : ImageManipulationIssueKinds.operational;
  const degraded = input.retryable
    || input.category === ImageManipulationFailureSummaryCategories.connectivity
    || input.category === ImageManipulationFailureSummaryCategories.capacity
    || input.category === ImageManipulationFailureSummaryCategories.timeout
    || input.category === ImageManipulationFailureSummaryCategories.output;
  const userFixable = kind === ImageManipulationIssueKinds.validation;
  return createImageManipulationIssueClassification({
    layer,
    kind,
    summaryCategory: input.category,
    disposition: input.retryable
      ? ImageManipulationFailureDispositions.retryable
      : ImageManipulationFailureDispositions.terminal,
    reason,
    userFixable,
    degraded,
  });
}

function resolveFailureLayer(
  category: ImageManipulationExecutionFailureCategory,
  stageCode: string,
) {
  if (stageCode === "output-collection") {
    return ImageManipulationIssueLayers.resultCollection;
  }
  if (stageCode === "dispatch") {
    return ImageManipulationIssueLayers.executionDispatch;
  }
  if (category === ImageManipulationFailureSummaryCategories.connectivity
    || category === ImageManipulationFailureSummaryCategories.capacity
    || category === ImageManipulationFailureSummaryCategories.timeout
    || category === ImageManipulationFailureSummaryCategories.dependency) {
    return ImageManipulationIssueLayers.nodeAvailability;
  }
  if (category === ImageManipulationFailureSummaryCategories.validation
    || category === ImageManipulationFailureSummaryCategories.translation) {
    return ImageManipulationIssueLayers.runReadiness;
  }
  return ImageManipulationIssueLayers.executionDispatch;
}

function resolveSummary(
  category: ImageManipulationExecutionFailureCategory,
  code: string,
  partialOutputCount: number,
): string {
  if (category === ImageManipulationExecutionFailureCategories.cancellation) {
    return "Execution was cancelled.";
  }
  if (category === ImageManipulationExecutionFailureCategories.timeout) {
    return "Execution timed out before completion.";
  }
  if (category === ImageManipulationExecutionFailureCategories.connectivity) {
    return "Execution backend could not be reached.";
  }
  if (category === ImageManipulationExecutionFailureCategories.dependency) {
    return "Required model dependency is unavailable.";
  }
  if (category === ImageManipulationExecutionFailureCategories.translation) {
    return "Execution graph translation does not match backend requirements.";
  }
  if (category === ImageManipulationExecutionFailureCategories.validation) {
    return "Execution request data is invalid.";
  }
  if (category === ImageManipulationExecutionFailureCategories.output) {
    if (code === "output-collection-partial-anomaly" || partialOutputCount > 0) {
      return "Execution produced partial outputs but output collection did not finish.";
    }
    return "Output collection failed after execution.";
  }
  return "Execution failed.";
}

function resolveUserMessage(
  category: ImageManipulationExecutionFailureCategory,
  code: string,
  retryable: boolean,
  partialOutputCount: number,
): string {
  if (category === ImageManipulationExecutionFailureCategories.cancellation) {
    return "The run was cancelled before it finished.";
  }
  if (category === ImageManipulationExecutionFailureCategories.timeout) {
    return "The run took too long and stopped before finishing.";
  }
  if (category === ImageManipulationExecutionFailureCategories.connectivity) {
    return "The backend is currently unreachable. Try again.";
  }
  if (category === ImageManipulationExecutionFailureCategories.dependency) {
    return "A required model is unavailable in the selected runtime.";
  }
  if (category === ImageManipulationExecutionFailureCategories.translation) {
    return "The workflow could not be prepared for backend execution.";
  }
  if (category === ImageManipulationExecutionFailureCategories.validation) {
    return "Execution request data is invalid. Review workflow bindings and inputs.";
  }
  if (category === ImageManipulationExecutionFailureCategories.output) {
    if (code === "output-collection-partial-anomaly" || partialOutputCount > 0) {
      return "Some outputs were generated, but collection did not complete.";
    }
    return "Outputs could not be collected after execution.";
  }
  if (retryable) {
    return "The run stopped before finishing. Try again.";
  }
  return "The run stopped before finishing.";
}

function buildDiagnostics(
  input: NormalizeImageManipulationExecutionFailureInput,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    source: input.source,
    stageCode: normalizeOptional(input.stageCode),
    backendStatusCode: normalizeOptional(input.backendStatusCode),
    backendErrorCode: normalizeOptional(input.backendErrorCode),
    rawMessage: sanitizeString(input.rawMessage),
    details: sanitizeRecord(input.diagnostics ?? {}),
  });
}

function toNormalizedText(input: NormalizeImageManipulationExecutionFailureInput): string {
  const pieces = [
    input.backendStatusCode,
    input.backendErrorCode,
    input.rawMessage,
    input.stageCode,
    ...collectSignals(input.diagnostics),
  ];
  return pieces
    .map((value) => value?.toLowerCase())
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ");
}

function collectSignals(
  value: Readonly<Record<string, unknown>> | undefined,
  depth = 0,
): ReadonlyArray<string> {
  if (!value || depth > 2) {
    return Object.freeze([]);
  }
  const collected: string[] = [];
  for (const candidate of Object.values(value)) {
    if (typeof candidate === "string") {
      const normalized = candidate.trim();
      if (normalized) {
        collected.push(normalized);
      }
      continue;
    }
    if (Array.isArray(candidate)) {
      for (const entry of candidate.slice(0, 10)) {
        if (typeof entry === "string" && entry.trim()) {
          collected.push(entry.trim());
        } else if (entry && typeof entry === "object") {
          collected.push(...collectSignals(entry as Readonly<Record<string, unknown>>, depth + 1));
        }
      }
      continue;
    }
    if (candidate && typeof candidate === "object") {
      collected.push(...collectSignals(candidate as Readonly<Record<string, unknown>>, depth + 1));
    }
  }
  return Object.freeze(collected);
}

function containsAny(text: string, tokens: ReadonlyArray<string>): boolean {
  for (const token of tokens) {
    if (text.includes(token)) {
      return true;
    }
  }
  return false;
}

function sanitizeRecord(
  input: Readonly<Record<string, unknown>>,
  depth = 0,
): Readonly<Record<string, unknown>> {
  if (depth > 3) {
    return Object.freeze({});
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    sanitized[key] = sanitizeValue(value, depth + 1);
  }
  return Object.freeze(sanitized);
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (typeof value === "string") {
    return sanitizeString(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.slice(0, 20).map((entry) => sanitizeValue(entry, depth)));
  }
  if (value && typeof value === "object") {
    return sanitizeRecord(value as Readonly<Record<string, unknown>>, depth);
  }
  return undefined;
}

function sanitizeString(value: string | undefined): string | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }
  let redacted = normalized;
  redacted = redacted.replace(/[A-Za-z]:\\[^\s"'`]+/g, "[redacted-path]");
  redacted = redacted.replace(/\bfile:(\/\/)?[^\s"'`]+/gi, "[redacted-file-uri]");
  redacted = redacted.replace(/(?:^|[\s"'`])\/(?:[^/\s"'`]+\/)+[^/\s"'`]*/g, " [redacted-path]");
  redacted = redacted.replace(
    /\b(token|secret|authorization|api[_-]?key|password)\b\s*[:=]\s*([^\s,;]+)/gi,
    "$1=[redacted]",
  );
  if (redacted.length > 400) {
    return `${redacted.slice(0, 397)}...`;
  }
  return redacted;
}

function clampNonNegativeInteger(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  if (value < 0) {
    return 0;
  }
  return Math.floor(value);
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

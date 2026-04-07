import {
  UnifiedIngestionIssueCodes,
  type UnifiedIngestionDetectionResult,
  type UnifiedIngestionIssue,
  type UnifiedIngestionRouteResult,
} from "@domain/dataset-studio/UnifiedIngestionDomain";

export const UnifiedIngestionFailureDispositions = Object.freeze({
  recoverable: "recoverable",
  terminal: "terminal",
} as const);

export type UnifiedIngestionFailureDisposition =
  typeof UnifiedIngestionFailureDispositions[keyof typeof UnifiedIngestionFailureDispositions];

export const UnifiedIngestionExecutionStages = Object.freeze({
  configuration: "configuration",
  sourceRead: "source-read",
  detection: "detection",
  routing: "routing",
  ingestion: "ingestion",
  conversion: "conversion",
  normalization: "normalization",
  preview: "preview",
} as const);

export type UnifiedIngestionExecutionStage =
  typeof UnifiedIngestionExecutionStages[keyof typeof UnifiedIngestionExecutionStages];

export const UnifiedIngestionFallbackDecisionKinds = Object.freeze({
  detectionTieBreaker: "detection-tie-breaker",
  unknownRouteFallback: "unknown-route-fallback",
  unknownRouteUnavailable: "unknown-route-unavailable",
  degradedPreview: "degraded-preview",
  partialMetadata: "partial-metadata",
} as const);

export type UnifiedIngestionFallbackDecisionKind =
  typeof UnifiedIngestionFallbackDecisionKinds[keyof typeof UnifiedIngestionFallbackDecisionKinds];

export interface UnifiedIngestionFallbackDecision {
  readonly kind: UnifiedIngestionFallbackDecisionKind;
  readonly stage: UnifiedIngestionExecutionStage;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface UnifiedIngestionFailureClassification {
  readonly stage: UnifiedIngestionExecutionStage;
  readonly disposition: UnifiedIngestionFailureDisposition;
  readonly code: string;
  readonly message: string;
}

function isRecoverableCode(code: UnifiedIngestionIssue["code"]): boolean {
  return code === UnifiedIngestionIssueCodes.invalidConfiguration
    || code === UnifiedIngestionIssueCodes.invalidSourceReference
    || code === UnifiedIngestionIssueCodes.sourceReadFailed
    || code === UnifiedIngestionIssueCodes.routingUnavailable
    || code === UnifiedIngestionIssueCodes.routingUnsupported
    || code === UnifiedIngestionIssueCodes.previewGenerationFailed
    || code === UnifiedIngestionIssueCodes.emptyNormalizedOutput
    || code === UnifiedIngestionIssueCodes.partialNormalizedOutput;
}

export function classifyUnifiedIngestionFailure(input: {
  readonly stage: UnifiedIngestionExecutionStage;
  readonly issues: ReadonlyArray<UnifiedIngestionIssue>;
}): UnifiedIngestionFailureClassification {
  const firstIssue = input.issues[0];
  const code = firstIssue?.code ?? UnifiedIngestionIssueCodes.ingestionFailed;
  const message = firstIssue?.message ?? "Unified ingestion failed.";
  return Object.freeze({
    stage: input.stage,
    disposition: isRecoverableCode(code)
      ? UnifiedIngestionFailureDispositions.recoverable
      : UnifiedIngestionFailureDispositions.terminal,
    code,
    message,
  });
}

export function deriveUnifiedIngestionFallbackDecisions(input: {
  readonly detection?: UnifiedIngestionDetectionResult;
  readonly route?: UnifiedIngestionRouteResult;
  readonly previewDegraded?: boolean;
  readonly includePartialMetadataFallback?: boolean;
}): ReadonlyArray<UnifiedIngestionFallbackDecision> {
  const decisions: UnifiedIngestionFallbackDecision[] = [];

  const conflictEvidence = input.detection?.evidence.find((entry) => entry.kind === "conflict-resolution");
  if (conflictEvidence) {
    decisions.push(Object.freeze({
      kind: UnifiedIngestionFallbackDecisionKinds.detectionTieBreaker,
      stage: UnifiedIngestionExecutionStages.detection,
      message: "Detection conflict was resolved by deterministic score tie-breaking.",
      details: conflictEvidence.details,
    }));
  }

  if (input.route?.status === "resolved" && input.route.fallbackUsed) {
    decisions.push(Object.freeze({
      kind: UnifiedIngestionFallbackDecisionKinds.unknownRouteFallback,
      stage: UnifiedIngestionExecutionStages.routing,
      message: input.route.reason,
      details: Object.freeze({
        policy: input.route.policy,
        handlerKind: input.route.handlerKind,
      }),
    }));
  }

  if (input.route?.status === "unsupported" && input.route.fallbackUsed) {
    decisions.push(Object.freeze({
      kind: UnifiedIngestionFallbackDecisionKinds.unknownRouteUnavailable,
      stage: UnifiedIngestionExecutionStages.routing,
      message: input.route.reason,
      details: Object.freeze({
        failureCode: input.route.failureCode,
      }),
    }));
  }

  if (input.previewDegraded) {
    decisions.push(Object.freeze({
      kind: UnifiedIngestionFallbackDecisionKinds.degradedPreview,
      stage: UnifiedIngestionExecutionStages.preview,
      message: "Preview generation degraded to a fallback preview model.",
    }));
  }

  if (input.includePartialMetadataFallback) {
    decisions.push(Object.freeze({
      kind: UnifiedIngestionFallbackDecisionKinds.partialMetadata,
      stage: UnifiedIngestionExecutionStages.preview,
      message: "Partial metadata was returned despite terminal execution state.",
    }));
  }

  return Object.freeze(decisions);
}

